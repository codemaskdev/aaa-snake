// AAA Snake v1.7: Season 1 (a parody).
// The apple can be seen only within VISION cells of Snek's head. The Season 1 battle pass fills
// one tier for every SEASON.tierXp XP; its top reward, at the last tier, is "Apple Vision: the
// ability to see the apple". Tiers "can be bought" with Golden Scales, which cannot be bought:
// the button opens a PARODY screen that says nothing is for sale. After every game over a loot
// box (skins only, src/skins.js) and the wardrobe. No payment code, no network, no prices.
// Nothing here reads a clock; times are ms of animation frames.

const VISION = 6; // cells; see DEVLOG.md, prompt 8
const SEASON = {
  tierXp: 500,
  tiers: 100,
  passListensAfter: 1500, // the battle pass shows the new tier for this long before Enter works
  shopListensAfter: 500,
  lootListensAfter: 3200, // the box shakes, bursts open and shows the skin first
  wardrobeListensAfter: 1000,
};

// The free track's rewards, tier by tier, round and round; the last tier is the one that matters.
const FREE_REWARDS = [
  'Profile border (grey)', 'Emote: nod', 'Banner: a field', '+0% XP boost', 'Spray: apple outline',
  'Title: "Walker"', 'Loading screen: the same field', 'Emote: slower nod', 'Banner: another field', 'Sticker: "gg"',
];
const TOP_REWARD = 'Apple Vision: the ability to see the apple';

const season = { tier: 0, pending: 0, shown: 0, goldenScales: 0, sparkles: [] };

function tierReward(tier) {
  return tier >= SEASON.tiers ? TOP_REWARD : FREE_REWARDS[(tier - 1) % FREE_REWARDS.length];
}

function hasAppleVision() {
  return season.tier >= SEASON.tiers;
}

// Can the player see the apple from here? Only within VISION cells, until Apple Vision.
function appleVisible(head, apple) {
  if (!apple) return false;
  if (hasAppleVision()) return true;
  const dx = apple.x - head.x;
  const dy = apple.y - head.y;
  return dx * dx + dy * dy <= VISION * VISION;
}

// The tiers the XP so far has earned; returns true if a new one waits to be shown.
function passCheck(xp) {
  const due = Math.min(SEASON.tiers, Math.floor(xp / SEASON.tierXp));
  if (due <= season.tier) return false;
  season.pending += due - season.tier;
  season.tier = due;
  return true;
}

function seasonScreen(name) {
  if (name === 'battle-pass' && season.pending > 0) season.shown = season.tier - season.pending + 1;
  if (name === 'loot-box') {
    openLootBox();
    const random = makeRandom(wardrobe.boxes * 104729); // the same sparkles for the same box
    season.sparkles = [];
    for (let i = 0; i < 90; i++) {
      season.sparkles.push({ angle: random() * Math.PI * 2, speed: 40 + random() * 200, size: 1 + random() * 3, delay: random() * 600, life: 900 + random() * 900 });
    }
  }
}

// Keys on the season's screens. Returns the screen to go to, 'carry-on' (back to play),
// 'new-game', or null.
function seasonKey(screen, code, time) {
  if (screen === 'battle-pass') {
    if (time < SEASON.passListensAfter) return null;
    if (code === 'KeyB') return 'parody-shop';
    if (code === 'Enter') {
      season.pending--;
      return 'carry-on';
    }
  }
  if (screen === 'parody-shop' && time >= SEASON.shopListensAfter && (code === 'Enter' || code === 'Escape')) return 'battle-pass';
  if (screen === 'loot-box' && time >= SEASON.lootListensAfter && code === 'Enter') return 'wardrobe';
  if (screen === 'wardrobe' && time >= SEASON.wardrobeListensAfter && code === 'Enter') return 'new-game';
  return null;
}

// The key that moves a season screen on, once it listens (never the buy button).
function seasonNext(screen, time) {
  if (screen === 'battle-pass') return time >= SEASON.passListensAfter ? 'Enter' : null;
  if (screen === 'parody-shop') return time >= SEASON.shopListensAfter ? 'Enter' : null;
  if (screen === 'loot-box') return time >= SEASON.lootListensAfter ? 'Enter' : null;
  if (screen === 'wardrobe') return time >= SEASON.wardrobeListensAfter ? 'Enter' : null;
  return null;
}

