// `npm run short -- trailer v1.0 v2.0`: the trailer (prompt 16). v1.0 and v2.0 side by side from the
// same seed, each replaying its measured run (as the shorts do) on one shared virtual clock, in
// tools/short/trailer.html (1080 x 1920). Real time for the first TRAILER.firstMs and the last
// TRAILER.lastMs, which hold v2.0's inner apple, its line and THE END; the middle sped up by the
// smallest step of 0.05x that keeps the whole within TRAILER.totalMs, the factor on screen. Prompt 16
// asked for the first 20 s at real time; with the last 10 s at real time that leaves no middle within
// 30 s, so the first part is 15 s (DEVLOG.md, prompt 16).
// Output in out/shorts/trailer/: trailer-<left>-<right>.mp4, frames/, first/middle/last.png, clip.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import {
  WIDTH, HEIGHT, FPS, SAFE, PREMISE, MAX_APPLE_DRIFT_MS, formatTime, speedText, audioMs, encodeShort, ffmpegVersion, loadForShort,
} from './short.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const TRAILER = { firstMs: 15000, lastMs: 10000, totalMs: 30000, afterEndMs: 1000 };

// The three parts, in run time and clip time. The last part ends TRAILER.afterEndMs after THE END.
export function trailerTimeline(right, t = TRAILER) {
  const theEnd = right.raw.log.find(e => e.type === 'screen' && e.name === 'the-end');
  if (!theEnd) throw new Error(`${right.version}: the run never shows THE END`);
  const lastFrom = theEnd.t + t.afterEndMs - t.lastMs;
  const span = lastFrom - t.firstMs;
  const room = t.totalMs - t.firstMs - t.lastMs;
  const speed = Math.max(1, Math.ceil((span / room) * 20 - 1e-9) / 20);
  const segs = [
    { name: 'first', runFrom: 0, clipMs: t.firstMs, speed: 1 },
    { name: 'middle', runFrom: t.firstMs, clipMs: span / speed, speed },
    { name: 'last', runFrom: lastFrom, clipMs: t.lastMs, speed: 1 },
  ];
  let at = 0;
  for (const seg of segs) {
    seg.clipFrom = at;
    at += seg.clipMs;
    seg.runTo = seg.runFrom + seg.clipMs * seg.speed;
  }
  return segs;
}

// What a counter says at run time t: the run clock until the version's first apple, then its measured value.
export function trailerCounter(v, appleAt, t, name) {
  const eaten = appleAt !== null && appleAt <= t;
  return { label: `${name}: first apple in`, value: formatTime(eaten ? v.median : Math.min(t, v.median)), frozen: eaten };
}

async function checkSafeAreaOf(page, ids) {
  const rects = await page.evaluate(({ ids, right, bottom }) => ids.map(id => {
    const el = document.getElementById(id);
    const r = el.getBoundingClientRect();
    const spills = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
    return { id, inside: r.right <= right && r.bottom <= bottom && !spills };
  }), { ids, ...SAFE });
  const outside = rects.filter(r => !r.inside);
  if (outside.length) throw new Error(`trailer layout outside the safe area or text spilling out: ${outside.map(r => r.id).join(', ')}`);
}

