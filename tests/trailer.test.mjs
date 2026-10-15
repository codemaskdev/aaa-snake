// The trailer (prompt 16): v1.0 and v2.0 side by side on one clock, real time at both ends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trailerTimeline, trailerCounter, TRAILER } from '../tools/trailer.mjs';

test('the trailer: real time first and last, the middle sped up in steps of 0.05x, 30 s at most, ending 1 s after THE END', () => {
  const right = { version: 'v2.0', raw: { log: [{ t: 107290, type: 'apple' }, { t: 113307, type: 'screen', name: 'the-end' }] } };
  const [first, middle, last] = trailerTimeline(right);
  assert.deepEqual([first.runFrom, first.runTo, first.speed], [0, TRAILER.firstMs, 1]);
  assert.equal(middle.runFrom, TRAILER.firstMs);
  assert.equal(middle.speed, 17.9, '89307 ms of run in at most 5000 ms of clip: 17.8614x, up to the next 0.05');
  assert.ok(Math.abs(middle.runTo - last.runFrom) < 1e-6, 'the middle ends where the last part starts');
  assert.deepEqual([last.runFrom, last.runTo, last.speed], [104307, 114307, 1]);
  assert.ok(last.runFrom < 107290, 'the inner apple is in the real-time end');
  const total = first.clipMs + middle.clipMs + last.clipMs;
  assert.ok(total <= TRAILER.totalMs && total >= 25000, `${total} ms`);
  assert.throws(() => trailerTimeline({ version: 'v1.0', raw: { log: [] } }), /never shows THE END/);
});

test('the trailer counters run on the shared clock until each version\'s own first apple, then hold its measured median', () => {
  const v10 = { median: 320.09999999403954 };
  assert.deepEqual(trailerCounter(v10, null, 200, 'Snake'), { label: 'Snake: first apple in', value: '0.200 s', frozen: false });
  assert.deepEqual(trailerCounter(v10, 320, 90000, 'Snake'), { label: 'Snake: first apple in', value: '0.320 s', frozen: true });
  const v20 = { median: 107290.10000002384 };
  assert.equal(trailerCounter(v20, null, 60000, 'AAA Snake').value, '1:00.000');
  assert.equal(trailerCounter(v20, 107290, 110000, 'AAA Snake').value, '1:47.290');
});

test('the stacked trailer layout: both panels full width inside the frame, every text inside the safe area and its box (prompt 20)', async () => {
  const { chromium } = await import('playwright');
  const path = await import('node:path');
  const { ROOT } = await import('./helpers.mjs');
  const { checkSafeAreaOf } = await import('../tools/trailer.mjs');
  const { PREMISE, WIDTH, HEIGHT } = await import('../tools/short.mjs');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
    await page.goto(`file://${path.join(ROOT, 'tools/short/trailer.html')}`);
    await page.evaluate(p => {
      window.trailer.setText(p, 'Snake (v1.0)', 'AAA Snake (v2.0)');
      window.trailer.setCounter('left', { label: 'Snake: first apple in', value: '0.320 s', frozen: true });
      window.trailer.setCounter('right', { label: 'AAA Snake: first apple in', value: '1:47.290', frozen: true });
      window.trailer.setSpeed('12.35x');
    }, PREMISE);
    await checkSafeAreaOf(page);
    const r = await page.evaluate(() => ['left', 'right'].map(id => document.getElementById(id).getBoundingClientRect().toJSON()));
    assert.deepEqual(r.map(x => [x.width, x.left]), [[1080, 0], [1080, 0]], 'each panel the full width');
    assert.ok(r[0].bottom <= r[1].top, 'v1.0 on top, v2.0 below');
  } finally {
    await browser.close();
  }
});
