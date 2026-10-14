// `npm run short <version>`: the 30-second vertical short of one version.
//
// It replays the version's median measured run (the run whose time to first apple
// is the median, from measurements/<version>.json): same build, same seed, the
// bot's own key presses at their recorded times, on a virtual clock, one
// screenshot per video frame. Layout (tools/short/layout.html), the same for
// every version: the patch note card from UPDATES.md at the top, the game in the
// middle, and the "time to first apple" counter at the bottom. The counter shows
// the run's own clock and freezes on the measured median when the apple is eaten.
//
// Output in out/shorts/<version>/: frames/00001.png..., short-<version>.mp4
// (1080x1920, 30 fps, H.264), first/middle/last.png and clip.json.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;
export const MAX_CLIP_MS = 30000;
// Safe area: nothing important in the bottom 25 % or the right 15 % of the frame.
export const SAFE = { right: WIDTH * 0.85, bottom: HEIGHT * 0.75 };
const MAX_APPLE_DRIFT_MS = 50;

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

// Where the clip starts in the run, in ms of the run's clock: the first frame drawn after
// the bot's first key press ('first-key') or after a screen first appears ('screen:<name>'),
// plus plan.afterMs for a screen that fades in.
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

// Clip time (ms) -> run time (ms), through the plan's speed segments.
export function clipToRun(plan, start) {
  return clipMs => {
    let run = start;
    let left = clipMs;
    for (const seg of plan.segments) {
      const part = Math.min(left, seg.clipMs);
      run += part * seg.speed;
      left -= part;
      if (left <= 0) break;
    }
    return run;
  };
}

export function speedAt(plan, clipMs) {
  let at = 0;
  for (const seg of plan.segments) {
    at += seg.clipMs;
    if (clipMs < at) return seg.speed;
  }
  return plan.segments[plan.segments.length - 1].speed;
}

function ffmpegVersion() {
  try {
    return execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0];
  } catch {
    return null;
  }
}