export async function recordTrailer({ left, right, distDirs, outDir, frameLimit = Infinity, encode = true, log = console.log }) {
  const timeline = trailerTimeline(right);
  const clipMs = timeline.reduce((sum, seg) => sum + seg.clipMs, 0);
  const frames = Math.min(Math.round((clipMs * FPS) / 1000), frameLimit);
  const framesDir = path.join(outDir, 'frames');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  const server = await startServer({ '/left': distDirs.left, '/right': distDirs.right, '/_short': path.join(ROOT, 'tools/short') });
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const panes = { left: { id: 'left', v: left, apple: null, now: 0, plays: [] }, right: { id: 'right', v: right, apple: null, now: 0, plays: [] } };
  try {
    const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
    await context.addInitScript({ path: path.join(ROOT, 'tools/short/vclock.js') });
    const page = await context.newPage();
    await page.goto(`${server.url}/_short/trailer.html`);
    await page.evaluate(([premise, l, r]) => window.trailer.setText(premise, l, r), [PREMISE, `Snake (${left.version})`, `AAA Snake (${right.version})`]);
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
      const seg = timeline.find(s => t >= s.clipFrom && t < s.clipFrom + s.clipMs) || timeline[timeline.length - 1];
      const runT = seg.runFrom + (t - seg.clipFrom) * seg.speed;
      await advance(panes.left, runT);
      await advance(panes.right, runT);
      await page.evaluate(({ l, r, speed }) => {
        window.trailer.setCounter('left', l);
        window.trailer.setCounter('right', r);
        window.trailer.setSpeed(speed);
      }, {
        l: trailerCounter(left, panes.left.apple, runT, 'Snake'),
        r: trailerCounter(right, panes.right.apple, runT, 'AAA Snake'),
        speed: seg.speed > 1 ? speedText(seg.speed) : '',
      });
      await checkSafeAreaOf(page, ['premise', 'speed', 'leftname', 'rightname', 'left', 'right', 'leftcounter', 'rightcounter', 'leftlabel', 'rightlabel']);
      await page.screenshot({ path: path.join(framesDir, `${String(f + 1).padStart(5, '0')}.png`) });
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
  // Sound: Warden Snek's lines that start in a real-time part, at their recorded length; nothing in the fast middle.
  const voice = [];
  for (const seg of timeline.filter(s => s.speed === 1)) {
    for (const p of panes.right.plays.filter(x => x.line !== null && x.t >= seg.runFrom && x.t < seg.runTo)) {
      const file = path.join(distDirs.right, 'voice', `${String(p.line).padStart(2, '0')}.mp3`);
      const clipAtMs = seg.clipFrom + (p.t - seg.runFrom);
      const fast = timeline.find(s => s.clipFrom > clipAtMs && s.speed > 1);
      const stopAtMs = Math.min(fast ? fast.clipFrom : clipMs, clipMs);
      const lengthMs = audioMs(file);
      voice.push({ version: right.version, segment: seg.name, line: p.line, file, runAtMs: p.t, clipAtMs, lengthMs, heardMs: Math.min(lengthMs, stopAtMs - clipAtMs) });
    }
  }
  const names = fs.readdirSync(framesDir).sort();
  const pickFrame = (i, name) => fs.copyFileSync(path.join(framesDir, names[i]), path.join(outDir, name));
  pickFrame(0, 'first.png');
  pickFrame(Math.floor((names.length - 1) / 2), 'middle.png');
  pickFrame(names.length - 1, 'last.png');
  const mp4 = path.join(outDir, `trailer-${left.version}-${right.version}.mp4`);
  if (encode) encodeShort(framesDir, voice, (frames * 1000) / FPS, mp4);
  const clip = {
    trailer: [left.version, right.version], size: [WIDTH, HEIGHT], fps: FPS, frames, clipMs: (frames * 1000) / FPS,
    timeline: timeline.map(({ name, runFrom, runTo, clipFrom, clipMs: ms, speed }) => ({ name, runFrom, runTo, clipFrom, clipMs: ms, speed })),
    apples: Object.fromEntries(Object.values(panes).map(p => [p.v.version, { replayed: p.apple, recorded: p.v.apple, median: p.v.median }])),
    voice: voice.map(({ file, ...v }) => ({ ...v, file: path.relative(ROOT, file) })),
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
  console.log(`$ npm run short -- trailer ${l} ${r}   (seed ${left.seed})`);
  const clip = await recordTrailer({
    left, right,
    distDirs: { left: path.join(ROOT, 'dist', l), right: path.join(ROOT, 'dist', r) },
    outDir: path.join(ROOT, 'out/shorts/trailer'),
  });
  console.log(`clip: ${clip.frames} frames, ${clip.clipMs} ms`);
  for (const s of clip.timeline) console.log(`  ${s.name.padEnd(8)} clip ${s.clipFrom} ms + ${s.clipMs} ms: run ${s.runFrom} -> ${s.runTo} ms at ${s.speed}x`);
  for (const [v, a] of Object.entries(clip.apples)) console.log(`${v}: first apple replayed at ${a.replayed} ms, recorded ${a.recorded} ms, median ${a.median} ms (counter freezes on the median)`);
  if (!clip.voice.length) console.log('sound: silence');
  for (const v of clip.voice) {
    console.log(`sound: ${v.version} line ${v.line} (${v.segment}) from ${v.clipAtMs / 1000} s to ${(v.clipAtMs + v.heardMs) / 1000} s of the trailer, ${v.heardMs} ms heard of ${v.lengthMs} ms${v.heardMs === v.lengthMs ? ' (in full)' : ' (CUT)'}`);
  }
  console.log(`wrote out/shorts/trailer/trailer-${l}-${r}.mp4, frames/, first.png, middle.png, last.png, clip.json`);
}
