// v1.9, Remastered: the same game under one WebGL pass, simulated hair, and a REMASTERED screen
// with minimum requirements taken from the last measurement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { chromium } from 'playwright';
import { startServer } from '../tools/serve.mjs';
import { patchNote } from '../tools/short.mjs';
import { requirementsFrom } from '../tools/requirements.mjs';
import { decide, makeMemory, remember } from '../tools/rig/bot.mjs';
import { offOrigin } from '../tools/rig/stats.mjs';
import { ROOT, loadRules } from './helpers.mjs';

const dir = fs.existsSync(path.join(ROOT, 'dist/v1.9')) ? path.join(ROOT, 'dist/v1.9') : path.join(ROOT, 'src');
const read = (d, name) => fs.readFileSync(path.join(d, name), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

test('the remaster leaves the game alone: rules, world and season are v1.7\'s, byte for byte', () => {
  for (const name of ['rules.js', 'world.js', 'season.js', 'online.js', 'progress.js']) {
    assert.equal(read(dir, name), read(path.join(ROOT, 'dist/v1.7'), name), name);
  }
});

test('the first apple is still on tick 7595: the bot\'s search on v1.9\'s own rules and world', () => {
  const R = loadRules(dir);
  const ctx = vm.createContext({});
  const { size, far, vision } = vm.runInContext(`${read(dir, 'rules.js')}\n${read(dir, 'world.js')}\n${read(dir, 'season.js')}\n;({ size: WORLD.size, far: WORLD.appleFar, vision: VISION })`, ctx);
  const random = R.makeRandom(1);
  const g = R.newGame(random, size, far);
  const memory = makeMemory();
  let tick = null;
  for (let n = 0; n < 20000 && tick === null; n++) {
    const head = g.snake[0];
    const visible = (g.apple.x - head.x) ** 2 + (g.apple.y - head.y) ** 2 <= vision * vision;
    // Turn left is learned at level 5, 500 XP, one XP a move before the first apple.
    const probe = { snake: g.snake, apple: visible ? g.apple : null, grid: size, heading: g.turns.at(-1) || g.direction,
      allowedTurns: g.tick >= 500 ? ['right', 'left'] : ['right'], vision, score: g.score, tick: g.tick };
    remember(memory, probe);
    const d = decide(probe, memory);
    if (d !== probe.heading) R.queueTurn(g, d);
    R.step(g, random);
    assert.equal(g.alive, true);
    if (g.score === 1) tick = g.tick;
  }
  assert.equal(tick, 7595);
});

test('the minimum requirements are v1.7\'s measured numbers, never typed by hand', () => {
  const req = vm.runInContext(`${read(dir, 'requirements.js')}\n;REQUIREMENTS`, vm.createContext({}));
  const measured = JSON.parse(fs.readFileSync(path.join(ROOT, 'measurements/v1.7.json'), 'utf8'));
  assert.deepEqual(plain(req), requirementsFrom(measured));
  assert.equal(req.from, 'v1.7');
  assert.ok(Number.isInteger(req.downloadBytes) && Number.isInteger(req.heapAfterGcBytes) && Number.isInteger(req.assetBytes));
});

test('exactly one WebGL pass: one program, one draw call, no framebuffer, no 3D engine', () => {
  const code = read(dir, 'remaster.js').replace(/\/\/.*$/gm, '');
  assert.equal(code.match(/createProgram\(/g).length, 1);
  assert.equal(code.match(/drawArrays\(/g).length, 1);
  assert.ok(!/createFramebuffer|drawElements|readPixels/.test(code));
  const html = read(dir, 'index.html');
  assert.ok(!/three|babylon|pixi|<script src="http/i.test(html));
});

test('the hair comes from the seed and is a simulation: same seed, same hair; its segments keep their length', () => {
  const run = seed => {
    const ctx = vm.createContext({});
    vm.runInContext(`${read(dir, 'rules.js')}\n${read(dir, 'hair.js')}`, ctx);
    return vm.runInContext(`startHair(${seed});
      for (let i = 0; i < 300; i++) hairWork(16.7, { x: 10 + i * 0.01, y: 10 + Math.sin(i / 20) }, i < 150 ? { x: 1, y: 0 } : { x: 0, y: 1 });
      ({ strands: hair.strands.map(s => ({ segment: s.segment, points: s.points.map(p => [p.x, p.y]) })) })`, ctx);
  };
  const a = plain(run(1));
  assert.deepEqual(a, plain(run(1)));
  assert.notDeepEqual(a, plain(run(2)));
  assert.ok(a.strands.length >= 5 && a.strands.length <= 8);
  for (const s of a.strands) {
    for (let k = 1; k < s.points.length; k++) {
      const d = Math.hypot(s.points[k][0] - s.points[k - 1][0], s.points[k][1] - s.points[k - 1][1]);
      assert.ok(Math.abs(d - s.segment) < s.segment * 0.05, `a segment of ${d} cells for ${s.segment}`);
    }
  }
});

test('the game shows every patch note so far, as UPDATES.md has them', () => {
  const notes = plain(vm.runInContext(`${read(dir, 'update.js')}\n;PATCH_NOTES`, vm.createContext({})));
  const md = fs.readFileSync(path.join(ROOT, 'UPDATES.md'), 'utf8');
  assert.deepEqual(notes.map(([version]) => version), ['v1.0', 'v1.1', 'v1.2', 'v1.3', 'v1.4', 'v1.5', 'v1.6', 'v1.7', 'v1.9']);
  for (const [version, note] of notes) assert.equal(note, patchNote(md, version), version);
});

test('v1.9 in the browser: the WebGL pass draws every frame; REMASTERED offers Enter after 3000 ms', async () => {
  const server = await startServer({ '/': dir });
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    const page = await browser.newPage();
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${server.url}/index.html?seed=1`);
    await page.waitForFunction(() => window.snakeGame.probe().screen === 'warning' && window.snakeGame.probe().next, null, { timeout: 60000, polling: 50 });
    const pass = await page.evaluate(() => ({ gl: post.gl !== null, frames: post.frame, shown: getComputedStyle(document.getElementById('screen')).display, hidden: getComputedStyle(document.getElementById('game')).display }));
    assert.deepEqual([pass.gl, pass.shown, pass.hidden], [true, 'block', 'none']);
    assert.ok(pass.frames > 100, `${pass.frames} frames through the pass`);
    // The camera sees the whole board, near the edge of the world too (v1.7 drew only its middle 336 px).
    const views = await page.evaluate(() => [camera({ x: 3084, y: 3084 }), camera({ x: 12, y: 12 })].map(c => [c.view.x1 - c.view.x0, c.view.y1 - c.view.y0]));
    assert.deepEqual(views, [[480, 480], [480, 480]]);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.snakeGame.probe().screen === 'title' && window.snakeGame.probe().next, null, { timeout: 10000, polling: 20 });
    await page.keyboard.press('Enter');
    assert.equal((await page.evaluate(() => window.snakeGame.probe())).screen, 'remastered');
    assert.equal((await page.evaluate(() => window.snakeGame.probe())).next, null);
    await page.waitForFunction(() => window.snakeGame.probe().next === 'Enter', null, { timeout: 5000, polling: 10 });
    await page.keyboard.press('Enter');
    assert.equal((await page.evaluate(() => window.snakeGame.probe())).screen, 'connecting');
    assert.deepEqual(errors, []);
    assert.ok(['remaster.js', 'hair.js', 'requirements.js'].every(name => requests.some(url => url.endsWith('/' + name))));
    assert.deepEqual(offOrigin(requests, new URL(server.url).origin), []);
  } finally {
    await browser.close();
    await server.close();
  }
});
