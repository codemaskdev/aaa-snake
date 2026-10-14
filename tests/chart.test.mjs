import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderSvg, renderPng, niceMax, PANELS } from '../tools/chart.mjs';
import { COLUMNS } from '../tools/rig/summary.mjs';
import { tempDir, pngSize } from './helpers.mjs';

const row = { version: 'v1.0', time_to_first_apple_ms: '326', control_share: '0.99', load_ms: '30', download_bytes: '9300', heap_used_after_gc_bytes: '780000', js_lines: '239', fps_median: '59.88', fps_p5: '57.1' };

test('every panel reads an existing CSV column', () => {
  for (const p of PANELS) assert.ok(COLUMNS.includes(p.col), p.col);
});

test('nice axis maximum', () => {
  assert.equal(niceMax(61), 80);
  assert.equal(niceMax(0.33), 0.4);
  assert.equal(niceMax(9.3), 10);
  assert.equal(niceMax(0), 1);
});

test('the chart shows each metric with its value from the CSV', () => {
  const svg = renderSvg([row]);
  for (const p of PANELS) assert.ok(svg.includes(p.title), p.title);
  assert.ok(svg.includes('0.33 s'));
  assert.ok(svg.includes('239'));
});

test('renders a 1920 x 1080 PNG', async () => {
  const file = path.join(tempDir('chart'), 'bloat.png');
  await renderPng(renderSvg([row, { ...row, version: 'v1.1', time_to_first_apple_ms: '30000' }]), file);
  assert.deepEqual(pngSize(file), { width: 1920, height: 1080 });
  assert.ok(fs.statSync(file).size > 10000);
});
