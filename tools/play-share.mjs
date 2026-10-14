// `npm run play-share`: control share in play for every measured version, from the raw
// headless runs already saved under measurements/ (no new runs). Since prompt 5,
// `npm run measure` computes the same number for each new version (tools/rig/stats.mjs
// playShare); this tool gives it for the versions measured before it existed, from the
// same game logs. Writes measurements/play-share-output.txt.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playShare, median, controlIntervals } from './rig/stats.mjs';
import { compareVersions } from './build.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MEASUREMENTS = path.join(ROOT, 'measurements');
const WINDOW_MS = 60000;

export function playShareOf(version, dir = MEASUREMENTS) {
  const result = JSON.parse(fs.readFileSync(path.join(dir, `${version}.json`), 'utf8'));
  const runs = result.runs.map(run => {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, version, `run-${run.run}.json`), 'utf8'));
    const logControlMs = controlIntervals(raw.log, run.endMs).reduce((sum, [a, b]) => sum + b - a, 0);
    return { run: run.run, logControlMs, ...playShare(raw.log, run.endMs, WINDOW_MS) };
  });
  // A run whose log stops short of the window has no value (before prompt 5 a headless run could end
  // right after the heap read, a few ms of control before the log reached 60000 ms).
  return { version, runs, median: median(runs.filter(r => r.share !== undefined).map(r => r.share)) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const versions = fs.readdirSync(MEASUREMENTS)
    .filter(name => /^v\d+\.\d+\.json$/.test(name))
    .map(name => name.slice(0, -'.json'.length))
    .sort(compareVersions);
  const lines = ['$ npm run play-share', `control share in play: the first ${WINDOW_MS} ms of control, from the first control frame, in each saved headless run`];
  for (const version of versions) {
    const { runs, median: m } = playShareOf(version);
    lines.push(`${version}: median ${m}`);
    for (const r of runs) {
      lines.push(r.share === undefined
        ? `  run ${r.run}: no value, its log has ${r.logControlMs} ms of control, less than ${WINDOW_MS}`
        : `  run ${r.run}: ${r.controlMs} ms of control from ${r.fromMs} to ${r.toMs} ms = ${r.share}`);
    }
  }
  fs.writeFileSync(path.join(MEASUREMENTS, 'play-share-output.txt'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  console.log('wrote measurements/play-share-output.txt');
}
