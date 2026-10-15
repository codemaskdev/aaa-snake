// AAA Snake v1.9: hair physics. A tuft on Warden Snek's head, simulated, not animated.
// The strands (how many, how long, how stiff, where they grow) come from the seed, with their own
// generator. Each strand is a chain of points moved by Verlet integration, with drag and a pull
// toward the back of the head, its segments held at their length by constraints. Positions are in
// cells (the 20 x 20 view's units). The simulation runs in fixed steps of HAIR.stepMs of animation
// time; the frame time only decides how many steps run. Drawing only: the game never reads it.

const HAIR = { stepMs: 8, points: 6, drag: 0.9, pull: 0.012, iterations: 3 };

const hair = { strands: [], left: 0, root: null };

function startHair(seed) {
  const random = makeRandom((seed ^ 0x4a1e5eed) >>> 0);
  const count = 5 + Math.floor(random() * 4); // 5 to 8 strands
  hair.strands = [];
  for (let i = 0; i < count; i++) {
    hair.strands.push({
      spread: (i / (count - 1) - 0.5) * 0.9 + (random() - 0.5) * 0.15, // where on the crown it grows
      segment: 0.09 + random() * 0.06,                                // cells between two points
      stiffness: 0.05 + random() * 0.1,                               // how much it keeps its shape
      points: null,
    });
  }
  hair.left = 0;
  hair.root = null;
}

// One fixed step. root: the head's centre in cells; back: a unit vector to the back of the head.
function hairStep(root, back) {
  for (const strand of hair.strands) {
    const side = { x: -back.y, y: back.x };
    const base = { x: root.x - back.x * 0.25 + side.x * strand.spread * 0.4, y: root.y - back.y * 0.25 + side.y * strand.spread * 0.4 };
    const out = { x: back.x + side.x * strand.spread, y: back.y + side.y * strand.spread }; // how it lies at rest
    if (!strand.points) {
      strand.points = Array.from({ length: HAIR.points }, (_, k) => {
        const p = { x: base.x + out.x * strand.segment * k, y: base.y + out.y * strand.segment * k };
        return { x: p.x, y: p.y, px: p.x, py: p.y };
      });
    }
    const pts = strand.points;
    pts[0].x = pts[0].px = base.x;
    pts[0].y = pts[0].py = base.y;
    for (let k = 1; k < pts.length; k++) { // Verlet: keep the velocity, damped, and pull backwards
      const p = pts[k];
      const vx = (p.x - p.px) * HAIR.drag;
      const vy = (p.y - p.py) * HAIR.drag;
      p.px = p.x;
      p.py = p.y;
      p.x += vx + back.x * HAIR.pull;
      p.y += vy + back.y * HAIR.pull;
    }
    for (let it = 0; it < HAIR.iterations; it++) { // each segment back to its length, and a little toward its rest shape
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1];
        const b = pts[k];
        const rest = { x: a.x + out.x * strand.segment, y: a.y + out.y * strand.segment };
        b.x += (rest.x - b.x) * strand.stiffness;
        b.y += (rest.y - b.y) * strand.stiffness;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-9;
        const fix = (d - strand.segment) / d;
        b.x -= dx * fix;
        b.y -= dy * fix;
      }
    }
  }
}

// Run the steps that `elapsed` ms of animation owe, with the head where it is drawn now.
function hairWork(elapsed, root, heading) {
  const back = { x: -heading.x, y: -heading.y };
  hair.left += Math.min(elapsed, 250);
  while (hair.left >= HAIR.stepMs) {
    hair.left -= HAIR.stepMs;
    hairStep(root, back);
  }
  hair.root = root;
}

function drawHair(ctx, cellPx) {
  if (!hair.root) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const strand of hair.strands) {
    if (!strand.points) continue;
    ctx.strokeStyle = 'rgba(236, 234, 222, 0.95)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    strand.points.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x * cellPx, p.y * cellPx) : ctx.lineTo(p.x * cellPx, p.y * cellPx)));
    ctx.stroke();
  }
  ctx.restore();
}
