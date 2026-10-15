// AAA Snake v2.0: the Game of the Year Edition's arcade cabinet, and the end.
// The cabinet stands six cells ahead of Snek's start. It runs the real v1.0: dist/v1.0's files,
// taken from the v1.0 tag at build time into cabinet/ (tools/build.mjs), loaded in an iframe of
// the same origin. Walking onto it stops play at its door; Enter goes inside, where the arrow keys
// steer v1.0's snake. The apple eaten inside counts as Snek's apple, and it ends the game: the
// reflection after an apple, THE END, then the credits, and nothing after them.
// Nothing here reads a clock; times are ms of animation frames.

const CABINET = { x: 134, y: 128, endMs: 3000 };

const cabinet = { frame: null, ended: false };

// The cabinet's own window (v1.0), once it has loaded.
function cabinetWindow() {
  if (!cabinet.frame) cabinet.frame = document.getElementById('cabinet');
  const w = cabinet.frame && cabinet.frame.contentWindow;
  return w && w.snakeGame ? w : null;
}

function atCabinet(cell) {
  return cell.x === CABINET.x && cell.y === CABINET.y;
}

// On screen: inside the 20 x 20 cells around the head (the view).
function cabinetOnScreen(head) {
  return Math.abs(CABINET.x - head.x) <= 10 && Math.abs(CABINET.y - head.y) <= 10;
}

// A key for v1.0, while Snek is inside: handed to the cabinet's own window.
function cabinetKey(code) {
  const w = cabinetWindow();
  if (w) w.dispatchEvent(new w.KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
}

// The first apple eaten inside, from v1.0's own log, or null.
function cabinetApple() {
  const w = cabinetWindow();
  return w ? w.snakeGame.log.find(e => e.type === 'apple') || null : null;
}

// The cabinet, standing in the world, its screen showing what v1.0 shows.
function drawCabinet(ctx) {
  const x = CABINET.x * CELL;
  const y = CABINET.y * CELL;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; // its shadow
  ctx.fillRect(x + 4, y - CELL + 6, CELL + 4, CELL * 2);
  ctx.fillStyle = '#2b1d4a';
  ctx.fillRect(x - 2, y - CELL - 4, CELL + 4, CELL * 2 + 4);
  ctx.fillStyle = '#111';
  ctx.fillRect(x + 1, y - CELL, CELL - 2, CELL - 4);
  const w = cabinetWindow();
  const inner = w && w.document.getElementById('game');
  if (inner) ctx.drawImage(inner, x + 2, y - CELL + 1, CELL - 4, CELL - 6);
  ctx.fillStyle = '#e8c66a';
  ctx.fillRect(x + 4, y + 2, CELL - 8, 3);
  ctx.restore();
}

// Inside the cabinet: v1.0's screen fills the view.
function drawInsideCabinet(ctx, width, height) {
  const w = cabinetWindow();
  const inner = w && w.document.getElementById('game');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  if (inner) ctx.drawImage(inner, 0, 0, width, height);
}

function drawCabinetDoor(ctx, width, height) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, height / 2 - 40, width, 80);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8c66a';
  ctx.font = 'bold 20px Helvetica, Arial, sans-serif';
  ctx.fillText('ARCADE: SNAKE (v1.0)', width / 2, height / 2 - 12);
  ctx.fillStyle = '#fff';
  ctx.font = '15px Helvetica, Arial, sans-serif';
  ctx.fillText('Press Enter to play', width / 2, height / 2 + 16);
  ctx.restore();
}

function drawTheEnd(ctx, time, width, height) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.globalAlpha = Math.min(1, time / 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px Georgia, serif';
  ctx.fillText('THE END', width / 2, height / 2);
  ctx.restore();
}

// The credits: who did what, and what was used. They stay; there is nothing after them.
const CREDITS = [
  ['AAA SNAKE', ''],
  ['Game of the Year Edition', ''],
  ['', ''],
  ['Idea, prompts and every decision', 'CodeMask'],
  ['Code, tests, measuring rig, shorts', 'Claude Code (Claude Opus 5.5)'],
  ['Voice of Warden Snek', 'ElevenLabs text-to-speech, eleven_v3'],
  ['', 'a voice designed for this project'],
  ['', 'with ElevenLabs Voice Design: synthetic, not a clone'],
  ['Measured with', 'Playwright 1.63.0, Chromium'],
  ['Shorts encoded with', 'ffmpeg'],
  ['', ''],
  ['The publisher, studio and engine on the logos are invented.', ''],
  ['Nothing in this game can be bought. Every shop is a parody.', ''],
  ['', ''],
  ['Thank you for playing.', ''],
];

function drawCredits(ctx, time, width, height) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const top = Math.max(60, height - time / 20); // they roll up, then stay
  CREDITS.forEach(([left, right], i) => {
    const y = top + i * 30;
    if (left && !right) {
      ctx.fillStyle = i < 2 ? '#e8c66a' : '#ccc';
      ctx.font = i < 2 ? 'bold 18px Helvetica, Arial, sans-serif' : '13px Helvetica, Arial, sans-serif';
      ctx.fillText(left, width / 2, y);
    } else if (left || right) {
      ctx.fillStyle = '#999';
      ctx.font = '12px Helvetica, Arial, sans-serif';
      ctx.fillText(left, width / 2, y - 8);
      ctx.fillStyle = '#fff';
      ctx.font = '14px Helvetica, Arial, sans-serif';
      ctx.fillText(right, width / 2, y + 8);
    }
  });
  ctx.restore();
}
