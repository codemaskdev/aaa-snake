// AAA Snake v1.4: always online.
// After the title, the game connects to SnakeNet, signs in a guest account, puts you in
// a server queue and asks you to accept its updated terms of service. During play, the
// connection drops now and then, and the game waits while it "reconnects".
// SnakeNet is a stub in this file: nothing here makes a network request. Every number it
// shows (the guest account, the queue position, when the connection drops and for how
// long) comes from the seed, through its own generator, so the apples land where they did.
// Times are in ms of animation frames, never the clock.

const ONLINE = {
  connectMs: 3000,          // "Connecting to SnakeNet..."
  signInListensAfter: 1500, // the button lights up
  signingInMs: 2000,
  toastMs: 3000,
  loginBonus: 100,          // Scales, the game's currency; nothing can be bought with it, or for it
  reconnectEvery: [150, 300], // ticks of play between two drops (15 to 30 s of play)
  reconnectLasts: [3000, 6000], // ms
};

const online = {
  random: null,
  guest: '',
  queue: [],          // [{ at, position }]: the position shown from `at` ms into the queue screen
  status: 'offline',  // 'offline', 'online' or 'reconnecting'
  scales: 0,
  toasts: [],         // [{ text, at }]
  clock: 0,           // ms of frames since the page started, for the toasts
  playTicks: 0,       // moves of the snake so far, over every game
  nextDrop: 0,        // the playTicks at which the connection drops next
  dropMs: 0,          // how long the current drop lasts
  drops: 0,
  terms: { target: 0, shown: 0, max: null, lines: null },
};

function startOnline(seed) {
  online.random = makeRandom((seed ^ 0x51ec7e5) >>> 0);
  const r = online.random;
  online.guest = `guest-${10000 + Math.floor(r() * 90000)}`;
  let position = 30 + Math.floor(r() * 40);
  let at = 0;
  online.queue = [{ at, position }];
  while (position > 0) {
    at += 200 + Math.floor(r() * 7) * 100;
    position = Math.max(0, position - 1 - Math.floor(r() * 3));
    online.queue.push({ at, position });
  }
  online.nextDrop = between(r, ONLINE.reconnectEvery);
}

function between(r, [low, high]) {
  return low + Math.floor(r() * (high - low + 1));
}

function queuePosition(time) {
  let position = online.queue[0].position;
  for (const step of online.queue) if (time >= step.at) position = step.position;
  return position;
}

function queueDone(time) {
  return time >= online.queue[online.queue.length - 1].at;
}

function toast(text) {
  online.toasts.push({ text, at: online.clock });
}

// The work behind the online screens, done on the frames while they show.
function onlineWork(screen, time, elapsed) {
  online.clock += elapsed;
  online.toasts = online.toasts.filter(t => online.clock - t.at < ONLINE.toastMs);
  if (screen === 'terms') {
    const t = online.terms;
    if (t.max !== null) {
      const step = elapsed * 2; // the box scrolls at 2000 px a second toward where you asked
      t.shown = t.shown < t.target ? Math.min(t.target, t.shown + step) : Math.max(t.target, t.shown - step);
    }
  }
}

// Called once when each online screen starts.
function onlineScreen(screen) {
  if (screen === 'sign-in') {
    online.status = 'online';
    toast('Connected to SnakeNet');
  }
  if (screen === 'queue') {
    toast(`Signed in as ${online.guest}`);
    online.scales += ONLINE.loginBonus;
    toast(`Daily login bonus: ${ONLINE.loginBonus} Scales`);
  }
  if (screen === 'loading' && online.terms.max !== null) toast('Terms of Service accepted');
}

// One move of the snake in play. True if the connection drops now.
function connectionDrops() {
  online.playTicks++;
  if (online.playTicks < online.nextDrop) return false;
  online.dropMs = between(online.random, ONLINE.reconnectLasts.map(ms => ms / 100)) * 100;
  online.nextDrop = online.playTicks + between(online.random, ONLINE.reconnectEvery);
  online.drops++;
  online.status = 'reconnecting';
  return true;
}

function reconnected() {
  online.status = 'online';
  toast('Connection restored');
}

