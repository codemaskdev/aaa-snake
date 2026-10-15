// One measured run: open a build in Chromium, let the bot play, collect the raw data.
import { chromium } from 'playwright';
import { decide, KEY_FOR, skillKey, makeMemory, remember } from './bot.mjs';
import {
  CONTROL_SCREENS, segments, controlMs, controlIntervals, firstApple, loadMs, frameRate, offOrigin, firstMs, playShare,
  playShareUntilEnd, gameEndedMs,
} from './stats.mjs';

// Injected before any game code. It records the time of every animation frame
// and every key press the page receives. It never touches the game.
const RIG_INIT = `(() => {
  if (window.top !== window) return;
  const rig = window.__rig = { frames: [], keys: [] };
  const loop = t => { rig.frames.push(t); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  window.addEventListener('keydown', e => {
    const game = window.snakeGame && window.snakeGame.probe();
    rig.keys.push({ t: performance.now(), code: e.code, screen: game ? game.screen : null, tick: game ? game.tick : null });
  }, true);
})();`;

// Keep Chromium from slowing down a window that is covered or in the background.
const FLAGS = [
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling',
];

export const VIEWPORT = { width: 1280, height: 800 };

// Browser modes:
//   'headless'       Chromium's "new headless" (channel 'chromium'): no window, draws on
//                    the real GPU (ANGLE Metal on the M1). Used for every metric but frame rate.
//   'visible'        a normal Chromium window on screen. Used for frame rate.
//   'headless-shell' Playwright's default headless shell: draws WebGL in software
//                    (SwiftShader). Only used by `npm run fps-check` to show the difference.
export const MODES = ['headless', 'visible', 'headless-shell'];

export async function launch(mode) {
  if (mode === 'visible') {
    return chromium.launch({ headless: false, args: [...FLAGS, `--window-size=${VIEWPORT.width},${VIEWPORT.height + 87}`, '--window-position=0,0'] });
  }
  if (mode === 'headless-shell') return chromium.launch({ headless: true, args: FLAGS });
  if (mode === 'headless') return chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  throw new Error(`unknown browser mode ${mode}`);
}

