// v1.2, the day-one patch: what it downloads, from where, and what it changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { chromium } from 'playwright';
import { startServer } from '../tools/serve.mjs';
import { patchNote } from '../tools/short.mjs';
import { ROOT, loadRules } from './helpers.mjs';

const dir = fs.existsSync(path.join(ROOT, 'dist/v1.2')) ? path.join(ROOT, 'dist/v1.2') : path.join(ROOT, 'src');

test('the patch notes in the game are the ones in UPDATES.md', () => {
  const code = fs.readFileSync(path.join(dir, 'update.js'), 'utf8');
  const notes = vm.runInContext(`${code}\n;PATCH_NOTES`, vm.createContext({}));
  const md = fs.readFileSync(path.join(ROOT, 'UPDATES.md'), 'utf8');
  assert.ok(notes.length > 0);
  for (const [version, note] of notes) assert.equal(note, patchNote(md, version), version);
});

test('the page never loads the patch itself; only the update code fetches it', () => {
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert.ok(!html.includes('patch/'));
});

test('v1.2: the patch arrives in throttled pieces from the game\'s own server, then installs', async () => {
  const server = await startServer({ '/': dir });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const requests = [];
    page.on('request', r => requests.push({ url: r.url(), range: r.headers().range || null }));
    await page.goto(`${server.url}/index.html?seed=1`);
    const until = (fn, timeout) => page.waitForFunction(fn, null, { timeout, polling: 10 });

    await until(() => window.snakeGame.probe().screen === 'patch-install', 20000);
    const size = fs.statSync(path.join(dir, 'patch/day-one.js')).size;
    const state = await page.evaluate(() => ({ total: patch.total, received: patch.received, requested: patch.requested }));
    assert.deepEqual(state, { total: size, received: size, requested: Math.ceil(size / 256) }, 'every real byte, in 256-byte pieces');
    const pieces = requests.filter(r => r.url.endsWith('/patch/day-one.js'));
    assert.equal(pieces.length, Math.ceil(size / 256));
    assert.ok(pieces.every((r, k) => r.range === `bytes=${k * 256}-${k * 256 + 255}`));

    const log = await page.evaluate(() => window.snakeGame.log);
    const shown = name => log.find(e => e.type === 'screen' && e.name === name).t;
    const downloadMs = shown('patch-install') - shown('patch-download');
    assert.ok(downloadMs >= Math.ceil(size / 256) * 1000 - 20, `the download took ${downloadMs} ms: throttled`);

    await until(() => window.snakeGame.probe().screen === 'publisher-logo', 8000);
    assert.equal(await page.evaluate(() => patch.installed), true);
    const origin = new URL(server.url).origin;
    assert.ok(requests.every(r => r.url.startsWith(origin) || r.url.startsWith(`blob:${origin}`)), 'nothing from any other origin');

    // The grass is drawn from the seed: the same seed gives the same field, another seed another one.
    const fields = await page.evaluate(() => {
      const draw = s => { prepareField(s, 480, 480); return field.toDataURL(); };
      return [draw(1), draw(1), draw(2)];
    });
    assert.equal(fields[0], fields[1]);
    assert.notEqual(fields[0], fields[2]);

    // ...and with its own generator: the apple is where the rules put it.
    const R = loadRules();
    const apple = JSON.parse(JSON.stringify(R.newGame(R.makeRandom(1)).apple));
    assert.deepEqual(await page.evaluate(() => window.snakeGame.probe().apple), apple);
  } finally {
    await browser.close();
    await server.close();
  }
});

test('v1.2: after the title, a loading screen with tips that listens only after 5 s', async () => {
  const server = await startServer({ '/': dir });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${server.url}/index.html?seed=1`);
    const until = (fn, timeout) => page.waitForFunction(fn, null, { timeout, polling: 10 });
    for (const screen of ['warning', 'title']) {
      await page.waitForFunction(s => window.snakeGame.probe().screen === s && window.snakeGame.probe().next, screen, { timeout: 45000, polling: 10 });
      await page.keyboard.press('Enter');
    }
    assert.equal(await page.evaluate(() => window.snakeGame.probe().screen), 'loading');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.snakeGame.probe().screen), 'loading', 'ignores keys while loading');
    await until(() => window.snakeGame.probe().next === 'Enter', 6000);
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.snakeGame.probe().screen), 'autosave');
    const log = await page.evaluate(() => window.snakeGame.log);
    assert.deepEqual(log.filter(e => e.type === 'screen').map(e => e.name).slice(0, 12), [
      'update-required', 'patch-download', 'patch-install', 'preparing',
      'publisher-logo', 'studio-logo', 'engine-logo', 'warning', 'title', 'loading', 'autosave',
    ].slice(0, 12));
  } finally {
    await browser.close();
    await server.close();
  }
});
