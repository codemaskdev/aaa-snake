// v1.1, the launch experience: the screens, the keys they ignore, the autosave before every game.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { startServer } from '../tools/serve.mjs';
import { ROOT } from './helpers.mjs';

const dir = fs.existsSync(path.join(ROOT, 'dist/v1.1')) ? path.join(ROOT, 'dist/v1.1') : path.join(ROOT, 'src');
const LAUNCH = ['publisher-logo', 'studio-logo', 'engine-logo', 'warning', 'title', 'autosave'];

test('v1.1: logos ignore keys, the warning and title listen only later, autosave before every game', async () => {
  const server = await startServer({ '/': dir });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${server.url}/index.html?seed=1`);
    const probe = () => page.evaluate(() => window.snakeGame.probe());
    const until = (fn, timeout = 8000) => page.waitForFunction(fn, null, { timeout, polling: 5 });

    await until(() => window.snakeGame.probe().shown);
    assert.equal((await probe()).screen, 'publisher-logo');
    for (const key of ['Enter', 'Escape', 'Space', 'ArrowUp']) await page.keyboard.press(key);
    assert.equal((await probe()).screen, 'publisher-logo', 'the logo cannot be skipped');
    assert.equal((await probe()).next, null);

    await until(() => window.snakeGame.probe().screen === 'warning' && window.snakeGame.probe().shown, 12000);
    await page.keyboard.press('Enter');
    assert.equal((await probe()).screen, 'warning', 'the warning ignores keys at first');
    await until(() => window.snakeGame.probe().next === 'Enter', 6000);
    await page.keyboard.press('KeyQ'); // any key
    assert.equal((await probe()).screen, 'title');
    await page.keyboard.press('Enter');
    assert.equal((await probe()).screen, 'title', 'the title ignores keys during its animation');
    await until(() => window.snakeGame.probe().next === 'Enter', 4000);
    await page.keyboard.press('Enter');
    assert.equal((await probe()).screen, 'autosave');
    await page.keyboard.press('Enter');
    assert.equal((await probe()).screen, 'autosave', 'the autosave notice cannot be skipped');

    await until(() => window.snakeGame.probe().screen === 'ready', 5000);
    await page.keyboard.press('KeyW');
    await until(() => window.snakeGame.probe().screen === 'gameover', 5000);
    await page.keyboard.press('Enter');
    assert.equal((await probe()).screen, 'autosave', 'the notice comes back after a game over');

    const log = await page.evaluate(() => window.snakeGame.log);
    const screens = log.filter(e => e.type === 'screen').map(e => e.name);
    assert.deepEqual(screens.slice(0, 9), [...LAUNCH, 'ready', 'play', 'gameover']);
    const accepts = log.filter(e => e.type === 'accepts').map(e => e.name);
    assert.deepEqual(accepts.slice(0, 2), ['warning', 'title']);
    const warningShown = log.find(e => e.type === 'frame' && e.name === 'warning').t;
    const warningListens = log.find(e => e.type === 'accepts' && e.name === 'warning').t;
    assert.ok(warningListens - warningShown >= 3900, `the warning listened after ${warningListens - warningShown} ms`);
  } finally {
    await browser.close();
    await server.close();
  }
});
