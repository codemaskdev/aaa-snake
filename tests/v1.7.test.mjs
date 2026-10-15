// v1.7, Season 1: the apple only within 6 cells, a battle pass that fills from XP, a PARODY shop,
// a loot box and the wardrobe after every game over, and skins that change only the drawing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { chromium } from 'playwright';
import { startServer } from '../tools/serve.mjs';
import { patchNote } from '../tools/short.mjs';
import { offOrigin } from '../tools/rig/stats.mjs';
import { decide, makeMemory, remember } from '../tools/rig/bot.mjs';
import { ROOT, tempDir, loadRules } from './helpers.mjs';

const dir = fs.existsSync(path.join(ROOT, 'dist/v1.7')) ? path.join(ROOT, 'dist/v1.7') : path.join(ROOT, 'src');
const plain = value => JSON.parse(JSON.stringify(value));

function loadSeason() {
  const code = ['rules.js', 'skins.js', 'season.js'].map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
  return vm.runInContext(`${code}\n;({ VISION, SEASON, TOP_REWARD, SKINS, ODDS, season, wardrobe, appleVisible, passCheck, seasonKey, seasonNext, startWardrobe, openLootBox, tierReward, hasAppleVision })`, vm.createContext({}));
}

test('the apple shows only within 6 cells of the head, as the crow flies', () => {
  const S = loadSeason();
  assert.equal(S.VISION, 6);
  const head = { x: 100, y: 100 };
  assert.equal(S.appleVisible(head, { x: 106, y: 100 }), true);
  assert.equal(S.appleVisible(head, { x: 104, y: 104 }), true, '5.66 cells');
  assert.equal(S.appleVisible(head, { x: 105, y: 104 }), false, '6.4 cells');
  assert.equal(S.appleVisible(head, { x: 107, y: 100 }), false);
  assert.equal(S.appleVisible(head, null), false);
});

test('the first apple is on tick 7595: the bot\'s search, offline, on v1.7\'s own rules and world', () => {
  const R = loadRules(dir);
  const read = name => fs.readFileSync(path.join(dir, name), 'utf8');
  const { size, far, vision } = vm.runInContext(`${read('rules.js')}\n${read('world.js')}\n${read('season.js')}\n;({ size: WORLD.size, far: WORLD.appleFar, vision: VISION })`, vm.createContext({}));
  const random = R.makeRandom(1);
  const g = R.newGame(random, size, far);
  const memory = makeMemory();
  let tick = null;
  for (let n = 0; n < 20000 && tick === null; n++) {
    const head = g.snake[0];
    const visible = (g.apple.x - head.x) ** 2 + (g.apple.y - head.y) ** 2 <= vision * vision;
    const probe = { snake: g.snake, apple: visible ? g.apple : null, grid: size, heading: g.turns.at(-1) || g.direction,
      allowedTurns: g.tick >= 500 ? ['right', 'left'] : ['right'], vision, score: g.score, tick: g.tick };
    remember(memory, probe);
    const d = decide(probe, memory);
    if (d !== probe.heading) R.queueTurn(g, d);
    R.step(g, random);
    if (g.score === 1) tick = g.tick;
  }
  assert.equal(tick, 7595);
});

test('the battle pass: a tier every 500 XP, 100 tiers, Apple Vision at the top', () => {
  const S = loadSeason();
  assert.deepEqual([S.SEASON.tierXp, S.SEASON.tiers], [500, 100]);
  assert.equal(S.TOP_REWARD, 'Apple Vision: the ability to see the apple');
  assert.equal(S.tierReward(100), S.TOP_REWARD);
  assert.notEqual(S.tierReward(99), S.TOP_REWARD);
  assert.equal(S.passCheck(499), false);
  assert.equal(S.passCheck(500), true);
  assert.deepEqual([S.season.tier, S.season.pending], [1, 1]);
  assert.equal(S.passCheck(1700), true, 'tiers 2 and 3 at once');
  assert.deepEqual([S.season.tier, S.season.pending], [3, 3]);
  assert.equal(S.hasAppleVision(), false);
  S.passCheck(50000);
  assert.equal(S.hasAppleVision(), true);
  assert.equal(S.appleVisible({ x: 0, y: 0 }, { x: 255, y: 255 }), true, 'Apple Vision: the apple anywhere');
});

