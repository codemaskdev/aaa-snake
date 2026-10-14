// AAA Snake v1.6: progression.
// Warden Snek earns XP for every move and every apple. Each level gives a skill point, and the
// skill tree sells back what the game used to do: smooth movement, eyes that look where you go,
// a shadow, and turning left. Until "Turn left" is learned (it needs level 5), only right turns
// work: going left means three rights. Every level-up stops the game for a full-screen
// "LEVEL UP!" and then the skill tree, where a skill must be chosen before play goes on.
// Nothing here reads a clock; times are ms of animation frames.

const PROGRESS = {
  xp: { move: 1, apple: 25 },
  levelUpListensAfter: 2000, // the LEVEL UP! screen takes Enter after this long
  treeListensAfter: 1000,    // the skill tree's links draw in for this long before it takes keys
};

// XP needed to reach a level: 50 for level 2, 150 for 3, 300 for 4, 500 for 5, 750 for 6...
function xpForLevel(level) {
  return 25 * level * (level - 1);
}

// The skills, in the order of the list (the tree reads left to right, top to bottom).
const SKILLS = [
  { id: 'smooth', name: 'Smooth movement', text: 'The snake glides from cell to cell again.', x: 125, y: 175, from: 'root' },
  { id: 'eyes', name: 'Eye contact', text: 'The eyes look where the snake is going again.', x: 355, y: 175, from: 'root' },
  { id: 'shadow', name: 'Shadow', text: 'Warden Snek casts a shadow again.', x: 125, y: 275, from: 'smooth' },
  { id: 'left', name: 'Turn left', text: 'Turn counter-clockwise. Saves two right turns.', x: 355, y: 275, from: 'eyes', level: 5 },
  { id: 'tongue', name: 'Tongue', text: 'A tongue. It does nothing.', x: 125, y: 375, from: 'shadow' },
  { id: 'deluxe', name: 'Turn right (Deluxe)', text: 'Turns right, as before. Deluxe.', x: 355, y: 375, from: 'left' },
];
const TREE_ROOT = { x: 240, y: 92 };

const LEFT_OF = { up: 'left', left: 'down', down: 'right', right: 'up' }; // a quarter turn counter-clockwise

const progression = {
  xp: 0,
  level: 1,
  points: 0,
  pending: 0,   // level-ups still to show
  skills: {},   // id -> true once learned
  cursor: 0,    // the skill the tree's cursor is on
  burst: [],    // the level-up particles
  shownLevel: 1,
};

// The level a skill is being chosen for: with two level-ups at once (an apple's XP can do that),
// the first skill tree is for the first of them.
function levelNow() {
  return progression.pending > 0 ? progression.level - progression.pending + 1 : progression.level;
}

function skillLearnable(skill) {
  return !progression.skills[skill.id] && progression.points > 0 && levelNow() >= (skill.level || 1);
}

// Add XP; returns true if it made a level (or more).
function gainXp(amount) {
  progression.xp += amount;
  let leveled = false;
  while (progression.xp >= xpForLevel(progression.level + 1)) {
    progression.level++;
    progression.points++;
    progression.pending++;
    leveled = true;
  }
  return leveled;
}

// True if turning this way from where the snake is heading is a left turn it has not learned.
function turnLocked(heading, direction) {
  return !progression.skills.left && LEFT_OF[heading] === direction;
}

function lockedMessage() {
  return progression.level < 5
    ? 'Skill locked: Turn left (requires level 5)'
    : 'Skill locked: Turn left (learn it in the skill tree)';
}

// The turns the snake may make, for the probe: always right; left once learned.
function allowedTurns() {
  return progression.skills.left ? ['right', 'left'] : ['right'];
}

function progressScreen(name) {
  if (name === 'level-up') {
    progression.shownLevel = levelNow();
    const random = makeRandom(progression.shownLevel * 7919); // the same burst for the same level, every time
    progression.burst = [];
    for (let i = 0; i < 140; i++) {
      const angle = random() * Math.PI * 2;
      const speed = 60 + random() * 260;
      progression.burst.push({
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 80, size: 2 + random() * 4,
        colour: ['#ffd54a', '#fff3b0', '#ff9f3a', '#ffffff'][Math.floor(random() * 4)], life: 1100 + random() * 900,
      });
    }
  }
  if (name === 'skill-tree') {
    progression.cursor = 0;
  }
}