export async function newContext(browser, mode) {
  // Visible: the real window and the screen's own pixel ratio (2 on a Retina Mac).
  // Headless: the same size and pixel ratio, emulated.
  return mode === 'visible'
    ? browser.newContext({ viewport: null })
    : browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * options:
 *   url          page to open (with ?seed=)
 *   mode         'headless' | 'visible'
 *   sessionMs    control share window, from navigation start (180000)
 *   playMsForMemory  heap is read once the bot has had this much control (60000)
 *   fpsPlayMs    frame rate is taken over the first this-much of control (60000)
 *   stopAfterControlMs  if set, end the run once the bot has had this much control
 *   maxMs        give up after this long (page time)
 *   pollMs       pause between two looks at the game
 */
export async function runOnce({ url, mode = 'headless', sessionMs = 180000, playMsForMemory = 60000, fpsPlayMs = 60000, stopAfterControlMs = null, maxMs = 1200000, pollMs = 4 }) {
  const browser = await launch(mode);
  const browserVersion = browser.version();
  const context = await newContext(browser, mode);
  await context.addInitScript(RIG_INIT);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const requests = new Map();
  cdp.on('Network.requestWillBeSent', e => requests.set(e.requestId, { url: e.request.url, bytes: 0, done: false }));
  cdp.on('Network.loadingFinished', e => {
    const r = requests.get(e.requestId);
    if (r) Object.assign(r, { bytes: e.encodedDataLength, done: true });
  });
  cdp.on('Network.loadingFailed', e => {
    const r = requests.get(e.requestId);
    if (r) Object.assign(r, { failed: e.errorText, done: true });
  });

  await page.goto(url, { waitUntil: 'commit' });

  let t = 0;
  let lastPoll = null;
  let lastScreen = null;
  let lastActedTick = -1;
  let lastNextPress = -Infinity;
  let controlSoFar = 0;
  let sawApple = false;
  let memory = null;
  let incomplete = false;
  let check = null;
  const steering = { sent: 0, accepted: 0, unchecked: 0 };
  const searchMemory = makeMemory(); // v1.7: the cells the bot has seen while it searches for the apple
  let firstSight = null;       // how many cells it had seen when the apple first came into view
  const nextKeys = {};

  async function readHeap() {
    const before = await page.evaluate(() => performance.now());
    const withoutGc = await cdp.send('Runtime.getHeapUsage');
    await cdp.send('HeapProfiler.collectGarbage');
    const afterGc = await cdp.send('Runtime.getHeapUsage');
    const after = await page.evaluate(() => performance.now());
    return {
      atMs: before,
      controlMsAtRead: controlSoFar,
      usedSizeAfterGc: afterGc.usedSize,
      totalSizeAfterGc: afterGc.totalSize,
      usedSizeBeforeGc: withoutGc.usedSize,
      raw: { beforeGc: withoutGc, afterGc },
      framesExcluded: [before, after + 500],
    };
  }

  for (;;) {
    let probe = null;
    try {
      [t, probe] = await page.evaluate(() => [performance.now(), window.snakeGame ? window.snakeGame.probe() : null]);
    } catch {
      await sleep(pollMs);
      continue; // the page is still loading
    }
    if (lastPoll !== null && CONTROL_SCREENS.has(lastScreen)) controlSoFar += t - lastPoll;
    lastPoll = t;

    if (probe && !probe.shown) probe = null; // a player can't react to a screen that isn't drawn yet
    if (probe) {
      if (check) {
        // Checked on the next look at the game; a turn sent just before the snake died can't be checked.
        if (probe.screen === 'play') {
          if (probe.heading === check) steering.accepted++;
        } else {
          steering.unchecked++;
        }
        check = null;
      }
      const changed = probe.screen !== lastScreen;
      lastScreen = probe.screen;
      if (probe.score > 0) sawApple = true;
      remember(searchMemory, probe);
      if (probe.vision && probe.apple && !firstSight) firstSight = { cellsSeen: searchMemory.count, tick: probe.tick, t };
      if (probe.next) nextKeys[probe.screen] = probe.next;

      if (CONTROL_SCREENS.has(probe.screen)) {
        if (changed || probe.tick !== lastActedTick) {
          lastActedTick = probe.tick;
          const dir = decide(probe, searchMemory);
          // On 'ready' (and v1.0's ready inside v2.0's cabinet) any arrow key starts the game, so always press one.
          const waiting = probe.screen === 'ready' || (probe.screen === 'cabinet' && probe.cabinetReady);
          if (waiting || dir !== probe.heading) {
            await page.keyboard.press(KEY_FOR[dir]);
            if (probe.screen === 'play') {
              steering.sent++;
              check = dir;
            }
          }
        }
      } else {
        // On v1.6's skill tree the bot also steers the cursor (skillKey); elsewhere it presses what is offered.
        const press = probe.screen === 'skill-tree' && probe.skills ? skillKey(probe) : probe.next;
        if (press && (changed || t - lastNextPress > 250)) {
          await page.keyboard.press(press);
          lastNextPress = t;
        }
      }
    }

    if (!memory && controlSoFar >= playMsForMemory) memory = await readHeap();
    // v2.0: the game can end (THE END, then the credits) before 60 s of control. The run ends with it;
    // the heap is read then if it was not read yet (README.md, Methods).
    if (probe && probe.ended) {
      if (!memory && playMsForMemory !== Infinity) memory = await readHeap();
      break;
    }
    if (stopAfterControlMs !== null && controlSoFar >= stopAfterControlMs) break;
    // Go on for 1 s of control past the 60 s window, so the game's own log (which the window
    // is cut from) has all of it too: the bot's count of control and the log's differ by ms.
    if (stopAfterControlMs === null && t >= sessionMs && memory && sawApple && controlSoFar >= fpsPlayMs + 1000) break;
    if (t >= maxMs) {
      incomplete = true;
      break;
    }
    await sleep(pollMs);
  }
  // A turn sent on the last look at the game can't be checked: the run ended before the next look.
  if (check) steering.unchecked++;

  const end = await page.evaluate(() => performance.now());
  const raw = await page.evaluate(() => ({
    log: window.snakeGame ? window.snakeGame.log : [],
    frames: window.__rig.frames,
    keys: window.__rig.keys,
    page: { devicePixelRatio, innerWidth, innerHeight, userAgent: navigator.userAgent, version: window.snakeGame?.version ?? null },
  }));
  // Which GPU draws WebGL in this browser mode (read after the run, in a fresh canvas).
  raw.page.webglRenderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return gl ? gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : null;
  });
  await browser.close();

  const origin = new URL(url).origin;
  const requestList = [...requests.values()];
  const apple = firstApple(raw.log);
  // A game that ended (v2.0) before the session's 180 s: both control shares stop at its end screen (prompt 15).
  const endedAtMs = gameEndedMs(raw.log);
  const session = Math.min(sessionMs, end, endedAtMs ?? Infinity);
  // Frame rate over the first fpsPlayMs of control (by the game's screen log): the same 60 s of play as the heap.
  const fpsWindow = firstMs(controlIntervals(raw.log, end), fpsPlayMs);
  const fps = {
    ...frameRate(raw.frames, fpsWindow, memory ? [memory.framesExcluded] : []),
    window: { controlMs: fpsWindow.reduce((sum, [a, b]) => sum + b - a, 0), from: fpsWindow.length ? fpsWindow[0][0] : null, to: fpsWindow.length ? fpsWindow[fpsWindow.length - 1][1] : null },
  };
  const firstDeath = raw.log.find(e => e.type === 'screen' && e.name === 'gameover');

  return {
    summary: {
      mode,
      browserVersion,
      page: raw.page,
      endMs: end,
      incomplete,
      timeToFirstAppleMs: apple ? apple.t : null,
      firstAppleTick: apple ? apple.tick : null,
      screensBeforeFirstApple: apple ? segments(raw.log, apple.t).map(s => ({ screen: s.name, ms: s.ms })) : null,
      loadMs: loadMs(raw.log),
      sessionMs: session,
      controlMs: controlMs(raw.log, session),
      controlShare: controlMs(raw.log, session) / session,
      controlInPlay: playShare(raw.log, end, fpsPlayMs) ?? (endedAtMs !== null ? playShareUntilEnd(raw.log, endedAtMs) : null),
      endedAtMs,
      search: firstSight,
      memory: memory && { ...memory, raw: undefined },
      memoryRaw: memory?.raw ?? null,
      fps,
      steering,
      nextKeys,
      applesBeforeFirstDeath: raw.log.filter(e => e.type === 'apple' && (!firstDeath || e.t < firstDeath.t)).map(e => ({ score: e.score, tick: e.tick })),
      deathsInSession: raw.log.filter(e => e.type === 'screen' && e.name === 'gameover' && e.t <= session).length,
      requests: {
        count: requestList.length,
        bytes: requestList.reduce((s, r) => s + r.bytes, 0),
        external: offOrigin(requestList.map(r => r.url), origin),
        failed: requestList.filter(r => r.failed).map(r => `${r.url} (${r.failed})`),
      },
      errors,
    },
    raw: { log: raw.log, keys: raw.keys, frames: raw.frames, requests: requestList.map(r => ({ path: r.url.replace(origin, ''), bytes: r.bytes })) },
  };
}
