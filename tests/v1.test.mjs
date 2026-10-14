// The rig against the real game: two short runs of v1.0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runOnce } from '../tools/rig/run.mjs';
import { startServer } from '../tools/serve.mjs';
import { ROOT } from './helpers.mjs';

const dir = fs.existsSync(path.join(ROOT, 'dist/v1.0')) ? path.join(ROOT, 'dist/v1.0') : path.join(ROOT, 'src');

test('the bot plays v1.0: straight to the first apple, every turn accepted, same game twice', async () => {
  const server = await startServer({ '/': dir });
  try {
    const runs = [];
    for (let i = 0; i < 2; i++) {
      const { summary } = await runOnce({ url: `${server.url}/index.html?seed=1`, sessionMs: 6000, playMsForMemory: 2000 });
      runs.push(summary);
    }
    for (const s of runs) {
      assert.deepEqual(s.screensBeforeFirstApple.map(x => x.screen), ['(page load)', 'ready', 'play']);
      assert.ok(s.timeToFirstAppleMs > 0 && s.timeToFirstAppleMs < 2000);
      assert.equal(s.steering.accepted, s.steering.sent - s.steering.unchecked);
      assert.deepEqual(s.requests.external, []);
      assert.deepEqual(s.errors, []);
      assert.ok(s.controlShare > 0.9);
    }
    assert.equal(runs[0].firstAppleTick, runs[1].firstAppleTick);
  } finally {
    await server.close();
  }
});

test('v1.0 by hand: WASD starts and steers, the wall ends the game, Enter restarts', async () => {
  const { chromium } = await import('playwright');
  const server = await startServer({ '/': dir });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${server.url}/index.html?seed=1`);
    const probe = () => page.evaluate(() => window.snakeGame.probe());
    await page.waitForFunction(() => window.snakeGame.probe().shown);
    assert.equal((await probe()).screen, 'ready');
    await page.keyboard.press('KeyW');
    assert.equal((await probe()).screen, 'play');
    assert.equal((await probe()).heading, 'up');
    await page.keyboard.press('KeyA');
    assert.equal((await probe()).heading, 'left');
    await page.keyboard.press('KeyD');
    assert.equal((await probe()).heading, 'left', 'straight back is ignored');
    await page.waitForFunction(() => window.snakeGame.probe().screen === 'gameover', null, { timeout: 5000 });
    assert.equal((await probe()).next, 'Enter');
    await page.keyboard.press('Enter');
    const after = await probe();
    assert.equal(after.screen, 'ready');
    assert.equal(after.score, 0);
    assert.equal(after.snake.length, 3);
  } finally {
    await browser.close();
    await server.close();
  }
});
