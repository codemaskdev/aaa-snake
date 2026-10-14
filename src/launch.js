// AAA Snake v1.5: the launch experience.
// Everything you sit through before the snake: the day-one update (update.js), three
// studio logos you cannot skip, a health warning, a title screen, the online screens
// (online.js: connecting, signing in, the queue, the terms of service), a loading screen
// with tips (it loads the voice lines), the opening cutscene (story.js), an autosave
// notice before every game, and the world map with the quest (world.js).
// The studio names are invented. Times are in ms of animation frames, never the clock.

const LAUNCH = {
  'update-required': { lasts: 2000, then: 'patch-download' },
  'patch-download':  { lasts: 0, needs: patchDownloaded, then: 'patch-install' }, // until every byte is in
  'patch-install':   { lasts: 3000, needs: patchInstalled, then: 'preparing' },
  'preparing':       { lasts: 3000, then: 'publisher-logo' },
  'publisher-logo':  { lasts: 3000, then: 'studio-logo' },  // cannot be skipped
  'studio-logo':     { lasts: 3000, then: 'engine-logo' },  // cannot be skipped
  'engine-logo':     { lasts: 3000, then: 'warning' },      // cannot be skipped
  'warning':         { listensAfter: 4000, then: 'title' }, // any key, once it listens
  'title':           { listensAfter: 2500, then: 'connecting' }, // after the title animation
  'connecting':      { lasts: ONLINE.connectMs, then: 'sign-in' }, // a stub: no request is made
  'sign-in':         { listensAfter: ONLINE.signInListensAfter, key: 'Enter', then: 'signing-in' },
  'signing-in':      { lasts: ONLINE.signingInMs, then: 'queue' },
  'queue':           { lasts: 0, needs: queueDone, then: 'terms' }, // until the position reaches 0
  'terms':           { listensAfter: 0, needs: termsRead, key: 'Enter', then: 'loading' }, // scrolled to the bottom
  'loading':         { listensAfter: 5000, needs: voiceLoaded, then: 'opening' }, // tips, then "Press any key"
  'opening':         { lasts: cutsceneMs(OPENING), then: 'autosave' }, // skippable "after your first playthrough"
  'autosave':        { lasts: 3000, then: 'world-map' },    // before every game
  'world-map':       { listensAfter: WORLD.mapListensAfter, key: 'Enter', then: 'ready' }, // the quest; also on M
};

const UPDATE_SCREENS = ['update-required', 'patch-download', 'patch-install', 'preparing'];
const ONLINE_SCREENS = ['connecting', 'sign-in', 'signing-in', 'queue', 'terms'];

const TIPS = [
  'Tip: apples are food.',
  'Tip: the snake goes where its eyes look.',
  'Tip: walls do not move. Try not to move into them.',
  'Tip: a longer snake is a bigger snake.',
  'Tip: when asked to press any key, press any key.',
];

const GOLD = '#e8c66a';

// True if this launch screen reacts to a key yet (any key, or only its own `key`).
function launchListens(screen, time) {
  const step = LAUNCH[screen];
  return Boolean(step && step.listensAfter !== undefined && time >= step.listensAfter && (!step.needs || step.needs(time)));
}

// The next screen, if this launch screen has run its time (and done its work); otherwise null.
function launchTimeUp(screen, time) {
  const step = LAUNCH[screen];
  if (!step || step.lasts === undefined || time < step.lasts) return null;
  return !step.needs || step.needs(time) ? step.then : null;
}

// Fade in over the first half second and out over the last one.
function fade(time, lasts) {
  return Math.max(0, Math.min(1, time / 500, (lasts - time) / 500));
}

function drawLaunch(ctx, screen, time, width, height) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (UPDATE_SCREENS.includes(screen)) drawUpdate(ctx, screen, time, width, height);
  if (screen === 'publisher-logo') drawPublisher(ctx, time, width, height);
  if (screen === 'studio-logo') drawStudio(ctx, time, width, height);
  if (screen === 'engine-logo') drawEngine(ctx, time, width, height);
  if (screen === 'warning') drawWarning(ctx, time, width, height);
  if (screen === 'title') drawTitle(ctx, time, width, height);
  if (ONLINE_SCREENS.includes(screen)) drawOnline(ctx, screen, time, width, height);
  if (screen === 'loading') drawLoading(ctx, time, width, height);
  if (screen === 'autosave') drawAutosave(ctx, time, width, height);
  ctx.restore();
}

// Logo 1: a publisher name that slowly grows, as if it were very important.
function drawPublisher(ctx, time, width, height) {
  ctx.globalAlpha = fade(time, 3000);
  const grow = 1 + time / 12000;
  ctx.translate(width / 2, height / 2);
  ctx.scale(grow, grow);
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText('VERY LARGE', 0, -24);
  ctx.fillText('PUBLISHER', 0, 24);
  ctx.font = '14px Georgia, serif';
  ctx.fillText('p r e s e n t s', 0, 70);
}

