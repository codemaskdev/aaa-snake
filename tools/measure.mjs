// `npm run measure <version>`: measure one build in dist/<version>/.
//
// 5 headless runs (every metric but frame rate), then 5 runs in a visible window
// (frame rate). Writes, under measurements/:
//   <version>.json           machine, browser, method, every run's numbers, the medians
//   <version>/run-<n>.json   raw data of each headless run (game log, keys, frames, requests)
//   <version>/fps-run-<n>.json  raw frame times of each visible run
//   <version>/output.txt     the command and everything it printed
//   summary.csv              one row per version (medians)
// Numbers are written as measured, never rounded.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
import { runOnce } from './rig/run.mjs';
import { median, CONTROL_SCREENS, PAGE_LOAD } from './rig/stats.mjs';
import { sizeOf } from './rig/size.mjs';
import { machineInfo } from './rig/machine.mjs';
import { upsertSummary } from './rig/summary.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PLAYWRIGHT_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/playwright/package.json'), 'utf8')).version;

export const DEFAULTS = {
  seed: 1,
  runs: 5,
  sessionMs: 180000,       // control share window: 3 minutes from navigation start
  playMsForMemory: 60000,  // heap is read after 60 s of control
  fpsRuns: 5,
  fpsPlayMs: 60000,        // frame rate: over the first 60 s of control (the heap's window)
  fpsMode: 'visible',
};