function parodyTag(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = '#e0245e';
  ctx.fillRect(x, y, 74, 22);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PARODY', x + 37, y + 11);
  ctx.restore();
}

function card(ctx, x, y, w, h, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

// The battle pass: a track of tier cards that slides to the new tier, the free and premium rows,
// and the top reward pinned at the end of the track.
function drawBattlePass(ctx, time, width, height) {
  ctx.save();
  ctx.fillStyle = '#0e0f1a';
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd54a';
  ctx.font = 'bold 20px Helvetica, Arial, sans-serif';
  ctx.fillText('SEASON 1 BATTLE PASS', 16, 26);
  parodyTag(ctx, width - 90, 15);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`TIER ${season.shown} REACHED`, width / 2, 74);
  ctx.fillStyle = '#aaa';
  ctx.font = '13px Helvetica, Arial, sans-serif';
  ctx.fillText(`Tier ${season.shown} of ${SEASON.tiers}. Every ${SEASON.tierXp} XP fills a tier.`, width / 2, 100);

  // The track: cards for the tiers around the new one, sliding in.
  const slide = Math.max(0, 1 - time / 700);
  const cardW = 96;
  const gap = 12;
  const centreX = width / 2 - cardW / 2 + slide * (cardW + gap);
  ctx.textAlign = 'center';
  for (let k = -2; k <= 2; k++) {
    const tier = season.shown + k;
    if (tier < 1 || tier > SEASON.tiers) continue;
    const x = centreX + k * (cardW + gap);
    const reached = tier <= season.shown;
    const current = tier === season.shown;
    if (current) {
      ctx.shadowColor = 'rgba(255, 210, 80, 0.9)';
      ctx.shadowBlur = 14 + 6 * Math.sin(time / 160);
    }
    card(ctx, x, 128, cardW, 112, reached ? '#2b2615' : '#171a26', current ? '#ffd54a' : reached ? '#8a7432' : '#333a4d');
    ctx.shadowBlur = 0;
    ctx.fillStyle = reached ? '#ffd54a' : '#777';
    ctx.font = 'bold 12px Helvetica, Arial, sans-serif';
    ctx.fillText(`TIER ${tier}`, x + cardW / 2, 142);
    ctx.fillStyle = reached ? '#eee' : '#888';
    ctx.font = '11px Helvetica, Arial, sans-serif';
    wrapText(ctx, tierReward(tier), x + cardW / 2, 170, cardW - 12, 14);
    ctx.fillStyle = '#555';
    ctx.font = '10px Helvetica, Arial, sans-serif';
    ctx.fillText('FREE', x + cardW / 2, 230);
    card(ctx, x, 248, cardW, 56, '#14121c', '#3a2f55'); // the premium row: all locked
    ctx.fillStyle = '#8a6fd1';
    ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
    ctx.fillText('PREMIUM', x + cardW / 2, 266);
    ctx.fillStyle = '#666';
    ctx.font = '10px Helvetica, Arial, sans-serif';
    ctx.fillText('Locked', x + cardW / 2, 286);
  }

  // The top reward, at the end of the track, always in view.
  const glow = 0.5 + 0.5 * Math.sin(time / 300);
  ctx.shadowColor = `rgba(255, 80, 80, ${0.6 + 0.4 * glow})`;
  ctx.shadowBlur = 18;
  card(ctx, 40, 322, width - 80, 62, '#2a1416', '#ff5a5a');
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ff8a8a';
  ctx.font = 'bold 12px Helvetica, Arial, sans-serif';
  ctx.fillText(`TIER ${SEASON.tiers}: TOP REWARD`, width / 2, 340);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px Helvetica, Arial, sans-serif';
  ctx.fillText(TOP_REWARD, width / 2, 364);

  ctx.font = '12px Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#ccc';
  ctx.fillText(`Golden Scales: ${season.goldenScales}`, width / 2, 410);
  card(ctx, 40, 428, 190, 34, '#3a2f55', '#8a6fd1');
  ctx.fillStyle = '#fff';
  ctx.fillText('B: Buy tiers with Golden Scales', 135, 445);
  if (time >= SEASON.passListensAfter) {
    card(ctx, width - 230, 428, 190, 34, '#1f3a26', '#5fbf6f');
    ctx.fillStyle = '#fff';
    ctx.fillText('Enter: Continue', width - 135, 445);
  }
  ctx.fillStyle = '#666';
  ctx.font = '10px Helvetica, Arial, sans-serif';
  ctx.fillText('A parody. Nothing can be bought, here or anywhere in this game.', width / 2, 488);
  ctx.restore();
}

