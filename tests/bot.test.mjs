import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToApple, decide } from '../tools/rig/bot.mjs';

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