// A key on the skill tree. Up and Down move along the list; Enter learns the skill under the
// cursor (or carries on, if no skill can be learned). Returns true when play should go on.
function skillTreeKey(code, time) {
  if (time < PROGRESS.treeListensAfter) return false;
  if (code === 'ArrowDown' || code === 'KeyS') progression.cursor = (progression.cursor + 1) % SKILLS.length;
  if (code === 'ArrowUp' || code === 'KeyW') progression.cursor = (progression.cursor + SKILLS.length - 1) % SKILLS.length;
  if (code !== 'Enter') return false;
  const skill = SKILLS[progression.cursor];
  if (skillLearnable(skill)) {
    progression.skills[skill.id] = true;
    progression.points--;
    progression.pending--;
    toast(`Skill learned: ${skill.name}`);
    return true;
  }
  if (!SKILLS.some(skillLearnable)) { // nothing to learn: the point waits for later
    progression.pending--;
    return true;
  }
  return false;
}

// The key that moves the skill tree on right now: Enter, if the cursor is on a skill that can be
// learned (or no skill can be), once the tree takes keys. The bot steers the cursor (tools/rig/bot.mjs).
function skillTreeNext(time) {
  if (time < PROGRESS.treeListensAfter) return null;
  return skillLearnable(SKILLS[progression.cursor]) || !SKILLS.some(skillLearnable) ? 'Enter' : null;
}

function skillsForProbe() {
  return SKILLS.map(skill => ({ id: skill.id, name: skill.name, owned: Boolean(progression.skills[skill.id]), learnable: skillLearnable(skill) }));
}

// The XP bar: it glows, and pulses for a moment after every move's worth of XP.
function drawXpBar(ctx, x, y, w, time) {
  const from = xpForLevel(progression.level);
  const to = xpForLevel(progression.level + 1);
  const share = (progression.xp - from) / (to - from);
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(x - 4, y - 18, w + 8, 30);
  ctx.fillStyle = '#222';
  ctx.fillRect(x, y, w, 7);
  ctx.shadowColor = 'rgba(255, 200, 60, 0.9)';
  ctx.shadowBlur = 8 + 4 * Math.sin(time / 300);
  const bar = ctx.createLinearGradient(x, 0, x + w, 0);
  bar.addColorStop(0, '#ff9f3a');
  bar.addColorStop(1, '#ffe27a');
  ctx.fillStyle = bar;
  ctx.fillRect(x, y, w * share, 7);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`LV ${progression.level}`, x, y - 8);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ccc';
  ctx.font = '10px Helvetica, Arial, sans-serif';
  ctx.fillText(`${progression.xp - from} / ${to - from} XP`, x + w, y - 8);
  ctx.restore();
}

