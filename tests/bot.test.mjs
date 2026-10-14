import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToApple, pathWithTurns, decide, skillKey } from '../tools/rig/bot.mjs';
import { loadRules } from './helpers.mjs';

const snake = (...cells) => cells.map(([x, y]) => ({ x, y }));

test('straight ahead when the apple is straight ahead', () => {
  assert.equal(pathToApple({ snake: snake([10, 10], [9, 10], [8, 10]), apple: { x: 13, y: 10 }, grid: 20, heading: 'right' }), 'right');
});

test('never straight back: an apple behind means turning first', () => {
  const dir = pathToApple({ snake: snake([10, 10], [9, 10], [8, 10]), apple: { x: 5, y: 10 }, grid: 20, heading: 'right' });
  assert.ok(dir === 'up' || dir === 'down');
});

test('turns toward an apple to the side', () => {
  assert.equal(pathToApple({ snake: snake([10, 10], [9, 10], [8, 10]), apple: { x: 10, y: 4 }, grid: 20, heading: 'right' }), 'up');
});

test('goes around its own body', () => {
  // A wall of body above the head; apple above it.
  const body = snake([5, 5], [4, 5], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [8, 5], [8, 6], [8, 7]);
  const dir = pathToApple({ snake: body, apple: { x: 5, y: 2 }, grid: 20, heading: 'right' });
  assert.ok(dir === 'right' || dir === 'down');
});

test('knows the tail moves away', () => {
  // Head at (1,0) heading left; the only way to the apple is through the tail's cell.
  const s = snake([1, 0], [2, 0], [2, 1], [1, 1], [0, 1]);
  assert.equal(pathToApple({ snake: s, apple: { x: 0, y: 2 }, grid: 3, heading: 'left' }), 'left');
});

test('no apple to see: no path; decide picks the move with the most room', () => {
  const probe = { snake: snake([1, 0], [0, 0]), apple: null, grid: 5, heading: 'right' };
  assert.equal(pathToApple(probe), null);
  assert.ok(['right', 'down'].includes(decide(probe)));
});

test('decide never steers into a wall when another move is open', () => {
  const probe = { snake: snake([19, 10], [18, 10], [17, 10]), apple: null, grid: 20, heading: 'right' };
  assert.notEqual(decide(probe), 'right');
});

// v1.6: until "Turn left" is learned the probe allows right turns only.
const RIGHT_OF = { up: 'right', right: 'down', down: 'left', left: 'up' };

test('right turns only: an apple up and to the left is reached by turning right, never left', () => {
  const R = loadRules();
  const random = R.makeRandom(1);
  const g = R.newGame(random);
  g.apple = { x: 8, y: 7 }; // behind and above the head at (10,10), heading right
  const seen = [];
  for (let i = 0; i < 40 && g.score === 0; i++) {
    const probe = { snake: g.snake, apple: g.apple, grid: 20, heading: g.direction, allowedTurns: ['right'] };
    const d = decide(probe);
    assert.ok(d === g.direction || d === RIGHT_OF[g.direction], `move ${i}: ${g.direction} -> ${d} is not straight or right`);
    if (d !== g.direction) R.queueTurn(g, d);
    seen.push(d);
    R.step(g, random);
    assert.equal(g.alive, true);
  }
  assert.equal(g.score, 1, 'it got there');
  // With left turns allowed the first move is up; with right turns only it cannot be.
  const free = { snake: snake([10, 10], [9, 10], [8, 10]), apple: { x: 8, y: 7 }, grid: 20, heading: 'right' };
  assert.equal(pathWithTurns({ ...free, allowedTurns: ['right', 'left'] }), 'up');
  assert.notEqual(pathWithTurns({ ...free, allowedTurns: ['right'] }), 'up');
});

test('with every turn allowed, the turn-limited search finds paths as short as the plain one', () => {
  const R = loadRules();
  for (let seed = 1; seed <= 20; seed++) {
    const g = R.newGame(R.makeRandom(seed));
    const walk = (choose) => {
      const h = { ...g, snake: g.snake.map(c => ({ ...c })), turns: [], direction: 'right', apple: { ...g.apple } };
      const random = R.makeRandom(99);
      for (let n = 1; n <= 60; n++) {
        const d = choose({ snake: h.snake, apple: h.apple, grid: 20, heading: h.direction });
        if (d !== h.direction) R.queueTurn(h, d);
        R.step(h, random);
        if (h.score === 1) return n;
      }
      return null;
    };
    assert.equal(walk(p => pathWithTurns({ ...p, allowedTurns: ['right', 'left'] })), walk(pathToApple), `seed ${seed}`);
  }
});

test('the skill tree: "Turn left" first, then the first skill in the list; Enter once there', () => {
  const skills = learnable => ['smooth', 'eyes', 'shadow', 'left', 'tongue', 'deluxe'].map(id => ({ id, learnable: learnable.includes(id) }));
  assert.equal(skillKey({ skills: skills(['smooth', 'eyes', 'shadow', 'tongue', 'deluxe']), cursor: 0, next: 'Enter' }), 'Enter');
  assert.equal(skillKey({ skills: skills(['eyes', 'shadow', 'tongue']), cursor: 0, next: null }), 'ArrowDown');
  assert.equal(skillKey({ skills: skills(['shadow', 'left', 'tongue']), cursor: 0, next: null }), 'ArrowDown');
  assert.equal(skillKey({ skills: skills(['shadow', 'left', 'tongue']), cursor: 3, next: 'Enter' }), 'Enter');
  assert.equal(skillKey({ skills: skills(['shadow', 'left']), cursor: 5, next: null }), 'ArrowUp');
  assert.equal(skillKey({ skills: skills([]), cursor: 2, next: 'Enter' }), 'Enter', 'nothing to learn: go on');
});