// The terms of service: you must scroll to the bottom before Accept lights up.
const TERMS_KEYS = { PageDown: 'page', Space: 'page', ArrowDown: 'line', PageUp: '-page', ArrowUp: '-line' };
const TERMS_BOX = { x: 30, y: 150, w: 420, h: 250, line: 18 };

function scrollTerms(amount) {
  const t = online.terms;
  if (t.max === null) return;
  const page = TERMS_BOX.h - 2 * TERMS_BOX.line;
  const by = { page, line: TERMS_BOX.line, '-page': -page, '-line': -TERMS_BOX.line }[amount] ?? amount;
  t.target = Math.max(0, Math.min(t.max, t.target + by));
}

function termsRead() {
  return online.terms.max !== null && online.terms.shown >= online.terms.max;
}

const TERMS = [
  ['1. Acceptance', 'By pressing any key on the title screen you accepted these terms before you could read them. By reading them now you accept them again.'],
  ['2. Changes', 'We may change these terms at any time. When we do, we will show you this window again, and you will scroll to the bottom again.'],
  ['3. Your account', 'Your guest account was created for you, named for you, and signed in for you. You are responsible for everything it does.'],
  ['4. Always online', 'AAA Snake is a single-player game that requires a connection to SnakeNet at all times, so that you are never alone while playing alone.'],
  ['5. The queue', 'The queue keeps the servers healthy. The servers are a file on your own computer, which is very healthy.'],
  ['6. Connection interruptions', 'From time to time the connection may be interrupted. The game will pause and reconnect. This is a feature of the online experience.'],
  ['7. Scales', 'Scales are the currency of SnakeNet. They have no value. They cannot be bought, sold, traded, refunded or spent. They can be counted.'],
  ['8. Daily login bonus', 'You receive Scales for signing in every day. The bonus is part of the experience and is not a reason to play. It is a reason to sign in.'],
  ['9. Apples', 'Apples are licensed to you, not sold. When an apple is eaten, the license ends.'],
  ['10. The snake', 'The snake remains the property of the snake. You may steer it. You may not make it go backwards; it would not let you anyway.'],
  ['11. Walls', 'Walls are provided as is. We make no promise that a wall will move out of your way.'],
  ['12. Warden Snek', 'Warden Snek is a fictional retired orchard warden. Any likeness to a real warden, orchard or snake is a coincidence he would find very moving.'],
  ['13. Fair play', 'Do not use software to play the game for you. The game is measured by software that plays it for you, which is different, because we wrote it.'],
  ['14. Data', 'SnakeNet collects nothing, because SnakeNet is not there. If it were there, it would collect a great deal, and tell you so in section 14.'],
  ['15. Cookies', 'This game does not use cookies. It uses apples.'],
  ['16. Community', 'Be kind to other players. There are no other players.'],
  ['17. Termination', 'We may end your session if the snake hits a wall, or itself. You may start again by pressing Enter.'],
  ['18. Warranty', 'The game is provided without a warranty of any kind, including the warranty that it is a game.'],
  ['19. Liability', 'We are not liable for time spent on logos, updates, cutscenes, queues, reconnections or terms of service, including these.'],
  ['20. Entire agreement', 'These terms, together with the previous terms, the next terms and any terms we think of later, are the entire agreement.'],
  ['21. Reading', 'If you have read this far, thank you. Nobody reads this far. Accept will light up when you reach the end.'],
  ['22. The end', 'This is the end.'],
];

function termsLines(ctx) {
  const lines = [];
  ctx.font = '13px Helvetica, Arial, sans-serif';
  for (const [heading, text] of TERMS) {
    lines.push({ text: heading, bold: true });
    lines.push(...splitLines(ctx, text, TERMS_BOX.w - 30).map(line => ({ text: line })));
    lines.push({ text: '' });
  }
  return lines;
}

// The screens, drawn by drawLaunch.
function drawOnline(ctx, screen, time, width, height) {
  if (screen === 'connecting') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px Helvetica, Arial, sans-serif';
    ctx.fillText(`Connecting to SnakeNet${'.'.repeat(1 + Math.floor(time / 400) % 3)}`, width / 2, height / 2 - 40);
    drawDots(ctx, width / 2, height / 2 + 20, time);
  }
  if (screen === 'sign-in' || screen === 'signing-in') drawSignIn(ctx, screen, time, width, height);
  if (screen === 'queue') drawQueue(ctx, time, width, height);
  if (screen === 'terms') drawTerms(ctx, time, width, height);
}

