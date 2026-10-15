// `npm run short -- trailer v1.0 v2.0`: the trailer, design "A" (prompt 21), in tools/short/trailer.html
// (1080 x 1920): one full-width panel, the premise in a band at the top, the time-to-first-apple counter
// under the game. Each version replays its median measured run (as the shorts do) on its own virtual clock,
// from the same seed. The host's lines are voice/HOST.md's "trailer" (1a, 1b, 2 to 5).
//   1  v1.0 from its first drawn frame, line 1a at 0 s; once its apple is eaten the frame holds, the counter
//      stopped on v1.0's median, line 2 ("Done.") after 1a, held until 2 ends plus TRAILER.holdAfterDoneMs.
//   2  a hard cut to black with a TRAILER.stingMs sting of our own (made by ffmpeg from a formula, STING),
//      then the card "Patch 2.0" with line 1b over it, until 1b ends (plus HOST_GAP_MS).
//   3  v2.0 from its first drawn frame, sped up for the length of line 3: the largest step of 0.05x that keeps
//      the part at least as long as the line, the factor in the corner; the counter runs.
//   4  real time from TRAILER.beforeCabinetMs before the cabinet is reached (its door shows): line 4, Enter, the
//      inner apple, Warden Snek's line, THE END, until TRAILER.afterEndMs after THE END. Line 4 must end
//      HOST_GAP_MS before Snek starts.
//   5  a freeze on THE END with line 5, as long as line 5 plus HOST_GAP_MS (prompt 22); then the file ends.
// Output in out/shorts/trailer/: trailer-<left>-<right>.mp4, frames/, first/middle/last.png, sting.wav, clip.json.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import {
  WIDTH, HEIGHT, FPS, SAFE, PREMISE, MAX_APPLE_DRIFT_MS, HOST_GAP_MS, formatTime, speedText, audioMs, encodeShort, ffmpegVersion,
  loadForShort, hostLines, checkNoOverlap,
} from './short.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const TRAILER = { holdAfterDoneMs: 400, stingMs: 500, beforeCabinetMs: 4000, afterEndMs: 1000 };
// The sting: a low thump falling in pitch, with a short high ping on top; 44.1 kHz mono, made by ffmpeg.
export const STING = '0.6*sin(2*PI*t*(55+165*exp(-6*t)))*exp(-5*t)+0.25*sin(2*PI*880*t)*exp(-25*t)';

const firstFrame = v => {
  const f = v.raw.log.find(e => e.type === 'frame');
  if (!f) throw new Error(`${v.version}: the run has no drawn frame`);
  return f.t;
};
const screenAt = (v, name) => {
  const e = v.raw.log.find(x => x.type === 'screen' && x.name === name);
  if (!e) throw new Error(`${v.version}: the run never shows ${name}`);
  return e.t;
};

// The five parts in clip time, and where each host line (and the sting) starts.
// host: { '1a': { ms, file, id }, '1b': ..., '2': ..., '3': ..., '4': ..., '5': ... }
export function trailerTimeline(left, right, host, t = TRAILER) {
  if (!right.firstLine) throw new Error(`${right.version}: no Warden Snek line after the apple`);
  const f1 = firstFrame(left);
  const f2 = firstFrame(right);
  const oneMs = host['1a'].ms + HOST_GAP_MS + host['2'].ms + t.holdAfterDoneMs;
  if (left.apple - f1 >= oneMs) throw new Error(`${left.version}: the apple comes after the hold would end`);
  const fourFrom = screenAt(right, 'cabinet-door') - t.beforeCabinetMs;
  const snekAt = right.apple + right.firstLine.afterAppleMs;
  if (fourFrom + host['4'].ms + HOST_GAP_MS > snekAt) throw new Error(`host line 4 (${host['4'].ms} ms) would not end before Warden Snek's line`);
  const theEnd = screenAt(right, 'the-end');
  const span = fourFrom - f2;
  const speed = Math.max(1, Math.floor((span / host['3'].ms) * 20 + 1e-9) / 20);
  const parts = [
    { name: '1 v1.0', kind: 'game', who: 'left', runFrom: f1, clipMs: oneMs, speed: 1, holdOnApple: true },
    { name: '2a black', kind: 'black', clipMs: t.stingMs },
    { name: '2b card', kind: 'card', clipMs: host['1b'].ms + HOST_GAP_MS },
    { name: '3 v2.0 sped up', kind: 'game', who: 'right', runFrom: f2, clipMs: span / speed, speed },
    { name: '4 v2.0 real time', kind: 'game', who: 'right', runFrom: fourFrom, clipMs: theEnd + t.afterEndMs - fourFrom, speed: 1 },
    { name: '5 freeze', kind: 'freeze', who: 'right', clipMs: host['5'].ms + HOST_GAP_MS }, // line 5 plus 300 ms (prompt 22)
  ];
  let at = 0;
  for (const p of parts) {
    p.clipFrom = at;
    at += p.clipMs;
    if (p.kind === 'game') p.runTo = p.runFrom + p.clipMs * p.speed;
  }
  const [one, black, card, three, four, five] = parts;
  const said = (key, clipAtMs, part) => ({ who: 'host', line: host[key].id, file: host[key].file, clipAtMs, lengthMs: host[key].ms, heardMs: host[key].ms, segment: part.name });
  parts.host = [
    said('1a', 0, one), said('2', host['1a'].ms + HOST_GAP_MS, one), said('1b', card.clipFrom, card),
    said('3', three.clipFrom, three), said('4', four.clipFrom, four), said('5', five.clipFrom, five),
  ];
  parts.sting = { who: 'sting', line: 'sting', clipAtMs: black.clipFrom, lengthMs: t.stingMs, heardMs: t.stingMs, segment: black.name };
  return parts;
}

