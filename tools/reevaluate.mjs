// `npm run reevaluate <version>`: the frame rate of a measured version computed again from its saved raw
// runs (measurements/<version>/), with the rules as they are now; nothing is measured again. Since
// prompt 16 a run with under one whole second of control takes its median over individual frames
// (tools/rig/stats.mjs frameRate). Rewrites measurements/<version>.json, its summary.csv row, and adds
// what changed to measurements/<version>/output.txt.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { frameRate, firstMs, controlIntervals, median } from './rig/stats.mjs';
import { upsertSummary } from './rig/summary.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MEASUREMENTS = path.join(ROOT, 'measurements');

export function reevaluate(version, dir = MEASUREMENTS) {
  const file = path.join(dir, `${version}.json`);
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  const raw = name => JSON.parse(fs.readFileSync(path.join(dir, version, name), 'utf8'));
  const windowOf = (r, end) => firstMs(controlIntervals(r.log, end), result.settings.fpsPlayMs);
  for (const run of result.fpsRuns) {
    const r = raw(`fps-run-${run.run}.json`);
    Object.assign(run, frameRate(r.frames, windowOf(r, run.endMs), []));
  }
  for (const run of result.runs) {
    const r = raw(`run-${run.run}.json`);
    Object.assign(run.fps, frameRate(r.frames, windowOf(r, run.endMs), run.memory ? [run.memory.framesExcluded] : []));
  }
  const m = result.median;
  const before = { fpsMedian: m.fpsMedian, fpsP5: m.fpsP5, budget: result.budget.pass };
  m.fpsMedian = median(result.fpsRuns.map(r => r.median));
  m.fpsP5 = median(result.fpsRuns.map(r => r.p5));
  m.fpsMedianOverFrames = result.fpsRuns.every(r => r.medianOverFrames) ? median(result.fpsRuns.map(r => r.medianOverFrames)) : null;
  m.headlessFpsMedian = median(result.runs.map(r => r.fps.median));
  m.headlessFpsP5 = median(result.runs.map(r => r.fps.p5));
  result.budget.pass = m.fpsMedian >= result.budget.fpsMedianMin && m.fpsP5 >= result.budget.fpsP5Min;
  result.reevaluated = { at: new Date().toISOString(), why: 'prompt 16: under one whole second of control, the frame-rate median is taken over individual frames', before };
  fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
  upsertSummary(path.join(dir, 'summary.csv'), result, result.settings.fpsMode || 'visible');
  const lines = [
    '',
    `$ npm run reevaluate ${version}   (${result.reevaluated.at}; the saved runs, nothing measured again)`,
    `frame rate (visible) before: median ${before.fpsMedian} fps, p5 ${before.fpsP5} fps, budget ${before.budget ? 'PASS' : 'FAIL'}`,
    `frame rate (visible) now:    median ${m.fpsMedian} fps${m.fpsMedianOverFrames ? ` (median over ${m.fpsMedianOverFrames} frames)` : ''}, p5 ${m.fpsP5} fps`,
    `performance budget (median >= 50 fps, p5 >= 30 fps): ${result.budget.pass ? 'PASS' : 'FAIL'}`,
  ];
  fs.appendFileSync(path.join(dir, version, 'output.txt'), lines.join('\n') + '\n');
  return { result, lines };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!/^v\d+\.\d+$/.test(version || '')) {
    console.error('usage: npm run reevaluate <version>');
    process.exit(1);
  }
  console.log(reevaluate(version).lines.join('\n'));
}