function drawSignIn(ctx, screen, time, width, height) {
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px Helvetica, Arial, sans-serif';
  ctx.fillText('SIGN IN TO SNAKENET', width / 2, 110);
  const field = (label, value, y) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#aaa';
    ctx.font = '13px Helvetica, Arial, sans-serif';
    ctx.fillText(label, 90, y - 18);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(90, y - 6, 300, 32);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(90.5, y - 5.5, 299, 31);
    ctx.fillStyle = '#fff';
    ctx.font = '16px Menlo, monospace';
    ctx.fillText(value, 102, y + 10);
    ctx.textAlign = 'center';
  };
  field('Account', online.guest, 180);
  field('Password', '•'.repeat(10), 250);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ccc';
  ctx.font = '13px Helvetica, Arial, sans-serif';
  ctx.fillText('[x] Keep me signed in (until the next launch)', 90, 300);
  ctx.textAlign = 'center';
  if (screen === 'signing-in') {
    drawDots(ctx, width / 2, 360, time);
    ctx.fillStyle = '#aaa';
    ctx.fillText(`Signing in as ${online.guest}...`, width / 2, 400);
    return;
  }
  const lit = launchListens('sign-in', time);
  ctx.fillStyle = lit ? GOLD : '#444';
  ctx.fillRect(width / 2 - 80, 340, 160, 40);
  ctx.fillStyle = lit ? '#000' : '#888';
  ctx.font = 'bold 16px Helvetica, Arial, sans-serif';
  ctx.fillText('SIGN IN', width / 2, 361);
  ctx.fillStyle = '#777';
  ctx.font = '13px Helvetica, Arial, sans-serif';
  ctx.fillText('Create account   |   Forgot password?', width / 2, 410);
  if (lit) {
    ctx.fillStyle = '#aaa';
    ctx.font = '16px Helvetica, Arial, sans-serif';
    ctx.fillText('Press Enter to sign in', width / 2, height - 60);
  }
}

function drawQueue(ctx, time, width, height) {
  drawTopBar(ctx, width);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px Helvetica, Arial, sans-serif';
  ctx.fillText('THE SERVERS ARE BUSY', width / 2, 130);
  ctx.font = '16px Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#ccc';
  ctx.fillText('You are in the queue. Your position:', width / 2, 190);
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 72px Helvetica, Arial, sans-serif';
  ctx.fillText(String(queuePosition(time)), width / 2, 270);
  drawDots(ctx, width / 2, 350, time);
  ctx.fillStyle = '#888';
  ctx.font = '14px Helvetica, Arial, sans-serif';
  ctx.fillText('Thank you for your patience. Please do not close the game.', width / 2, 400);
}

function drawTerms(ctx, time, width, height) {
  const t = online.terms;
  if (t.lines === null) {
    t.lines = termsLines(ctx);
    t.max = Math.max(0, t.lines.length * TERMS_BOX.line + 20 - TERMS_BOX.h);
  }
  drawTopBar(ctx, width);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px Helvetica, Arial, sans-serif';
  ctx.fillText('WE HAVE UPDATED OUR TERMS OF SERVICE', width / 2, 85);
  ctx.font = '13px Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#aaa';
  ctx.fillText('Please read them carefully. Scroll to the bottom to accept.', width / 2, 115);
  const box = TERMS_BOX;
  ctx.fillStyle = '#111';
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  t.lines.forEach((line, i) => {
    const y = box.y + 10 + i * box.line - t.shown;
    if (y < box.y - box.line || y > box.y + box.h) return;
    ctx.font = line.bold ? 'bold 13px Helvetica, Arial, sans-serif' : '13px Helvetica, Arial, sans-serif';
    ctx.fillStyle = line.bold ? '#fff' : '#bbb';
    ctx.fillText(line.text, box.x + 12, y);
  });
  ctx.restore();
  // The scroll bar.
  const barH = Math.max(20, box.h * box.h / (box.h + t.max));
  const barY = box.y + (box.h - barH) * (t.max ? t.shown / t.max : 1);
  ctx.fillStyle = '#666';
  ctx.fillRect(box.x + box.w - 7, barY, 4, barH);

  const lit = termsRead();
  ctx.fillStyle = lit ? GOLD : '#333';
  ctx.fillRect(width / 2 - 80, box.y + box.h + 22, 160, 40);
  ctx.fillStyle = lit ? '#000' : '#666';
  ctx.font = 'bold 16px Helvetica, Arial, sans-serif';
  ctx.fillText('ACCEPT', width / 2, box.y + box.h + 43);
  ctx.fillStyle = '#888';
  ctx.font = '13px Helvetica, Arial, sans-serif';
  ctx.fillText(lit ? 'Press Enter to accept' : 'Scroll down: Page Down, Space, the arrow keys or the mouse wheel', width / 2, height - 30);
}

