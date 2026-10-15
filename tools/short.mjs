// `npm run short <version>`: the vertical short of one version.
//
// Every short replays measured runs: the median run of a version (the run whose time
// to first apple is the median, from measurements/<version>.json), same build, same
// seed, the bot's own key presses on the screens and ticks where it pressed them, on
// a virtual clock, one screenshot per video frame. The counter shows the run's own
// clock and freezes on the measured median when the apple is eaten.
//
// v1.0 has its own plan (tools/short/plans.json). Every later version follows one
// fixed plan, compared with the version before it (compareTimeline below):
//   A  0-3 s    the previous version reaches its first apple at real speed; its counter
//               freezes on its median, then the new median appears next to it.
//   B  3-6 s    the new version's patch note, large.
//   C  6-~22 s  the new version from launch to 2 s before its first apple, sped up so it
//               fits (see compressSpeed); the speed is shown in small type.
//   D  the end  the new version eats its first apple at real speed: from 2 s before it
//               until Warden Snek's line after it has been said in full (the line starts
//               600 ms after the apple, story.js's letterbox; since prompt 12), or 1 s after
//               the apple for a version without voice lines. If that makes the short longer
//               than 30 s, C goes faster in steps of 0.05 until it fits.
// Sound: silence, except that line in D (since prompt 12, A carries no voice).
//
// Output in out/shorts/<version>/: frames/00001.png..., short-<version>.mp4
// (1080x1920, 30 fps, H.264), first/middle/last.png and clip.json.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import { listVersions } from './build.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;
export const MAX_CLIP_MS = 30000;
// Safe area: nothing important in the bottom 25 % or the right 15 % of the frame.
export const SAFE = { right: WIDTH * 0.85, bottom: HEIGHT * 0.75 };
const MAX_APPLE_DRIFT_MS = 50;
// The fixed plan for every version after v1.0 (ms of clip time).
export const PLAN = { prevMs: 3000, noteMs: 3000, launchMs: 16000, launchMaxMs: 21000, appleMs: 3000, beforeAppleMs: 2000 };
// Room kept for the line starting a little later in the replay than in the recorded run (the
// first apple may be up to MAX_APPLE_DRIFT_MS off, and a line starts on the next 60 Hz frame).
const LINE_SLACK_MS = 100;

