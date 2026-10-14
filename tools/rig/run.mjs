// One measured run: open a build in Chromium, let the bot play, collect the raw data.
import { chromium } from 'playwright';
import { decide, KEY_FOR } from './bot.mjs';
import {
  CONTROL_SCREENS, segments, controlMs, controlIntervals, firstApple, loadMs, frameRate,
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
 *   maxMs        give up after this long (page time)
 *   pollMs       pause between two looks at the game
 */
export async function runOnce({ url, mode = 'headless', sessionMs = 180000, playMsForMemory = 60000, maxMs = 1200000, pollMs = 4 }) {
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
      if (probe.next) nextKeys[probe.screen] = probe.next;

      if (CONTROL_SCREENS.has(probe.screen)) {
        if (changed || probe.tick !== lastActedTick) {
          lastActedTick = probe.tick;
          const dir = decide(probe);
          // On 'ready' any arrow key starts the game, so always press one.
          if (probe.screen !== 'play' || dir !== probe.heading) {
            await page.keyboard.press(KEY_FOR[dir]);
            if (probe.screen === 'play') {
              steering.sent++;
              check = dir;
            }
          }
        }
      } else if (probe.next && (changed || t - lastNextPress > 250)) {
        await page.keyboard.press(probe.next);
        lastNextPress = t;
      }
    }

    if (!memory && controlSoFar >= playMsForMemory) memory = await readHeap();
    if (t >= sessionMs && memory && sawApple) break;
    if (t >= maxMs) {
      incomplete = true;
      break;
    }
    await sleep(pollMs);
  }

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
  const accepts = new Set([...CONTROL_SCREENS, ...Object.keys(nextKeys)]);
  const session = Math.min(sessionMs, end);
  const fps = frameRate(raw.frames, controlIntervals(raw.log, end), memory ? [memory.framesExcluded] : []);
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
      loadMs: loadMs(raw.log, accepts),
      sessionMs: session,
      controlMs: controlMs(raw.log, session),
      controlShare: controlMs(raw.log, session) / session,
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
        external: requestList.filter(r => !r.url.startsWith(origin) && !r.url.startsWith('data:')).map(r => r.url),
        failed: requestList.filter(r => r.failed).map(r => `${r.url} (${r.failed})`),
      },
      errors,
    },
    raw: { log: raw.log, keys: raw.keys, frames: raw.frames, requests: requestList.map(r => ({ path: r.url.replace(origin, ''), bytes: r.bytes })) },
  };
}
