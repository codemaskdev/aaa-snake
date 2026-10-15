// Pure number crunching for the rig. No browser here, so it is easy to test.

// Pre-registered: the screens on which the player's input steers the snake.
// A new update must use these names only when arrow keys really steer the snake;
// any other screen name counts as "not in control".
export const CONTROL_SCREENS = new Set(['ready', 'play', 'cabinet']); // 'cabinet' since v2.0: the arrow keys steer v1.0's snake

// Name for the time before the game reports its first screen.
export const PAGE_LOAD = '(page load)';

// Median: the middle value; for an even count, the mean of the two middle values.
export function median(values) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Nearest-rank percentile: the smallest value with at least p % of values at or below it.
export function percentile(values, p) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * s.length));
  return s[rank - 1];
}

// The screen entries of a game log, as [{ t, name }], in time order.
export function screenEntries(log) {
  return log.filter(e => e.type === 'screen').map(e => ({ t: e.t, name: e.name }));
}

// Cut [0, end] into segments by screen: [{ name, from, to, ms }].
// The time before the first screen entry is PAGE_LOAD.
export function segments(log, end) {
  const out = [];
  let name = PAGE_LOAD;
  let from = 0;
  for (const entry of screenEntries(log)) {
    if (entry.t >= end) break;
    out.push({ name, from, to: entry.t, ms: entry.t - from });
    name = entry.name;
    from = entry.t;
  }
  out.push({ name, from, to: end, ms: end - from });
  return out.filter(s => s.ms > 0 || s.name !== PAGE_LOAD);
}

// Milliseconds in control screens within [0, end].
export function controlMs(log, end, control = CONTROL_SCREENS) {
  return segments(log, end).filter(s => control.has(s.name)).reduce((sum, s) => sum + s.ms, 0);
}

// The intervals (from, to) in control screens, for picking the frames "during play".
export function controlIntervals(log, end, control = CONTROL_SCREENS) {
  return segments(log, end).filter(s => control.has(s.name)).map(s => [s.from, s.to]);
}

// Requests that left the game's own origin (scheme + host + port of the page).
// Inline data: URLs are not requests to anyone; a blob: URL carries the origin that made it.
// Anything else (another host, another port, another scheme) is off-origin, and the rig fails the version.
export function offOrigin(urls, origin) {
  return urls.filter(url => {
    if (url.startsWith('data:')) return false;
    const inner = url.startsWith('blob:') ? url.slice(5) : url;
    try {
      return new URL(inner).origin !== origin;
    } catch {
      return true;
    }
  });
}

// The first `amount` ms of the given intervals, in order: the window "the first 60 s of play".
export function firstMs(intervals, amount) {
  const out = [];
  let left = amount;
  for (const [a, b] of intervals) {
    if (left <= 0) break;
    const take = Math.min(b - a, left);
    out.push([a, a + take]);
    left -= take;
  }
  return out;
}

// Control share in play: from the first frame of a control screen until `amount` ms of control
// have passed (the heap's and the frame rate's window), the share of that time spent in control.
// The launch screens before it are left out; whatever stops play after it (finishing moves,
// cutscenes, deaths, reconnects) counts against it. Null if the log has less control than that.
export function playShare(log, end, amount) {
  const window = firstMs(controlIntervals(log, end), amount);
  const controlled = window.reduce((sum, [a, b]) => sum + b - a, 0);
  if (!window.length || controlled < amount) return null;
  const fromMs = window[0][0];
  const toMs = window[window.length - 1][1];
  return { controlMs: controlled, fromMs, toMs, share: controlled / (toMs - fromMs) };
}

// Since v2.0 (prompt 15): when the game ends (THE END) before `amount` of control, control share in
// play is taken over the actual window: from the first control frame to the end screen.
export function playShareUntilEnd(log, endScreenMs) {
  const intervals = controlIntervals(log, endScreenMs);
  if (!intervals.length) return null;
  const controlled = intervals.reduce((sum, [a, b]) => sum + b - a, 0);
  const fromMs = intervals[0][0];
  return { controlMs: controlled, fromMs, toMs: endScreenMs, share: controlled / (endScreenMs - fromMs), endedGame: true };
}

// When the game ended: the first frame of its end screen (THE END), or null.
export function gameEndedMs(log) {
  const entry = log.find(e => e.type === 'screen' && e.name === 'the-end');
  return entry ? entry.t : null;
}

export function firstApple(log) {
  return log.find(e => e.type === 'apple') || null;
}

// Load time: the first drawn frame of a screen that accepts any key. That is the first
// 'frame' entry of a control screen, or the first 'accepts' entry (logged by the game on
// the first drawn frame where another screen starts reacting to a key), whichever is first.
export function loadMs(log, control = CONTROL_SCREENS) {
  const entry = log.find(e => (e.type === 'frame' && control.has(e.name)) || e.type === 'accepts');
  return entry ? entry.t : null;
}

// Frame rate from rAF timestamps, counting only frames inside the given intervals
// (control screens) and outside the excluded windows.
//   median: the median of per-second frame counts. Each 1-second window (laid end to
//     end from the start of each interval, kept only if wholly inside it and clear of
//     exclusions) gives one value: the number of frames that began in it. This is what an
//     FPS counter shows. (Per-frame values are not used for the median: rAF timestamps
//     snap to the 60 Hz display, so a 25 ms frame shows up as 16.7 ms and 33.3 ms
//     intervals in turn, and their median jumps between 30 and 60.)
//   p5: the 5th percentile (nearest rank) of per-frame values, 1000 / interval between
//     two consecutive frames, to catch stutter.
export function frameRate(frameTimes, intervals, excluded = []) {
  const clear = (a, b) => !excluded.some(([x, y]) => a <= y && b >= x);
  const inside = t => intervals.some(([a, b]) => t >= a && t <= b) && clear(t, t);
  const fps = [];
  const gaps = [];
  for (let i = 1; i < frameTimes.length; i++) {
    const a = frameTimes[i - 1];
    const b = frameTimes[i];
    if (b > a && inside(a) && inside(b)) {
      gaps.push(b - a);
      fps.push(1000 / (b - a));
    }
  }
  const perSecond = [];
  for (const [a, b] of intervals) {
    for (let s = a; s + 1000 <= b; s += 1000) {
      if (!clear(s, s + 1000)) continue;
      perSecond.push(frameTimes.filter(t => t >= s && t < s + 1000).length);
    }
  }
  // Under one whole second of control (v2.0, prompt 16) there is no per-second count: the median is
  // then taken over the individual frames (1000 / frame ms), and says over how many.
  const overFrames = perSecond.length === 0 && fps.length > 0;
  return {
    frames: fps.length,
    seconds: perSecond.length,
    median: overFrames ? median(fps) : median(perSecond),
    medianOverFrames: overFrames ? fps.length : null,
    p5: percentile(fps, 5),
    medianPerFrame: median(fps),
    longestFrameMs: gaps.length ? Math.max(...gaps) : null,
  };
}
