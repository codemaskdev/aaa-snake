import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRules } from './helpers.mjs';

const R = loadRules();
const plain = x => JSON.parse(JSON.stringify(x));

test('the same seed gives the same numbers, another seed different ones', () => {
  const a = R.makeRandom(1);
  const b = R.makeRandom(1);
  const c = R.makeRandom(2);
  const sa = Array.from({ length: 20 }, a);
  assert.deepEqual(sa, Array.from({ length: 20 }, b));
  assert.notDeepEqual(sa, Array.from({ length: 20 }, c));
  assert.ok(sa.every(x => x >= 0 && x < 1));
});

test('a new game: 3 cells in the middle heading right, apple not on the snake', () => {
  const g = R.newGame(R.makeRandom(1));
  assert.deepEqual(plain(g.snake), [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]);
  assert.equal(g.direction, 'right');
  assert.equal(R.isOnSnake(g.snake, g.apple), false);
});

test('moving, eating and growing', () => {
  const random = R.makeRandom(1);
  const g = R.newGame(random);
  g.apple = { x: 11, y: 10 };
  R.step(g, random);
  assert.equal(g.score, 1);
  assert.equal(g.snake.length, 4);
  assert.deepEqual(plain(g.snake[0]), { x: 11, y: 10 });
  assert.equal(R.isOnSnake(g.snake, g.apple), false);
  R.step(g, random);
  assert.equal(g.snake.length, 4);
  assert.equal(g.tick, 2);
});

test('hitting a wall ends the game', () => {
  const random = R.makeRandom(1);
  const g = R.newGame(random);
  g.apple = { x: 0, y: 0 };
  for (let i = 0; i < 9; i++) R.step(g, random);
  assert.equal(g.alive, true);
  R.step(g, random);
  assert.equal(g.alive, false);
  const tick = g.tick;
  R.step(g, random);
  assert.equal(g.tick, tick, 'a dead snake does not move');
});

test('hitting yourself ends the game, but chasing your own tail is fine', () => {
  const random = R.makeRandom(1);
  const g = R.newGame(random);
  g.snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }];
  g.apple = { x: 0, y: 0 };
  R.queueTurn(g, 'down');
  R.step(g, random);
  assert.equal(g.alive, false);

  const h = R.newGame(random);
  h.snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 6 }];
  h.apple = { x: 0, y: 0 };
  R.queueTurn(h, 'down');
  R.step(h, random);
  assert.equal(h.alive, true, 'the tail cell is free this tick');
});

test('turning straight back is ignored, and at most two turns wait in line', () => {
  const g = R.newGame(R.makeRandom(1));
  R.queueTurn(g, 'left');
  assert.deepEqual(plain(g.turns), []);
  R.queueTurn(g, 'up');
  R.queueTurn(g, 'down');
  assert.deepEqual(plain(g.turns), ['up']);
  R.queueTurn(g, 'left');
  R.queueTurn(g, 'down');
  assert.deepEqual(plain(g.turns), ['up', 'left']);
});

test('the apple never lands on the snake', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const random = R.makeRandom(seed);
    const g = R.newGame(random);
    for (let i = 0; i < 5; i++) {
      const apple = R.placeApple(g, random);
      assert.equal(R.isOnSnake(g.snake, apple), false);
    }
  }
});

test('same seed and same inputs give the same game', () => {
  const play = () => {
    const random = R.makeRandom(42);
    const inputs = R.makeRandom(7);
    const g = R.newGame(random);
    const dirs = ['up', 'down', 'left', 'right'];
    for (let i = 0; i < 2000 && g.alive; i++) {
      if (inputs() < 0.3) R.queueTurn(g, dirs[Math.floor(inputs() * 4)]);
      R.step(g, random);
    }
    return plain(g);
  };
  assert.deepEqual(play(), play());
});
