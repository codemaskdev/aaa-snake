// v2.0, Game of the Year Edition: an arcade cabinet at the start runs the real v1.0; its apple ends the game.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { startServer } from '../tools/serve.mjs';
import { patchNote } from '../tools/short.mjs';
import { decide, toCabinet, KEY_FOR, skillKey, makeMemory, remember } from '../tools/rig/bot.mjs';
import { CONTROL_SCREENS, playShareUntilEnd, gameEndedMs } from '../tools/rig/stats.mjs';
import { offOrigin } from '../tools/rig/stats.mjs';
import { ROOT, loadRules } from './helpers.mjs';

const dir = path.join(ROOT, 'dist/v2.0');
const built = fs.existsSync(dir);
const read = (d, name) => fs.readFileSync(path.join(d, name), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

test('the cabinet is the real v1.0, taken from the v1.0 tag, byte for byte; src/ holds no copy', { skip: !built && 'not built yet' }, () => {
  const files = execFileSync('git', ['ls-tree', '-r', '--name-only', 'v1.0', '--', 'dist/v1.0'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual(files.map(f => path.basename(f)).sort(), fs.readdirSync(path.join(dir, 'cabinet')).sort());
  for (const file of files) {
    const tagged = execFileSync('git', ['show', `v1.0:${file}`], { cwd: ROOT });
    assert.ok(tagged.equals(fs.readFileSync(path.join(dir, 'cabinet', path.basename(file)))), file);
    assert.ok(tagged.equals(fs.readFileSync(path.join(ROOT, file))), `${file} matches dist/v1.0 too`);
  }
  assert.ok(!fs.existsSync(path.join(ROOT, 'src/cabinet')), 'nothing of v1.0 copied into src/');
});

test('nothing else changed: the game\'s other files are v1.9\'s, byte for byte', { skip: !built && 'not built yet' }, () => {
  for (const name of ['rules.js', 'world.js', 'season.js', 'skins.js', 'progress.js', 'online.js', 'story.js', 'launch.js', 'hair.js', 'remaster.js']) {
    assert.equal(read(dir, name), read(path.join(ROOT, 'dist/v1.9'), name), name);
  }
});

test('inside the cabinet, the v1.0 bot rule eats v1.0\'s first apple on tick 3, as dist/v1.0 does', { skip: !built && 'not built yet' }, () => {
  const R = loadRules(path.join(dir, 'cabinet'));
  const random = R.makeRandom(1);
  const g = R.newGame(random);
  let tick = null;
  for (let n = 0; n < 50 && tick === null; n++) {
    const d = decide({ snake: g.snake, apple: g.apple, grid: R.GRID, heading: g.turns.at(-1) || g.direction });
    if (d !== g.direction) R.queueTurn(g, d);
    R.step(g, random);
    if (g.score === 1) tick = g.tick;
  }
  assert.equal(tick, 3);
  const v10 = JSON.parse(fs.readFileSync(path.join(ROOT, 'measurements/v1.0.json'), 'utf8'));
  assert.equal(v10.runs[0].firstAppleTick, 3, 'dist/v1.0, measured: tick 3');
});

test('the bot goes for whichever apple is fewer moves away: the cabinet (plus 3 inside) or the world\'s', () => {
  const snake = [{ x: 128, y: 128 }, { x: 127, y: 128 }, { x: 126, y: 128 }];
  const probe = { snake, grid: 256, heading: 'right', allowedTurns: ['right'], cabinet: { x: 134, y: 128 }, apple: null, vision: 6 };
  assert.equal(toCabinet(probe), 'right', 'the world apple out of sight: to the cabinet');
  assert.equal(toCabinet({ ...probe, apple: { x: 131, y: 128 } }), null, '3 moves to the apple against 6 + 3');
  assert.equal(toCabinet({ ...probe, apple: { x: 128, y: 133 } }), null, '5 moves to the apple (down, a right turn) against 9');
  assert.equal(toCabinet({ ...probe, apple: { x: 138, y: 135 } }), 'right', '17 moves to the apple against 6 + 3');
  assert.equal(toCabinet({ ...probe, cabinet: null }), null);
  assert.ok(CONTROL_SCREENS.has('cabinet'), 'arrow keys inside count as control');
});

test('a game that ends: both control shares stop at THE END (prompt 15)', () => {
  const log = [
    { t: 0, type: 'screen', name: 'warning' }, { t: 100, type: 'screen', name: 'ready' }, { t: 150, type: 'screen', name: 'play' },
    { t: 750, type: 'screen', name: 'cabinet-door' }, { t: 760, type: 'screen', name: 'cabinet' }, { t: 1100, type: 'screen', name: 'reflection' },
    { t: 7100, type: 'screen', name: 'the-end' }, { t: 10100, type: 'screen', name: 'credits' },
  ];
  assert.equal(gameEndedMs(log), 7100);
  const s = playShareUntilEnd(log, 7100);
  assert.deepEqual([s.controlMs, s.fromMs, s.toMs], [650 + 340, 100, 7100]);
  assert.equal(s.share, 990 / 7000);
});

test('the game shows every patch note so far, as UPDATES.md has them', { skip: !built && 'not built yet' }, () => {
  const notes = plain(vm.runInContext(`${read(dir, 'update.js')}\n;PATCH_NOTES`, vm.createContext({})));
  const md = fs.readFileSync(path.join(ROOT, 'UPDATES.md'), 'utf8');
  assert.deepEqual(notes.map(([version]) => version), ['v1.0', 'v1.1', 'v1.2', 'v1.3', 'v1.4', 'v1.5', 'v1.6', 'v1.7', 'v1.9', 'v2.0']);
  for (const [version, note] of notes) assert.equal(note, patchNote(md, version), version);
});

test('v2.0 in the browser: to the cabinet, Enter, v1.0\'s apple on tick 3, the reflection, THE END, the credits, and nothing after', { skip: !built && 'not built yet' }, async () => {
  const server = await startServer({ '/': dir });
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    const page = await browser.newPage();
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${server.url}/index.html?seed=1`);
    const probe = () => page.evaluate(() => window.snakeGame.probe());
    await page.waitForFunction(() => window.snakeGame.probe().screen === 'publisher-logo', null, { timeout: 60000, polling: 50 });
    await page.evaluate(() => setScreen('ready'));
    const memory = makeMemory();
    let last = null;
    let lastTick = -1;
    let lastPress = 0;
    for (let i = 0; i < 20000; i++) {
      const p = await probe();
      if (p.ended) break;
      if (p.shown) {
        remember(memory, p);
        if (['ready', 'play', 'cabinet'].includes(p.screen)) {
          if (p.screen !== last || p.tick !== lastTick) {
            lastTick = p.tick;
            if (p.screen === 'play') assert.ok(p.cabinet, 'the cabinet is on screen from the start');
            const d = decide(p, memory);
            if (p.screen === 'ready' || (p.screen === 'cabinet' && p.cabinetReady) || d !== p.heading) await page.keyboard.press(KEY_FOR[d]);
          }
        } else {
          const key = p.screen === 'skill-tree' && p.skills ? skillKey(p) : p.next;
          const now = Date.now();
          if (key && (p.screen !== last || now - lastPress > 250)) {
            await page.keyboard.press(key);
            lastPress = now;
          }
        }
        last = p.screen;
      }
      await page.waitForTimeout(4);
    }
    const log = await page.evaluate(() => window.snakeGame.log.filter(e => e.type === 'apple' || e.type === 'screen').map(e => [e.type, e.name || e.tick, e.where || '']));
    const screens = log.filter(e => e[0] === 'screen').map(e => e[1]);
    assert.deepEqual(screens.slice(screens.indexOf('ready')), ['ready', 'play', 'cabinet-door', 'cabinet', 'reflection', 'the-end', 'credits']);
    assert.deepEqual(log.filter(e => e[0] === 'apple'), [['apple', 3, 'cabinet']]);
    const end = await probe();
    assert.deepEqual([end.screen, end.ended, end.next, end.score], ['credits', true, null, 1]);
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(500);
    assert.equal((await probe()).screen, 'credits', 'no key, no restart');
    assert.deepEqual(errors, []);
    assert.ok(requests.some(url => url.endsWith('/cabinet/game.js')));
    assert.deepEqual(offOrigin(requests, new URL(server.url).origin), []);
  } finally {
    await browser.close();
    await server.close();
  }
});
