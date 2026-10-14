// v1.5, the open world: the same rules on a bigger board, the apple far away, a world made from
// the seed with its own generator, and frames that draw only what the camera sees.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { chromium } from 'playwright';
import { startServer } from '../tools/serve.mjs';
import { patchNote } from '../tools/short.mjs';
import { offOrigin } from '../tools/rig/stats.mjs';
import { ROOT, loadRules } from './helpers.mjs';

const dir = fs.existsSync(path.join(ROOT, 'dist/v1.5')) ? path.join(ROOT, 'dist/v1.5') : path.join(ROOT, 'src');
const R = loadRules(dir);

function loadWorld(seed) {
  const code = ['rules.js', 'world.js'].map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
  const context = vm.createContext({});
  return vm.runInContext(`${code}\n;({ WORLD, made: makeWorld(${seed}) })`, context);
}

const plain = value => JSON.parse(JSON.stringify(value));
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

test('the open world keeps the rules: one cell a tick, walls at the edge of the world', () => {
  const { WORLD } = loadWorld(1);
  const random = R.makeRandom(1);
  const g = R.newGame(random, WORLD.size, WORLD.appleFar);
  assert.deepEqual(plain(g.snake), [{ x: 128, y: 128 }, { x: 127, y: 128 }, { x: 126, y: 128 }]);
  g.apple = { x: 0, y: 0 };
  for (let i = 0; i < 127; i++) R.step(g, random);
  assert.equal(g.alive, true);
  assert.deepEqual(plain(g.snake[0]), { x: 255, y: 128 }, 'one cell a tick');
  R.step(g, random);
  assert.equal(g.alive, false, 'the edge of the world is a wall');
});

test('the apple lands far away, by the seed: at least 128 moves from the head, every time', () => {
  const { WORLD } = loadWorld(1);
  assert.equal(WORLD.size, 256);
  assert.equal(WORLD.appleFar, 128);
  for (let seed = 1; seed <= 30; seed++) {
    const random = R.makeRandom(seed);
    const g = R.newGame(random, WORLD.size, WORLD.appleFar);
    assert.ok(distance(g.apple, g.snake[0]) >= 128, `seed ${seed}: ${distance(g.apple, g.snake[0])}`);
    assert.deepEqual(plain(g.apple), plain(R.newGame(R.makeRandom(seed), WORLD.size, WORLD.appleFar).apple), 'the same seed, the same apple');
    // Eat it: the next one is far from the new head too.
    if (g.apple.x < 3) continue;
    g.snake = [{ x: g.apple.x - 1, y: g.apple.y }, { x: g.apple.x - 2, y: g.apple.y }, { x: g.apple.x - 3, y: g.apple.y }];
    g.direction = 'right';
    R.step(g, random);
    assert.equal(g.score, 1);
    assert.ok(distance(g.apple, g.snake[0]) >= 128);
  }
  const small = R.newGame(R.makeRandom(1));
  assert.equal(small.size, 20, 'with no size, the board of v1.0');
});

test('the world comes from the seed: 600 markers of five kinds, one to a cell, none at the start', () => {
  const a = loadWorld(1);
  const b = loadWorld(1);
  const markers = a.made.markers;
  assert.deepEqual(plain(markers), plain(b.made.markers));
  assert.deepEqual(Array.from(a.made.ground.slice(0, 2000)), Array.from(b.made.ground.slice(0, 2000)));
  assert.notDeepEqual(plain(loadWorld(2).made.markers), plain(markers));
  assert.equal(markers.length, 600);
  const counts = {};
  for (const m of markers) counts[m.kind] = (counts[m.kind] || 0) + 1;
  assert.deepEqual(counts, { question: 120, viewpoint: 24, camp: 40, chest: 160, acorn: 256 });
  assert.equal(new Set(markers.map(m => m.y * 256 + m.x)).size, 600, 'one marker to a cell');
  for (const m of markers) {
    assert.ok(distance(m, { x: 128, y: 128 }) >= 4, 'not on the start');
    assert.equal(a.made.props[m.y * 256 + m.x], 0, 'a marker stands on open ground');
  }
  const trees = Array.from(a.made.props).filter(p => p >= 1 && p <= 3).length;
  const rocks = Array.from(a.made.props).filter(p => p >= 4).length;
  assert.ok(trees > 1000 && rocks > 300, `${trees} trees, ${rocks} rocks`);
});

test('the world has its own generator: the apples are the game\'s, as in v1.4', () => {
  assert.match(fs.readFileSync(path.join(dir, 'world.js'), 'utf8'), /makeRandom\(\(seed \^ 0x[0-9a-f]+\) >>> 0\)/);
  assert.match(fs.readFileSync(path.join(dir, 'game.js'), 'utf8'), /const random = makeRandom\(seed\);\nlet game = newGame\(random, WORLD\.size, WORLD\.appleFar\);\nstartOnline\(seed\);/);
});

