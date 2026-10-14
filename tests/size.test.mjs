import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { countLines, sizeOf } from '../tools/rig/size.mjs';
import { ROOT } from './helpers.mjs';

test('line counts match wc -l', () => {
  const files = fs.readdirSync(path.join(ROOT, 'src'), { recursive: true }).filter(f => fs.statSync(path.join(ROOT, 'src', f)).isFile());
  for (const name of files) {
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
  const jsFiles = fs.readdirSync(path.join(ROOT, 'src'), { recursive: true }).filter(f => f.endsWith('.js'));
  assert.equal(src.jsBytes, jsFiles.reduce((sum, f) => sum + fs.statSync(path.join(ROOT, 'src', f)).size, 0));
  // Assets are every file that is not code: since v1.3, the voice lines in src/voice/.
  const assets = fs.readdirSync(path.join(ROOT, 'src'), { recursive: true })
    .filter(f => fs.statSync(path.join(ROOT, 'src', f)).isFile() && !/\.(js|html|css)$/.test(f));
  assert.equal(src.assetBytes, assets.reduce((sum, f) => sum + fs.statSync(path.join(ROOT, 'src', f)).size, 0));
});