function git(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function gitInfo(version) {
  const tagCommit = git(['rev-list', '-n', '1', version]);
  return {
    head: git(['rev-parse', '--short', 'HEAD']),
    tag: tagCommit ? { name: version, commit: tagCommit.slice(0, 7) } : null,
    buildSameAsTag: tagCommit ? git(['diff', '--quiet', version, 'HEAD', '--', `dist/${version}`]) !== null : null,
    buildUncommitted: git(['status', '--porcelain', '--', `dist/${version}`]) !== '',
  };
}

const METHOD = {
  timeToFirstApple: 'performance.now() in the page when the game logs its first apple; 0 is navigation start.',
  screensBeforeFirstApple: `Segments of the game's screen log between navigation start and the first apple. "${PAGE_LOAD}" is the time before the game reports its first screen.`,
  bot: 'tools/rig/bot.mjs. Seed 1. It acts only on screens already drawn, presses the key a screen offers to leave it (skip/continue/restart) at once, and on control screens takes a shortest path to the apple (breadth-first search). Keys are real key presses (Playwright keyboard). It polls the game every 4 ms.',
  controlShareInPlay: 'Since prompt 5: from the first drawn frame of a control screen until the bot has had 60000 ms of control (the heap\'s and the frame rate\'s window), control time divided by the time that passed. The launch screens are left out; what stops play after the first control frame (finishing moves, cutscenes, deaths, reconnects) counts against it (tools/rig/stats.mjs playShare).',
  controlShare: `Time in control screens (${[...CONTROL_SCREENS].join(', ')}) divided by the session, over the first sessionMs from navigation start. Control screens are those where arrow keys steer the snake; the list is fixed in tools/rig/stats.mjs.`,
  search: 'Since v1.7 the apple shows only within a vision radius. The bot counts the cells it has seen (within the radius of every cell its head has been on, since the apple appeared); search.cellsSeen is that count on the bot\'s first look at the game that shows the apple, with the tick and the time.',
  steering: 'In play, every turn key the bot sends is checked on the next look at the game: accepted means the game now heads that way. A turn sent just before the snake died, or on the last look at the game in a run, cannot be checked and is counted as unchecked.',
  load: 'performance.now() of the first drawn frame of a screen that accepts any key: the first frame of a control screen, or the game\'s first "accepts" log entry (the first drawn frame where another screen starts reacting to a key), whichever comes first.',
  memory: 'CDP Runtime.getHeapUsage().usedSize of the page, read right after CDP HeapProfiler.collectGarbage, at the moment the bot has had playMsForMemory of control. The value before garbage collection is kept too.',
  origin: 'Every request of every run must go to the page\'s own origin (scheme, host and port of the game); any other request is listed in checks.externalRequests and fails the checks (tools/rig/stats.mjs offOrigin).',
  download: 'Sum of CDP Network.loadingFinished encodedDataLength over every request of the session (headers + body; no compression, browser cache disabled).',
  size: 'Files in dist/<version>/. js = .js and .mjs; code = js + .html + .css; assets = every other file. Lines = newline characters, like wc -l (tools/rig/size.mjs).',
  frameRate: 'Method 2 (since 2026-10-14, prompt 4): over the first 60 s of play, the same window as the heap. Every requestAnimationFrame timestamp is recorded by a script injected before the game; only frames inside control screens count, taken in order from navigation start until 60000 ms of control (by the game\'s screen log), and frames within the heap read (+500 ms) are left out. Per run: median = median of per-second frame counts (1-second windows, like an FPS counter); p5 = 5th percentile (nearest rank) of per-frame values, 1000 / interval between two frames. The version\'s figure is the median over runs. Per-frame values are not used for the median because rAF timestamps snap to the 60 Hz display: a 25 ms frame shows up as 16.7 and 33.3 ms intervals in turn. Method 1 took the control frames of the first 60 s from navigation start; its files are in measurements/old-method/.',
  frameRateWindow: 'Frame rate is measured in a visible Chromium window, not headless: on this Mac, headless and visible medians agreed on CPU and GPU loads, but the 5th percentile did not (see measurements/fps-check.json). The headless runs\' frame rate is kept as headlessFps for comparison.',
  medians: 'Median over runs: the middle value of 5 (mean of the two middle values for an even count).',
};

export async function measure(opts) {
  const o = { ...DEFAULTS, ...opts };
  const lines = [];
  const say = (text = '') => {
    lines.push(text);
    if (!o.quiet) console.log(text);
  };
  const dir = o.dir;
  if (!fs.existsSync(path.join(dir, 'index.html'))) throw new Error(`no build at ${path.relative(ROOT, dir) || dir}/index.html`);

  say(`$ ${o.command}`);
  const machine = machineInfo();
  say(`machine: ${machine.model} (${machine.modelIdentifier}), ${machine.chip}, ${machine.ramBytes} bytes RAM, ${machine.os}, Node ${machine.node}`);

  const size = sizeOf(dir);
  say(`size: js ${size.jsLines} lines / ${size.jsBytes} bytes; code ${size.codeLines} lines; assets ${size.assetBytes} bytes; build ${size.buildBytes} bytes (${size.files.length} files)`);

  const server = await startServer({ '/': dir });
  const url = `${server.url}/index.html?seed=${o.seed}`;
  const runs = [];
  const rawRuns = [];
  const fpsRuns = [];
  const fpsRaw = [];
  try {
    for (let i = 1; i <= o.runs; i++) {
      const { summary, raw } = await runOnce({ url, mode: 'headless', sessionMs: o.sessionMs, playMsForMemory: o.playMsForMemory });
      runs.push({ run: i, ...summary });
      rawRuns.push(raw);
      const s = summary;
      say(`run ${i}/${o.runs} headless: first apple ${s.timeToFirstAppleMs} ms (tick ${s.firstAppleTick}), load ${s.loadMs} ms, control ${s.controlMs} / ${s.sessionMs} ms = ${s.controlShare}, control in play ${s.controlInPlay?.controlMs} / ${s.controlInPlay ? s.controlInPlay.toMs - s.controlInPlay.fromMs : null} ms = ${s.controlInPlay?.share}, heap ${s.memory?.usedSizeAfterGc} bytes after GC (${s.memory?.usedSizeBeforeGc} before) at ${s.memory?.controlMsAtRead} ms of control, download ${s.requests.bytes} bytes in ${s.requests.count} requests, headless fps median ${s.fps.median} p5 ${s.fps.p5}, steering ${s.steering.accepted}/${s.steering.sent} (${s.steering.unchecked} unchecked), deaths ${s.deathsInSession}, errors ${s.errors.length}${s.search ? `, apple first seen after ${s.search.cellsSeen} cells seen (tick ${s.search.tick}, ${s.search.t} ms)` : ''}${s.incomplete ? ', INCOMPLETE' : ''}`);
      say(`  screens before the first apple: ${(s.screensBeforeFirstApple || []).map(x => `${x.screen} ${x.ms} ms`).join(' -> ')}`);
    }
    for (let i = 1; i <= o.fpsRuns; i++) {
      const { summary, raw } = await runOnce({ url, mode: o.fpsMode, playMsForMemory: Infinity, fpsPlayMs: o.fpsPlayMs, stopAfterControlMs: o.fpsPlayMs + 1000 });
      const fps = { run: i, mode: o.fpsMode, ...summary.fps, page: summary.page, endMs: summary.endMs, errors: summary.errors };
      fpsRuns.push(fps);
      fpsRaw.push({ frames: raw.frames, log: raw.log });
      say(`fps run ${i}/${o.fpsRuns} ${o.fpsMode}: median ${fps.median} fps, p5 ${fps.p5} fps, ${fps.frames} frames over ${fps.window.controlMs} ms of play, longest frame ${fps.longestFrameMs} ms`);
    }
  } finally {
    await server.close();
  }

  const pick = f => median(runs.map(f).filter(v => v !== null && v !== undefined));
  const result = {
    version: o.version,
    command: o.command,
    measuredAt: new Date().toISOString(),
    git: o.git === false ? null : gitInfo(o.version),
    machine,
    browser: {
      name: 'Chromium',
      version: runs[0]?.browserVersion ?? null,
      playwright: PLAYWRIGHT_VERSION,
      headless: { mode: 'new headless (Playwright channel "chromium")', userAgent: runs[0]?.page.userAgent, webglRenderer: runs[0]?.page.webglRenderer, viewport: [runs[0]?.page.innerWidth, runs[0]?.page.innerHeight], devicePixelRatio: runs[0]?.page.devicePixelRatio },
      fpsWindow: fpsRuns[0] ? { mode: o.fpsMode, userAgent: fpsRuns[0].page.userAgent, webglRenderer: fpsRuns[0].page.webglRenderer, viewport: [fpsRuns[0].page.innerWidth, fpsRuns[0].page.innerHeight], devicePixelRatio: fpsRuns[0].page.devicePixelRatio } : null,
    },
    settings: { seed: o.seed, runs: o.runs, sessionMs: o.sessionMs, playMsForMemory: o.playMsForMemory, fpsRuns: o.fpsRuns, fpsPlayMs: o.fpsPlayMs, frameRateMethod: 2 },
    method: METHOD,
    size,
    median: {
      timeToFirstAppleMs: pick(r => r.timeToFirstAppleMs),
      loadMs: pick(r => r.loadMs),
      controlShare: pick(r => r.controlShare),
      controlShareInPlay: pick(r => r.controlInPlay?.share),
      heapUsedAfterGcBytes: pick(r => r.memory?.usedSizeAfterGc),
      downloadBytes: pick(r => r.requests.bytes),
      fpsMedian: median(fpsRuns.map(r => r.median)),
      fpsP5: median(fpsRuns.map(r => r.p5)),
      headlessFpsMedian: pick(r => r.fps.median),
      headlessFpsP5: pick(r => r.fps.p5),
    },
    checks: {
      firstAppleTicks: runs.map(r => r.firstAppleTick),
      sameFirstAppleTickInAllRuns: new Set(runs.map(r => r.firstAppleTick)).size === 1,
      sameApplesBeforeFirstDeathInAllRuns: new Set(runs.map(r => JSON.stringify(r.applesBeforeFirstDeath))).size === 1,
      externalRequests: runs.flatMap(r => r.requests.external),
      failedRequests: runs.flatMap(r => r.requests.failed),
      pageErrors: [...runs.flatMap(r => r.errors), ...fpsRuns.flatMap(r => r.errors)],
      steering: {
        sent: runs.reduce((s, r) => s + r.steering.sent, 0),
        accepted: runs.reduce((s, r) => s + r.steering.accepted, 0),
        unchecked: runs.reduce((s, r) => s + r.steering.unchecked, 0),
      },
      incompleteRuns: runs.filter(r => r.incomplete).map(r => r.run),
    },
    runs,
    fpsRuns,
  };

  // The median run for the first apple: the run whose value is the median (used by `npm run short`).
  const sorted = [...runs].filter(r => r.timeToFirstAppleMs !== null).sort((a, b) => a.timeToFirstAppleMs - b.timeToFirstAppleMs);
  result.medianRun = sorted.length % 2 ? sorted[(sorted.length - 1) / 2].run : null;

  const m = result.median;
  say('');
  say(`median of ${o.runs} runs (${o.version}):`);
  say(`  time to first apple   ${m.timeToFirstAppleMs} ms (run ${result.medianRun})`);
  const medianScreens = runs.find(r => r.run === result.medianRun)?.screensBeforeFirstApple || [];
  for (const s of medianScreens) say(`    ${s.screen.padEnd(16)} ${s.ms} ms`);
  say(`  load time             ${m.loadMs} ms`);
  say(`  control share         ${m.controlShare} (of ${o.sessionMs} ms)`);
  say(`  control share in play ${m.controlShareInPlay} (first ${o.fpsPlayMs} ms of control, from the first control frame)`);
  say(`  JS heap after GC      ${m.heapUsedAfterGcBytes} bytes`);
  say(`  download              ${m.downloadBytes} bytes`);
  say(`  frame rate (${o.fpsMode})  median ${m.fpsMedian} fps, p5 ${m.fpsP5} fps`);
  say(`  frame rate (headless) median ${m.headlessFpsMedian} fps, p5 ${m.headlessFpsP5} fps`);
  say(`  js ${size.jsLines} lines, ${size.jsBytes} bytes; code ${size.codeLines} lines; assets ${size.assetBytes} bytes; build ${size.buildBytes} bytes`);
  const c = result.checks;
  say(`checks: first apple tick ${c.firstAppleTicks.join(', ')} (same in all runs: ${c.sameFirstAppleTickInAllRuns}); external requests ${c.externalRequests.length}; failed requests ${c.failedRequests.length}; page errors ${c.pageErrors.length}; steering ${c.steering.accepted}/${c.steering.sent} turns accepted (${c.steering.unchecked} sent just before a death or the end of a run, not checkable); incomplete runs ${c.incompleteRuns.length}`);
  c.pass = c.externalRequests.length === 0 && c.pageErrors.length === 0 && c.incompleteRuns.length === 0 && c.steering.accepted === c.steering.sent - c.steering.unchecked;
  say(`checks: ${c.pass ? 'PASS' : 'FAIL'}`);
  const budget = m.fpsMedian >= 50 && m.fpsP5 >= 30;
  say(`performance budget (median >= 50 fps, p5 >= 30 fps): ${budget ? 'PASS' : 'FAIL'}`);
  result.budget = { fpsMedianMin: 50, fpsP5Min: 30, pass: budget };

  // Write everything.
  const outDir = o.outDir;
  const runDir = path.join(outDir, o.version);
  fs.rmSync(runDir, { recursive: true, force: true });
  fs.mkdirSync(runDir, { recursive: true });
  rawRuns.forEach((raw, i) => fs.writeFileSync(path.join(runDir, `run-${i + 1}.json`), JSON.stringify(raw)));
  fpsRaw.forEach((raw, i) => fs.writeFileSync(path.join(runDir, `fps-run-${i + 1}.json`), JSON.stringify(raw)));
  fs.writeFileSync(path.join(outDir, `${o.version}.json`), JSON.stringify(result, null, 2) + '\n');
  upsertSummary(path.join(outDir, 'summary.csv'), result, o.fpsMode);
  const shown = outDir.startsWith(ROOT) ? path.relative(ROOT, outDir) : path.basename(outDir);
  say(`wrote ${shown}/${o.version}.json, ${shown}/${o.version}/ (raw runs and this output), ${shown}/summary.csv`);
  fs.writeFileSync(path.join(runDir, 'output.txt'), lines.join('\n') + '\n');
  return result;
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
    else out._.push(a);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const version = args._[0];
  if (!/^v\d+\.\d+$/.test(version || '')) {
    console.error('usage: npm run measure <version>   (like v1.0)');
    process.exit(1);
  }
  const extra = process.argv.slice(3).join(' ');
  const result = await measure({
    version,
    dir: path.join(ROOT, 'dist', version),
    outDir: path.join(ROOT, 'measurements'),
    command: `npm run measure ${version}${extra ? ' -- ' + extra : ''}`,
    ...(args.runs && { runs: Number(args.runs) }),
    ...(args['fps-runs'] && { fpsRuns: Number(args['fps-runs']) }),
    ...(args.session && { sessionMs: Number(args.session) }),
  });
  if (!result.checks.pass || !result.budget.pass) process.exitCode = 1;
}
