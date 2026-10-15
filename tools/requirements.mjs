// `npm run requirements <version>`: the "Minimum requirements" of the REMASTERED screen (since v1.9),
// written into src/requirements.js from the measurement of <version> (measurements/<version>.json):
// its download bytes and JS heap after GC (the measured run, or the median), and its asset bytes.
// The numbers are never typed by hand; tests/v1.9.test.mjs checks the file against the measurement.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kindOf } from './rig/summary.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export function requirementsFrom(result) {
  return {
    from: result.version,
    measuredAt: result.measuredAt,
    kind: kindOf(result.settings.runs),
    downloadBytes: result.median.downloadBytes,
    heapAfterGcBytes: result.median.heapUsedAfterGcBytes,
    assetBytes: result.size.assetBytes,
  };
}

export function requirementsJs(req) {
  return `// AAA Snake: the minimum requirements on the REMASTERED screen.
// Written by \`npm run requirements ${req.from}\` from measurements/${req.from}.json; do not edit by hand.
const REQUIREMENTS = ${JSON.stringify(req, null, 2)};
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!/^v\d+\.\d+$/.test(version || '')) {
    console.error('usage: npm run requirements <measured version>   (like v1.7)');
    process.exit(1);
  }
  const result = JSON.parse(fs.readFileSync(path.join(ROOT, 'measurements', `${version}.json`), 'utf8'));
  const req = requirementsFrom(result);
  fs.writeFileSync(path.join(ROOT, 'src/requirements.js'), requirementsJs(req));
  console.log(`wrote src/requirements.js from measurements/${version}.json: ${JSON.stringify(req)}`);
}
