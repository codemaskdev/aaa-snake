// v1.6, progression: XP for moves and apples, a level-up and a skill tree for every level,
// right turns only until "Turn left" is learned at level 5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { chromium } from 'playwright';
import { startServer } from '../tools/serve.mjs';
import { patchNote } from '../tools/short.mjs';
import { skillKey } from '../tools/rig/bot.mjs';
import { offOrigin } from '../tools/rig/stats.mjs';
import { ROOT } from './helpers.mjs';

const dir = fs.existsSync(path.join(ROOT, 'dist/v1.6')) ? path.join(ROOT, 'dist/v1.6') : path.join(ROOT, 'src');
const plain = value => JSON.parse(JSON.stringify(value));

function loadProgress() {
  const code = ['rules.js', 'progress.js'].map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
  const context = vm.createContext({ toasts: [] });
  return vm.runInContext(`function toast(text) { toasts.push(text); }\n${code}\n;({ PROGRESS, SKILLS, progression, xpForLevel, gainXp, turnLocked, lockedMessage, allowedTurns, skillTreeKey, skillTreeNext, skillsForProbe, progressScreen, toasts })`, context);
}

test('XP: 1 a move, 25 an apple; levels at 50, 150, 300, 500 and 750 XP', () => {
  const P = loadProgress();
  assert.deepEqual(plain(P.PROGRESS.xp), { move: 1, apple: 25 });
  assert.deepEqual([2, 3, 4, 5, 6].map(P.xpForLevel), [50, 150, 300, 500, 750]);
  for (let i = 0; i < 49; i++) assert.equal(P.gainXp(1), false);
  assert.equal(P.gainXp(1), true, 'level 2 at 50 XP');
  assert.deepEqual([P.progression.level, P.progression.points, P.progression.pending], [2, 1, 1]);
  P.gainXp(500 - 50);
  assert.deepEqual([P.progression.level, P.progression.points, P.progression.pending], [5, 4, 4], 'three levels at once wait in line');
});

test('only right turns until "Turn left" is learned; the locked turn says so', () => {
  const P = loadProgress();
  assert.equal(P.turnLocked('right', 'up'), true, 'right -> up is counter-clockwise');
  assert.equal(P.turnLocked('up', 'left'), true);
  assert.equal(P.turnLocked('left', 'down'), true);
  assert.equal(P.turnLocked('down', 'right'), true);
  for (const [from, to] of [['right', 'down'], ['down', 'left'], ['left', 'up'], ['up', 'right'], ['right', 'right']]) {
    assert.equal(P.turnLocked(from, to), false, `${from} -> ${to}`);
  }
  assert.equal(P.lockedMessage(), 'Skill locked: Turn left (requires level 5)');
  assert.deepEqual(plain(P.allowedTurns()), ['right']);
  P.progression.skills.left = true;
  assert.equal(P.turnLocked('right', 'up'), false);
  assert.deepEqual(plain(P.allowedTurns()), ['right', 'left']);
});

test('the skill tree, chosen by the bot\'s rule: three skills in list order, then "Turn left" at level 5', () => {
  const P = loadProgress();
  assert.deepEqual(plain(P.SKILLS.map(s => s.id)), ['smooth', 'eyes', 'shadow', 'left', 'tongue', 'deluxe']);
  assert.equal(P.SKILLS.find(s => s.id === 'left').level, 5);
  const learned = [];
  P.gainXp(750); // levels 2 to 6: five skill trees
  while (P.progression.pending > 0) {
    P.progressScreen('skill-tree');
    assert.equal(P.skillTreeNext(0), null, 'the tree takes no key while its links draw in');
    assert.equal(P.skillTreeKey('Enter', 0), false);
    for (let presses = 0; ; presses++) {
      assert.ok(presses < 10);
      const key = skillKey({ skills: plain(P.skillsForProbe()), cursor: P.progression.cursor, next: P.skillTreeNext(1000) });
      if (P.skillTreeKey(key, 1000)) break;
    }
    learned.push(Object.keys(P.progression.skills).at(-1));
  }
  assert.deepEqual(learned, ['smooth', 'eyes', 'shadow', 'left', 'tongue']);
  assert.deepEqual(plain(P.toasts), ['Skill learned: Smooth movement', 'Skill learned: Eye contact', 'Skill learned: Shadow', 'Skill learned: Turn left', 'Skill learned: Tongue']);
});

