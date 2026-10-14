import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { patchNote, formatTime, clipToRun, speedAt, startTime, recordShort } from '../tools/short.mjs';
import { measure } from '../tools/measure.mjs';
import { ROOT, tempDir, pngSize } from './helpers.mjs';

test('patch notes are read from UPDATES.md sections', () => {
  const md = '# Updates\n\n## v1.0 — Snake\n- **Patch note:** "It is a snake."\n\n## v1.1 — Logos\nText\n- **Patch note:** Logos added.\n';
  assert.equal(patchNote(md, 'v1.0'), 'It is a snake.');
  assert.equal(patchNote(md, 'v1.1'), 'Logos added.');
  assert.equal(patchNote(md, 'v1.2'), null);
});

test('every clip plan has a patch note in UPDATES.md and fits in 30 s', () => {
  const plans = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/short/plans.json'), 'utf8'));
  const md = fs.readFileSync(path.join(ROOT, 'UPDATES.md'), 'utf8');
  for (const [version, plan] of Object.entries(plans)) {
    if (version === 'about') continue;
    assert.ok(patchNote(md, version), `${version} has a patch note`);
    assert.ok(plan.segments.reduce((s, x) => s + x.clipMs, 0) <= 30000);
  }
});

test('counter text', () => {
  assert.equal(formatTime(326.4), '0.326 s');
  assert.equal(formatTime(61234.6), '1:01.235');
  assert.equal(formatTime(-3), '0.000 s');
});

test('clip time to run time through speed segments', () => {
  const plan = { segments: [{ clipMs: 1000, speed: 1 }, { clipMs: 2000, speed: 10 }] };
  const toRun = clipToRun(plan, 500);
  assert.equal(toRun(0), 500);
  assert.equal(toRun(1000), 1500);
  assert.equal(toRun(2000), 11500);
  assert.equal(speedAt(plan, 999), 1);
  assert.equal(speedAt(plan, 1000), 10);
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
  const clip = await recordShort({
    version: 'fixture', distDir: path.join(ROOT, 'tests/fixture'), measurementsDir: out, outDir: shortDir, note: 'Fixture note.',
    plan: { start: 'first-key', segments: [{ clipMs: 3000, speed: 1 }] }, frameLimit: 20, log: () => {},
  });
  assert.equal(clip.frames, 20);
  assert.ok(Math.abs(clip.check.replayMinusMedianMs) <= 50, `replay ${clip.check.replayMinusMedianMs} ms off the median`);
  assert.equal(clip.check.sameApplesAsRecordedRun, true);
  assert.ok(clip.safeArea.elements.every(e => e.inside));
  for (const name of ['first.png', 'middle.png', 'last.png', 'frames/00001.png']) {
    assert.deepEqual(pngSize(path.join(shortDir, name)), { width: 1080, height: 1920 });
  }
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,nb_frames', '-of', 'json', path.join(shortDir, 'short-fixture.mp4')], { encoding: 'utf8' });
  const stream = JSON.parse(probe).streams[0];
  assert.deepEqual([stream.codec_name, stream.width, stream.height, stream.r_frame_rate, stream.nb_frames], ['h264', 1080, 1920, '30/1', '20']);
});