test('buying goes to the PARODY screen and back; the screens offer only Enter, never the buy key', () => {
  const S = loadSeason();
  S.season.pending = 1;
  assert.equal(S.seasonKey('battle-pass', 'KeyB', 1000), null, 'not before it listens');
  assert.equal(S.seasonNext('battle-pass', 1000), null);
  assert.equal(S.seasonNext('battle-pass', 1500), 'Enter');
  assert.equal(S.seasonKey('battle-pass', 'KeyB', 1500), 'parody-shop');
  assert.equal(S.seasonNext('parody-shop', 500), 'Enter');
  assert.equal(S.seasonKey('parody-shop', 'Enter', 500), 'battle-pass');
  assert.equal(S.season.pending, 1, 'looking at the shop spends nothing');
  assert.equal(S.seasonKey('battle-pass', 'Enter', 1500), 'carry-on');
  assert.equal(S.season.pending, 0);
  assert.equal(S.seasonKey('loot-box', 'Enter', 3000), null);
  assert.equal(S.seasonKey('loot-box', 'Enter', 3200), 'wardrobe');
  assert.equal(S.seasonKey('wardrobe', 'Enter', 1000), 'new-game');
});

test('no payment, no network, no prices in Season 1', () => {
  for (const name of ['season.js', 'skins.js']) {
    const code = fs.readFileSync(path.join(dir, name), 'utf8');
    assert.ok(!/fetch\(|XMLHttpRequest|WebSocket|sendBeacon|PaymentRequest|\bpaypal\b|\bstripe\b|\bcheckout\b/i.test(code), name);
    assert.ok(!/[$€£¥]\s?\d|\d\s?(USD|EUR|dollars?)/i.test(code), `${name} has no price`);
  }
  assert.match(fs.readFileSync(path.join(dir, 'season.js'), 'utf8'), /'PARODY'/);
});

test('skins: 10 in the boxes plus the starter; Classic Green is the one Legendary; the odds add up to 100', () => {
  const S = loadSeason();
  const boxed = S.SKINS.filter(s => s.rarity !== 'Starter');
  assert.equal(boxed.length, 10);
  assert.deepEqual(plain(S.ODDS), [['Common', 60], ['Rare', 25], ['Epic', 12], ['Legendary', 3]]);
  assert.deepEqual(plain(S.SKINS.filter(s => s.rarity === 'Legendary').map(s => s.name)), ['Classic Green']);
  const classic = S.SKINS.find(s => s.id === 'classic');
  assert.deepEqual([classic.body, classic.head], ['#3b3', '#8f8'], 'the v1.0 snake');
  assert.ok(fs.readFileSync(path.join(ROOT, 'dist/v1.0/game.js'), 'utf8').includes("snake: '#3b3', head: '#8f8'"));
});

test('drops come from the seed: the same boxes for the same seed, and they follow the odds', () => {
  const draw = (seed, n) => {
    const S = loadSeason();
    S.startWardrobe(seed);
    return Array.from({ length: n }, () => S.openLootBox().id);
  };
  assert.deepEqual(draw(1, 30), draw(1, 30));
  assert.notDeepEqual(draw(1, 30), draw(2, 30));
  const S = loadSeason();
  const rarity = Object.fromEntries(S.SKINS.map(s => [s.id, s.rarity]));
  const counts = { Common: 0, Rare: 0, Epic: 0, Legendary: 0 };
  for (const id of draw(1, 20000)) counts[rarity[id]]++;
  for (const [name, percent] of S.ODDS) {
    assert.ok(Math.abs((counts[name] / 20000) * 100 - percent) < 1.5, `${name}: ${counts[name]} of 20000`);
  }
});

test('the game shows every patch note so far, as UPDATES.md has them', () => {
  const code = fs.readFileSync(path.join(dir, 'update.js'), 'utf8');
  const notes = plain(vm.runInContext(`${code}\n;PATCH_NOTES`, vm.createContext({})));
  const md = fs.readFileSync(path.join(ROOT, 'UPDATES.md'), 'utf8');
  assert.deepEqual(notes.map(([version]) => version), ['v1.0', 'v1.1', 'v1.2', 'v1.3', 'v1.4', 'v1.5', 'v1.6', 'v1.7']);
  for (const [version, note] of notes) assert.equal(note, patchNote(md, version), version);
});

test('line 16: the new subtitle, its slot pinned at 2800 ms', () => {
  const story = vm.runInContext(`${fs.readFileSync(path.join(dir, 'story.js'), 'utf8')}\n;({ LINES, slotMs })`, vm.createContext({}));
  const line = story.LINES.find(l => l.id === 16);
  assert.equal(line.text, 'Another. The orchard remembers.');
  assert.equal(story.slotMs(line), 2800);
  const old = vm.runInContext(`${fs.readFileSync(path.join(ROOT, 'dist/v1.6/story.js'), 'utf8')}\n;({ LINES, slotMs })`, vm.createContext({}));
  assert.equal(old.LINES.find(l => l.id === 16).text, 'Another one. The orchard remembers.', 'earlier builds keep the old subtitle');
});

test('v1.7 in the browser: the probe hides the far apple; a tier, the PARODY shop, a loot box and the wardrobe', async () => {
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
    await page.waitForFunction(() => window.snakeGame.probe().screen === 'publisher-logo', null, { timeout: 60000, polling: 50 });
    let p = await probe();
    // The camera sees the whole 480 x 480 board, in the middle of the world and at its edge (fixed in prompt 14).
    const views = await page.evaluate(() => [camera({ x: 3084, y: 3084 }), camera({ x: 12, y: 12 })].map(c => [c.view.x1 - c.view.x0, c.view.y1 - c.view.y0]));
    assert.deepEqual(views, [[480, 480], [480, 480]]);
    assert.equal(p.vision, 6);
    assert.equal(p.apple, null, 'the apple is 163 moves away');
    await page.evaluate(() => setScreen('ready'));
    await page.keyboard.press('ArrowRight');
    await page.evaluate(() => { progression.xp = 499; progression.level = 5; progression.skills.left = true; });
    await page.waitForFunction(() => window.snakeGame.probe().screen === 'battle-pass', null, { timeout: 5000, polling: 10 });
    p = await probe();
    assert.equal(p.next, null);
    await page.waitForFunction(() => window.snakeGame.probe().next === 'Enter', null, { timeout: 5000, polling: 10 });
    const shots = process.env.V17_SHOTS;
    if (shots) await page.locator('canvas').screenshot({ path: path.join(shots, 'battle-pass.png') });
    await page.keyboard.press('KeyB');
    assert.equal((await probe()).screen, 'parody-shop');
    await page.waitForTimeout(600);
    if (shots) await page.locator('canvas').screenshot({ path: path.join(shots, 'parody-shop.png') });
    await page.keyboard.press('Enter');
    assert.equal((await probe()).screen, 'battle-pass');
    await page.waitForFunction(() => window.snakeGame.probe().next === 'Enter', null, { timeout: 5000, polling: 10 });
    await page.keyboard.press('Enter');
    assert.equal((await probe()).screen, 'play');

    await page.evaluate(() => setScreen('gameover'));
    await page.keyboard.press('Enter');
    assert.equal((await probe()).screen, 'loot-box');
    await page.waitForFunction(() => window.snakeGame.probe().next === 'Enter', null, { timeout: 6000, polling: 20 });
    await page.keyboard.press('Enter');
    assert.equal((await probe()).screen, 'wardrobe');
    const worn = await page.evaluate(() => [wardrobe.worn, wardrobe.owned.length, wardrobe.boxes]);
    assert.equal(worn[2], 1);
    assert.notEqual(worn[0], 'warden', 'the new skin is worn');
    await page.waitForFunction(() => window.snakeGame.probe().next === 'Enter', null, { timeout: 3000, polling: 20 });
    await page.keyboard.press('Enter');
    assert.equal((await probe()).screen, 'autosave');
    assert.deepEqual(errors, []);
    assert.ok(requests.some(url => url.endsWith('/season.js')) && requests.some(url => url.endsWith('/skins.js')));
    assert.deepEqual(offOrigin(requests, new URL(server.url).origin), []);
  } finally {
    await browser.close();
    await server.close();
  }
});