// The one-line patch note of a version, from its section in UPDATES.md:
// a "## <version> ..." heading and a "**Patch note:** ..." line under it.
export function patchNote(markdown, version) {
  const sections = markdown.split(/^## /m);
  const section = sections.find(s => s.startsWith(version + ' ') || s.startsWith(version + '\n'));
  if (!section) return null;
  const match = section.match(/\*\*Patch note:\*\*\s*(.+)/);
  return match ? match[1].trim().replace(/^"(.*)"$/, '$1') : null;
}

// Display of a time in ms on the counter: seconds to the millisecond.
export function formatTime(ms) {
  const total = Math.max(0, ms) / 1000;
  if (total < 60) return `${total.toFixed(3)} s`;
  const minutes = Math.floor(total / 60);
  return `${minutes}:${(total - minutes * 60).toFixed(3).padStart(6, '0')}`;
}

// The first 60 Hz animation frame at or after t: the first frame that can show what happened at t.
export const nextFrame = t => Math.ceil(t / (1000 / 60)) * (1000 / 60);

// Where a version's action starts in its run, in ms of the run's clock: the first frame
// drawn after the bot's first key press ('first-key') or after a screen first appears
// ('screen:<name>'), plus plan.afterMs for a screen that fades in.
export function startTime(plan, raw) {
  if (plan.start === 'first-key') {
    if (!raw.keys.length) throw new Error('the run has no key presses');
    return nextFrame(raw.keys[0].t);
  }
  const screen = /^screen:(.+)$/.exec(plan.start);
  if (screen) {
    const entry = raw.log.find(e => e.type === 'screen' && e.name === screen[1]);
    if (!entry) throw new Error(`the run never shows screen '${screen[1]}'`);
    return nextFrame(entry.t + (plan.afterMs || 0));
  }
  throw new Error(`unknown clip start '${plan.start}'`);
}

// How much to speed up the launch part (C) so the short lands at 25-30 s.
// C gets 16 s at the largest speed (a multiple of 0.05) that does not make it shorter;
// above 4x it keeps 4x while C fits in 21 s, and only then goes faster.
// Never slower than real time: a launch shorter than 16 s plays at 1x, and the short is
// then shorter than 25 s.
export function compressSpeed(runMs) {
  let speed = Math.max(1, Math.floor((runMs / PLAN.launchMs) * 20) / 20);
  if (speed > 4) speed = runMs / 4 <= PLAN.launchMaxMs ? 4 : Math.ceil((runMs / PLAN.launchMaxMs) * 20) / 20;
  return speed;
}

// The line Warden Snek says after the first apple, from a build's story.js: its number, when it
// starts after the apple (the letterbox), and its recorded length. null for a version without voice.
export function firstAppleLine(distDir) {
  const file = path.join(distDir, 'story.js');
  if (!fs.existsSync(file)) return null;
  const story = vm.runInContext(`${fs.readFileSync(file, 'utf8')}\n;({ line: LINES.find(l => l.scene.startsWith('After')), LETTERBOX_MS })`, vm.createContext({}));
  const id = story.line.id;
  return { id, afterAppleMs: story.LETTERBOX_MS, ms: audioMs(path.join(distDir, 'voice', `${String(id).padStart(2, '0')}.mp3`)) };
}

// One measured version: its median run and what the short shows of it.
export function loadVersion(measurementsDir, version, plan, note, firstLine = null) {
  const result = JSON.parse(fs.readFileSync(path.join(measurementsDir, `${version}.json`), 'utf8'));
  const median = result.median.timeToFirstAppleMs;
  if (result.medianRun === null || median === null) throw new Error(`${version}: no median run with a first apple in the measurements`);
  const raw = JSON.parse(fs.readFileSync(path.join(measurementsDir, version, `run-${result.medianRun}.json`), 'utf8'));
  const apple = raw.log.find(e => e.type === 'apple');
  return { version, note, plan, result, raw, median, apple: apple.t, start: startTime(plan, raw), runs: result.settings.runs, seed: result.settings.seed, firstLine };
}

// v1.0's own clip: its plan's segments, all on the version's own pane.
export function singleTimeline(cur) {
  let from = cur.start;
  return cur.plan.segments.map(seg => {
    const s = { name: 'single', kind: 'game', who: 'cur', runFrom: from, clipMs: seg.clipMs, speed: seg.speed, counter: 'run', card: 'cur' };
    from += seg.clipMs * seg.speed;
    return s;
  });
}

// The fixed plan for every version after v1.0 (see the top of this file).
export function compareTimeline(prev, cur) {
  const aFrom = Math.max(prev.start, prev.apple - PLAN.beforeAppleMs);
  const dFrom = cur.apple - PLAN.beforeAppleMs;
  if (dFrom <= cur.start) throw new Error(`${cur.version}: the first apple comes too soon after the start for this plan`);
  const dMs = cur.firstLine ? PLAN.beforeAppleMs + cur.firstLine.afterAppleMs + cur.firstLine.ms : PLAN.appleMs;
  const room = MAX_CLIP_MS - PLAN.prevMs - PLAN.noteMs - dMs - (cur.firstLine ? LINE_SLACK_MS : 0);
  let speed = compressSpeed(dFrom - cur.start);
  while ((dFrom - cur.start) / speed > room) speed = Math.round((speed + 0.05) * 100) / 100; // C faster, so it all fits
  return [
    { name: 'A previous version', kind: 'game', who: 'prev', runFrom: aFrom, clipMs: PLAN.prevMs, speed: 1, counter: 'compare', card: 'prev' },
    { name: 'B patch note', kind: 'note', clipMs: PLAN.noteMs, counter: 'compare-done', card: 'cur-version' },
    { name: 'C launch', kind: 'game', who: 'cur', runFrom: cur.start, clipMs: (dFrom - cur.start) / speed, speed, counter: 'run', card: 'cur' },
    { name: 'D first apple', kind: 'game', who: 'cur', runFrom: dFrom, clipMs: dMs, speed: 1, counter: 'run', card: 'cur', untilLine: cur.firstLine },
  ];
}

function ffmpegVersion() {
  try {
    return execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0];
  } catch {
    return null;
  }
}

const speedText = s => `${Number(s.toFixed(2))}x`;