test('level-up particles come from a seeded generator: the same burst for the same level', () => {
  const a = loadProgress();
  const b = loadProgress();
  a.gainXp(50);
  b.gainXp(50);
  a.progressScreen('level-up');
  b.progressScreen('level-up');
  assert.equal(a.progression.burst.length, 140);
  assert.deepEqual(plain(a.progression.burst), plain(b.progression.burst));
  assert.equal(a.progression.shownLevel, 2);
});

test('the game shows every patch note so far, as UPDATES.md has them', () => {
  const code = fs.readFileSync(path.join(dir, 'update.js'), 'utf8');
  const notes = plain(vm.runInContext(`${code}\n;PATCH_NOTES`, vm.createContext({})));
  const md = fs.readFileSync(path.join(ROOT, 'UPDATES.md'), 'utf8');
  assert.deepEqual(notes.map(([version]) => version), ['v1.0', 'v1.1', 'v1.2', 'v1.3', 'v1.4', 'v1.5', 'v1.6']);
  for (const [version, note] of notes) assert.equal(note, patchNote(md, version), version);
});

test('v1.6 in the browser: a locked left turn, a level-up, the skill tree and back to play', async () => {
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
    await page.evaluate(() => setScreen('ready'));
    let p = await probe();
    assert.deepEqual(p.allowedTurns, ['right']);
    assert.deepEqual([p.level, p.xp], [1, 0]);

    await page.keyboard.press('ArrowUp'); // heading right: up is a left turn
    assert.equal((await probe()).screen, 'ready', 'a locked turn does not start the game');
    assert.equal(await page.evaluate(() => online.toasts.at(-1).text), 'Skill locked: Turn left (requires level 5)');
    await page.keyboard.press('ArrowDown');
    assert.equal((await probe()).screen, 'play');
    await page.waitForFunction(() => window.snakeGame.probe().tick >= 3, null, { timeout: 5000, polling: 10 });
    assert.ok((await probe()).xp >= 3, 'XP for every move');

    await page.evaluate(() => { progression.xp = 49; });
    await page.waitForFunction(() => window.snakeGame.probe().screen === 'level-up', null, { timeout: 5000, polling: 10 });
    p = await probe();
    assert.equal(p.level, 2);
    assert.equal(p.next, null, 'LEVEL UP! takes no key at first');
    await page.waitForFunction(() => window.snakeGame.probe().next === 'Enter', null, { timeout: 5000, polling: 10 });
    await page.keyboard.press('Enter');
    p = await probe();
    assert.equal(p.screen, 'skill-tree');
    assert.deepEqual(p.skills.map(s => [s.id, s.learnable]), [['smooth', true], ['eyes', true], ['shadow', true], ['left', false], ['tongue', true], ['deluxe', true]]);
    await page.keyboard.press('Enter');
    assert.equal((await probe()).screen, 'skill-tree', 'no choice before the links have drawn in');
    await page.waitForFunction(() => window.snakeGame.probe().next === 'Enter', null, { timeout: 5000, polling: 10 });
    await page.keyboard.press(skillKey(await probe()));
    p = await probe();
    assert.equal(p.screen, 'play', 'play goes on once a skill is chosen');
    assert.equal(await page.evaluate(() => progression.skills.smooth), true);
    assert.deepEqual(errors, []);
    assert.ok(requests.some(url => url.endsWith('/progress.js')));
    assert.deepEqual(offOrigin(requests, new URL(server.url).origin), []);
  } finally {
    await browser.close();
    await server.close();
  }
});