// The same game under every skin: on the short recorder's virtual clock (tools/short/vclock.js), the
// same keys at the same ticks; the game's log and final state must be identical.
test('a game plays identically under every skin', async () => {
  const wrap = tempDir('skins');
  fs.writeFileSync(path.join(wrap, 'frame.html'), '<!doctype html><iframe id="game" src="/game/index.html?seed=1" width="480" height="512"></iframe>');
  const server = await startServer({ '/game': dir, '/': wrap });
  const browser = await chromium.launch();
  const ids = loadSeason().SKINS.map(s => s.id);
  const keys = [
    { code: 'ArrowRight', screen: 'ready' },
    { code: 'ArrowDown', screen: 'play', tick: 20 },
    { code: 'ArrowLeft', screen: 'play', tick: 40 }, // a locked left turn: the same toast under every skin
    { code: 'ArrowRight', screen: 'play', tick: 41 },
    { code: 'ArrowDown', screen: 'play', tick: 70 },
  ];
  try {
    const results = {};
    for (const id of ids) {
      const context = await browser.newContext();
      await context.addInitScript({ path: path.join(ROOT, 'tools/short/vclock.js') });
      const page = await context.newPage();
      await page.goto(`${server.url}/frame.html`);
      const frame = () => page.frame({ url: /index\.html/ });
      await page.waitForFunction(() => {
        const w = document.getElementById('game').contentWindow;
        return w && w.__vclock && w.snakeGame;
      });
      // Up to "Preparing your experience" (the world is made), 100 ms of virtual time at a time.
      for (let t = 100; ; t += 100) {
        const screen = await frame().evaluate(to => { window.__vclock.advanceTo(to); return window.snakeGame.probe().screen; }, t);
        if (screen === 'publisher-logo') break;
        assert.ok(t < 120000);
      }
      const result = await frame().evaluate(({ id, keys }) => {
        wardrobe.worn = id;
        progression.level = 20; // no level-up or battle-pass tier in these 20 s: only play, reconnects and toasts
        const t0 = window.__vclock.now();
        setScreen('ready');
        window.__vclock.replay(keys.map(k => ({ ...k, t: t0 + 50 })));
        window.__vclock.advanceTo(t0 + 20000);
        const after = window.snakeGame.log.filter(e => e.t >= t0).map(e => ({ ...e, t: e.t - t0 }));
        const p = window.snakeGame.probe();
        return { log: after, snake: p.snake, tick: p.tick, score: p.score, screen: p.screen, xp: p.xp, toasts: online.toasts.map(x => x.text) };
      }, { id, keys });
      results[id] = JSON.stringify(result);
      if (id === 'warden') assert.ok(JSON.parse(results[id]).tick >= 100, 'the game really went on');
      await context.close();
    }
    for (const id of ids) assert.equal(results[id], results.warden, `${id} plays differently`);
  } finally {
    await browser.close();
    await server.close();
  }
});