// Logo 2: the studio's budget bar fills up, and keeps going past the end.
function drawStudio(ctx, time, width, height) {
  ctx.globalAlpha = fade(time, 3000);
  const barWidth = 240;
  const fill = barWidth * (time / 1500);
  ctx.fillStyle = '#c33';
  ctx.fillRect(width / 2 - barWidth / 2, height / 2 + 20, Math.min(fill, width), 16);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(width / 2 - barWidth / 2, height / 2 + 20, barWidth, 16);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 30px Helvetica, Arial, sans-serif';
  ctx.fillText('OVERBUDGET', width / 2, height / 2 - 36);
  ctx.font = '16px Helvetica, Arial, sans-serif';
  ctx.fillText('I N T E R A C T I V E', width / 2, height / 2 - 6);
}

// Logo 3: the engine draws its own grid, line by line.
function drawEngine(ctx, time, width, height) {
  ctx.globalAlpha = fade(time, 3000);
  const lines = Math.floor(time / 80);
  ctx.strokeStyle = '#2a6';
  ctx.lineWidth = 1;
  for (let i = 0; i <= Math.min(lines, 12); i++) {
    const x = width / 2 - 120 + i * 20;
    const y = height / 2 - 120 + i * 20;
    ctx.beginPath(); ctx.moveTo(x, height / 2 - 120); ctx.lineTo(x, height / 2 + 120); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(width / 2 - 120, y); ctx.lineTo(width / 2 + 120, y); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(width / 2 - 140, height / 2 - 34, 280, 68);
  ctx.fillStyle = '#8f8';
  ctx.font = '13px Helvetica, Arial, sans-serif';
  ctx.fillText('POWERED BY', width / 2, height / 2 - 14);
  ctx.font = 'bold 28px Helvetica, Arial, sans-serif';
  ctx.fillText('GRID & BONES', width / 2, height / 2 + 14);
}

function drawWarning(ctx, time, width, height) {
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px Helvetica, Arial, sans-serif';
  ctx.fillText('PHOTOSENSITIVITY WARNING', width / 2, 120);
  ctx.font = '16px Helvetica, Arial, sans-serif';
  const text = 'Some people can have seizures when they see flashing lights or patterns, '
    + 'including in video games. If you feel dizzy or unwell while playing, stop at once and rest. '
    + 'This game contains squares.';
  wrapText(ctx, text, width / 2, 190, width - 80, 24);
  if (launchListens('warning', time)) {
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press any key to continue', width / 2, height - 70);
  }
}

// The title drops in letter by letter; only then does "Press any key" appear.
function drawTitle(ctx, time, width, height) {
  const title = 'AAA SNAKE';
  ctx.font = 'bold 56px Helvetica, Arial, sans-serif';
  const shown = Math.min(title.length, Math.floor(time / (LAUNCH.title.listensAfter / title.length)));
  ctx.fillStyle = GOLD;
  ctx.fillText(title.slice(0, shown), width / 2, height / 2 - 30);
  if (launchListens('title', time) && Math.floor(time / 500) % 2 === 0) {
    ctx.fillStyle = '#fff';
    ctx.font = '18px Helvetica, Arial, sans-serif';
    ctx.fillText('Press any key', width / 2, height / 2 + 60);
  }
}

// A loading screen: a new tip every 2.5 s, then "Press any key".
function drawLoading(ctx, time, width, height) {
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px Helvetica, Arial, sans-serif';
  ctx.fillText('LOADING', width / 2, height / 2 - 90);
  drawStripes(ctx, 80, height / 2 - 60, width - 160, time);
  ctx.font = 'italic 17px Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#ddd';
  wrapText(ctx, TIPS[Math.floor(time / 2500) % TIPS.length], width / 2, height / 2 + 10, width - 100, 24);
  ctx.font = '14px Menlo, monospace';
  ctx.fillStyle = '#888';
  ctx.fillText(`Voice lines: ${voice.loaded} of ${LINES.length}`, width / 2, height / 2 + 70);
  if (launchListens('loading', time)) {
    ctx.fillStyle = '#aaa';
    ctx.font = '16px Helvetica, Arial, sans-serif';
    ctx.fillText('Press any key to continue', width / 2, height - 70);
  }
}

// A spinning ring and a notice, before every single game.
function drawAutosave(ctx, time, width, height) {
  ctx.globalAlpha = fade(time, 3000);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 5;
  ctx.beginPath();
  const start = time / 150;
  ctx.arc(width / 2, height / 2 - 40, 22, start, start + Math.PI * 1.5);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '16px Helvetica, Arial, sans-serif';
  wrapText(ctx, 'This game saves automatically. Do not turn off your computer while this icon is on screen.',
    width / 2, height / 2 + 30, width - 100, 24);
}

// Write text centred on x, breaking lines so none is wider than maxWidth.
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  let line = '';
  for (const word of text.split(' ')) {
    const longer = line ? `${line} ${word}` : word;
    if (ctx.measureText(longer).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = longer;
    }
  }
  if (line) ctx.fillText(line, x, y);
}
