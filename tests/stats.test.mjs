import { test } from 'node:test';
import assert from 'node:assert/strict';
import { median, percentile, segments, controlMs, loadMs, frameRate, firstApple, offOrigin, PAGE_LOAD } from '../tools/rig/stats.mjs';

const log = [
  { t: 10, type: 'screen', name: 'logo' },
  { t: 20, type: 'frame', name: 'logo' },
  { t: 1510, type: 'screen', name: 'intro' },
  { t: 1525, type: 'frame', name: 'intro' },
  { t: 1530, type: 'screen', name: 'ready' },
  { t: 1540, type: 'frame', name: 'ready' },
  { t: 1550, type: 'screen', name: 'play' },
  { t: 1855, type: 'apple', score: 1, tick: 3 },
  { t: 5000, type: 'screen', name: 'gameover' },
  { t: 5100, type: 'screen', name: 'ready' },
];

test('median and nearest-rank percentile', () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
  const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(hundred, 5), 5);
  assert.equal(percentile([60, 60, 60, 30], 5), 30);
  assert.equal(percentile([7], 5), 7);
});

test('screens between navigation start and the first apple', () => {
  const apple = firstApple(log);
  assert.equal(apple.t, 1855);
  assert.deepEqual(segments(log, apple.t).map(s => [s.name, s.ms]), [
    [PAGE_LOAD, 10], ['logo', 1500], ['intro', 20], ['ready', 20], ['play', 305],
  ]);
});

test('control share counts ready and play only, inside the window', () => {
  // ready 1530-1550 (20) + play 1550-5000 (3450) + ready 5100-6000 (900)
  assert.equal(controlMs(log, 6000), 20 + 3450 + 900);
  // window ends inside play
  assert.equal(controlMs(log, 2000), 20 + 450);
  assert.equal(controlMs([], 1000), 0);
});

test('load time: the first frame of a control screen or the first accepts entry', () => {
  assert.equal(loadMs(log), 1540, 'no accepts entries: the first ready frame');
  const withWarning = [
    { t: 5, type: 'screen', name: 'warning' },
    { t: 20, type: 'frame', name: 'warning' },
    { t: 4020, type: 'accepts', name: 'warning' },
    { t: 4500, type: 'screen', name: 'ready' },
    { t: 4510, type: 'frame', name: 'ready' },
  ];
  assert.equal(loadMs(withWarning), 4020, 'the warning counts from the frame it starts listening, not its first frame');
  assert.equal(loadMs([]), null);
});

test('frame rate: median of per-second frame counts, p5 of per-frame values', () => {
  const frames = [];
  for (let i = 0; i <= 150; i++) frames.push(i * 20);      // 50 fps from 0 to 3000 ms
  frames.push(3100);                                         // then one 100 ms frame (10 fps)
  const all = frameRate(frames, [[0, 3200]]);
  assert.equal(all.seconds, 3);
  assert.equal(all.median, 50);
  assert.equal(all.frames, 151);
  assert.equal(all.p5, 50);
  assert.equal(all.longestFrameMs, 100);
  // 20 frames with one 100 ms gap: the slowest frame is the 5th percentile.
  const few = [0, 20, 40, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 400, 420, 440, 460];
  assert.equal(frameRate(few, [[0, 1000]]).p5, 10);
  // Exclusions drop frames and whole seconds.
  const excluded = frameRate(frames, [[0, 3200]], [[2950, 3200]]);
  assert.equal(excluded.longestFrameMs, 20);
  assert.equal(excluded.seconds, 2);
  // Only frames inside the intervals count.
  assert.equal(frameRate(frames, [[500, 700]]).frames, 10);
});

test('frame rate: a 25 ms frame snapped to a 60 Hz display reads as 40 fps', () => {
  // rAF timestamps alternate 16.7 and 33.3 ms apart, as measured on the M1.
  const frames = [0];
  for (let i = 1; i <= 240; i++) frames.push(frames[i - 1] + (i % 2 ? 1000 / 60 : 2000 / 60));
  const r = frameRate(frames, [[0, 6000]]);
  assert.equal(r.median, 40);
  assert.equal(Math.round(r.p5), 30);
});

test('only the game\'s own origin is allowed', () => {
  const origin = 'http://127.0.0.1:5000';
  assert.deepEqual(offOrigin([
    'http://127.0.0.1:5000/index.html',
    'http://127.0.0.1:5000/patch/v1.2.js',
    'data:image/png;base64,AAAA',
    'blob:http://127.0.0.1:5000/1234-5678',
    'http://localhost:5000/index.html',
    'http://127.0.0.1:5001/patch.js',
    'https://127.0.0.1:5000/patch.js',
    'https://cdn.example.com/patch.js',
    'blob:https://example.com/1234',
  ], origin), [
    'http://localhost:5000/index.html',
    'http://127.0.0.1:5001/patch.js',
    'https://127.0.0.1:5000/patch.js',
    'https://cdn.example.com/patch.js',
    'blob:https://example.com/1234',
  ]);
});
