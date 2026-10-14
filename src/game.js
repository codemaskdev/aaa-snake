// AAA Snake v1.1: the screen, the keys and the game loop.
// The rules live in rules.js, the launch experience in launch.js.

const VERSION = 'v1.1';
const CELL = 24;        // each cell is 24 x 24 pixels
const HUD = 32;         // a strip at the top for the score
const TICK_MS = 100;    // the snake moves one cell every 100 ms (10 per second)
const COLORS = { board: '#111', hud: '#000', snake: '#3b3', head: '#8f8', apple: '#e33', text: '#fff', eye: '#fff', pupil: '#000' };

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
let before = copySnake();  // where the snake was before its last move, for smooth drawing
let eaten = null;          // the apple just eaten, drawn until the head reaches it
let best = 0;
let screen = 'publisher-logo'; // the launch screens, then 'ready', 'play', 'gameover'
let screenTime = 0;            // ms the current screen has been showing

window.addEventListener('keydown', event => {
  const direction = KEYS[event.code];
  if (direction) event.preventDefault(); // stop the arrow keys from scrolling the page

  if (LAUNCH[screen]) {
    if (launchListens(screen, screenTime)) setScreen(LAUNCH[screen].then); // any key
  } else if (screen === 'ready' && direction) {
    queueTurn(game, direction);
    setScreen('play');
  } else if (screen === 'play' && direction) {
    queueTurn(game, direction);
  } else if (screen === 'gameover' && (event.code === 'Enter' || event.code === 'Space')) {
    game = newGame(random);
    before = copySnake();
    eaten = null;
    setScreen('autosave'); // the notice comes back before every game
  }
});

// The game loop. The browser calls frame() about 60 times a second.
// The snake moves on a fixed beat (TICK_MS), however fast the screen draws.
let lastFrame = null;
let waited = 0;
function frame(now) {
  const elapsed = lastFrame === null ? 0 : Math.min(now - lastFrame, 250); // after a long pause, don't jump ahead
  lastFrame = now;
  screenTime += elapsed;
  const next = launchTimeUp(screen, screenTime);
  if (next) setScreen(next);
  if (screen === 'play') {
    waited += elapsed;
    while (waited >= TICK_MS && screen === 'play') {
      waited -= TICK_MS;
      tick();
    }
  }
  draw();
  requestAnimationFrame(frame);
}

// One move of the snake, plus what happens because of it.
function tick() {
  const scoreBefore = game.score;
  const apple = game.apple;
  before = copySnake();
  step(game, random);
  eaten = game.score > scoreBefore ? apple : null;
  if (eaten) report('apple', { score: game.score, tick: game.tick });
  if (!game.alive) {
    best = Math.max(best, game.score);
    setScreen('gameover');
  }
}

function setScreen(name) {
  screen = name;
  screenTime = 0;
  waited = 0;
  report('screen', { name });
}

function copySnake() {
  return game.snake.map(part => ({ x: part.x, y: part.y }));
}

function draw() {
  if (LAUNCH[screen]) {
    drawLaunch(ctx, screen, screenTime, canvas.width, canvas.height);
    reportFirstFrame();
    return;
  }
  ctx.fillStyle = COLORS.hud;
  ctx.fillRect(0, 0, canvas.width, HUD);
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(0, HUD, canvas.width, GRID * CELL);

  // How far the snake is between its last cell and its new one: 0 to 1.
  const progress = screen === 'play' ? Math.min(waited / TICK_MS, 1) : 1;
  if (game.apple) drawApple(game.apple);
  if (eaten && progress < 1) drawApple(eaten);
  drawSnake(snakePath(progress));

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

// The points the snake's body passes through, in cells, part of the way into its move.
// The head glides toward its new cell and the tail follows the body's old path,
// so the snake bends around corners instead of cutting across them.
function snakePath(progress) {
  const now = game.snake;
  if (progress >= 1 || before.length === 0) return now;
  const grew = now.length > before.length;
  const between = (a, b) => ({ x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress });
  const path = [between(before[0], now[0]), ...before.slice(0, grew ? before.length : before.length - 1)];
  if (!grew) path.push(between(before[before.length - 1], before[before.length - 2]));
  return path;
}

function center(cell) {
  return { x: cell.x * CELL + CELL / 2, y: HUD + cell.y * CELL + CELL / 2 };
}

function drawSnake(path) {
  const points = path.map(center);
  ctx.strokeStyle = COLORS.snake;
  ctx.lineWidth = CELL - 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  drawHead(points[0]);
}

// The head, with two eyes that look the way the snake is about to go.
function drawHead(p) {
  const heading = game.turns.length > 0 ? game.turns[0] : game.direction;
  const look = DIRECTIONS[heading];
  ctx.fillStyle = COLORS.head;
  ctx.beginPath();
  ctx.arc(p.x, p.y, CELL / 2, 0, Math.PI * 2);
  ctx.fill();
  for (const side of [-1, 1]) {
    // Eyes sit a little forward, one on each side of the direction of travel.
    const eye = { x: p.x + look.x * 4 - look.y * side * 5, y: p.y + look.y * 4 + look.x * side * 5 };
    ctx.fillStyle = COLORS.eye;
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.pupil;
    ctx.beginPath();
    ctx.arc(eye.x + look.x * 2, eye.y + look.y * 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawApple(cell) {
  const p = center(cell);
  ctx.fillStyle = COLORS.apple;
  ctx.beginPath();
  ctx.arc(p.x, p.y, CELL / 2 - 2, 0, Math.PI * 2);
  ctx.fill();
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
let reportedListening = false;
function report(type, data) {
  log.push({ t: performance.now(), type, ...data });
}
function listening() {
  return launchListens(screen, screenTime) || screen === 'gameover';
}
function reportFirstFrame() {
  if (screen !== lastDrawnScreen) {
    report('frame', { name: screen });
    reportedListening = false;
  }
  if (listening() && !reportedListening) report('accepts', { name: screen }); // starts reacting to a key
  reportedListening = listening();
  lastDrawnScreen = screen;
}
window.snakeGame = {
  version: VERSION,
  log,
  probe: () => ({
    screen,
    shown: screen === lastDrawnScreen,       // false until the screen is on the display
    next: listening() ? 'Enter' : null,      // the key that leaves this screen, once it listens
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
