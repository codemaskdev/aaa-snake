import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from '../tools/serve.mjs';
import { ROOT } from './helpers.mjs';

test('the server answers byte ranges, as the day-one patch download needs', async () => {
  const dir = path.join(ROOT, 'tests/fixture');
  const server = await startServer({ '/': dir });
  try {
    const whole = fs.readFileSync(path.join(dir, 'blob.bin'));
    const part = await fetch(`${server.url}/blob.bin`, { headers: { Range: 'bytes=100-355' } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get('content-range'), `bytes 100-355/${whole.length}`);
    assert.ok(Buffer.from(await part.arrayBuffer()).equals(whole.subarray(100, 356)));
    const tail = await fetch(`${server.url}/blob.bin`, { headers: { Range: `bytes=${whole.length - 10}-${whole.length + 500}` } });
    assert.equal((await tail.arrayBuffer()).byteLength, 10);
    const past = await fetch(`${server.url}/blob.bin`, { headers: { Range: `bytes=${whole.length}-` } });
    assert.equal(past.status, 416);
    const full = await fetch(`${server.url}/blob.bin`);
    assert.equal(full.status, 200);
    assert.equal((await full.arrayBuffer()).byteLength, whole.length);
  } finally {
    await server.close();
  }
});