// The bar at the top: the online indicator and the currency, between the score and the version.
function drawTopBar(ctx, width, left = '', right = VERSION) {
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, HUD);
  ctx.fillStyle = '#222';
  ctx.fillRect(0, HUD - 1, width, 1);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(left, 8, HUD / 2);
  ctx.textAlign = 'right';
  ctx.fillText(right, width - 8, HUD / 2);
  // The online indicator.
  const colour = { online: '#3c3', reconnecting: '#e9a33a', offline: '#c33' }[online.status];
  const label = { online: 'Online', reconnecting: 'Reconnecting', offline: 'Offline' }[online.status];
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(width - 215, HUD / 2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.font = '13px Helvetica, Arial, sans-serif';
  ctx.fillText(label, width - 205, HUD / 2);
  // The currency: a small diamond and the count.
  ctx.fillStyle = '#6cf';
  ctx.beginPath();
  ctx.moveTo(width - 92, HUD / 2 - 6);
  ctx.lineTo(width - 86, HUD / 2);
  ctx.lineTo(width - 92, HUD / 2 + 6);
  ctx.lineTo(width - 98, HUD / 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(String(online.scales), width - 80, HUD / 2);
  ctx.restore();
}

// "Connection interrupted. Reconnecting...", over the paused game.
function drawReconnecting(ctx, time, width, height) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, HUD, width, height - HUD);
  ctx.fillStyle = '#151515';
  ctx.fillRect(60, height / 2 - 70, width - 120, 140);
  ctx.strokeStyle = '#e9a33a';
  ctx.lineWidth = 2;
  ctx.strokeRect(61, height / 2 - 69, width - 122, 138);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px Helvetica, Arial, sans-serif';
  ctx.fillText('Connection interrupted.', width / 2, height / 2 - 35);
  ctx.font = '16px Helvetica, Arial, sans-serif';
  ctx.fillText(`Reconnecting${'.'.repeat(1 + Math.floor(time / 400) % 3)}`, width / 2, height / 2 - 8);
  drawDots(ctx, width / 2, height / 2 + 35, time);
  ctx.restore();
}

// Toasts slide in at the top right, under the bar, and go after a few seconds.
function drawToasts(ctx, width) {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '13px Helvetica, Arial, sans-serif';
  online.toasts.forEach((t, i) => {
    const age = online.clock - t.at;
    const slide = Math.min(1, age / 250, (ONLINE.toastMs - age) / 250);
    const w = ctx.measureText(t.text).width + 28;
    const x = width - (w + 10) * slide;
    const y = HUD + 10 + i * 38;
    ctx.fillStyle = 'rgba(20, 20, 20, 0.92)';
    ctx.fillRect(x, y, w, 30);
    ctx.fillStyle = '#6cf';
    ctx.fillRect(x, y, 3, 30);
    ctx.fillStyle = '#fff';
    ctx.fillText(t.text, x + 14, y + 15);
  });
  ctx.restore();
}

// A row of three dots that light up in turn.
function drawDots(ctx, x, y, time) {
  for (let i = 0; i < 3; i++) {
    const lit = Math.floor(time / 250) % 3 === i;
    ctx.fillStyle = lit ? GOLD : '#444';
    ctx.beginPath();
    ctx.arc(x + (i - 1) * 22, y, lit ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