test('the game shows every patch note so far, as UPDATES.md has them', () => {
  const code = fs.readFileSync(path.join(dir, 'update.js'), 'utf8');
  const notes = plain(vm.runInContext(`${code}\n;PATCH_NOTES`, vm.createContext({})));
  const md = fs.readFileSync(path.join(ROOT, 'UPDATES.md'), 'utf8');
  assert.deepEqual(notes.map(([version]) => version), ['v1.0', 'v1.1', 'v1.2', 'v1.3', 'v1.4', 'v1.5']);
  for (const [version, note] of notes) assert.equal(note, patchNote(md, version), version);
});

test('v1.5 in the browser: culling, markers, the world map and fast travel', async () => {
  const server = await startServer({ '/': dir });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${server.url}/index.html?seed=1`);
    const probe = () => page.evaluate(() => window.snakeGame.probe());
    // "Preparing your experience" makes the world (after the day-one patch, about 14 s in).
    await page.waitForFunction(() => window.snakeGame.probe().screen === 'publisher-logo', null, { timeout: 60000, polling: 50 });
    assert.equal(await page.evaluate(() => world.ready), true);
    assert.equal(await page.evaluate(() => LAUNCH.autosave.then), 'world-map');
    assert.deepEqual(await page.evaluate(() => LAUNCH['world-map']), { listensAfter: 3000, key: 'Enter', then: 'ready' });
    const p = await probe();
    assert.equal(p.grid, 256);
    assert.ok(distance(p.apple, p.snake[0]) >= 128, 'the quest marker shows where the apple is');

    // Culling: whatever part of the world the camera sees, only the cells in view (plus a margin
    // of 2 for trees, rocks and markers) are drawn.
    const culled = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = c.height = 480;
      const g = c.getContext('2d');
      const results = [];
      for (const [cx, cy, zoom] of [[3072, 3072, 1], [240, 240, 1], [6144 - 240, 6144 - 240, 1], [1000, 4000, 2.5]]) {
        const seen = 240 / zoom;
        const view = { x0: cx - seen, y0: cy - seen, x1: cx + seen, y1: cy + seen };
        const drawn = [];
        const original = g.drawImage.bind(g);
        g.drawImage = (...args) => { drawn.push(args.length === 9 ? [args[5], args[6], 'tile'] : [args[1], args[2], 'sprite']); return original(...args); };
        drawWorld(g, view);
        const tiles = drawn.filter(d => d[2] === 'tile');
        const outside = drawn.filter(([x, y]) => x < view.x0 - 3 * 24 - 60 || y < view.y0 - 3 * 24 - 60 || x > view.x1 + 3 * 24 || y > view.y1 + 3 * 24);
        results.push({ tiles: tiles.length, all: drawn.length, outside: outside.length });
      }
      return results;
    });
    for (const r of culled.slice(0, 3)) {
      assert.ok(r.tiles <= 21 * 21, `${r.tiles} tiles`);
      assert.equal(r.outside, 0);
      assert.ok(r.all < 700, `${r.all} images in a frame`);
    }
    assert.ok(culled[3].tiles <= 9 * 9, 'a close-up draws fewer tiles');

    // A marker the head reaches is found: a toast, a count, and it stays found.
    const visits = await page.evaluate(() => {
      const chest = world.markers.find(m => m.kind === 'chest');
      const acorn = world.markers.find(m => m.kind === 'acorn');
      return [visitCell(chest), visitCell(chest), visitCell(acorn), world.found.chest, world.found.acorn, visitCell({ x: 128, y: 128 })];
    });
    assert.match(visits[0], /^Chest opened\. /);
    assert.equal(visits[1], null, 'an opened chest stays open');
    assert.equal(visits[2], 'Acorn collected: 1 / 256');
    assert.deepEqual(visits.slice(3), [1, 1, null]);

    // During play, M opens the world map: Enter closes it after 3000 ms, and an arrow key carries on.
    await page.evaluate(() => setScreen('ready'));
    await page.keyboard.press('ArrowDown');
    assert.equal((await probe()).screen, 'play');
    await page.keyboard.press('KeyF');
    assert.equal(await page.evaluate(() => online.toasts.at(-1).text), 'Fast travel is coming in a future update.');
    await page.keyboard.press('KeyM');
    assert.equal((await probe()).screen, 'world-map');
    assert.equal((await probe()).next, null);
    await page.keyboard.press('Enter');
    assert.equal((await probe()).screen, 'world-map', 'the map does not close before 3000 ms');
    await page.waitForFunction(() => window.snakeGame.probe().next === 'Enter', null, { timeout: 10000, polling: 20 });
    await page.keyboard.press('Enter');
    assert.equal((await probe()).screen, 'ready');
    assert.deepEqual(errors, []);
    assert.ok(requests.some(url => url.endsWith('/world.js')));
    assert.deepEqual(offOrigin(requests, new URL(server.url).origin), []);
  } finally {
    await browser.close();
    await server.close();
  }
});
