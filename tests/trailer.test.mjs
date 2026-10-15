// The trailer, design "A" (prompt 21): one full-width panel; v1.0, a sting and a card, v2.0 sped up, then real time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';
import { trailerTimeline, trailerCounter, checkSafeAreaOf, TRAILER } from '../tools/trailer.mjs';
import { HOST_GAP_MS, PREMISE, WIDTH, HEIGHT } from '../tools/short.mjs';
import { ROOT } from './helpers.mjs';

const host = Object.fromEntries([['1a', 1360], ['1b', 2000], ['2', 560], ['3', 8720], ['4', 3920], ['5', 10240]].map(([k, ms]) => [k, { id: `trailer-${k}`, file: `${k}.mp3`, ms }]));
const left = { version: 'v1.0', apple: 320.1, raw: { log: [{ t: 28, type: 'frame', name: 'ready' }] } };
const right = {
  version: 'v2.0', apple: 107290.1, firstLine: { afterAppleMs: 600 },
  raw: { log: [{ t: 101.6, type: 'frame', name: 'update-required' }, { t: 106956.8, type: 'screen', name: 'cabinet-door' }, { t: 113307.1, type: 'screen', name: 'the-end' }] },
};

test('the trailer\'s five parts: v1.0 held until "Done." + 400 ms, black with the sting, the card, v2.0 for line 3, real time, the freeze', () => {
  const parts = trailerTimeline(left, right, host);
  const [one, black, card, three, four, five] = parts;
  assert.deepEqual([one.runFrom, one.clipMs], [28, 1360 + HOST_GAP_MS + 560 + TRAILER.holdAfterDoneMs], 'from v1.0\'s first drawn frame');
  assert.equal(black.clipMs, TRAILER.stingMs);
  assert.equal(card.clipMs, 2000 + HOST_GAP_MS);
  assert.equal(three.runFrom, 101.6, 'from v2.0\'s first drawn frame');
  assert.equal(three.speed, 11.75, 'the largest step of 0.05x that keeps the part at least as long as line 3');
  assert.ok(three.clipMs >= 8720 && (three.runTo - three.runFrom) / (three.speed + 0.05) < 8720);
  assert.ok(Math.abs(three.runTo - four.runFrom) < 1e-6, 'part 4 starts where part 3 ends');
  assert.equal(four.runFrom, 106956.8 - 4000, '4 s before the cabinet is reached');
  assert.ok(Math.abs(four.runTo - (113307.1 + TRAILER.afterEndMs)) < 1e-6);
  assert.equal(five.clipMs, 10240, 'the file ends when line 5 ends');
  const at = Object.fromEntries(parts.host.map(h => [h.line, h.clipAtMs]));
  assert.deepEqual([at['trailer-1a'], at['trailer-2'], at['trailer-1b'], at['trailer-3'], at['trailer-4'], at['trailer-5']],
    [0, 1360 + HOST_GAP_MS, card.clipFrom, three.clipFrom, four.clipFrom, five.clipFrom]);
  assert.ok(four.runFrom + 3920 + HOST_GAP_MS <= 107290.1 + 600, 'line 4 ends before Snek');
  assert.equal(parts.sting.clipAtMs, black.clipFrom);
  assert.throws(() => trailerTimeline(left, { ...right, raw: { log: right.raw.log.filter(e => e.name !== 'cabinet-door') } }, host), /never shows cabinet-door/);
});

test('the trailer counter runs on the run clock until the version\'s own first apple, then holds its measured median', () => {
  const v10 = { median: 320.09999999403954 };
  assert.deepEqual(trailerCounter(v10, null, 200, 'Snake (v1.0)'), { label: 'Snake (v1.0): first apple in', value: '0.200 s', frozen: false });
  assert.deepEqual(trailerCounter(v10, 319.6, 333, 'Snake (v1.0)'), { label: 'Snake (v1.0): first apple in', value: '0.320 s', frozen: true });
  const v20 = { median: 107290.10000002384 };
  assert.equal(trailerCounter(v20, null, 60000, 'AAA Snake (v2.0)').value, '1:00.000');
  assert.equal(trailerCounter(v20, 107290, 110000, 'AAA Snake (v2.0)').value, '1:47.290');
});

test('design A\'s layout: the premise band, the game at 1080 x 1152, the counter under it, nothing below y = 1440, text inside its box', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
    await page.goto(`file://${path.join(ROOT, 'tools/short/trailer.html')}`);
    await page.evaluate(p => {
      window.trailer.setPremise(p);
      window.trailer.setCard('Patch 2.0');
      window.trailer.setCounter({ label: 'AAA Snake (v2.0): first apple in', value: '1:47.290', frozen: true });
      window.trailer.setSpeed('11.8x');
    }, PREMISE);
    for (const what of ['left', 'card', 'right']) {
      await page.evaluate(w => window.trailer.show(w), what);
      await checkSafeAreaOf(page);
    }
    const r = await page.evaluate(() => Object.fromEntries(['band', 'left', 'right', 'counterband'].map(id => [id, document.getElementById(id).getBoundingClientRect().toJSON()])));
    assert.deepEqual([r.band.top, r.band.height], [0, 90]);
    assert.deepEqual([r.left.left, r.left.top, r.left.width, r.left.height], [0, 90, 1080, 1152], '480 x 512 at 2.25x');
    assert.deepEqual([r.right.top, r.right.width, r.right.height], [90, 1080, 1152]);
    assert.ok(r.counterband.top >= 1242 && r.counterband.bottom <= 1440);
  } finally {
    await browser.close();
  }
});
