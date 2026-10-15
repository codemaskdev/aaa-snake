// AAA Snake v1.2: the day-one update, before the logos.
// "A required update is available", then the patch is downloaded from the game's own
// server (patch/day-one.js, nowhere else), installed, and the game "prepares your
// experience" (it really does: it draws the grass field the patch adds).
// The download is throttled on purpose: one piece of PATCH_PIECE bytes per
// PATCH_EVERY ms. The bytes on screen are the real bytes received.

const PATCH_URL = 'patch/day-one.js';
const PATCH_PIECE = 256;   // bytes per request
const PATCH_EVERY = 1000;  // ms between requests: the throttle

// Every patch note so far, as in UPDATES.md (tests/v1.2.test.mjs checks they match).
const PATCH_NOTES = [
  ['v1.0', "Snake. Eat apples, grow, don't hit anything."],
  ['v1.1', "We've added a premium launch experience so every session starts with the right expectations."],
  ['v1.2', 'A day-one patch is now required to enjoy the day-one experience.'],
  ['v1.3', "Warden Snek's story is now fully voiced, and every apple is now a cinematic moment."],
  ['v1.4', "Always-online connectivity keeps you close to the Snake community, even when you'd rather play."],
  ['v1.5', 'The world is now bigger than ever. The apple is the same size as before.'],
  ['v1.6', 'Turning left is now a skill. Progression is now a feature.'],
  ['v1.7', 'Season 1 is here! Unlock exclusive rewards, including the ability to see the apple.'],
];

const patch = { total: null, pieces: [], received: 0, requested: 0, installed: false, failed: null };

// Ask the server for piece k of the patch (a byte range of the file).
function requestPiece(k) {
  patch.requested = k + 1;
  const from = k * PATCH_PIECE;
  fetch(PATCH_URL, { headers: { Range: `bytes=${from}-${from + PATCH_PIECE - 1}` }, cache: 'no-store' })
    .then(response => {
      if (response.status !== 206) throw new Error(`the server answered ${response.status}`);
      patch.total = Number(response.headers.get('Content-Range').split('/')[1]);
      return response.arrayBuffer();
    })
    .then(bytes => {
      patch.pieces[k] = new Uint8Array(bytes);
      patch.received += bytes.byteLength;
    })
    .catch(error => { patch.failed = String(error.message || error); });
}

function piecesNeeded() {
  return patch.total === null ? 1 : Math.ceil(patch.total / PATCH_PIECE);
}

function patchDownloaded(time) {
  return patch.total !== null && patch.received === patch.total && time >= piecesNeeded() * PATCH_EVERY;
}

function patchInstalled() {
  return patch.installed;
}

// Put the pieces back together and run them, like a <script> the game wrote itself.
function installPatch() {
  const script = document.createElement('script');
  script.src = URL.createObjectURL(new Blob(patch.pieces, { type: 'text/javascript' }));
  script.onload = () => { patch.installed = true; };
  script.onerror = () => { patch.failed = 'the patch did not install'; };
  document.head.appendChild(script);
}

// The real work behind each update screen, done on the frames while it shows.
function updateWork(screen, time, seed, width, height) {
  if (screen === 'update-required' && patch.requested === 0) requestPiece(0);
  if (screen === 'patch-download') {
    while (patch.requested < piecesNeeded() && time >= patch.requested * PATCH_EVERY) requestPiece(patch.requested);
  }
  if (screen === 'patch-install' && !patch.installing) {
    patch.installing = true;
    installPatch();
  }
  if (screen === 'preparing' && !patch.prepared) {
    patch.prepared = true;
    prepareField(seed, width, height); // from the patch
  }
}

