// AAA Snake v1.7: the screen, the keys and the game loop.
// The rules live in rules.js, the day-one update in update.js, the story in story.js,
// SnakeNet in online.js, the open world in world.js, XP and skills in progress.js,
// Season 1 in season.js and skins.js, the launch experience in launch.js.
// The shadows arrive in the day-one patch.

const VERSION = 'v1.7';
const CELL = 24;        // each cell is 24 x 24 pixels
const HUD = 32;         // a strip at the top for the score
const BOARD = GRID * CELL;
const TICK_MS = 100;    // the snake moves one cell every 100 ms (10 per second)
const COLORS = { apple: '#e33', text: '#fff', eye: '#fff', pupil: '#000' }; // the snake's colours come from its skin
const DARKNESS = 'rgba(0, 0, 0, 0.82)'; // the field at night
const LIGHT = 110;                     // radius of the light around Warden Snek's head, in pixels
                                       // (the opening is at night; the world after it is in daylight)

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
let game = newGame(random, WORLD.size, WORLD.appleFar);
startOnline(seed);
startWardrobe(seed);
let before = copySnake();  // where the snake was before its last move, for smooth drawing
let reflection = null;     // the line of the cutscene after an apple
let best = 0;
let screen = 'update-required'; // update and launch screens, then 'ready', 'play', the finishing move, 'gameover'
let screenTime = 0;            // ms the current screen has been showing
let dropPending = false;       // SnakeNet dropped while a level-up was due: it shows after the skill tree

window.addEventListener('keydown', event => {
  const direction = KEYS[event.code];
  if (direction) event.preventDefault(); // stop the arrow keys from scrolling the page

  if (screen === 'terms' && TERMS_KEYS[event.code]) {
    event.preventDefault();
    scrollTerms(TERMS_KEYS[event.code]);
  } else if (['battle-pass', 'parody-shop', 'loot-box', 'wardrobe'].includes(screen)) {
    const to = seasonKey(screen, event.code, screenTime);
    if (to === 'carry-on') carryOn();
    else if (to === 'new-game') {
      game = newGame(random, WORLD.size, WORLD.appleFar);
      before = copySnake();
      setScreen('autosave'); // the notice comes back before every game
    } else if (to) setScreen(to);
  } else if (screen === 'level-up') {
    if (event.code === 'Enter' && screenTime >= PROGRESS.levelUpListensAfter) setScreen('skill-tree');
  } else if (screen === 'skill-tree') {
    if (direction) event.preventDefault();
    if (skillTreeKey(event.code, screenTime)) carryOn();
  } else if ((screen === 'ready' || screen === 'play') && direction && turnLocked(game.turns.length > 0 ? game.turns[game.turns.length - 1] : game.direction, direction)) {
    toast(lockedMessage()); // until "Turn left" is learned, only right turns work
  } else if (LAUNCH[screen]) {
    const key = LAUNCH[screen].key;
    if (launchListens(screen, screenTime) && (!key || event.code === key)) setScreen(LAUNCH[screen].then); // any key, or its own
  } else if (screen === 'ready' && direction) {
    queueTurn(game, direction);
    setScreen('play');
  } else if (screen === 'play' && direction) {
    queueTurn(game, direction);
  } else if (screen === 'play' && event.code === 'KeyM') {
    setScreen('world-map'); // Enter closes it, then an arrow key carries on
  } else if ((screen === 'play' || screen === 'ready') && event.code === 'KeyF') {
    toast('Fast travel is coming in a future update.');
  } else if (screen === 'finisher' && event.code === FINISHER.key && screenTime >= FINISHER.slowMs) {
    setScreen('finisher-bite');
  } else if (screen === 'gameover' && (event.code === 'Enter' || event.code === 'Space')) {
    setScreen('loot-box'); // a loot box after every game over, then the wardrobe, then a new game
  }
});

canvas.addEventListener('wheel', event => {
  if (screen !== 'terms') return;
  event.preventDefault();
  scrollTerms(event.deltaY);
}, { passive: false });

