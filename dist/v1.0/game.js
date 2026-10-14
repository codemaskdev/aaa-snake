// AAA Snake v1.0: the screen, the keys and the game loop.
// The rules live in rules.js. This file shows them and listens to you.

const VERSION = 'v1.0';
const CELL = 24;        // each cell is 24 x 24 pixels
const HUD = 32;         // a strip at the top for the score
const TICK_MS = 100;    // the snake moves one cell every 100 ms (10 per second)
const COLORS = { board: '#111', hud: '#000', snake: '#3b3', head: '#8f8', apple: '#e33', text: '#fff' };

// Which key turns the snake which way. Arrow keys and WASD both work.
const KEYS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

const canvas = document.getElementById('game');
canvas.width = GRID * CELL;
canvas.height = HUD + GRID * CELL;
const ctx = canvas.getContext('2d');

// The seed picks the apples. Add ?seed=7 to the address for a different game.
const seed = Number(new URLSearchParams(location.search).get('seed') || 1) >>> 0;
const random = makeRandom(seed);
let game = newGame(random);
let best = 0;
let screen = 'ready';   // 'ready' (waiting for a key), 'play' or 'gameover'

window.addEventListener('keydown', event => {
  const direction = KEYS[event.code];
  if (direction) event.preventDefault(); // stop the arrow keys from scrolling the page

  if (screen === 'ready' && direction) {
    queueTurn(game, direction);
    setScreen('play');
  } else if (screen === 'play' && direction) {
    queueTurn(game, direction);
  } else if (screen === 'gameover' && (event.code === 'Enter' || event.code === 'Space')) {
    game = newGame(random);
    setScreen('ready');
  }
});

// The game loop. The browser calls frame() about 60 times a second.
// The snake moves on a fixed beat (TICK_MS), however fast the screen draws.
let lastFrame = null;
let waited = 0;
function frame(now) {
  if (screen === 'play' && lastFrame !== null) {
    waited += Math.min(now - lastFrame, 250); // after a long pause, don't jump ahead
    while (waited >= TICK_MS && screen === 'play') {
      waited -= TICK_MS;
      tick();
    }
  }
  lastFrame = now;
  draw();
  requestAnimationFrame(frame);
}

// One move of the snake, plus what happens because of it.
function tick() {
  const scoreBefore = game.score;
  step(game, random);
  if (game.score > scoreBefore) report('apple', { score: game.score, tick: game.tick });
  if (!game.alive) {
    best = Math.max(best, game.score);
    setScreen('gameover');
  }
}

function setScreen(name) {
  screen = name;
  waited = 0;
  report('screen', { name });
}

function draw() {
  ctx.fillStyle = COLORS.hud;
  ctx.fillRect(0, 0, canvas.width, HUD);
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(0, HUD, canvas.width, GRID * CELL);

  if (game.apple) drawCell(game.apple, COLORS.apple);
  game.snake.forEach((part, i) => drawCell(part, i === 0 ? COLORS.head : COLORS.snake));

  ctx.fillStyle = COLORS.text;
  ctx.font = '16px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${game.score}   Best ${best}`, 8, HUD / 2);
  ctx.textAlign = 'right';
  ctx.fillText(VERSION, canvas.width - 8, HUD / 2);

  if (screen === 'ready') drawMessage('Press an arrow key or WASD');
  if (screen === 'gameover') drawMessage('Game over. Press Enter to play again');
  reportFirstFrame();
}

// Plain squares, with a 1-pixel gap so you can count the cells.
function drawCell(cell, color) {
  ctx.fillStyle = color;
  ctx.fillRect(cell.x * CELL + 1, HUD + cell.y * CELL + 1, CELL - 2, CELL - 2);
}

function drawMessage(text) {
  const y = HUD + (GRID * CELL) / 2;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, y - 24, canvas.width, 48);
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'center';
  ctx.fillText(text, canvas.width / 2, y);
}

// For the measuring bot in tools/. It reads the game; it never changes it.
// Times are in ms since the page started loading. The game never reads them.
const log = [];
let lastDrawnScreen = null;
function report(type, data) {
  log.push({ t: performance.now(), type, ...data });
}
function reportFirstFrame() {
  if (screen !== lastDrawnScreen) report('frame', { name: screen });
  lastDrawnScreen = screen;
}
window.snakeGame = {
  version: VERSION,
  log,
  probe: () => ({
    screen,
    shown: screen === lastDrawnScreen,            // false until the screen is on the display
    next: screen === 'gameover' ? 'Enter' : null, // the key that leaves this screen
    tick: game.tick,
    heading: game.turns.length > 0 ? game.turns[game.turns.length - 1] : game.direction,
    snake: game.snake,
    apple: game.apple,
    score: game.score,
    grid: GRID,
  }),
};

report('screen', { name: screen });
requestAnimationFrame(frame);