function drawUpdate(ctx, screen, time, width, height) {
  ctx.fillStyle = '#fff';
  if (patch.failed) {
    ctx.font = 'bold 20px Helvetica, Arial, sans-serif';
    ctx.fillText('THE UPDATE FAILED', width / 2, 160);
    ctx.font = '15px Helvetica, Arial, sans-serif';
    wrapText(ctx, `${patch.failed}. AAA Snake needs its own server for this: run npm run serve and open it from there.`,
      width / 2, 210, width - 80, 22);
    return;
  }
  if (screen === 'update-required') {
    ctx.font = 'bold 22px Helvetica, Arial, sans-serif';
    ctx.fillText('A REQUIRED UPDATE IS AVAILABLE', width / 2, 150);
    ctx.font = '16px Helvetica, Arial, sans-serif';
    wrapText(ctx, 'AAA Snake must be updated before you can play. The update will start automatically.',
      width / 2, 200, width - 100, 24);
    drawSpinner(ctx, width / 2, 300, time);
  }
  if (screen === 'patch-download') {
    ctx.font = 'bold 22px Helvetica, Arial, sans-serif';
    ctx.fillText('DOWNLOADING DAY-ONE PATCH', width / 2, 70);
    drawBar(ctx, 60, 100, width - 120, patch.total ? patch.received / patch.total : 0);
    ctx.font = '16px Menlo, monospace';
    const total = patch.total === null ? '...' : patch.total.toLocaleString('en-US');
    ctx.fillText(`${patch.received.toLocaleString('en-US')} of ${total} bytes`, width / 2, 145);
    drawPatchNotes(ctx, time, width, height);
  }
  if (screen === 'patch-install') {
    ctx.font = 'bold 22px Helvetica, Arial, sans-serif';
    ctx.fillText('INSTALLING', width / 2, 70);
    drawStripes(ctx, 60, 100, width - 120, time);
    ctx.font = '16px Menlo, monospace';
    ctx.fillText(`${patch.received.toLocaleString('en-US')} bytes`, width / 2, 145);
    drawPatchNotes(ctx, time, width, height);
  }
  if (screen === 'preparing') {
    // The grass field the patch just drew fades in behind the text: the experience, prepared.
    if (patch.prepared) { // drawn on this screen's first frame of work, so from its second frame on
      ctx.globalAlpha = Math.min(1, time / 3000);
      drawField(ctx, 0, (height - width) / 2);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, height / 2 - 60, width, 120);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px Helvetica, Arial, sans-serif';
    ctx.fillText('PREPARING YOUR EXPERIENCE', width / 2, height / 2 - 20);
    drawSpinner(ctx, width / 2, height / 2 + 25, time);
  }
}

// The patch notes so far, scrolling up in a box, over and over.
function drawPatchNotes(ctx, time, width, height) {
  const box = { x: 40, y: 190, w: width - 80, h: height - 230 };
  ctx.strokeStyle = '#444';
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lines = [];
  for (const [version, note] of PATCH_NOTES) lines.push({ text: `PATCH NOTES ${version}`, bold: true }, ...splitLines(ctx, note, box.w - 30).map(text => ({ text })), { text: '' });
  const lineHeight = 22;
  const loop = lines.length * lineHeight;
  const offset = (time / 40) % loop;
  for (let copy = 0; copy < 2; copy++) {
    lines.forEach((line, i) => {
      ctx.font = line.bold ? 'bold 14px Helvetica, Arial, sans-serif' : '14px Helvetica, Arial, sans-serif';
      ctx.fillStyle = line.bold ? GOLD : '#ccc';
      ctx.fillText(line.text, box.x + 15, box.y + 12 - offset + copy * loop + i * lineHeight);
    });
  }
  ctx.restore();
}

function splitLines(ctx, text, maxWidth) {
  ctx.font = '14px Helvetica, Arial, sans-serif';
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const longer = line ? `${line} ${word}` : word;
    if (ctx.measureText(longer).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = longer;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawBar(ctx, x, y, w, share) {
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, 18);
  ctx.fillStyle = GOLD;
  ctx.fillRect(x + 3, y + 3, (w - 6) * Math.min(1, share), 12);
}

// A bar with moving stripes: busy, with no promise of how long.
function drawStripes(ctx, x, y, w, time) {
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, 18);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 3, y + 3, w - 6, 12);
  ctx.clip();
  ctx.fillStyle = GOLD;
  for (let sx = x - 40 + ((time / 20) % 40); sx < x + w; sx += 40) {
    ctx.beginPath();
    ctx.moveTo(sx, y + 15);
    ctx.lineTo(sx + 20, y + 15);
    ctx.lineTo(sx + 32, y + 3);
    ctx.lineTo(sx + 12, y + 3);
    ctx.fill();
  }
  ctx.restore();
}

function drawSpinner(ctx, x, y, time) {
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  ctx.beginPath();
  const start = time / 150;
  ctx.arc(x, y, 16, start, start + Math.PI * 1.5);
  ctx.stroke();
}