// The game loop. The browser calls frame() about 60 times a second.
// The snake moves on a fixed beat (TICK_MS), however fast the screen draws.
let lastFrame = null;
let waited = 0;
function frame(now) {
  const elapsed = lastFrame === null ? 0 : Math.min(now - lastFrame, 250); // after a long pause, don't jump ahead
  lastFrame = now;
  screenTime += elapsed;
  updateWork(screen, screenTime, seed, canvas.width, BOARD);
  onlineWork(screen, screenTime, elapsed);
  worldWork(elapsed);
  if (screen === 'preparing' && !world.ready) prepareWorld(seed); // "Preparing your experience" makes the world
  if (screen === 'loading' && !voice.started) loadVoice();
  if (screen === 'opening') speak(lineAt(OPENING, screenTime));
  if (screen === 'reflection') speak(lineAt([reflection], screenTime));
  const next = launchTimeUp(screen, screenTime);
  if (next) setScreen(next);
  if (screen === 'finisher-bite' && screenTime >= FINISHER.biteMs) bite();
  if (screen === 'reflection' && screenTime >= cutsceneMs([reflection])) carryOn();
  if (screen === 'reconnecting' && screenTime >= online.dropMs) {
    reconnected();
    carryOn();
  }
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
  } else {
    const found = visitCell(game.snake[0]); // a map marker on this cell
    if (found) toast(found);
    gainXp(PROGRESS.xp.move);
    passCheck(progression.xp);
    if (connectionDrops()) dropPending = true; // the game pauses until SnakeNet "reconnects"
    if (progression.pending > 0 || season.pending > 0 || dropPending) carryOn();
  }
}

// After anything that stops play: a level-up waiting comes first (LEVEL UP!, then the skill tree),
// then a battle-pass tier, then a connection drop waiting, then play.
function carryOn() {
  if (progression.pending > 0) {
    setScreen('level-up');
  } else if (season.pending > 0) {
    setScreen('battle-pass');
  } else if (dropPending) {
    dropPending = false;
    report('reconnect', { playTicks: online.playTicks, ms: online.dropMs });
    setScreen('reconnecting');
  } else {
    setScreen('play');
  }
}

// The end of the finishing move: the snake takes its step onto the apple, and it counts.
function bite() {
  before = copySnake();
  step(game, random);
  report('apple', { score: game.score, tick: game.tick });
  gainXp(PROGRESS.xp.apple); // a level-up or a tier it makes waits for the reflection
  passCheck(progression.xp);
  reflection = REFLECTIONS[(game.score - 1) % REFLECTIONS.length];
  setScreen('reflection');
}

function setScreen(name) {
  screen = name;
  screenTime = 0;
  waited = 0;
  voice.spoken = null;
  onlineScreen(name);
  worldScreen(name);
  progressScreen(name);
  seasonScreen(name);
  report('screen', { name });
}

function copySnake() {
  return game.snake.map(part => ({ x: part.x, y: part.y }));
}

