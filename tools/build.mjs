// `npm run build <version>`: copy the game in src/ to dist/<version>/.
// Old builds are never overwritten, so every version stays playable side by side.
// It also rewrites dist/index.html, a list of every built version.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

export function versionInSource(srcDir = SRC) {
  for (const name of fs.readdirSync(srcDir)) {
    if (!name.endsWith('.js')) continue;
    const match = fs.readFileSync(path.join(srcDir, name), 'utf8').match(/const VERSION = '([^']+)'/);
    if (match) return match[1];
  }
  return null;
}

export function listVersions(distDir = DIST) {
  if (!fs.existsSync(distDir)) return [];
  return fs.readdirSync(distDir)
    .filter(name => /^v\d+\.\d+$/.test(name))
    .sort((a, b) => compareVersions(a, b));
}

export function compareVersions(a, b) {
  const [a1, a2] = a.slice(1).split('.').map(Number);
  const [b1, b2] = b.slice(1).split('.').map(Number);
  return a1 - b1 || a2 - b2;
}

function writeIndex() {
  const items = listVersions().map(v => `    <li><a href="${v}/">${v}</a></li>`).join('\n');
  fs.writeFileSync(path.join(DIST, 'index.html'), `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>AAA Snake: every version</title></head>
<body style="font: 18px monospace; background: #000; color: #fff">
  <h1>AAA Snake: every version</h1>
  <ul>
${items}
  </ul>
</body>
</html>
`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!/^v\d+\.\d+$/.test(version || '')) {
    console.error('usage: npm run build <version>   (like v1.0)');
    process.exit(1);
  }
  const inSource = versionInSource();
  if (inSource !== version) {
    console.error(`src/ says VERSION = '${inSource}', not '${version}'. Update the VERSION constant first.`);
    process.exit(1);
  }
  const out = path.join(DIST, version);
  if (fs.existsSync(out)) {
    console.error(`dist/${version}/ already exists. Old builds are never overwritten.`);
    process.exit(1);
  }
  fs.cpSync(SRC, out, { recursive: true, filter: src => path.basename(src) !== '.DS_Store' });
  writeIndex();
  console.log(`built dist/${version}/: ${fs.readdirSync(out).join(', ')}`);
}
