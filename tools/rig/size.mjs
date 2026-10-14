// Size of one build on disk.
// Lines are counted by this file the way `wc -l` counts them: the number of
// newline characters (tests/size.test.mjs checks it against wc -l).
import fs from 'node:fs';
import path from 'node:path';

const JS = new Set(['.js', '.mjs']);
const CODE = new Set(['.js', '.mjs', '.html', '.css']);   // everything else is an asset
const TEXT = new Set(['.js', '.mjs', '.html', '.css', '.json', '.glsl', '.svg', '.txt']);

export function countLines(buffer) {
  let n = 0;
  for (const byte of buffer) if (byte === 10) n++;
  return n;
}

function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else if (entry.name !== '.DS_Store') out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

export function sizeOf(dir) {
  const files = walk(dir).map(rel => {
    const body = fs.readFileSync(path.join(dir, rel));
    const ext = path.extname(rel).toLowerCase();
    return { path: rel, bytes: body.length, lines: TEXT.has(ext) ? countLines(body) : null, ext };
  });
  const sum = (list, field) => list.reduce((s, f) => s + f[field], 0);
  const js = files.filter(f => JS.has(f.ext));
  const code = files.filter(f => CODE.has(f.ext));
  const assets = files.filter(f => !CODE.has(f.ext));
  return {
    tool: 'tools/rig/size.mjs: newline characters per file, like wc -l',
    jsLines: sum(js, 'lines'),
    codeLines: sum(code, 'lines'),
    jsBytes: sum(js, 'bytes'),
    assetBytes: sum(assets, 'bytes'),
    buildBytes: sum(files, 'bytes'),
    files: files.map(({ ext, ...f }) => f),
  };
}