export async function recordShort({ cur, prev = null, distDirs, outDir, frameLimit = Infinity, encode = true, log = console.log }) {
  const timeline = prev ? compareTimeline(prev, cur) : singleTimeline(cur);
  const clipMs = timeline.reduce((s, x) => s + x.clipMs, 0);
  if (clipMs > MAX_CLIP_MS) throw new Error(`clip is ${clipMs} ms, more than ${MAX_CLIP_MS}`);
  let at = 0;
  for (const seg of timeline) {
    seg.clipFrom = at;
    at += seg.clipMs;
    if (seg.kind === 'game') seg.runTo = seg.runFrom + seg.clipMs * seg.speed;
  }
  const lastCur = timeline.filter(s => s.who === 'cur').pop();
  if (cur.apple > lastCur.runTo) throw new Error(`the first apple (${cur.apple} ms) is after the clip ends (${lastCur.runTo} ms of the run)`);

  const framesDir = path.join(outDir, 'frames');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });

  const mounts = { '/cur': distDirs.cur, '/_short': path.join(ROOT, 'tools/short') };
  if (prev) mounts['/prev'] = distDirs.prev;
  const server = await startServer(mounts);
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  let frames = Math.min(Math.round((clipMs * FPS) / 1000), frameLimit);
  const dSeg = timeline.find(s => s.untilLine);
  if (dSeg && frameLimit === Infinity) frames += Math.ceil((LINE_SLACK_MS * FPS) / 1000); // room to finish the line
  const panes = { cur: { id: 'game', v: cur, now: 0, apple: null }, prev: prev && { id: 'prev', v: prev, now: 0, apple: null } };
  let safeArea;
  try {
    const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
    await context.addInitScript({ path: path.join(ROOT, 'tools/short/vclock.js') });
    const page = await context.newPage();
    await page.goto(`${server.url}/_short/layout.html`);
    for (const pane of Object.values(panes).filter(Boolean)) {
      const dir = pane.id === 'game' ? '/cur' : '/prev';
      await page.evaluate(({ id, src }) => window.layout.load(id, src), { id: pane.id, src: `${dir}/index.html?seed=${pane.v.seed}` });
      await page.waitForFunction(id => {
        const w = document.getElementById(id).contentWindow;
        return w && w.__vclock && w.snakeGame;
      }, pane.id);
      await page.evaluate(({ id, keys, frames }) => document.getElementById(id).contentWindow.__vclock.replay(keys, frames), { id: pane.id, keys: pane.v.raw.keys, frames: pane.v.raw.frames || [] });
    }

    // Move a pane's game to run time t, at most 100 ms of virtual time per step, so the
    // page gets to handle anything real in between (like a download it asked for).
    const advance = async (pane, t) => {
      while (pane.now < t) {
        const to = Math.min(t, pane.now + 100);
        const state = await page.evaluate(({ id, to }) => {
          const w = document.getElementById(id).contentWindow;
          w.__vclock.advanceTo(to);
          const apple = w.snakeGame.log.find(e => e.type === 'apple');
          return { now: w.__vclock.now(), apple: apple ? apple.t : null };
        }, { id: pane.id, to });
        pane.now = to;
        if (state.apple !== null) pane.apple = state.apple;
      }
      return { eaten: pane.apple !== null && pane.apple <= t };
    };

    // Fast-forward each pane to where it first shows, no frames.
    for (const seg of timeline.filter(s => s.kind === 'game')) {
      const pane = panes[seg.who];
      if (pane.now === 0) await advance(pane, seg.runFrom);
    }

    for (let f = 0; f < frames; f++) {
      const t = (f * 1000) / FPS;
      const seg = timeline.find(s => t >= s.clipFrom && t < s.clipFrom + s.clipMs) || timeline[timeline.length - 1];
      let runT = null;
      let eaten = false;
      if (seg.kind === 'game') {
        runT = seg.runFrom + (t - seg.clipFrom) * seg.speed;
        ({ eaten } = await advance(panes[seg.who], runT));
        panes[seg.who].shownUntil = runT;
      }
      // D ends on the first video frame after the line has been said in full, as the replay plays it.
      if (seg === dSeg && dSeg.lineEndClipMs === undefined) {
        const played = await page.evaluate(({ id, line }) => {
          const w = document.getElementById(id).contentWindow;
          const url = w.eval(`voice.urls[${line}]`);
          const p = w.__vclock.plays().find(x => x.src === url);
          return p ? p.t : null;
        }, { id: panes.cur.id, line: dSeg.untilLine.id });
        if (played !== null) {
          dSeg.lineEndClipMs = dSeg.clipFrom + (played + dSeg.untilLine.ms - dSeg.runFrom);
          frames = Math.min(Math.ceil((dSeg.lineEndClipMs * FPS) / 1000), frameLimit);
        }
      }
      const counter = counterFor(seg, { cur, prev, runT, eaten });
      const card = seg.card === 'prev' ? [prev.version, prev.note] : seg.card === 'cur-version' ? [cur.version, ''] : [cur.version, cur.note];
      await page.evaluate(({ which, card, counter, speed, big }) => {
        window.layout.show(which);
        window.layout.setCard(card[0], card[1]);
        window.layout.setBigNote(big[0], big[1]);
        window.layout.setCounter(counter);
        window.layout.setSpeed(speed);
      }, {
        which: seg.kind === 'note' ? 'note' : panes[seg.who].id,
        card,
        counter,
        speed: seg.kind === 'game' && prev && seg.name.startsWith('C') ? speedText(seg.speed) : '',
        big: [cur.version, cur.note],
      });
      const rects = await checkSafeArea(page); // every frame: text changes from frame to frame
      if (f === 0) safeArea = rects;
      await page.screenshot({ path: path.join(framesDir, `${String(f + 1).padStart(5, '0')}.png`) });
      if ((f + 1) % 90 === 0 || f === frames - 1) log(`  frame ${f + 1}/${frames}`);
    }
    if (dSeg && frameLimit === Infinity && dSeg.lineEndClipMs === undefined) throw new Error(`${cur.version}: line ${dSeg.untilLine.id} did not start in segment D`);
    if (dSeg) {
      dSeg.clipMs = (frames * 1000) / FPS - dSeg.clipFrom;
      dSeg.runTo = dSeg.runFrom + dSeg.clipMs;
    }
    for (const pane of Object.values(panes).filter(Boolean)) {
      pane.log = await page.evaluate(id => document.getElementById(id).contentWindow.snakeGame.log, pane.id);
      // Which voice line each sound the game started was (a version without voice lines has none).
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

  // Checks: each pane ate the same apples as its recorded run, and its first apple came
  // within MAX_APPLE_DRIFT_MS of the measured median.
  const checks = {};
  for (const [who, pane] of Object.entries(panes).filter(([, p]) => p)) {
    const end = pane.shownUntil;
    const applesIn = l => l.filter(e => e.type === 'apple' && e.t <= end).map(e => `${e.score}@${e.tick}`);
    const c = {
      version: pane.v.version,
      medianRun: pane.v.result.medianRun,
      shownUntilMs: end,
      recordedFirstAppleMs: pane.v.apple,
      replayFirstAppleMs: pane.apple,
      medianFirstAppleMs: pane.v.median,
      replayMinusMedianMs: pane.apple === null ? null : pane.apple - pane.v.median,
      applesRecorded: applesIn(pane.v.raw.log),
      applesReplayed: applesIn(pane.log),
    };
    c.sameApplesAsRecordedRun = JSON.stringify(c.applesRecorded) === JSON.stringify(c.applesReplayed);
    if (c.replayFirstAppleMs === null || Math.abs(c.replayMinusMedianMs) > MAX_APPLE_DRIFT_MS) {
      throw new Error(`${c.version}: the replayed first apple (${c.replayFirstAppleMs} ms) is more than ${MAX_APPLE_DRIFT_MS} ms from the median (${c.medianFirstAppleMs} ms)`);
    }
    if (!c.sameApplesAsRecordedRun) throw new Error(`${c.version}: the replay ate different apples than the recorded run: ${c.applesReplayed.join(' ')} vs ${c.applesRecorded.join(' ')}`);
    checks[who] = c;
  }

  const names = fs.readdirSync(framesDir).sort();
  const pickFrame = (i, name) => fs.copyFileSync(path.join(framesDir, names[i]), path.join(outDir, name));
  pickFrame(0, 'first.png');
  pickFrame(Math.floor((names.length - 1) / 2), 'middle.png');
  pickFrame(names.length - 1, 'last.png');

  const voice = voiceTrack(timeline, panes, distDirs, (frames * 1000) / FPS);
  const mp4 = path.join(outDir, `short-${cur.version}.mp4`);
  if (encode) encodeShort(framesDir, voice, (frames * 1000) / FPS, mp4);
  const clip = {
    version: cur.version,
    comparedWith: prev ? prev.version : null,
    note: cur.note,
    size: [WIDTH, HEIGHT],
    fps: FPS,
    frames,
    clipMs: (frames * 1000) / FPS,
    timeline: timeline.map(({ name, kind, who, runFrom, runTo, clipFrom, clipMs, speed }) => ({ name, kind, who: who ? panes[who].v.version : null, runFrom, runTo, clipFrom, clipMs, speed })),
    counter: 'run clock (virtual time of the replay) until the first apple, then the measured median; in A, the new version\'s median appears once the previous one freezes',
    checks,
    voice: voice.map(({ file, ...v }) => ({ ...v, file: path.relative(ROOT, file) })),
    safeArea: { ...SAFE, elements: safeArea },
    browser: browser.version(),
    encoder: encode ? ffmpegVersion() : null,
    names: { frames: 'frames/%05d.png', video: encode ? path.basename(mp4) : null },
  };
  fs.writeFileSync(path.join(outDir, 'clip.json'), JSON.stringify(clip, null, 2) + '\n');
  return clip;
}

// The short's sound: silence, except Warden Snek's lines in the new version's segments played at 1x
// (D), each from the moment the replay started it, at its recorded length. A line stops where a
// segment faster than 1x begins, or where the short ends. Versions without voice lines get silence.
export function voiceTrack(timeline, panes, distDirs, clipMs) {
  const out = [];
  for (const seg of timeline.filter(s => s.kind === 'game' && s.speed === 1 && s.who === 'cur')) { // since prompt 12, A carries no voice
    const pane = panes[seg.who];
    const runTo = seg.runFrom + seg.clipMs;
    for (const p of (pane.plays || []).filter(x => x.line !== null && x.t >= seg.runFrom && x.t < runTo)) {
      const file = path.join(distDirs[seg.who], 'voice', `${String(p.line).padStart(2, '0')}.mp3`);
      const clipAtMs = seg.clipFrom + (p.t - seg.runFrom);
      const fast = timeline.find(s => s.clipFrom > clipAtMs && s.kind === 'game' && s.speed > 1);
      const stopAtMs = Math.min(fast ? fast.clipFrom : clipMs, clipMs);
      const lengthMs = audioMs(file);
      out.push({ version: pane.v.version, segment: seg.name, line: p.line, file, runAtMs: p.t, clipAtMs, lengthMs, heardMs: Math.min(lengthMs, stopAtMs - clipAtMs) });
    }
  }
  return out;
}

function audioMs(file) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim()) * 1000;
}

