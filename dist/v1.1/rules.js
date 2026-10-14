// AAA Snake v1.0: the rules of the game.
// Nothing in this file touches the screen, the keyboard or the clock,
// so the same seed and the same key presses always give the same game.

const GRID = 20;          // the board is 20 x 20 cells
const START_LENGTH = 3;   // a new snake is 3 cells long

// The four ways the snake can move, as steps on the grid.
const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// A small seeded random number generator (it's called mulberry32).
// Same seed, same numbers, every time. We never use Math.random().
function makeRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // a number from 0 up to (not including) 1
  };
}

// True if two directions point exactly opposite ways (like left and right).
function isOpposite(a, b) {
  return DIRECTIONS[a].x === -DIRECTIONS[b].x && DIRECTIONS[a].y === -DIRECTIONS[b].y;
}

// True if some part of the snake sits on this cell.
function isOnSnake(snake, cell) {
  return snake.some(part => part.x === cell.x && part.y === cell.y);
}

// A new game: a short snake in the middle, heading right, and one apple.
function newGame(random) {
  const middle = Math.floor(GRID / 2);
  const snake = [];
  for (let i = 0; i < START_LENGTH; i++) {
    snake.push({ x: middle - i, y: middle }); // snake[0] is the head
  }
  const game = { snake, direction: 'right', turns: [], apple: null, score: 0, alive: true, tick: 0 };
  game.apple = placeApple(game, random);
  return game;
}

// Put the apple on a random free cell, never on the snake.
function placeApple(game, random) {
  const free = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!isOnSnake(game.snake, { x, y })) free.push({ x, y });
    }
  }
  if (free.length === 0) return null; // the snake fills the board: no apple left
  return free[Math.floor(random() * free.length)];
}

// Remember a turn for the next moves. Up to two turns wait in line,
// so two quick key presses aren't lost. Turning straight back is ignored.
function queueTurn(game, direction) {
  const last = game.turns.length > 0 ? game.turns[game.turns.length - 1] : game.direction;
  if (game.turns.length >= 2) return;
  if (direction === last || isOpposite(direction, last)) return;
  game.turns.push(direction);
}

// Move the snake one cell. One call is one "tick" of the game.
function step(game, random) {
  if (!game.alive) return;
  if (game.turns.length > 0) game.direction = game.turns.shift();
  const move = DIRECTIONS[game.direction];
  const head = { x: game.snake[0].x + move.x, y: game.snake[0].y + move.y };
  game.tick++;

  const eats = game.apple !== null && head.x === game.apple.x && head.y === game.apple.y;
  // The tail moves out of the way this tick, unless the snake eats and grows.
  const body = eats ? game.snake : game.snake.slice(0, -1);
  const hitsWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
  if (hitsWall || isOnSnake(body, head)) {
    game.alive = false;
    return;
  }

  game.snake.unshift(head);
  if (eats) {
    game.score++;
    game.apple = placeApple(game, random);
  } else {
    game.snake.pop();
  }
}
