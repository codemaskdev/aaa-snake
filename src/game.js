// AAA Snake v1.3: the screen, the keys and the game loop.
// The rules live in rules.js, the day-one update in update.js, the story in story.js,
// the launch experience in launch.js. The grass and the shadows arrive in the day-one patch.

const VERSION = 'v1.3';
const CELL = 24;        // each cell is 24 x 24 pixels
const HUD = 32;         // a strip at the top for the score
const BOARD = GRID * CELL;
const TICK_MS = 100;    // the snake moves one cell every 100 ms (10 per second)
const COLORS = { hud: '#000', snake: '#3b3', head: '#8f8', apple: '#e33', text: '#fff', eye: '#fff', pupil: '#000' };
const DARKNESS = 'rgba(0, 0, 0, 0.82)'; // the field at night
const LIGHT = 110;                     // radius of the light around Warden Snek's head, in pixels

// Which key turns the snake which way. Arrow keys and WASD both work.
const KEYS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

const canvas = document.getElementById('game');
canvas.width = BOARD;
canvas.height = HUD + BOARD;
const ctx = canvas.getContext('2d');
const dark = document.createElement('canvas'); // the darkness, with a hole of light cut in it each frame
dark.width = dark.height = BOARD;
const darkCtx = dark.getContext('2d');

// The seed picks the apples. Add ?seed=7 to the address for a different game.
const seed = Number(new URLSearchParams(location.search).get('seed') || 1) >>> 0;
const random = makeRandom(seed);
let game = newGame(random);
let before = copySnake();  // where the snake was before its last move, for smooth drawing
let reflection = null;     // the line of the cutscene after an apple
let best = 0;
let screen = 'update-required'; // update and launch screens, then 'ready', 'play', the finishing move, 'gameover'
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
  } else if (screen === 'finisher' && event.code === FINISHER.key && screenTime >= FINISHER.slowMs) {
    setScreen('finisher-bite');
  } else if (screen === 'gameover' && (event.code === 'Enter' || event.code === 'Space')) {
    game = newGame(random);
    before = copySnake();
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
  updateWork(screen, screenTime, seed, canvas.width, BOARD);
  if (screen === 'loading' && !voice.started) loadVoice();
  if (screen === 'opening') speak(lineAt(OPENING, screenTime));
  if (screen === 'reflection') speak(lineAt([reflection], screenTime));
  const next = launchTimeUp(screen, screenTime);
  if (next) setScreen(next);
  if (screen === 'finisher-bite' && screenTime >= FINISHER.biteMs) bite();
  if (screen === 'reflection' && screenTime >= cutsceneMs([reflection])) setScreen('play');
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

// One move of the snake. If the move would reach the apple, the finishing move starts
// instead, and the apple is eaten only when it ends (bite).
function tick() {
  const move = DIRECTIONS[game.turns.length > 0 ? game.turns[0] : game.direction];
  const head = game.snake[0];
  if (game.apple && head.x + move.x === game.apple.x && head.y + move.y === game.apple.y) {
    setScreen('finisher');
    return;
  }
  before = copySnake();
  step(game, random);
  if (!game.alive) {
    best = Math.max(best, game.score);
    setScreen('gameover');
  }
}

// The end of the finishing move: the snake takes its step onto the apple, and it counts.
function bite() {
  before = copySnake();
  step(game, random);
  report('apple', { score: game.score, tick: game.tick });
  reflection = REFLECTIONS[(game.score - 1) % REFLECTIONS.length];
  setScreen('reflection');
}

function setScreen(name) {
  screen = name;
  screenTime = 0;
  waited = 0;
  voice.spoken = null;
  report('screen', { name });
}

function copySnake() {
  return game.snake.map(part => ({ x: part.x, y: part.y }));
}

function draw() {
  if (LAUNCH[screen] && screen !== 'opening') {
    drawLaunch(ctx, screen, screenTime, canvas.width, canvas.height);
    reportFirstFrame();
    return;
  }
  ctx.fillStyle = COLORS.hud;
  ctx.fillRect(0, 0, canvas.width, HUD);
  ctx.fillStyle = COLORS.text;
  ctx.font = '16px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${game.score}   Best ${best}`, 8, HUD / 2);
  ctx.textAlign = 'right';
  ctx.fillText(VERSION, canvas.width - 8, HUD / 2);

  // How far the snake is between its last cell and its new one: 0 to 1.
  const progress = screen === 'play' ? Math.min(waited / TICK_MS, 1) : 1;
  const path = snakePath(progress);
  let headAt = center(path[0]);
  let appleScale = 1;
  if (screen === 'finisher-bite') {
    // The bite: the head slides onto the apple, which shrinks into it.
    const share = Math.min(1, screenTime / FINISHER.biteMs);
    const target = center(game.apple);
    headAt = { x: headAt.x + (target.x - headAt.x) * share, y: headAt.y + (target.y - headAt.y) * share };
    appleScale = 1 - share;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HUD, BOARD, BOARD);
  ctx.clip();
  const zoom = applyCamera(headAt);
  drawField(ctx, 0, HUD); // the grass, from the day-one patch
  withShadow(ctx, () => drawSnake(path, headAt)); // soft shadows, from the day-one patch
  drawDarkness(headAt, LIGHT / zoom); // the light stays the same size on screen in a close-up
  if (game.apple) drawApple(game.apple, appleScale, true);
  ctx.restore();

  if (screen === 'opening' || screen === 'reflection') {
    const lines = screen === 'opening' ? OPENING : [reflection];
    drawLetterbox(ctx, letterbox(lines, screenTime), canvas.width, canvas.height);
    drawSubtitle(ctx, lineAt(lines, screenTime), canvas.width, canvas.height);
    if (screen === 'opening') {
      ctx.fillStyle = '#777';
      ctx.font = '11px Helvetica, Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Skip available after your first playthrough', canvas.width - 10, 20);
    }
  }
  if (screen === 'finisher' && screenTime >= FINISHER.slowMs) drawMessage('Press E to eat', HUD + BOARD - 50); // below the close-up of the head
  if (screen === 'ready') drawMessage('Press an arrow key or WASD');
  if (screen === 'gameover') drawMessage('Game over. Press Enter to play again');
  reportFirstFrame();
}