// LEVEL UP!, over everything: a burst of particles, the new level, and the skill point.
function drawLevelUp(ctx, time, width, height) {
  ctx.save();
  const fadeIn = Math.min(1, time / 300);
  ctx.fillStyle = `rgba(0, 0, 0, ${0.75 * fadeIn})`;
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width / 2, height / 2 - 30, 10, width / 2, height / 2 - 30, 260);
  glow.addColorStop(0, `rgba(255, 190, 60, ${0.35 * fadeIn})`);
  glow.addColorStop(1, 'rgba(255, 190, 60, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  const t = time / 1000;
  for (const p of progression.burst) {
    if (time > p.life) continue;
    ctx.globalAlpha = 1 - time / p.life;
    ctx.fillStyle = p.colour;
    ctx.fillRect(width / 2 + p.vx * t, height / 2 - 30 + p.vy * t + 160 * t * t, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const grow = 1 + 0.15 * Math.max(0, 1 - time / 400);
  ctx.translate(width / 2, height / 2 - 40);
  ctx.scale(grow, grow);
  ctx.shadowColor = 'rgba(255, 200, 60, 1)';
  ctx.shadowBlur = 24 + 10 * Math.sin(time / 180);
  ctx.fillStyle = '#ffd54a';
  ctx.font = 'bold 54px Helvetica, Arial, sans-serif';
  ctx.fillText('LEVEL UP!', 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px Helvetica, Arial, sans-serif';
  ctx.fillText(`Level ${progression.shownLevel}`, width / 2, height / 2 + 20);
  ctx.fillStyle = '#ccc';
  ctx.font = '15px Helvetica, Arial, sans-serif';
  ctx.fillText('+1 skill point', width / 2, height / 2 + 52);
  if (time >= PROGRESS.levelUpListensAfter) {
    ctx.fillStyle = '#fff';
    ctx.font = '14px Helvetica, Arial, sans-serif';
    ctx.fillText('Press Enter to choose a skill', width / 2, height - 60);
  }
  ctx.restore();
}

// The skill tree: nodes joined by links that draw in, then keep flowing toward what can be learned.
function drawSkillTree(ctx, time, width, height) {
  ctx.save();
  ctx.fillStyle = '#0d1018';
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px Helvetica, Arial, sans-serif';
  ctx.fillText('SKILL TREE', 16, 26);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffd54a';
  ctx.font = 'bold 14px Helvetica, Arial, sans-serif';
  ctx.fillText(`Level ${levelNow()}   Skill points: ${progression.points}`, width - 16, 26);

  const drawIn = Math.min(1, time / PROGRESS.treeListensAfter);
  const at = id => (id === 'root' ? TREE_ROOT : SKILLS.find(s => s.id === id));
  for (const skill of SKILLS) { // the links, from parent to child
    const a = at(skill.from);
    const b = skill;
    const owned = progression.skills[skill.id];
    ctx.strokeStyle = owned ? '#ffd54a' : skillLearnable(skill) ? '#7fc8ff' : '#3a4050';
    ctx.lineWidth = owned ? 3 : 2;
    ctx.setLineDash(owned ? [] : [8, 6]);
    ctx.lineDashOffset = -time / 25;
    ctx.shadowColor = owned ? 'rgba(255, 210, 80, 0.8)' : 'transparent';
    ctx.shadowBlur = owned ? 10 : 0;
    ctx.beginPath();
    const ay = a.y + 22;
    const by = b.y - 24;
    const midY = ay + (by - ay) * 0.5;
    ctx.moveTo(a.x, ay);
    const ex = a.x + (b.x - a.x) * drawIn;
    const ey = ay + (by - ay) * drawIn;
    ctx.bezierCurveTo(a.x, midY, ex, midY, ex, ey);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;

  const node = (x, y, w, h, fill, stroke) => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 8);
    ctx.fill();
    ctx.stroke();
  };
  node(TREE_ROOT.x, TREE_ROOT.y, 150, 44, '#1d2230', '#ffd54a');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd54a';
  ctx.font = 'bold 14px Helvetica, Arial, sans-serif';
  ctx.fillText('Warden Snek', TREE_ROOT.x, TREE_ROOT.y);
  SKILLS.forEach((skill, i) => {
    const owned = progression.skills[skill.id];
    const learnable = skillLearnable(skill);
    const selected = i === progression.cursor && time >= PROGRESS.treeListensAfter;
    if (selected) {
      ctx.shadowColor = 'rgba(127, 200, 255, 0.9)';
      ctx.shadowBlur = 12 + 6 * Math.sin(time / 150);
    }
    node(skill.x, skill.y, 200, 48, owned ? '#3a3216' : '#1a1e29', selected ? '#ffffff' : owned ? '#ffd54a' : learnable ? '#7fc8ff' : '#3a4050');
    ctx.shadowBlur = 0;
    ctx.fillStyle = owned ? '#ffd54a' : learnable ? '#fff' : '#777';
    ctx.font = 'bold 13px Helvetica, Arial, sans-serif';
    ctx.fillText(skill.name, skill.x, skill.y - 8);
    ctx.font = '11px Helvetica, Arial, sans-serif';
    ctx.fillStyle = owned ? '#c8b46a' : '#999';
    const status = owned ? 'Learned' : levelNow() < (skill.level || 1) ? `Requires level ${skill.level}` : '1 skill point';
    ctx.fillText(status, skill.x, skill.y + 11);
  });

  const skill = SKILLS[progression.cursor];
  ctx.fillStyle = '#ccc';
  ctx.font = '13px Helvetica, Arial, sans-serif';
  ctx.fillText(skill.text, width / 2, height - 72);
  ctx.fillStyle = '#888';
  ctx.font = '12px Helvetica, Arial, sans-serif';
  ctx.fillText('Up / Down: choose      Enter: learn', width / 2, height - 40);
  ctx.restore();
}