// Frames and sound into the mp4: H.264 video and an AAC track (mono, 44.1 kHz) in every short.
function encodeShort(framesDir, voice, clipMs, mp4) {
  const args = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(framesDir, '%05d.png'),
    '-f', 'lavfi', '-t', String(clipMs / 1000), '-i', 'anullsrc=r=44100:cl=mono'];
  voice.forEach(v => args.push('-i', v.file));
  const parts = voice.map((v, i) => `[${i + 2}:a]atrim=end=${v.heardMs / 1000},adelay=${Math.round(v.clipAtMs)}:all=1[v${i}]`);
  const mix = `[1:a]${voice.map((_, i) => `[v${i}]`).join('')}amix=inputs=${voice.length + 1}:duration=first:normalize=0[aout]`;
  args.push('-filter_complex', [...parts, mix].join(';'), '-map', '0:v', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '1', '-t', String(clipMs / 1000), '-movflags', '+faststart', mp4);
  execFileSync('ffmpeg', args);
}

// What the counter at the bottom shows for this frame.
export function counterFor(seg, { cur, prev, runT, eaten }) {
  if (seg.counter === 'compare' || seg.counter === 'compare-done') {
    const done = seg.counter === 'compare-done' || eaten;
    return {
      compare: true,
      label: `${prev.version} -> ${cur.version}`,
      sub: `time to first apple, measured medians`,
      value: formatTime(done ? prev.median : Math.min(runT, prev.median)),
      newValue: done ? formatTime(cur.median) : '',
      frozen: done,
    };
  }
  return {
    compare: false,
    label: 'Time to first apple',
    sub: `${prev ? `${cur.version}, ` : ''}${cur.runs === 1 ? 'a single measured run' : `median of ${cur.runs} measured runs`}`,
    value: formatTime(eaten ? cur.median : Math.min(runT, cur.median)),
    frozen: eaten,
  };
}

