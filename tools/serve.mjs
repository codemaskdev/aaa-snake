// A tiny static file server with no dependencies.
// `npm run serve` serves dist/ at http://localhost:8080 (every version side by side).
// The rig uses startServer() on a free port. No compression and no caching,
// so the bytes the browser downloads are the bytes on disk plus headers.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.bin': 'application/octet-stream',
};

// Serve files under one or more roots. mounts: { '/prefix': '/abs/dir' }; '/' is the fallback.
export function startServer(mounts, port = 0) {
  const entries = Object.entries(mounts).sort((a, b) => b[0].length - a[0].length);
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    for (const [prefix, dir] of entries) {
      if (prefix !== '/' && !urlPath.startsWith(prefix + '/') && urlPath !== prefix) continue;
      let rel = prefix === '/' ? urlPath : urlPath.slice(prefix.length);
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      const file = path.join(dir, rel);
      if (!file.startsWith(dir + path.sep) && file !== dir) break;
      fs.readFile(file, (err, body) => {
        if (err) {
          res.writeHead(404, { 'content-type': 'text/plain' });
          res.end('not found');
          return;
        }
        const type = TYPES[path.extname(file)] || 'application/octet-stream';
        // One byte range ("Range: bytes=from-to"), the way v1.2 downloads its day-one patch in pieces.
        const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
        if (range) {
          const from = Number(range[1]);
          const to = Math.min(range[2] === '' ? body.length - 1 : Number(range[2]), body.length - 1);
          if (from > to) {
            res.writeHead(416, { 'content-range': `bytes */${body.length}` });
            res.end();
            return;
          }
          res.writeHead(206, {
            'content-type': type,
            'content-length': to - from + 1,
            'content-range': `bytes ${from}-${to}/${body.length}`,
            'accept-ranges': 'bytes',
            'cache-control': 'no-store',
          });
          res.end(body.subarray(from, to + 1));
          return;
        }
        // Headers unchanged since v1.0, so download bytes stay comparable across versions.
        res.writeHead(200, {
          'content-type': type,
          'content-length': body.length,
          'cache-control': 'no-store',
        });
        res.end(body);
      });
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  });
  return new Promise(resolve => {
    server.listen(port, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) });
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(fileURLToPath(new URL('../dist', import.meta.url)));
  const { url } = await startServer({ '/': root }, Number(process.env.PORT || 8080));
  console.log(`Serving dist/ at ${url}/  (open ${url}/v1.0/ to play v1.0)`);
}
