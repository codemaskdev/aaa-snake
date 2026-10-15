// AAA Snake v1.7: skins, the only thing in a loot box.
// A skin changes how the snake is drawn and nothing else: the rules, the tick, the speed and the
// collisions never read it (tests/v1.7.test.mjs plays the same game under every skin).
// Drops come from the seed, with their own generator, so the apples stay where they were.

const SKINS = [
  { id: 'warden', name: 'Warden', rarity: 'Starter', body: '#3b3', head: '#8f8' }, // the look Snek starts with
  { id: 'moss', name: 'Moss', rarity: 'Common', body: '#2f6b2a', head: '#b6e3a0' },
  { id: 'sand', name: 'Sand', rarity: 'Common', body: '#c9a66b', head: '#f3e2b8' },
  { id: 'slate', name: 'Slate', rarity: 'Common', body: '#5a6b7d', head: '#c9d3dc' },
  { id: 'plum', name: 'Plum', rarity: 'Common', body: '#7a3b8f', head: '#e8a6d8' },
  { id: 'tiger', name: 'Tiger', rarity: 'Rare', body: '#e8892b', head: '#f6c27a', pattern: 'stripes' },
  { id: 'frost', name: 'Frost', rarity: 'Rare', body: '#8fd6ff', head: '#e6f7ff', glow: 'rgba(150, 220, 255, 0.9)', glowBlur: 10 },
  { id: 'ember', name: 'Ember', rarity: 'Rare', body: '#c9302c', head: '#ff8a5c', trail: true },
  { id: 'neon', name: 'Neon', rarity: 'Epic', body: '#00e5ff', head: '#b8fbff', glow: 'rgba(0, 229, 255, 1)', glowBlur: 18 },
  { id: 'galaxy', name: 'Galaxy', rarity: 'Epic', body: '#1b1f5e', head: '#5b63d6', pattern: 'stars' },
  { id: 'classic', name: 'Classic Green', rarity: 'Legendary', body: '#3b3', head: '#8f8', classic: true }, // v1.0's snake
];

// The odds of a box, per rarity, in percent (shown on the loot-box screen; UPDATES.md has them too).
const ODDS = [['Common', 60], ['Rare', 25], ['Epic', 12], ['Legendary', 3]];
const RARITY_COLOURS = { Starter: '#bbb', Common: '#c8c8c8', Rare: '#4da3ff', Epic: '#b35cff', Legendary: '#ffb02e' };

const wardrobe = { owned: ['warden'], worn: 'warden', boxes: 0, last: null, duplicate: false, random: null, trail: [] };

function startWardrobe(seed) {
  wardrobe.random = makeRandom((seed ^ 0x100b0c5) >>> 0);
}

function wornSkin() {
  return SKINS.find(s => s.id === wardrobe.worn);
}

// Open one box: a rarity by the odds, then one skin of that rarity. The newest skin is worn.
function openLootBox() {
  const roll = wardrobe.random() * 100;
  let rarity = ODDS[ODDS.length - 1][0];
  let sum = 0;
  for (const [name, percent] of ODDS) {
    sum += percent;
    if (roll < sum) {
      rarity = name;
      break;
    }
  }
  const pool = SKINS.filter(s => s.rarity === rarity);
  const skin = pool[Math.floor(wardrobe.random() * pool.length)];
  wardrobe.boxes++;
  wardrobe.duplicate = wardrobe.owned.includes(skin.id);
  if (!wardrobe.duplicate) wardrobe.owned.push(skin.id);
  wardrobe.worn = skin.id;
  wardrobe.last = skin;
  return skin;
}

// The snake in its skin. points: the body's centres, head first, in world px.
function drawSkinnedSnake(ctx, points, time) {
  const skin = wornSkin();
  if (skin.classic) { // v1.0: square cells, no curves, no eyes
    points.slice().reverse().forEach((p, i) => {
      ctx.fillStyle = i === points.length - 1 ? skin.head : skin.body;
      ctx.fillRect(p.x - CELL / 2 + 1, p.y - CELL / 2 + 1, CELL - 2, CELL - 2);
    });
    return false; // no round head to draw
  }
  if (skin.trail) drawTrail(ctx, points[0], time);
  ctx.save();
  if (skin.glow) {
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur = skin.glowBlur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  ctx.strokeStyle = skin.body;
  ctx.lineWidth = CELL - 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.restore();
  if (skin.pattern === 'stripes') {
    ctx.strokeStyle = 'rgba(40, 20, 0, 0.8)';
    ctx.lineWidth = 3;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const across = Math.abs(b.x - a.x) > Math.abs(b.y - a.y) ? { x: 0, y: 1 } : { x: 1, y: 0 };
      ctx.beginPath();
      ctx.moveTo(mx - across.x * 8, my - across.y * 8);
      ctx.lineTo(mx + across.x * 8, my + across.y * 8);
      ctx.stroke();
    }
  }
  if (skin.pattern === 'stars') {
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const twinkle = 0.5 + 0.5 * Math.sin(time / 200 + i * 1.7);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + 0.6 * twinkle})`;
      ctx.fillRect(p.x - 4 + (i % 3) * 3, p.y - 3 + (i % 2) * 4, 2, 2);
    }
  }
  return true;
}

// Ember's trail: the last places the head passed, fading. Kept for drawing only.
function drawTrail(ctx, head, time) {
  const trail = wardrobe.trail;
  const last = trail[trail.length - 1];
  if (!last || Math.hypot(last.x - head.x, last.y - head.y) > 6) trail.push({ x: head.x, y: head.y, at: time });
  while (trail.length && time - trail[0].at > 900) trail.shift();
  for (const ember of trail) {
    const age = (time - ember.at) / 900;
    ctx.fillStyle = `rgba(255, ${Math.floor(160 - 120 * age)}, 40, ${0.7 * (1 - age)})`;
    ctx.beginPath();
    ctx.arc(ember.x, ember.y, 6 * (1 - age) + 1, 0, Math.PI * 2);
    ctx.fill();
  }
}