export async function checkSafeArea(page) {
  // Every box must sit inside the safe area, and no text may spill out of its box.
  const rects = await page.evaluate(({ right, bottom }) => ['card', 'note', 'game', 'prev', 'bignote', 'bignotetext', 'counter', 'speed'].map(id => {
    const el = document.getElementById(id);
    const r = el.getBoundingClientRect();
    const spills = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
    return { id, right: r.right, bottom: r.bottom, spills, inside: r.right <= right && r.bottom <= bottom && !spills };
  }), SAFE);
  const outside = rects.filter(r => !r.inside);
  if (outside.length) throw new Error(`layout outside the safe area or text spilling out: ${outside.map(r => r.id).join(', ')}`);
  return rects;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!/^v\d+\.\d+$/.test(version || '')) {
    console.error('usage: npm run short <version>   (like v1.0)');
    process.exit(1);
  }
  const plans = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/short/plans.json'), 'utf8'));
  const updates = fs.readFileSync(path.join(ROOT, 'UPDATES.md'), 'utf8');
  const measurements = path.join(ROOT, 'measurements');
  const load = v => {
    if (!plans[v]) throw new Error(`no clip plan for ${v} in tools/short/plans.json`);
    const note = patchNote(updates, v);
    if (!note) throw new Error(`no "**Patch note:**" line for ${v} in UPDATES.md`);
    return loadVersion(measurements, v, plans[v], note, firstAppleLine(path.join(ROOT, 'dist', v)));
  };
  const versions = listVersions();
  const prevVersion = versions[versions.indexOf(version) - 1] || null;
  const cur = load(version);
  const prev = prevVersion ? load(prevVersion) : null;
  console.log(`$ npm run short ${version}`);
  console.log(`patch note: ${cur.note}`);
  const clip = await recordShort({
    cur,
    prev,
    distDirs: { cur: path.join(ROOT, 'dist', version), prev: prevVersion && path.join(ROOT, 'dist', prevVersion) },
    outDir: path.join(ROOT, 'out/shorts', version),
  });
  console.log(`clip: ${clip.frames} frames, ${clip.clipMs} ms${clip.comparedWith ? `, after ${clip.comparedWith}` : ''}`);
  for (const s of clip.timeline) {
    console.log(`  ${s.name.padEnd(18)} clip ${s.clipFrom} ms + ${s.clipMs} ms${s.kind === 'game' ? `: ${s.who} run ${s.runFrom} -> ${s.runTo} ms at ${s.speed}x` : ''}`);
  }
  for (const c of Object.values(clip.checks)) {
    console.log(`${c.version}: first apple replayed at ${c.replayFirstAppleMs} ms, recorded ${c.recordedFirstAppleMs} ms, median ${c.medianFirstAppleMs} ms (counter freezes on the median); ${c.applesReplayed.length} apples shown, same as the recorded run: ${c.sameApplesAsRecordedRun}`);
  }
  if (!clip.voice.length) console.log('sound: silence (no Warden Snek line in segment D)');
  for (const v of clip.voice) {
    console.log(`sound: ${v.version} line ${v.line} (${v.segment}) from ${v.clipAtMs / 1000} s to ${(v.clipAtMs + v.heardMs) / 1000} s of the short, ${v.heardMs} ms heard of ${v.lengthMs} ms${v.heardMs === v.lengthMs ? ' (in full)' : ' (CUT)'}`);
  }
    if (clip.clipMs < 25000 && clip.comparedWith) console.log(`note: the clip is shorter than 25 s because ${version}'s launch is shorter than ${PLAN.launchMs} ms at 1x`);
  console.log(`wrote out/shorts/${version}/short-${version}.mp4, frames/, first.png, middle.png, last.png, clip.json`);
}
