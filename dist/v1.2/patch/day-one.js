// AAA Snake v1.2: the day-one patch.
// The game does not load this file with a <script> tag. It downloads it from its own
// server in small pieces (see launch.js), shows the real bytes as they arrive, then
// installs it. What the patch adds:
//   - a grass field, drawn once into an offscreen canvas from the seed;
//   - soft shadows under the snake and the apple.

let field = null; // the offscreen canvas with the grass on it

// Draw the grass once. It has its own seeded generator, so the apples
// (which use the game's generator) land exactly where they did before.
function prepareField(seed, width, height) {
  const random = makeRandom((seed ^ 0x9e3779b9) >>> 0);
  field = document.createElement('canvas');
  field.width = width;
  field.height = height;
  const g = field.getContext('2d');
  g.fillStyle = '#1b2a18';
  g.fillRect(0, 0, width, height);

  // A few darker and lighter patches, so the field is not one flat colour.
  for (let i = 0; i < 40; i++) {
    const x = random() * width;
    const y = random() * height;
    const r = 20 + random() * 50;
    const patch = g.createRadialGradient(x, y, 0, x, y, r);
    patch.addColorStop(0, random() < 0.5 ? 'rgba(10, 20, 8, 0.5)' : 'rgba(60, 90, 45, 0.25)');
    patch.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = patch;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Thousands of short blades of grass.
  g.lineWidth = 1;
  for (let i = 0; i < 3000; i++) {
    const x = random() * width;
    const y = random() * height;
    const length = 2 + random() * 4;
    const lean = (random() - 0.5) * 3;
    const shade = 40 + Math.floor(random() * 40);
    g.strokeStyle = `rgba(${shade}, ${shade + 50}, ${Math.floor(shade / 2)}, 0.55)`;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + lean, y - length);
    g.stroke();
  }
}

function drawField(ctx, x, y) {
  ctx.drawImage(field, x, y);
}

// Draw something with a soft shadow under it.
function withShadow(ctx, draw) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 5;
  draw();
  ctx.restore();
}
