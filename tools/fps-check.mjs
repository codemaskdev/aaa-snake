// `npm run fps-check`: does headless frame rate match a visible window on this Mac?
// Runs the test fixture under known loads (CPU busy work, heavy WebGL) in three
// browser modes and prints the frame rate of each. Saves measurements/fps-check.json
// and measurements/fps-check-output.txt. This is why `npm run measure` takes frame
// rate from a visible window.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
import { runOnce } from './rig/run.mjs';
import { machineInfo } from './rig/machine.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LOADS = [
  { query: 'burn=0', what: 'no extra work' },
  { query: 'burn=25', what: '25 ms of CPU work per frame' },
  { query: 'gl=100', what: 'light WebGL shader' },
  { query: 'gl=400', what: 'heavy WebGL shader' },
];
const MODES = ['headless-shell', 'headless', 'visible'];
const SESSION_MS = 12000;

const lines = [];
const say = t => { lines.push(t); console.log(t); };
say('$ npm run fps-check');
const machine = machineInfo();
say(`machine: ${machine.model} (${machine.modelIdentifier}), ${machine.chip}, ${machine.ramBytes} bytes RAM, ${machine.os}`);
say(`each cell: one run of tests/fixture, ${SESSION_MS} ms, frames during play only`);

const server = await startServer({ '/': path.join(ROOT, 'tests/fixture') });
const results = [];
try {
  for (const load of LOADS) {
    for (const mode of MODES) {
      const { summary } = await runOnce({ url: `${server.url}/index.html?${load.query}`, mode, sessionMs: SESSION_MS, playMsForMemory: Infinity, maxMs: SESSION_MS });
      results.push({ load: load.query, what: load.what, mode, browserVersion: summary.browserVersion, webglRenderer: summary.page.webglRenderer, fps: summary.fps });
      say(`${load.query.padEnd(8)} ${mode.padEnd(15)} median ${summary.fps.median} fps, p5 ${summary.fps.p5} fps, ${summary.fps.frames} frames, longest ${summary.fps.longestFrameMs} ms  [${summary.page.webglRenderer}]`);
    }
  }
} finally {
  await server.close();
}
const out = path.join(ROOT, 'measurements');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'fps-check.json'), JSON.stringify({ measuredAt: new Date().toISOString(), machine, sessionMs: SESSION_MS, results }, null, 2) + '\n');
say('wrote measurements/fps-check.json and measurements/fps-check-output.txt');
fs.writeFileSync(path.join(out, 'fps-check-output.txt'), lines.join('\n') + '\n');
