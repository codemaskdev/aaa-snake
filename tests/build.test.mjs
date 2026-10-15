// Every version stays playable side by side: each build in dist/ matches its tag.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { listVersions, versionInSource, compareVersions } from '../tools/build.mjs';
import { ROOT } from './helpers.mjs';

const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

test('version order', () => {
  assert.ok(compareVersions('v1.2', 'v1.10') < 0);
  assert.ok(compareVersions('v2.0', 'v1.9') > 0);
});

test('src/ declares a version', () => {
  assert.match(versionInSource(), /^v\d+\.\d+$/);
});

// Two exceptions: voice lines (dist/<version>/voice/) follow src/voice/, so a recording replaces its
// placeholder in every build (npm run voice; tests/v1.4.test.mjs checks they match); and since prompt 14
// requirements.js (v1.9 on) follows the measurement it is written from (npm run requirements;
// tests/v1.9.test.mjs checks it against that measurement).
test('each tagged build in dist/ is unchanged since its tag, except its voice lines and requirements.js', () => {
  const tags = new Set(git(['tag', '--list', 'v*']).split('\n').filter(Boolean));
  for (const version of listVersions()) {
    if (!tags.has(version)) continue; // built, not tagged yet
    const files = git(['ls-tree', '-r', '--name-only', version, '--', `dist/${version}`]).split('\n').filter(Boolean);
    assert.ok(files.length > 0, `${version}: the tag has no dist/${version}`);
    for (const file of files) {
      if (file.startsWith(`dist/${version}/voice/`) || file === `dist/${version}/requirements.js`) continue;
      const tagged = execFileSync('git', ['show', `${version}:${file}`], { cwd: ROOT });
      assert.ok(tagged.equals(fs.readFileSync(path.join(ROOT, file))), `${file} changed since tag ${version}`);
    }
  }
});

test('each build has its own index.html and declares its own version', () => {
  for (const version of listVersions()) {
    const dir = path.join(ROOT, 'dist', version);
    assert.ok(fs.existsSync(path.join(dir, 'index.html')));
    assert.equal(versionInSource(dir), version);
  }
});
