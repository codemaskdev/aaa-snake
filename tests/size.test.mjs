import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { countLines, sizeOf } from '../tools/rig/size.mjs';
import { ROOT } from './helpers.mjs';

test('line counts match wc -l', () => {
  for (const name of ['rules.js', 'game.js', 'index.html']) {
    const file = path.join(ROOT, 'src', name);
    const wc = Number(execFileSync('wc', ['-l', file], { encoding: 'utf8' }).trim().split(/\s+/)[0]);
    assert.equal(countLines(fs.readFileSync(file)), wc, name);
  }
});

test('sizes: js, code and assets are split by file type', () => {
  const s = sizeOf(path.join(ROOT, 'tests/fixture'));
  assert.equal(s.jsBytes, 0);
  assert.equal(s.assetBytes, 65536, 'blob.bin is the only asset');
  assert.equal(s.buildBytes, 65536 + fs.statSync(path.join(ROOT, 'tests/fixture/index.html')).size);
  const src = sizeOf(path.join(ROOT, 'src'));
  assert.equal(src.jsBytes, fs.statSync(path.join(ROOT, 'src/rules.js')).size + fs.statSync(path.join(ROOT, 'src/game.js')).size);
  assert.equal(src.assetBytes, 0);
});
