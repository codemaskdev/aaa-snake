import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { upsertSummary, parseCsv, COLUMNS } from '../tools/rig/summary.mjs';
import { tempDir } from './helpers.mjs';

const result = (version, ttfa) => ({
  version,
  measuredAt: '2026-01-01T00:00:00.000Z',
  settings: { runs: 5 },
  size: { jsLines: 1, codeLines: 2, jsBytes: 3, assetBytes: 4, buildBytes: 5 },
  median: { timeToFirstAppleMs: ttfa, controlShare: 0.5, loadMs: 6, heapUsedAfterGcBytes: 7, downloadBytes: 8, fpsMedian: 59.88023952095874, fpsP5: 30.1 },
});

test('one row per version, in version order, replaced when measured again, never rounded', () => {
  const file = path.join(tempDir('csv'), 'summary.csv');
  upsertSummary(file, result('v1.10', 1), 'visible');
  upsertSummary(file, result('v1.2', 2), 'visible');
  upsertSummary(file, result('v1.0', 0.1 + 0.2), 'visible');
  upsertSummary(file, result('v1.2', 3), 'visible');
  const text = fs.readFileSync(file, 'utf8');
  assert.equal(text.split('\n')[0], COLUMNS.join(','));
  const rows = parseCsv(text);
  assert.deepEqual(rows.map(r => r.version), ['v1.0', 'v1.2', 'v1.10']);
  assert.equal(rows[1].time_to_first_apple_ms, '3');
  assert.equal(rows[0].time_to_first_apple_ms, '0.30000000000000004');
  assert.equal(rows[0].fps_median, '59.88023952095874');
});