function draw() {
  if (screen === 'world-map') {
    const head = game.snake[0];
    const seen = appleVisible(head, game.apple); // since v1.7 the maps show the apple only once it is in view
    drawWorldMap(ctx, screenTime, canvas.width, canvas.height, head, seen ? game.apple : null, seen ? questDistance() : null);
    drawToasts(ctx, canvas.width);
    reportFirstFrame();
    return;
  }
  const seasonScreens = { 'battle-pass': drawBattlePass, 'parody-shop': drawParodyShop, 'loot-box': drawLootBox, wardrobe: drawWardrobe };
  if (seasonScreens[screen]) {
    seasonScreens[screen](ctx, screenTime, canvas.width, canvas.height);
    drawToasts(ctx, canvas.width);
    reportFirstFrame();
    return;
  }
  if (screen === 'skill-tree') {
    drawSkillTree(ctx, screenTime, canvas.width, canvas.height);
    drawToasts(ctx, canvas.width);
    reportFirstFrame();
    return;
  }
  if (LAUNCH[screen] && screen !== 'opening') {
    drawLaunch(ctx, screen, screenTime, canvas.width, canvas.height);
    drawToasts(ctx, canvas.width);
    reportFirstFrame();
    return;
  }
  drawTopBar(ctx, canvas.width, `Score ${game.score}   Best ${best}`, VERSION);

  // How far the snake is between its last cell and its new one: 0 to 1.
  // Until "Smooth movement" is learned again, the snake jumps from cell to cell.
  const progress = screen === 'play' && progression.skills.smooth ? Math.min(waited / TICK_MS, 1) : 1;
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

  const cam = camera(headAt);
  const toScreen = p => ({ x: BOARD / 2 + (p.x - cam.x) * cam.zoom, y: HUD + BOARD / 2 + (p.y - cam.y) * cam.zoom });
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HUD, BOARD, BOARD);
  ctx.clip();
  ctx.translate(BOARD / 2, HUD + BOARD / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);
  drawWorld(ctx, cam.view); // only the cells the camera sees
  if (progression.skills.shadow) withShadow(ctx, () => drawSnake(path, headAt)); // soft shadows, from the day-one patch
  else drawSnake(path, headAt); // the shadow is a skill now
  const seen = appleVisible(game.snake[0], game.apple); // only within VISION cells, until Apple Vision
  if (seen) drawApple(game.apple, appleScale, true);
  drawClouds(ctx, cam.view);
  ctx.restore();
  if (screen === 'opening') drawDarkness(toScreen(headAt), LIGHT); // the opening is still at night

  if (['ready', 'play', 'reconnecting', 'gameover'].includes(screen) && game.apple) {
    drawVision(ctx, toScreen(headAt), cam.zoom);
    drawWorldHud(ctx, seen ? questDistance() : null, HUD);
    drawSeasonHud(ctx, HUD);
    drawXpBar(ctx, 14, HUD + BOARD - 16, BOARD - WORLD.minimap.px - 50, world.time);
    drawMinimap(ctx, game.snake[0], seen ? game.apple : null, BOARD - WORLD.minimap.px - 10, HUD + BOARD - WORLD.minimap.px - 24);
    if (seen) drawQuestMarker(ctx, toScreen(center(game.apple)), toScreen(headAt), { x: 0, y: HUD, w: BOARD, h: BOARD });
  }
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
  if (screen === 'ready') drawMessage('Press an arrow key or WASD', HUD + BOARD / 2 + 70); // below the head, which the camera keeps in the middle
  if (screen === 'gameover') drawMessage('Game over. Press Enter to play again');
  if (screen === 'reconnecting') drawReconnecting(ctx, screenTime, canvas.width, canvas.height);
  if (screen === 'level-up') drawLevelUp(ctx, screenTime, canvas.width, canvas.height);
  drawToasts(ctx, canvas.width);
  reportFirstFrame();
}

// Moves from the head to the apple (a cell is a metre, as open worlds go).
function questDistance() {
  const head = game.snake[0];
  return game.apple ? Math.abs(game.apple.x - head.x) + Math.abs(game.apple.y - head.y) : 0;
}

// The camera follows Warden Snek, stopping at the edges of the world. Cutscenes and the
// finishing move are shot in close-up on the head. Returns where it looks, its zoom,
// and the rectangle of the world it sees (in world px), which is all that gets drawn.
function camera(headAt) {
  let zoom = 1;
  if (screen === 'opening' || screen === 'reflection') zoom = 2.5;
  if (screen === 'finisher') zoom = 1 + 1.5 * Math.min(1, screenTime / FINISHER.slowMs); // the slow push-in
  if (screen === 'finisher-bite') zoom = 2.5;
  const half = BOARD / 2 - 3 * CELL; // since v1.7 the camera may look 3 cells past the edge, so Snek never hides under the HUD
  const edge = v => Math.max(half, Math.min(WORLD.size * CELL - half, v));
  const close = (zoom - 1) / 1.5; // 0 at normal zoom, 1 in a close-up, which centres on the head
  let x = edge(headAt.x) + (headAt.x - edge(headAt.x)) * close;
  let y = edge(headAt.y) + (headAt.y - edge(headAt.y)) * close;
  if (zoom === 1) {
    x = Math.round(x);
    y = Math.round(y);
  }
  const seen = half / zoom;
  return { x, y, zoom, view: { x0: x - seen, y0: y - seen, x1: x + seen, y1: y + seen } };
}

