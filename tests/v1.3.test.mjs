// v1.3, story mode: the lines, their placeholders, the guardrails, and the finishing move.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { startServer } from '../tools/serve.mjs';
import { loadStory, linesMarkdown, fileFor, durationMs } from '../tools/voice.mjs';
import { ROOT } from './helpers.mjs';

const dir = fs.existsSync(path.join(ROOT, 'dist/v1.3')) ? path.join(ROOT, 'dist/v1.3') : path.join(ROOT, 'src');
const story = loadStory(path.join(dir, 'story.js'));

test('voice/LINES.md is generated from the lines in the game', () => {
  assert.equal(fs.readFileSync(path.join(ROOT, 'voice/LINES.md'), 'utf8'), linesMarkdown(loadStory()));
});

test('every line has its audio file, and it fits in the line\'s slot', () => {
  for (const line of story.LINES) {
    const file = path.join(dir, 'voice', fileFor(line));
    assert.ok(fs.existsSync(file), fileFor(line));
    const ms = durationMs(file);
    assert.ok(ms <= story.slotMs(line), `${fileFor(line)}: ${ms} ms in a ${story.slotMs(line)} ms slot`);
  }
});

test('the guardrails: Warden Snek imitates no known character, and no line carries a number', () => {
  const banned = /\b(bandana|eyepatch|eye patch|cardboard|box|radio|codec|stealth|sneak|soldier|commander|mission|agent|operative|codename|code name|kept you waiting|brother)\b/i;
  for (const line of story.LINES) {
    assert.ok(!banned.test(line.text), `line ${line.id}: ${line.text}`);
    assert.ok(!/\d/.test(line.text), `line ${line.id} has a digit`);
    assert.match(line.emotion, /^[a-z]+$/, 'the emotion is one word');
  }
});

test('v1.3: opening cutscene, then "Press E to eat" before every apple, then a reflection', async () => {
  const server = await startServer({ '/': dir });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${server.url}/index.html?seed=1`);
    const probe = () => page.evaluate(() => window.snakeGame.probe());
    const until = (fn, timeout, arg) => page.waitForFunction(fn, arg, { timeout, polling: 10 });
    for (const screen of ['warning', 'title', 'loading']) {
      await until(s => window.snakeGame.probe().screen === s && window.snakeGame.probe().next, 60000, screen);
      await page.keyboard.press('Enter');
    }
    const loaded = await page.evaluate(() => ({ loaded: voice.loaded, bytes: voice.bytes }));
    const bytes = story.LINES.reduce((sum, line) => sum + fs.statSync(path.join(dir, 'voice', fileFor(line))).size, 0);
    assert.deepEqual(loaded, { loaded: story.LINES.length, bytes }, 'the loading screen loaded every voice line');
    assert.equal((await probe()).screen, 'opening');
    await page.keyboard.press('Escape');
    assert.equal((await probe()).screen, 'opening', 'the opening cannot be skipped on a first playthrough');

    await until(() => window.snakeGame.probe().screen === 'ready', 60000);
    const start = await probe(); // seed 1: head at (10,10) going right, the apple at (11,12)
    assert.deepEqual([start.snake[0], start.heading, start.apple], [{ x: 10, y: 10 }, 'right', { x: 11, y: 12 }]);
    await page.keyboard.press('ArrowRight');
    await until(() => window.snakeGame.probe().snake[0].x === 11, 3000);
    await page.keyboard.press('ArrowDown');
    await until(() => window.snakeGame.probe().screen === 'finisher', 5000);
    assert.equal((await probe()).score, 0, 'the apple does not count yet');
    await until(() => window.snakeGame.probe().next === 'KeyE', 3000);
    await page.keyboard.press('Enter');
    assert.equal((await probe()).screen, 'finisher', 'only E eats');
    await page.keyboard.press('KeyE');
    assert.equal((await probe()).screen, 'finisher-bite');
    await until(() => window.snakeGame.probe().screen === 'reflection', 3000);
    assert.equal((await probe()).score, 1, 'the apple counts once the bite ends');
    await until(() => window.snakeGame.probe().screen === 'play', 10000);

    const log = await page.evaluate(() => window.snakeGame.log);
    const at = (type, name) => log.find(e => e.type === type && (!name || e.name === name)).t;
    const openingMs = at('screen', 'autosave') - at('screen', 'opening');
    const expected = await page.evaluate(() => cutsceneMs(OPENING));
    assert.ok(Math.abs(openingMs - expected) < 50, `opening ${openingMs} ms, planned ${expected} ms`);
    assert.ok(at('apple') > at('screen', 'finisher-bite'), 'the apple is logged after the bite');
  } finally {
    await browser.close();
    await server.close();
  }
});