// What the buy button opens.
function drawParodyShop(ctx, time, width, height) {
  ctx.save();
  ctx.fillStyle = '#120a10';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e0245e';
  ctx.fillRect(width / 2 - 110, 110, 220, 64);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px Helvetica, Arial, sans-serif';
  ctx.fillText('PARODY', width / 2, 143);
  ctx.font = 'bold 20px Helvetica, Arial, sans-serif';
  ctx.fillText('Nothing is for sale.', width / 2, 222);
  ctx.fillStyle = '#ccc';
  ctx.font = '14px Helvetica, Arial, sans-serif';
  wrapText(ctx, 'Golden Scales cannot be bought. There is no shop, no price and no payment in this game. Tiers fill from XP, which you get by playing.', width / 2, 262, width - 100, 20);
  if (time >= SEASON.shopListensAfter) {
    ctx.fillStyle = '#fff';
    ctx.font = '13px Helvetica, Arial, sans-serif';
    ctx.fillText('Enter: back to the battle pass', width / 2, height - 60);
  }
  ctx.restore();
}

// The loot box: it shakes, bursts open with light rays and sparkles, and shows what was inside.
function drawLootBox(ctx, time, width, height) {
  const skin = wardrobe.last;
  const colour = RARITY_COLOURS[skin.rarity];
  ctx.save();
  ctx.fillStyle = '#07080d';
  ctx.fillRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height / 2 - 30;
  const open = time >= 1200;
  if (open) { // light rays, turning
    const t = time - 1200;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t / 2000);
    const reach = Math.min(1, t / 400) * 300;
    for (let i = 0; i < 14; i++) {
      ctx.rotate((Math.PI * 2) / 14);
      const ray = ctx.createLinearGradient(0, 0, reach, 0);
      ray.addColorStop(0, colour);
      ray.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = ray;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(reach, -18);
      ctx.lineTo(reach, 18);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    for (const s of season.sparkles) { // sparkles flying out
      const age = t - s.delay;
      if (age < 0 || age > s.life) continue;
      const d = (s.speed * age) / 1000;
      ctx.globalAlpha = 1 - age / s.life;
      ctx.fillStyle = Math.floor(age / 80) % 2 ? '#fff' : colour;
      ctx.fillRect(cx + Math.cos(s.angle) * d, cy + Math.sin(s.angle) * d, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }
  // The box: shaking, then its lid flies off.
  const shake = open ? 0 : Math.sin(time / 30) * Math.min(6, time / 150);
  ctx.save();
  ctx.translate(cx + shake, cy + 30);
  ctx.shadowColor = colour;
  ctx.shadowBlur = open ? 30 : 10;
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(-46, -20, 92, 56);
  ctx.fillStyle = '#d9a441';
  ctx.fillRect(-6, -20, 12, 56);
  if (!open) {
    ctx.fillStyle = '#6b4626';
    ctx.fillRect(-50, -38, 100, 20);
  } else {
    const fly = Math.min(1, (time - 1200) / 300);
    ctx.fillStyle = '#6b4626';
    ctx.save();
    ctx.translate(30 * fly, -38 - 90 * fly);
    ctx.rotate(fly * 0.8);
    ctx.fillRect(-50, 0, 100, 20);
    ctx.restore();
  }
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (open && time >= 1600) {
    ctx.fillStyle = colour;
    ctx.font = 'bold 14px Helvetica, Arial, sans-serif';
    ctx.fillText(skin.rarity.toUpperCase(), cx, cy - 92);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px Helvetica, Arial, sans-serif';
    ctx.fillText(skin.name, cx, cy - 66);
    if (wardrobe.duplicate) {
      ctx.fillStyle = '#aaa';
      ctx.font = '13px Helvetica, Arial, sans-serif';
      ctx.fillText('Duplicate. You already have this one.', cx, cy + 96);
    }
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px Helvetica, Arial, sans-serif';
  ctx.fillText(`LOOT BOX #${wardrobe.boxes}`, cx, 36);
  ctx.fillStyle = '#999';
  ctx.font = '12px Helvetica, Arial, sans-serif';
  ctx.fillText(`Drop odds: ${ODDS.map(([name, p]) => `${name} ${p}%`).join('   ')}`, cx, height - 92);
  ctx.fillText('Skins only: they change how the snake looks, nothing else.', cx, height - 72);
  if (time >= SEASON.lootListensAfter) {
    ctx.fillStyle = '#fff';
    ctx.font = '13px Helvetica, Arial, sans-serif';
    ctx.fillText('Enter: to the wardrobe', cx, height - 40);
  }
  parodyTag(ctx, width - 90, 15);
  ctx.restore();
}

// The wardrobe: the new skin, worn, and the whole collection.
function drawWardrobe(ctx, time, width, height) {
  ctx.save();
  ctx.fillStyle = '#0d1018';
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px Helvetica, Arial, sans-serif';
  ctx.fillText('WARDROBE', 16, 26);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ccc';
  ctx.font = '13px Helvetica, Arial, sans-serif';
  ctx.fillText(`${wardrobe.owned.length} of ${SKINS.length} skins`, width - 16, 26);
  ctx.textAlign = 'center';
  SKINS.forEach((skin, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 18 + col * 113;
    const y = 52 + row * 128;
    const owned = wardrobe.owned.includes(skin.id);
    const isNew = wardrobe.last && skin.id === wardrobe.last.id;
    if (isNew) {
      ctx.shadowColor = RARITY_COLOURS[skin.rarity];
      ctx.shadowBlur = 12 + 6 * Math.sin(time / 160);
    }
    card(ctx, x, y, 104, 116, owned ? '#1a1e29' : '#111318', owned ? RARITY_COLOURS[skin.rarity] : '#2a2e38');
    ctx.shadowBlur = 0;
    if (owned) { // a little snake in this skin
      ctx.fillStyle = skin.body;
      if (skin.classic) {
        for (let k = 0; k < 3; k++) ctx.fillRect(x + 22 + k * 20, y + 34, 18, 18);
        ctx.fillStyle = skin.head;
        ctx.fillRect(x + 82 - 20, y + 34, 18, 18);
      } else {
        ctx.strokeStyle = skin.body;
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + 24, y + 43);
        ctx.lineTo(x + 70, y + 43);
        ctx.stroke();
        ctx.fillStyle = skin.head;
        ctx.beginPath();
        ctx.arc(x + 76, y + 43, 10, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Helvetica, Arial, sans-serif';
      ctx.fillText(skin.name, x + 52, y + 76);
    } else {
      ctx.fillStyle = '#444';
      ctx.font = 'bold 28px Helvetica, Arial, sans-serif';
      ctx.fillText('?', x + 52, y + 44);
    }
    ctx.fillStyle = RARITY_COLOURS[skin.rarity];
    ctx.font = '10px Helvetica, Arial, sans-serif';
    ctx.fillText(skin.rarity, x + 52, y + 94);
    if (skin.id === wardrobe.worn) {
      ctx.fillStyle = '#ffd54a';
      ctx.fillText(isNew ? 'NEW, WORN' : 'WORN', x + 52, y + 107);
    }
  });
  if (time >= SEASON.wardrobeListensAfter) {
    ctx.fillStyle = '#fff';
    ctx.font = '13px Helvetica, Arial, sans-serif';
    ctx.fillText('Enter: back to the game', width / 2, height - 24);
  }
  ctx.restore();
}

// In play: the circle Snek can see, and the season's tier under the quest tracker.
function drawVision(ctx, head, zoom) {
  if (hasAppleVision()) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(head.x, head.y, (VISION + 0.5) * CELL * zoom, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSeasonHud(ctx, top) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(8, top + 54, 190, 20);
  ctx.fillStyle = '#ffd54a';
  ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`SEASON 1   Tier ${season.tier} / ${SEASON.tiers}`, 16, top + 64);
  ctx.restore();
}