// What the counter says at run time t: the run clock until the version's first apple, then its measured median.
export function trailerCounter(v, appleAt, t, name) {
  const eaten = appleAt !== null && appleAt <= t;
  return { label: `${name}: first apple in`, value: formatTime(eaten ? v.median : Math.min(t, v.median)), frozen: eaten };
}

// Text: inside the safe area and not spilling out of its box. The game panels: inside the frame.
export const TRAILER_TEXT = ['premise', 'speed', 'cardtext', 'counter', 'label', 'value'];
export const TRAILER_PANELS = ['left', 'right', 'card'];
export async function checkSafeAreaOf(page, ids = TRAILER_TEXT, panels = TRAILER_PANELS) {
  const rects = await page.evaluate(({ ids, panels, right, bottom, width, height }) => [
    ...ids.map(id => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      const spills = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
      return { id, inside: r.right <= right && r.bottom <= bottom && !spills };
    }),
    ...panels.map(id => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { id, inside: r.left >= 0 && r.top >= 0 && r.right <= width && r.bottom <= height };
    }),
  ], { ids, panels, ...SAFE, width: WIDTH, height: HEIGHT });
  const outside = rects.filter(r => !r.inside);
  if (outside.length) throw new Error(`trailer layout outside the safe area or text spilling out: ${outside.map(r => r.id).join(', ')}`);
}

export function makeSting(file, ms = TRAILER.stingMs) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `aevalsrc=${STING}:s=44100:d=${ms / 1000}`, '-ac', '1', file]);
  return file;
}

