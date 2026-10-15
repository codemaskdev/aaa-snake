// The host's voice in the shorts and the trailer (prompt 17).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareTimeline, hostTrack, checkNoOverlap, HOST_GAP_MS, PLAN } from '../tools/short.mjs';
import { trailerTimeline, TRAILER } from '../tools/trailer.mjs';
import { loadHost, HOST_RECORDING } from '../tools/voice.mjs';

const line = (id, ms) => ({ id, file: `${id}.mp3`, ms });

test('voice/HOST.md: four lines for every short from v1.1 to v2.0 and five for the trailer, with the author\'s changes', () => {
  const host = loadHost();
  assert.deepEqual(Object.keys(host), ['v1.1', 'v1.2', 'v1.3', 'v1.4', 'v1.5', 'v1.6', 'v1.7', 'v1.9', 'v2.0', 'trailer']);
  for (const [short, lines] of Object.entries(host)) assert.equal(lines.length, short === 'trailer' ? 5 : 4, short);
  assert.match(host['v1.1'][2].text, /^Three logos and a warning you can't skip\./);
  assert.match(host['v1.7'][1].text, /Ten skins\./);
  assert.match(host['v1.7'][3].text, /The game is two days old\./);
  assert.deepEqual([HOST_RECORDING.voiceId, HOST_RECORDING.model, HOST_RECORDING.stability, HOST_RECORDING.similarity, HOST_RECORDING.style, HOST_RECORDING.speed, HOST_RECORDING.output],
    ['uFIXVu9mmnDZ7dTKCBTX', 'eleven_v3', 0, 0.75, 0.2, 1, 'mp3_44100_64']);
});

test('a short with the host: A, B and C as long as lines 1 to 3 need, C at the largest 0.05 step that fits line 3, line 4 after D', () => {
  const prev = { version: 'v1.0', start: 15, apple: 320 };
  const cur = { version: 'v1.1', start: 500, apple: 18000, firstLine: null, plan: {}, host: [line('a', 3760), line('b', 6800), line('c', 6480), line('d', 8320)] };
  const [a, b, c, d] = compareTimeline(prev, cur);
  assert.equal(a.clipMs, 3760 + HOST_GAP_MS);
  assert.equal(a.runFrom, 15, 'A starts no earlier than the previous run\'s start');
  assert.equal(b.clipMs, 6800 + HOST_GAP_MS);
  const span = cur.apple - PLAN.beforeAppleMs - cur.start;
  assert.equal(c.speed, 2.25, `${span} ms of run, at least ${6480 + HOST_GAP_MS} ms of clip`);
  assert.ok(c.clipMs >= 6480 + HOST_GAP_MS && span / (c.speed + 0.05) < 6480 + HOST_GAP_MS);
  assert.equal(d.clipMs, 3000);
  let at = 0;
  for (const seg of [a, b, c, d]) { seg.clipFrom = at; at += seg.clipMs; }
  const track = hostTrack([a, b, c, d], cur.host, at);
  assert.deepEqual(track.map(h => h.clipAtMs), [0, a.clipMs, a.clipMs + b.clipMs, at + HOST_GAP_MS], 'line 4 starts 300 ms after D ends (prompt 18)');
  assert.equal(HOST_GAP_MS, 300);
  assert.ok(track.every(h => h.heardMs === h.lengthMs), 'never cut');
  // The previous apple keeps its place 1 s before A ends when A is longer than 3 s.
  const [a2] = compareTimeline({ version: 'v1.6', start: 100, apple: 120000 }, { ...cur, apple: 130000 });
  assert.equal(a2.runFrom + a2.clipMs - 120000, PLAN.prevMs - PLAN.beforeAppleMs);
});

test('host and Snek never speak at once', () => {
  assert.doesNotThrow(() => checkNoOverlap([{ line: 'x', clipAtMs: 0, heardMs: 1000 }], [{ line: 10, clipAtMs: 1000, heardMs: 3840 }]));
  assert.throws(() => checkNoOverlap([{ line: 'x', clipAtMs: 0, heardMs: 1001 }], [{ line: 10, clipAtMs: 1000, heardMs: 3840 }]), /overlaps/);
});

test('the trailer with the host: line 3 fits the middle, line 4 ends before Snek, line 5 from THE END over a freeze', () => {
  const right = { version: 'v2.0', apple: 107290, firstLine: { afterAppleMs: 600 }, raw: { log: [{ t: 113307, type: 'screen', name: 'the-end' }] } };
  const host = [line('t1', 3600), line('t2', 560), line('t3', 8720), line('t4', 3920), line('t5', 10240)];
  const segs = trailerTimeline(right, TRAILER, host);
  const [first, middle, last] = segs;
  assert.equal(first.clipMs, 3600 + HOST_GAP_MS + 560 + TRAILER.afterDoneMs, 'the first part ends 1 s after "Done." (prompt 20)');
  assert.equal(middle.runFrom, first.clipMs);
  assert.ok(middle.clipMs >= 8720 + HOST_GAP_MS);
  assert.equal(last.runFrom + 3920 + HOST_GAP_MS, 107290 + 600, 'line 4 ends HOST_GAP_MS before Snek starts');
  const [h1, h2, h3, h4, h5] = segs.host;
  assert.deepEqual([h1.clipAtMs, h2.clipAtMs, h3.clipAtMs, h4.clipAtMs], [0, 3600 + HOST_GAP_MS, middle.clipFrom, last.clipFrom]);
  assert.equal(h5.clipAtMs, last.clipFrom + (113307 - last.runFrom));
  assert.equal(segs.freezeMs, h5.clipAtMs + 10240 - (last.clipFrom + last.clipMs));
});