// Cutscenes and the finishing move are shot in close-up on Warden Snek's head.
function applyCamera(headAt) {
  let zoom = 1;
  if (screen === 'opening' || screen === 'reflection') zoom = 2.5;
  if (screen === 'finisher') zoom = 1 + 1.5 * Math.min(1, screenTime / FINISHER.slowMs); // the slow push-in
  if (screen === 'finisher-bite') zoom = 2.5;
  if (zoom === 1) return zoom;
  ctx.translate(canvas.width / 2, HUD + BOARD / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-headAt.x, -headAt.y);
  return zoom;
}

// The field at night: darkness everywhere except a soft light around the head.
function drawDarkness(headAt, radius) {
  darkCtx.globalCompositeOperation = 'source-over';
  darkCtx.clearRect(0, 0, BOARD, BOARD);
  darkCtx.fillStyle = DARKNESS;
  darkCtx.fillRect(0, 0, BOARD, BOARD);
  darkCtx.globalCompositeOperation = 'destination-out';
  const light = darkCtx.createRadialGradient(headAt.x, headAt.y - HUD, 0, headAt.x, headAt.y - HUD, radius);
  light.addColorStop(0, 'rgba(0, 0, 0, 1)');
  light.addColorStop(0.5, 'rgba(0, 0, 0, 0.7)');
  light.addColorStop(1, 'rgba(0, 0, 0, 0)');
  darkCtx.fillStyle = light;
  darkCtx.fillRect(0, 0, BOARD, BOARD);
  ctx.drawImage(dark, 0, HUD);
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

function drawSnake(path, headAt) {
  const points = [headAt, ...path.slice(1).map(center)];
  ctx.strokeStyle = COLORS.snake;
  ctx.lineWidth = CELL - 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  drawHead(headAt);
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

// The apple; in the dark it glows, so you can always find it.
function drawApple(cell, scale, glow = false) {
  const p = center(cell);
  ctx.save();
  if (glow) {
    ctx.shadowColor = 'rgba(255, 70, 70, 0.9)';
    ctx.shadowBlur = 18;
  }
  ctx.fillStyle = COLORS.apple;
  ctx.beginPath();
  ctx.arc(p.x, p.y, (CELL / 2 - 2) * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMessage(text, y = HUD + BOARD / 2) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, y - 24, canvas.width, 48);
  ctx.fillStyle = COLORS.text;
  ctx.font = '16px monospace';
  ctx.textBaseline = 'middle';
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
// The key that leaves this screen right now, or null if it doesn't listen yet.
function nextKey() {
  if (launchListens(screen, screenTime) || screen === 'gameover') return 'Enter';
  if (screen === 'finisher' && screenTime >= FINISHER.slowMs) return FINISHER.key;
  return null;
}
function reportFirstFrame() {
  if (screen !== lastDrawnScreen) {
    report('frame', { name: screen });
    reportedListening = false;
  }
  const listens = nextKey() !== null;
  if (listens && !reportedListening) report('accepts', { name: screen }); // starts reacting to a key
  reportedListening = listens;
  lastDrawnScreen = screen;
}
window.snakeGame = {
  version: VERSION,
  log,
  probe: () => ({
    screen,
    shown: screen === lastDrawnScreen, // false until the screen is on the display
    next: nextKey(),                   // the key that leaves this screen, once it listens
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