export async function recordTrailer({ left, right, host, distDirs, outDir, frameLimit = Infinity, encode = true, log = console.log }) {
  const parts = trailerTimeline(left, right, host);
  const clipMs = parts.reduce((sum, p) => sum + p.clipMs, 0);
  const frames = Math.min(Math.ceil((clipMs * FPS) / 1000), frameLimit);
  const framesDir = path.join(outDir, 'frames');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  const server = await startServer({ '/left': distDirs.left, '/right': distDirs.right, '/_short': path.join(ROOT, 'tools/short') });
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const panes = { left: { id: 'left', v: left, apple: null, now: 0, plays: [], hold: null }, right: { id: 'right', v: right, apple: null, now: 0, plays: [] } };
  const frameFile = f => path.join(framesDir, `${String(f + 1).padStart(5, '0')}.png`);
  let browserVersion = null;
  try {
    browserVersion = browser.version();
    const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
    await context.addInitScript({ path: path.join(ROOT, 'tools/short/vclock.js') });
    const page = await context.newPage();
    await page.goto(`${server.url}/_short/trailer.html`);
    await page.evaluate(([premise, card]) => { window.trailer.setPremise(premise); window.trailer.setCard(card); }, [PREMISE, `Patch ${right.version.replace(/^v/, '')}`]);
    for (const pane of Object.values(panes)) {
      await page.evaluate(({ id, src }) => window.trailer.load(id, src), { id: pane.id, src: `/${pane.id}/index.html?seed=${pane.v.seed}` });
      await page.waitForFunction(id => { const w = document.getElementById(id).contentWindow; return w && w.__vclock && w.snakeGame; }, pane.id);
      await page.evaluate(({ id, keys, frames: f }) => document.getElementById(id).contentWindow.__vclock.replay(keys, f), { id: pane.id, keys: pane.v.raw.keys, frames: pane.v.raw.frames || [] });
    }
    // Move a pane to run time t, at most 100 ms of virtual time per step, so real loads can finish in between.
    const advance = async (pane, t) => {
      while (pane.now < t) {
        const to = Math.min(t, pane.now + 100);
        const apple = await page.evaluate(({ id, to }) => {
          const w = document.getElementById(id).contentWindow;
          w.__vclock.advanceTo(to);
          const a = w.snakeGame.log.find(e => e.type === 'apple');
          return a ? a.t : null;
        }, { id: pane.id, to });
        pane.now = to;
        if (apple !== null && pane.apple === null) pane.apple = apple;
      }
    };
    for (let f = 0; f < frames; f++) {
      const t = (f * 1000) / FPS;
      const part = parts.find(p => t >= p.clipFrom && t < p.clipFrom + p.clipMs) || parts[parts.length - 1];
      if (part.kind === 'freeze' && f > 0) { // the frame before, held
        fs.copyFileSync(frameFile(f - 1), frameFile(f));
        continue;
      }
      let show = part.kind === 'game' ? part.who : part.kind;
      let counter = null;
      let speed = '';
      if (part.kind === 'game') {
        const pane = panes[part.who];
        let runT = part.runFrom + (t - part.clipFrom) * part.speed;
        if (part.holdOnApple && pane.hold !== null) runT = pane.hold; // part 1: the frame holds once the apple is eaten
        await advance(pane, runT);
        if (part.holdOnApple && pane.hold === null && pane.apple !== null && pane.apple <= runT) pane.hold = runT;
        counter = trailerCounter(pane.v, pane.apple, runT, part.who === 'left' ? `Snake (${left.version})` : `AAA Snake (${right.version})`);
        if (part.speed > 1) speed = speedText(part.speed);
      }
      await page.evaluate(({ show, counter, speed }) => {
        window.trailer.show(show);
        window.trailer.setCounter(counter);
        window.trailer.setSpeed(speed);
      }, { show, counter, speed });
      await checkSafeAreaOf(page);
      await page.screenshot({ path: frameFile(f) });
      if ((f + 1) % 90 === 0 || f === frames - 1) log(`  frame ${f + 1}/${frames}`);
    }
    for (const pane of Object.values(panes)) {
      pane.plays = await page.evaluate(id => {
        const w = document.getElementById(id).contentWindow;
        const urls = w.eval('typeof voice === "undefined" ? {} : voice.urls');
        const lineOf = Object.fromEntries(Object.entries(urls).map(([line, url]) => [url, Number(line)]));
        return w.__vclock.plays().map(p => ({ ...p, line: lineOf[p.src] ?? null }));
      }, pane.id);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  if (frameLimit === Infinity) {
    for (const pane of Object.values(panes)) {
      if (pane.apple === null || Math.abs(pane.apple - pane.v.apple) > MAX_APPLE_DRIFT_MS) {
        throw new Error(`${pane.v.version}: the replayed first apple (${pane.apple} ms) is more than ${MAX_APPLE_DRIFT_MS} ms from the recorded one (${pane.v.apple} ms)`);
      }
    }
  }
  // Sound: Warden Snek's lines that start in a real-time part of v2.0, at their recorded length.
  const voice = [];
  for (const part of parts.filter(p => p.kind === 'game' && p.who === 'right' && p.speed === 1)) {
    for (const p of panes.right.plays.filter(x => x.line !== null && x.t >= part.runFrom && x.t < part.runTo)) {
      const file = path.join(distDirs.right, 'voice', `${String(p.line).padStart(2, '0')}.mp3`);
      const lengthMs = audioMs(file);
      const clipAtMs = part.clipFrom + (p.t - part.runFrom);
      voice.push({ version: right.version, segment: part.name, line: p.line, file, runAtMs: p.t, clipAtMs, lengthMs, heardMs: Math.min(lengthMs, part.clipFrom + part.clipMs - clipAtMs) });
    }
  }
  const sting = { ...parts.sting, file: makeSting(path.join(outDir, 'sting.wav')) };
  const said = frameLimit === Infinity ? parts.host : [];
  checkNoOverlap([...said, sting], voice);
  const names = fs.readdirSync(framesDir).sort();
  const pickFrame = (i, name) => fs.copyFileSync(path.join(framesDir, names[i]), path.join(outDir, name));
  pickFrame(0, 'first.png');
  pickFrame(Math.floor((names.length - 1) / 2), 'middle.png');
  pickFrame(names.length - 1, 'last.png');
  const mp4 = path.join(outDir, `trailer-${left.version}-${right.version}.mp4`);
  if (encode) encodeShort(framesDir, [...voice, ...said, sting], (frames * 1000) / FPS, mp4);
  const clip = {
    trailer: [left.version, right.version], design: 'A (prompt 21)', size: [WIDTH, HEIGHT], fps: FPS, frames, clipMs: (frames * 1000) / FPS,
    parts: parts.map(({ name, kind, who, runFrom, runTo, clipFrom, clipMs: ms, speed }) => ({ name, kind, who: who ? panes[who].v.version : null, runFrom, runTo, clipFrom, clipMs: ms, speed })),
    holdFromRunMs: panes.left.hold,
    apples: Object.fromEntries(Object.values(panes).map(p => [p.v.version, { replayed: p.apple, recorded: p.v.apple, median: p.v.median }])),
    voice: voice.map(({ file, ...v }) => ({ ...v, file: path.relative(ROOT, file) })),
    host: said.map(({ file, ...h }) => ({ ...h, file: path.relative(ROOT, file) })),
    sting: { clipAtMs: sting.clipAtMs, ms: TRAILER.stingMs, made: `ffmpeg -f lavfi -i aevalsrc=${STING}:s=44100:d=${TRAILER.stingMs / 1000}` },
    browser: browserVersion,
    encoder: encode ? ffmpegVersion() : null,
  };
  fs.writeFileSync(path.join(outDir, 'clip.json'), JSON.stringify(clip, null, 2) + '\n');
  return clip;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [l, r] = process.argv.slice(2);
  if (!/^v\d+\.\d+$/.test(l || '') || !/^v\d+\.\d+$/.test(r || '')) {
    console.error('usage: npm run short -- trailer <left> <right>   (like v1.0 v2.0)');
    process.exit(1);
  }
  const left = loadForShort(l);
  const right = loadForShort(r);
  if (left.seed !== right.seed) throw new Error(`${l} was measured with seed ${left.seed}, ${r} with seed ${right.seed}: not the same seed`);
  const host = Object.fromEntries(hostLines('trailer').map(h => [h.id.replace(/^trailer-/, ''), h]));
  console.log(`$ npm run short -- trailer ${l} ${r}   (seed ${left.seed})`);
  const clip = await recordTrailer({
    left, right, host,
    distDirs: { left: path.join(ROOT, 'dist', l), right: path.join(ROOT, 'dist', r) },
    outDir: path.join(ROOT, 'out/shorts/trailer'),
  });
  console.log(`clip: ${clip.frames} frames, ${clip.clipMs} ms`);
  for (const p of clip.parts) console.log(`  ${p.name.padEnd(17)} clip ${p.clipFrom} ms + ${p.clipMs} ms${p.kind === 'game' ? `: ${p.who} run ${p.runFrom} -> ${p.runTo} ms at ${p.speed}x` : ''}`);
  console.log(`part 1 holds from ${clip.holdFromRunMs} ms of v1.0's run`);
  for (const [v, a] of Object.entries(clip.apples)) console.log(`${v}: first apple replayed at ${a.replayed} ms, recorded ${a.recorded} ms, median ${a.median} ms (counter freezes on the median)`);
  for (const h of clip.host) console.log(`host: line ${h.line} (${h.segment}) from ${h.clipAtMs / 1000} s to ${(h.clipAtMs + h.heardMs) / 1000} s of the trailer`);
  console.log(`sting: from ${clip.sting.clipAtMs / 1000} s, ${clip.sting.ms} ms`);
  for (const v of clip.voice) {
    console.log(`sound: ${v.version} line ${v.line} (${v.segment}) from ${v.clipAtMs / 1000} s to ${(v.clipAtMs + v.heardMs) / 1000} s of the trailer, ${v.heardMs} ms heard of ${v.lengthMs} ms${v.heardMs === v.lengthMs ? ' (in full)' : ' (CUT)'}`);
  }
  console.log(`wrote out/shorts/trailer/trailer-${l}-${r}.mp4, frames/, first.png, middle.png, last.png, sting.wav, clip.json`);
}
