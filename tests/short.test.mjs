import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { patchNote, formatTime, startTime, compressSpeed, compareTimeline, counterFor, loadVersion, recordShort, PLAN } from '../tools/short.mjs';
import { measure } from '../tools/measure.mjs';
import { ROOT, tempDir, pngSize } from './helpers.mjs';

test('patch notes are read from UPDATES.md sections', () => {
  const md = '# Updates\n\n## v1.0 — Snake\n- **Patch note:** "It is a snake."\n\n## v1.1 — Logos\nText\n- **Patch note:** Logos added.\n';
  assert.equal(patchNote(md, 'v1.0'), 'It is a snake.');
  assert.equal(patchNote(md, 'v1.1'), 'Logos added.');
  assert.equal(patchNote(md, 'v1.2'), null);
});

test('every clip plan has a patch note in UPDATES.md; v1.0\'s own plan fits in 30 s', () => {
  const plans = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/short/plans.json'), 'utf8'));
  const md = fs.readFileSync(path.join(ROOT, 'UPDATES.md'), 'utf8');
  for (const [version, plan] of Object.entries(plans)) {
    if (version === 'about') continue;
    assert.ok(patchNote(md, version), `${version} has a patch note`);
    if (plan.segments) assert.ok(plan.segments.reduce((s, x) => s + x.clipMs, 0) <= 30000);
  }
});

test('counter text', () => {
  assert.equal(formatTime(326.4), '0.326 s');
  assert.equal(formatTime(61234.6), '1:01.235');
  assert.equal(formatTime(-3), '0.000 s');
});

test('speed-up of the launch part: 16 s of clip, never slower than real time, 4x until 21 s', () => {
  assert.equal(compressSpeed(60000), 3.75);      // 16 s
  assert.equal(compressSpeed(48000), 3);         // 16 s
  assert.equal(compressSpeed(64000), 4);         // 16 s
  assert.equal(compressSpeed(70000), 4);         // 17.5 s
  assert.equal(compressSpeed(100000), 4.8);      // 20.83 s
  assert.equal(compressSpeed(16392), 1);         // 16.39 s
  assert.equal(compressSpeed(10000), 1);         // 10 s: the short ends up under 25 s
  for (const run of [16000, 30000, 48000, 64000, 84000, 90000, 200000]) {
    const clip = run / compressSpeed(run);
    assert.ok(clip >= PLAN.launchMs - 1e-6 && clip <= PLAN.launchMaxMs + 1e-6, `${run} ms -> ${clip} ms`);
  }
});

test('the fixed plan: previous version, patch note, launch sped up, first apple at real speed', () => {
  const prev = { version: 'v1.0', start: 33, apple: 320, median: 320, runs: 5 };
  const cur = { version: 'v1.1', start: 517, apple: 62517, median: 62500, runs: 5 };
  const t = compareTimeline(prev, cur);
  assert.deepEqual(t.map(s => s.name[0]), ['A', 'B', 'C', 'D']);
  assert.deepEqual([t[0].runFrom, t[0].clipMs, t[0].speed], [33, 3000, 1]);
  assert.equal(t[1].clipMs, 3000);
  assert.equal(t[2].runFrom, 517);
  assert.equal(t[2].speed, 3.75);
  assert.equal(t[2].clipMs, 16000);
  assert.deepEqual([t[3].runFrom, t[3].clipMs, t[3].speed], [60517, 3000, 1]);
  const total = t.reduce((s, x) => s + x.clipMs, 0);
  assert.ok(total >= 25000 && total <= 30000);
  // A previous version deep into its run starts 2 s before its apple.
  assert.equal(compareTimeline({ ...prev, start: 500, apple: 18909 }, cur)[0].runFrom, 16909);
});

test('the counter shows the run clock, then only measured medians', () => {
  const prev = { version: 'v1.0', median: 320.6, runs: 5 };
  const cur = { version: 'v1.1', median: 18908.8, runs: 5 };
  const a = { counter: 'compare' };
  assert.deepEqual(counterFor(a, { cur, prev, runT: 200, eaten: false }).newValue, '');
  assert.equal(counterFor(a, { cur, prev, runT: 200, eaten: false }).value, '0.200 s');
  const frozen = counterFor(a, { cur, prev, runT: 330, eaten: true });
  assert.deepEqual([frozen.value, frozen.newValue, frozen.label], ['0.321 s', '18.909 s', 'v1.0 -> v1.1']);
  assert.equal(counterFor({ counter: 'run' }, { cur, prev, runT: 99999, eaten: false }).value, '18.909 s', 'never past the median');
  assert.equal(counterFor({ counter: 'run' }, { cur, prev, runT: 5000, eaten: false }).value, '5.000 s');
});

test('clip start: the first frame after the first key, or after a screen first appears', () => {
  const raw = { keys: [{ t: 40, code: 'ArrowUp' }], log: [{ t: 5, type: 'screen', name: 'ready' }] };
  assert.equal(startTime({ start: 'first-key' }, raw), 50);
  assert.equal(startTime({ start: 'screen:ready' }, raw), 1000 / 60);
  assert.ok(Math.abs(startTime({ start: 'screen:ready', afterMs: 500 }, raw) - 31000 / 60) < 1e-9, 'frame 31, 516.67 ms');
  assert.throws(() => startTime({ start: 'screen:intro' }, raw));
});

test('records the fixture: replays its measured run in the fixed layout', async () => {
  const out = tempDir('short');
  await measure({
    version: 'fixture', dir: path.join(ROOT, 'tests/fixture'), outDir: out, command: 'test', git: false, quiet: true,
    runs: 1, sessionMs: 4000, playMsForMemory: 1000, fpsRuns: 0,
  });
  const shortDir = path.join(out, 'short');
  const cur = loadVersion(out, 'fixture', { start: 'first-key', segments: [{ clipMs: 3000, speed: 1 }] }, 'Fixture note.');
  const clip = await recordShort({ cur, distDirs: { cur: path.join(ROOT, 'tests/fixture') }, outDir: shortDir, frameLimit: 20, log: () => {} });
  assert.equal(clip.frames, 20);
  assert.ok(Math.abs(clip.checks.cur.replayMinusMedianMs) <= 50, `replay ${clip.checks.cur.replayMinusMedianMs} ms off the median`);
  assert.equal(clip.checks.cur.sameApplesAsRecordedRun, true);
  assert.ok(clip.safeArea.elements.every(e => e.inside));
  for (const name of ['first.png', 'middle.png', 'last.png', 'frames/00001.png']) {
    assert.deepEqual(pngSize(path.join(shortDir, name)), { width: 1080, height: 1920 });
  }
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,nb_frames', '-of', 'json', path.join(shortDir, 'short-fixture.mp4')], { encoding: 'utf8' });
  const stream = JSON.parse(probe).streams[0];
  assert.deepEqual([stream.codec_name, stream.width, stream.height, stream.r_frame_rate, stream.nb_frames], ['h264', 1080, 1920, '30/1', '20']);
});
