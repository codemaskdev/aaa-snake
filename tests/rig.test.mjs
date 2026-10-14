// The rig measured against the fixture: a fake game with known timings (tests/fixture).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { measure } from '../tools/measure.mjs';
import { runOnce } from '../tools/rig/run.mjs';
import { startServer } from '../tools/serve.mjs';
import { parseCsv } from '../tools/rig/summary.mjs';
import { ROOT, tempDir } from './helpers.mjs';

const FIXTURE = path.join(ROOT, 'tests/fixture');
let out;
let result;

before(async () => {
  out = tempDir('rig');
  result = await measure({
    version: 'fixture', dir: FIXTURE, outDir: out, command: 'test', git: false, quiet: true,
    runs: 3, sessionMs: 8000, playMsForMemory: 3000, fpsRuns: 0,
  });
});

test('passes the fixture screens in order, waits out the logo, skips the intro', () => {
  for (const run of result.runs) {
    const screens = run.screensBeforeFirstApple;
    assert.deepEqual(screens.map(s => s.screen), ['(page load)', 'logo', 'intro', 'ready', 'play']);
    const ms = Object.fromEntries(screens.map(s => [s.screen, s.ms]));
    assert.ok(ms.logo >= 1490 && ms.logo < 1600, `logo ${ms.logo} ms`);
    assert.ok(ms.intro < 150, `intro ${ms.intro} ms: the bot pressed Escape`);
    assert.ok(ms.play >= 200 && ms.play < 420, `play ${ms.play} ms: 3 moves of 100 ms`);
  }
});

test('time to first apple, load time and control share are where the fixture puts them', () => {
  for (const run of result.runs) {
    assert.equal(run.firstAppleTick, 3);
    assert.ok(run.timeToFirstAppleMs > 1700 && run.timeToFirstAppleMs < 2200, `${run.timeToFirstAppleMs}`);
    assert.ok(run.loadMs > 1490 && run.loadMs < 1700, `load ${run.loadMs}: the first intro frame`);
    // control from about 1530 ms to 8000 ms
    assert.ok(run.controlShare > 0.78 && run.controlShare < 0.83, `control ${run.controlShare}`);
    assert.equal(run.steering.accepted, run.steering.sent - run.steering.unchecked);
    assert.ok(run.steering.sent > 0);
    assert.ok(run.memory.usedSizeAfterGc > 0);
  }
  assert.equal(result.checks.sameFirstAppleTickInAllRuns, true);
  assert.deepEqual(result.checks.externalRequests, []);
  assert.deepEqual(result.checks.pageErrors, []);
  const ttfa = result.runs.map(r => r.timeToFirstAppleMs).sort((a, b) => a - b);
  assert.equal(result.median.timeToFirstAppleMs, ttfa[1]);
  assert.equal(result.runs.find(r => r.run === result.medianRun).timeToFirstAppleMs, ttfa[1]);
});

test('writes the json, raw runs, output and the summary row', () => {
  const saved = JSON.parse(fs.readFileSync(path.join(out, 'fixture.json'), 'utf8'));
  assert.equal(saved.machine.chip.length > 0, true);
  assert.ok(saved.browser.version);
  assert.equal(saved.runs.length, 3);
  const raw = JSON.parse(fs.readFileSync(path.join(out, 'fixture/run-1.json'), 'utf8'));
  assert.ok(raw.log.length > 0 && raw.frames.length > 0 && raw.keys.length > 0);
  assert.match(fs.readFileSync(path.join(out, 'fixture/output.txt'), 'utf8'), /^\$ test\n/);
  const rows = parseCsv(fs.readFileSync(path.join(out, 'summary.csv'), 'utf8'));
  assert.equal(rows[0].version, 'fixture');
  assert.equal(rows[0].time_to_first_apple_ms, String(result.median.timeToFirstAppleMs));
  const json = fs.readFileSync(path.join(out, 'fixture.json'), 'utf8');
  assert.ok(!json.includes(ROOT), 'no local paths in the measurement file');
});

test('frame rate, memory and download follow the load the fixture is given', async () => {
  const server = await startServer({ '/': FIXTURE });
  try {
    const { summary } = await runOnce({ url: `${server.url}/index.html?burn=25&alloc=20&asset=1`, mode: 'headless', sessionMs: 5000, playMsForMemory: 2000 });
    assert.ok(summary.fps.median >= 30 && summary.fps.median <= 42, `fps ${summary.fps.median} with 25 ms of work per frame`);
    assert.ok(summary.memory.usedSizeAfterGc >= 20 * 1048576, `heap ${summary.memory.usedSizeAfterGc} with 20 MiB kept`);
    assert.ok(summary.requests.bytes >= 65536, `download ${summary.requests.bytes} with blob.bin`);
  } finally {
    await server.close();
  }
});