// The field at night: darkness everywhere except a soft light around the head (on screen).
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

// The middle of a cell, in world px.
function center(cell) {
  return { x: cell.x * CELL + CELL / 2, y: cell.y * CELL + CELL / 2 };
}

// The snake, in the skin it wears (src/skins.js; drawing only).
function drawSnake(path, headAt) {
  const points = [headAt, ...path.slice(1).map(center)];
  if (drawSkinnedSnake(ctx, points, world.time)) drawHead(headAt);
}

// The head, with two eyes that look the way the snake is about to go
// (since v1.6, only with "Eye contact"; until then they stare at you).
function drawHead(p) {
  const heading = game.turns.length > 0 ? game.turns[0] : game.direction;
  const look = DIRECTIONS[heading];
  ctx.fillStyle = wornSkin().head;
  ctx.beginPath();
  ctx.arc(p.x, p.y, CELL / 2, 0, Math.PI * 2);
  ctx.fill();
  if (progression.skills.tongue && Math.floor(world.time / 700) % 3 === 0) drawTongue(p, look);
  for (const side of [-1, 1]) {
    // Eyes sit a little forward, one on each side of the direction of travel.
    const eye = progression.skills.eyes
      ? { x: p.x + look.x * 4 - look.y * side * 5, y: p.y + look.y * 4 + look.x * side * 5 }
      : { x: p.x + side * 5, y: p.y - 1 };
    const pupil = progression.skills.eyes ? look : { x: 0, y: 0 };
    ctx.fillStyle = COLORS.eye;
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.pupil;
    ctx.beginPath();
    ctx.arc(eye.x + pupil.x * 2, eye.y + pupil.y * 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The "Tongue" skill: a forked tongue, now and then. It does nothing.
function drawTongue(p, look) {
  const tip = { x: p.x + look.x * 20, y: p.y + look.y * 20 };
  ctx.strokeStyle = '#d33';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x + look.x * 10, p.y + look.y * 10);
  ctx.lineTo(tip.x, tip.y);
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x + look.x * 4 - look.y * 3, tip.y + look.y * 4 + look.x * 3);
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x + look.x * 4 + look.y * 3, tip.y + look.y * 4 - look.x * 3);
  ctx.stroke();
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
// The key that moves this screen on right now (leaves it, or on the terms scrolls them first), or null.
function nextKey() {
  if (screen === 'terms' && !termsRead()) return 'PageDown'; // the terms must be scrolled to the bottom first
  if (launchListens(screen, screenTime)) return LAUNCH[screen].key || 'Enter';
  if (screen === 'gameover') return 'Enter';
  if (screen === 'level-up' && screenTime >= PROGRESS.levelUpListensAfter) return 'Enter';
  if (screen === 'skill-tree') return skillTreeNext(screenTime);
  if (['battle-pass', 'parody-shop', 'loot-box', 'wardrobe'].includes(screen)) return seasonNext(screen, screenTime);
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
    next: nextKey(),                   // the key that moves this screen on, once it listens
    tick: game.tick,
    heading: game.turns.length > 0 ? game.turns[game.turns.length - 1] : game.direction,
    snake: game.snake,
    apple: appleVisible(game.snake[0], game.apple) ? game.apple : null, // since v1.7, only within the vision radius
    vision: hasAppleVision() ? null : VISION,
    score: game.score,
    grid: game.size, // since v1.5, the open world (the quest marker always shows where the apple is)
    allowedTurns: allowedTurns(), // since v1.6: 'right' always, 'left' once learned (going straight is always allowed)
    level: progression.level,
    xp: progression.xp,
    skills: screen === 'skill-tree' ? skillsForProbe() : null, // the skill tree's list, and where its cursor is
    cursor: screen === 'skill-tree' ? progression.cursor : null,
  }),
};

report('screen', { name: screen });
requestAnimationFrame(frame);