export async function recordShort({ version, distDir, measurementsDir, outDir, plan, note, frameLimit = Infinity, encode = true, log = console.log }) {
  const result = JSON.parse(fs.readFileSync(path.join(measurementsDir, `${version}.json`), 'utf8'));
  const median = result.median.timeToFirstAppleMs;
  if (result.medianRun === null || median === null) throw new Error('no median run with a first apple in the measurements');
  const raw = JSON.parse(fs.readFileSync(path.join(measurementsDir, version, `run-${result.medianRun}.json`), 'utf8'));
  const clipMs = plan.segments.reduce((s, x) => s + x.clipMs, 0);
  if (clipMs > MAX_CLIP_MS) throw new Error(`clip is ${clipMs} ms, more than ${MAX_CLIP_MS}`);
  const start = startTime(plan, raw);
  const toRun = clipToRun(plan, start);
  const recordedApple = raw.log.find(e => e.type === 'apple');
  if (recordedApple.t > toRun(clipMs)) throw new Error(`the first apple (${recordedApple.t} ms) is after the clip ends (${toRun(clipMs)} ms of the run): raise the speed`);

  const framesDir = path.join(outDir, 'frames');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });

  const server = await startServer({ '/game': distDir, '/_short': path.join(ROOT, 'tools/short') });
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const frames = Math.min(Math.round((clipMs * FPS) / 1000), frameLimit);
  let replayApple = null;
  let replayLog = [];
  let safeArea;
  try {
    const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
    await context.addInitScript({ path: path.join(ROOT, 'tools/short/vclock.js') });
    const page = await context.newPage();
    await page.goto(`${server.url}/_short/layout.html`);
    await page.evaluate(args => window.layout.setup(args), {
      version,
      note,
      src: `/game/index.html?seed=${result.settings.seed}`,
      source: `median of ${result.settings.runs} measured runs`,
    });
    await page.waitForFunction(() => {
      const w = document.getElementById('game').contentWindow;
      return w && w.__vclock && w.snakeGame;
    });
    await page.evaluate(keys => document.getElementById('game').contentWindow.__vclock.replay(keys), raw.keys);

    safeArea = await page.evaluate(({ right, bottom }) => ['card', 'game', 'counter', 'speed'].map(id => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { id, right: r.right, bottom: r.bottom, inside: r.right <= right && r.bottom <= bottom };
    }), SAFE);
    const outside = safeArea.filter(r => !r.inside);
    if (outside.length) throw new Error(`layout outside the safe area: ${outside.map(r => r.id).join(', ')}`);

    // Advance the game to time t; tell the layout what the counter shows.
    const advance = t => page.evaluate(({ t, median }) => {
      const w = document.getElementById('game').contentWindow;
      w.__vclock.advanceTo(t);
      const apple = w.snakeGame.log.find(e => e.type === 'apple');
      const eaten = Boolean(apple && apple.t <= t);
      return { now: w.__vclock.now(), apple: apple ? apple.t : null, eaten, counterMs: eaten ? median : Math.min(t, median) };
    }, { t, median });

    await advance(start); // fast-forward to the start of the clip, no frames
    for (let f = 0; f < frames; f++) {
      const clipAt = (f * 1000) / FPS;
      const speed = speedAt(plan, clipAt);
      const state = await advance(toRun(clipAt));
      if (state.apple !== null) replayApple = state.apple;
      await page.evaluate(({ text, frozen, speed }) => {
        window.layout.setCounter(text, frozen);
        window.layout.setSpeed(speed === 1 ? '' : `x${speed}`);
      }, { text: formatTime(state.counterMs), frozen: state.eaten, speed });
      await page.screenshot({ path: path.join(framesDir, `${String(f + 1).padStart(5, '0')}.png`) });
      if ((f + 1) % 60 === 0 || f === frames - 1) log(`  frame ${f + 1}/${frames}`);
    }
    replayLog = await page.evaluate(() => document.getElementById('game').contentWindow.snakeGame.log);
  } finally {
    await browser.close();
    await server.close();
  }

  const endRun = toRun((frames * 1000) / FPS);
  const applesIn = l => l.filter(e => e.type === 'apple' && e.t <= endRun).map(e => `${e.score}@${e.tick}`);
  const check = {
    recordedFirstAppleMs: recordedApple.t,
    replayFirstAppleMs: replayApple,
    medianFirstAppleMs: median,
    replayMinusMedianMs: replayApple === null ? null : replayApple - median,
    applesRecorded: applesIn(raw.log),
    applesReplayed: applesIn(replayLog),
  };
  check.sameApplesAsRecordedRun = JSON.stringify(check.applesRecorded) === JSON.stringify(check.applesReplayed);
  if (replayApple === null || Math.abs(replayApple - median) > MAX_APPLE_DRIFT_MS) {
    throw new Error(`the replayed first apple (${replayApple} ms) is more than ${MAX_APPLE_DRIFT_MS} ms from the median (${median} ms)`);
  }
  if (!check.sameApplesAsRecordedRun) throw new Error(`the replay ate different apples than the recorded run: ${check.applesReplayed.join(' ')} vs ${check.applesRecorded.join(' ')}`);

  const names = fs.readdirSync(framesDir).sort();
  const pickFrame = (i, name) => fs.copyFileSync(path.join(framesDir, names[i]), path.join(outDir, name));
  pickFrame(0, 'first.png');
  pickFrame(Math.floor((names.length - 1) / 2), 'middle.png');
  pickFrame(names.length - 1, 'last.png');

  const mp4 = path.join(outDir, `short-${version}.mp4`);
  if (encode) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(framesDir, '%05d.png'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', mp4]);
  }
  const clip = {
    version,
    note,
    plan,
    size: [WIDTH, HEIGHT],
    fps: FPS,
    frames,
    clipMs: (frames * 1000) / FPS,
    run: { measurements: `measurements/${version}.json`, medianRun: result.medianRun, startMs: start, endMs: endRun },
    counter: 'run clock (virtual time of the replay) until the first apple, then the measured median',
    check,
    safeArea: { ...SAFE, elements: safeArea },
    browser: browser.version(),
    encoder: encode ? ffmpegVersion() : null,
    names: { frames: 'frames/%05d.png', video: encode ? path.basename(mp4) : null },
  };
  fs.writeFileSync(path.join(outDir, 'clip.json'), JSON.stringify(clip, null, 2) + '\n');
  return clip;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!/^v\d+\.\d+$/.test(version || '')) {
    console.error('usage: npm run short <version>   (like v1.0)');
    process.exit(1);
  }
  const plans = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/short/plans.json'), 'utf8'));
  if (!plans[version]) throw new Error(`no clip plan for ${version} in tools/short/plans.json`);
  const note = patchNote(fs.readFileSync(path.join(ROOT, 'UPDATES.md'), 'utf8'), version);
  if (!note) throw new Error(`no "**Patch note:**" line for ${version} in UPDATES.md`);
  console.log(`$ npm run short ${version}`);
  console.log(`patch note: ${note}`);
  const clip = await recordShort({
    version,
    note,
    plan: plans[version],
    distDir: path.join(ROOT, 'dist', version),
    measurementsDir: path.join(ROOT, 'measurements'),
    outDir: path.join(ROOT, 'out/shorts', version),
  });
  console.log(`clip: ${clip.frames} frames, ${clip.clipMs} ms, run ${clip.run.medianRun} from ${clip.run.startMs} ms to ${clip.run.endMs} ms`);
  console.log(`first apple: replay ${clip.check.replayFirstAppleMs} ms, recorded ${clip.check.recordedFirstAppleMs} ms, median ${clip.check.medianFirstAppleMs} ms (counter freezes on the median)`);
  console.log(`apples in the clip: ${clip.check.applesReplayed.length}, same as the recorded run: ${clip.check.sameApplesAsRecordedRun}`);
  console.log(`wrote out/shorts/${version}/short-${version}.mp4, frames/, first.png, middle.png, last.png, clip.json`);
}
