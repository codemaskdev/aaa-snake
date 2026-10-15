// AAA Snake v1.5: the open world.
// A world of WORLD.size x WORLD.size cells that the camera follows, made from the seed on the
// "Preparing your experience" screen: ground, trees and rocks, and 600 map markers (question
// marks, viewpoints, camps, chests that hold nothing, and acorns to collect). All of it is
// scenery: nothing here blocks the snake, and nothing here uses the game's own generator,
// so the rules are those of v1.0 on a bigger board, with the apple placed far away.
// Each frame draws only the cells the camera sees (see DEVLOG.md, prompt 6).
// Times are in ms of animation frames, never the clock.

const WORLD = {
  size: 256,      // cells across (and down)
  appleFar: 128,  // the apple lands at least this many moves from the head
  markers: { question: 120, viewpoint: 24, camp: 40, chest: 160, acorn: 256 },
  clouds: 28,
  wind: { x: 9, y: 4 },          // how fast the cloud shadows drift, in px a second
  minimap: { px: 112, cells: 72 }, // the corner map: its size on screen, and how many cells it shows
  mapListensAfter: 3000,          // the world map shows the quest for this long before Enter works
};

const TERRAIN = [
  { name: 'grass', color: '#3f6b2e', rgb: [63, 107, 46], blades: ['rgba(96, 146, 62, 0.75)', 'rgba(40, 78, 30, 0.6)'], count: 22 },
  { name: 'forest floor', color: '#2d5226', rgb: [45, 82, 38], blades: ['rgba(70, 116, 52, 0.7)', 'rgba(25, 52, 22, 0.7)'], count: 26 },
  { name: 'meadow', color: '#5a8235', rgb: [90, 130, 53], blades: ['rgba(130, 170, 70, 0.7)', 'rgba(70, 108, 40, 0.6)'], count: 18, flowers: true },
  { name: 'dry grass', color: '#7b7344', rgb: [123, 115, 68], blades: ['rgba(160, 148, 90, 0.75)', 'rgba(96, 88, 50, 0.6)'], count: 16 },
];
const VARIANTS = 8; // ground tiles per terrain, so the ground does not repeat in a grid

// What the toasts say when the snake reaches a marker. Picked by the marker's number, not at random.
const FINDS = {
  question: ['a rock', 'some grass', 'another rock', 'a slightly different rock', 'nothing', 'a very ordinary tree'],
  viewpoint: ['You can see a lot of markers from here.', 'The view: more markers.', 'You can see the apple from here. It is far.'],
  camp: ['Nobody was there.', 'Everyone had already left.', 'It was just a tent.'],
  chest: ['It was empty.', 'It was empty. Again.', 'Somebody got here first.'],
};

const world = {
  ready: false,
  ground: null,   // one byte a cell: terrain * VARIANTS + variant
  props: null,    // one byte a cell: 0 nothing, 1-3 a tree, 4-5 a rock
  markers: [],    // { x, y, kind, done }
  markerAt: null, // the marker's number at each cell, or -1
  found: { question: 0, viewpoint: 0, camp: 0, chest: 0, acorn: 0 },
  clouds: [],
  time: 0,        // ms of frames since the page started, for the clouds and the bobbing markers
  atlas: null, sprites: null, cloudSprites: null, minimap: null, mapView: null,
  questShown: false,
};

// Smooth random hills: a coarse grid of random numbers, blended between the corners.
function valueNoise(random, size, step) {
  const n = Math.ceil(size / step) + 2;
  const grid = new Float32Array(n * n);
  for (let i = 0; i < grid.length; i++) grid[i] = random();
  const smooth = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = x / step;
    const gy = y / step;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const fx = smooth(gx - ix);
    const fy = smooth(gy - iy);
    const at = (a, b) => grid[b * n + a];
    const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * fx;
    const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * fx;
    return top + (bottom - top) * fy;
  };
}

// The world's layout from the seed: ground, props and markers. No drawing, so the tests can run it.
function makeWorld(seed) {
  const random = makeRandom((seed ^ 0x0be11d5) >>> 0); // its own generator: the apples stay the game's
  const size = WORLD.size;
  const ground = new Uint8Array(size * size);
  const props = new Uint8Array(size * size);
  const hills = valueNoise(random, size, 24);
  const bumps = valueNoise(random, size, 8);
  const woods = valueNoise(random, size, 20);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const h = hills(x, y) * 0.65 + bumps(x, y) * 0.35;
      const forest = woods(x, y) > 0.6;
      const terrain = forest ? 1 : h > 0.62 ? 2 : h < 0.33 ? 3 : 0;
      ground[y * size + x] = terrain * VARIANTS + Math.floor(random() * VARIANTS);
      const r = random();
      if (r < (forest ? 0.22 : 0.025)) props[y * size + x] = 1 + Math.floor(random() * 3);
      else if (r > 0.985) props[y * size + x] = 4 + Math.floor(random() * 2);
    }
  }
  const markers = [];
  const markerAt = new Int16Array(size * size).fill(-1);
  const middle = Math.floor(size / 2);
  for (const [kind, count] of Object.entries(WORLD.markers)) {
    for (let placed = 0; placed < count;) {
      const x = Math.floor(random() * size);
      const y = Math.floor(random() * size);
      if (markerAt[y * size + x] !== -1 || Math.abs(x - middle) + Math.abs(y - middle) < 4) continue; // not on the start
      markerAt[y * size + x] = markers.length;
      props[y * size + x] = 0; // a marker stands on open ground
      markers.push({ x, y, kind, done: false });
      placed++;
    }
  }
  return { random, ground, props, markers, markerAt };
}

// Make the world and everything drawn from it once: the tile atlas, the sprites, the minimap.
function prepareWorld(seed) {
  const made = makeWorld(seed);
  Object.assign(world, { ground: made.ground, props: made.props, markers: made.markers, markerAt: made.markerAt });
  const random = made.random;
  world.atlas = makeAtlas(random);
  world.sprites = makeSprites(random);
  world.cloudSprites = [makeCloud(random), makeCloud(random), makeCloud(random)];
  const span = WORLD.size * CELL;
  world.clouds = [];
  for (let i = 0; i < WORLD.clouds; i++) {
    world.clouds.push({ x: random() * span, y: random() * span, sprite: i % world.cloudSprites.length });
  }
  world.minimap = makeMinimap();
  world.ready = true;
}

function canvasOf(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

// The ground tiles: VARIANTS of each terrain, side by side. Blades of grass that cross an edge
// are drawn again on the other side, so any tile fits next to any other without a seam.
function makeAtlas(random) {
  const atlas = canvasOf(CELL * VARIANTS, CELL * TERRAIN.length);
  const g = atlas.getContext('2d');
  TERRAIN.forEach((t, row) => {
    for (let v = 0; v < VARIANTS; v++) {
      const ox = v * CELL;
      const oy = row * CELL;
      g.save();
      g.beginPath();
      g.rect(ox, oy, CELL, CELL);
      g.clip();
      g.fillStyle = t.color;
      g.fillRect(ox, oy, CELL, CELL);
      g.lineWidth = 1;
      for (let i = 0; i < t.count; i++) {
        const x = random() * CELL;
        const y = random() * CELL;
        const length = 2 + random() * 4;
        const lean = (random() - 0.5) * 3;
        g.strokeStyle = t.blades[i % t.blades.length];
        for (const dx of [-CELL, 0, CELL]) {
          for (const dy of [-CELL, 0, CELL]) {
            g.beginPath();
            g.moveTo(ox + x + dx, oy + y + dy);
            g.lineTo(ox + x + dx + lean, oy + y + dy - length);
            g.stroke();
          }
        }
      }
      if (t.flowers && v % 2 === 0) {
        for (let i = 0; i < 3; i++) {
          g.fillStyle = ['#f2e86d', '#f4f4f4', '#e88ab0'][Math.floor(random() * 3)];
          g.fillRect(ox + 2 + random() * (CELL - 4), oy + 2 + random() * (CELL - 4), 2, 2);
        }
      }
      g.restore();
    }
  });
  return atlas;
}

// Trees and rocks with their shadows, and the map markers, each drawn once into its own canvas.
function makeSprites(random) {
  const sprites = { props: [null] };
  for (let i = 0; i < 3; i++) sprites.props.push(makeTree(random, 19 + i * 4));
  for (let i = 0; i < 2; i++) sprites.props.push(makeRock(random, 9 + i * 4));
  for (const kind of Object.keys(WORLD.markers)) {
    sprites[kind] = makeMarker(kind, false);
    sprites[`${kind}-done`] = makeMarker(kind, true);
  }
  return sprites;
}

function makeTree(random, radius) {
  const size = radius * 2 + 28;
  const c = canvasOf(size, size);
  const g = c.getContext('2d');
  const mid = size / 2;
  g.filter = 'blur(4px)'; // the shadow, falling down and to the right
  g.fillStyle = 'rgba(0, 0, 0, 0.38)';
  g.beginPath();
  g.ellipse(mid + 8, mid + 10, radius, radius * 0.8, 0, 0, Math.PI * 2);
  g.fill();
  g.filter = 'none';
  const lobes = 5;
  for (let i = 0; i < lobes; i++) { // the canopy: a few round lobes around a middle one
    const a = (i / lobes) * Math.PI * 2 + random();
    const r = radius * (0.5 + random() * 0.2);
    const x = mid + Math.cos(a) * radius * 0.45;
    const y = mid + Math.sin(a) * radius * 0.45;
    const leaf = g.createRadialGradient(x - r * 0.4, y - r * 0.4, 1, x, y, r);
    leaf.addColorStop(0, '#5f9a3f');
    leaf.addColorStop(1, '#24481c');
    g.fillStyle = leaf;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const top = g.createRadialGradient(mid - radius * 0.3, mid - radius * 0.3, 1, mid, mid, radius * 0.6);
  top.addColorStop(0, '#79b552');
  top.addColorStop(1, '#2f5a24');
  g.fillStyle = top;
  g.beginPath();
  g.arc(mid, mid, radius * 0.6, 0, Math.PI * 2);
  g.fill();
  return c;
}

function makeRock(random, radius) {
  const size = radius * 2 + 20;
  const c = canvasOf(size, size);
  const g = c.getContext('2d');
  const mid = size / 2;
  const corners = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = radius * (0.75 + random() * 0.3);
    corners.push([mid + Math.cos(a) * r, mid + Math.sin(a) * r * 0.8]);
  }
  const outline = (dx, dy) => {
    g.beginPath();
    corners.forEach(([x, y], i) => (i === 0 ? g.moveTo(x + dx, y + dy) : g.lineTo(x + dx, y + dy)));
    g.closePath();
  };
  g.filter = 'blur(3px)';
  g.fillStyle = 'rgba(0, 0, 0, 0.4)';
  outline(5, 6);
  g.fill();
  g.filter = 'none';
  const stone = g.createLinearGradient(mid - radius, mid - radius, mid + radius, mid + radius);
  stone.addColorStop(0, '#b4b0a6');
  stone.addColorStop(1, '#5f5c55');
  g.fillStyle = stone;
  outline(0, 0);
  g.fill();
  return c;
}

// A map marker: a round badge with a symbol. Done markers are grey (an open chest stays open).
function makeMarker(kind, done) {
  const c = canvasOf(30, 30);
  const g = c.getContext('2d');
  const gold = done ? '#8a8a8a' : '#f1c94b';
  g.shadowColor = 'rgba(0, 0, 0, 0.6)';
  g.shadowBlur = 4;
  g.shadowOffsetY = 2;
  if (kind === 'acorn') {
    g.fillStyle = '#9b6a32';
    g.beginPath();
    g.ellipse(15, 17, 6, 7.5, 0, 0, Math.PI * 2);
    g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = '#5c3b17';
    g.beginPath();
    g.ellipse(15, 11, 7.5, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(14, 4, 2, 4);
    return c;
  }
  g.fillStyle = done ? 'rgba(40, 40, 40, 0.85)' : 'rgba(20, 24, 30, 0.9)';
  g.beginPath();
  g.arc(15, 15, 11, 0, Math.PI * 2);
  g.fill();
  g.shadowColor = 'transparent';
  g.strokeStyle = gold;
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = gold;
  g.strokeStyle = gold;
  if (kind === 'question') {
    g.font = 'bold 15px Helvetica, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(done ? '✓' : '?', 15, 16);
  }
  if (kind === 'viewpoint') { // a tall triangle: a lookout
    g.beginPath();
    g.moveTo(15, 7);
    g.lineTo(21, 21);
    g.lineTo(9, 21);
    g.closePath();
    g.fill();
  }
  if (kind === 'camp') { // a tent
    g.beginPath();
    g.moveTo(15, 8);
    g.lineTo(23, 21);
    g.lineTo(7, 21);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(20, 24, 30, 0.9)';
    g.beginPath();
    g.moveTo(15, 14);
    g.lineTo(18, 21);
    g.lineTo(12, 21);
    g.closePath();
    g.fill();
  }
  if (kind === 'chest') { // a box; open, it shows its empty inside
    g.fillRect(8, 13, 14, 9);
    if (done) {
      g.fillStyle = '#111';
      g.fillRect(9, 14, 12, 4);
      g.fillStyle = gold;
      g.fillRect(8, 7, 14, 3);
    } else {
      g.fillRect(8, 9, 14, 3);
      g.fillStyle = 'rgba(20, 24, 30, 0.9)';
      g.fillRect(14, 15, 2, 3);
    }
  }
  return c;
}

// A cloud's shadow: soft dark blobs, blurred once here, never per frame.
function makeCloud(random) {
  const c = canvasOf(420, 260);
  const g = c.getContext('2d');
  g.filter = 'blur(22px)';
  g.fillStyle = 'rgba(0, 0, 0, 0.2)';
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.ellipse(110 + random() * 200, 100 + random() * 60, 50 + random() * 50, 35 + random() * 30, 0, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

const MARKER_RGB = {
  question: [241, 201, 75], viewpoint: [255, 255, 255], camp: [235, 140, 60], chest: [200, 150, 70], acorn: [155, 106, 50],
};

// The whole world at one pixel a cell, for the minimap and the world map.
function makeMinimap() {
  const size = WORLD.size;
  const c = canvasOf(size, size);
  const g = c.getContext('2d');
  const image = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    let rgb = TERRAIN[Math.floor(world.ground[i] / VARIANTS)].rgb;
    if (world.props[i] >= 1 && world.props[i] <= 3) rgb = [32, 62, 26];
    if (world.props[i] >= 4) rgb = [130, 128, 120];
    if (world.markerAt[i] !== -1) rgb = MARKER_RGB[world.markers[world.markerAt[i]].kind];
    image.data.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
  }
  g.putImageData(image, 0, 0);
  return c;
}

function worldWork(elapsed) {
  world.time += elapsed;
}

// The snake's head reached this cell: a marker there is found. Returns what the toast says, or null.
function visitCell(cell) {
  if (!world.ready) return null;
  const i = world.markerAt[cell.y * WORLD.size + cell.x];
  if (i === undefined || i === -1 || world.markers[i].done) return null;
  const marker = world.markers[i];
  marker.done = true;
  world.found[marker.kind]++;
  const g = world.minimap.getContext('2d');
  const rgb = marker.kind === 'acorn' ? TERRAIN[Math.floor(world.ground[cell.y * WORLD.size + cell.x] / VARIANTS)].rgb : [120, 120, 120];
  g.fillStyle = `rgb(${rgb.join(', ')})`;
  g.fillRect(cell.x, cell.y, 1, 1);
  const pick = list => list[i % list.length];
  if (marker.kind === 'acorn') return `Acorn collected: ${world.found.acorn} / ${WORLD.markers.acorn}`;
  if (marker.kind === 'question') return `Location discovered: ${pick(FINDS.question)}.`;
  if (marker.kind === 'viewpoint') return `Viewpoint reached. ${pick(FINDS.viewpoint)}`;
  if (marker.kind === 'camp') return `Camp cleared. ${pick(FINDS.camp)}`;
  return `Chest opened. ${pick(FINDS.chest)}`;
}

// The world under the camera. view: the rectangle it sees, in world px. Only the cells inside it
// (and a margin of 2 for the trees and shadows that hang over the edge) are drawn.
function drawWorld(ctx, view) {
  const size = WORLD.size;
  ctx.fillStyle = '#101a0e'; // beyond the edge of the world, seen only in a close-up near it
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  const cx0 = Math.max(0, Math.floor(view.x0 / CELL));
  const cy0 = Math.max(0, Math.floor(view.y0 / CELL));
  const cx1 = Math.min(size - 1, Math.floor(view.x1 / CELL));
  const cy1 = Math.min(size - 1, Math.floor(view.y1 / CELL));
  world.drawn = 0;
  ctx.imageSmoothingEnabled = false; // tiles meet exactly, even in a close-up
  for (let y = cy0; y <= cy1; y++) {
    for (let x = cx0; x <= cx1; x++) {
      const tile = world.ground[y * size + x];
      const sx = (tile % VARIANTS) * CELL;
      const sy = Math.floor(tile / VARIANTS) * CELL;
      ctx.drawImage(world.atlas, sx, sy, CELL, CELL, x * CELL, y * CELL, CELL + 0.5, CELL + 0.5);
      world.drawn++;
    }
  }
  ctx.imageSmoothingEnabled = true;
  const px0 = Math.max(0, cx0 - 2);
  const py0 = Math.max(0, cy0 - 2);
  const px1 = Math.min(size - 1, cx1 + 2);
  const py1 = Math.min(size - 1, cy1 + 2);
  for (let y = py0; y <= py1; y++) { // rocks and trees, row by row, so lower ones overlap upper ones
    for (let x = px0; x <= px1; x++) {
      const prop = world.props[y * size + x];
      if (prop === 0) continue;
      const sprite = world.sprites.props[prop];
      ctx.drawImage(sprite, x * CELL + CELL / 2 - sprite.width / 2, y * CELL + CELL / 2 - sprite.height / 2);
      world.drawn++;
    }
  }
  for (let y = py0; y <= py1; y++) {
    for (let x = px0; x <= px1; x++) {
      const i = world.markerAt[y * size + x];
      if (i === -1) continue;
      const marker = world.markers[i];
      if (marker.done && marker.kind === 'acorn') continue; // collected
      const sprite = world.sprites[marker.done ? `${marker.kind}-done` : marker.kind];
      const bob = marker.done ? 0 : Math.sin(world.time / 400 + i) * 2;
      ctx.drawImage(sprite, x * CELL + CELL / 2 - 15, y * CELL + CELL / 2 - 17 + bob);
      world.drawn++;
    }
  }
}

// The cloud shadows drift over everything, the snake included. Only those over the view are drawn.
function drawClouds(ctx, view) {
  const margin = 420;
  const span = WORLD.size * CELL + margin * 2;
  const wrap = v => ((v % span) + span) % span - margin;
  for (const cloud of world.clouds) {
    const sprite = world.cloudSprites[cloud.sprite];
    const x = wrap(cloud.x + (WORLD.wind.x * world.time) / 1000);
    const y = wrap(cloud.y + (WORLD.wind.y * world.time) / 1000);
    if (x > view.x1 || y > view.y1 || x + sprite.width < view.x0 || y + sprite.height < view.y0) continue;
    ctx.drawImage(sprite, x, y);
    world.drawn++;
  }
}

// On-screen help for the quest: a marker over the apple if it is in view, otherwise an arrow
// circling the head that points to it (the distance is in the quest tracker).
function drawQuestMarker(ctx, apple, head, box) {
  ctx.save();
  const inside = apple.x > box.x + 10 && apple.x < box.x + box.w - 10 && apple.y > box.y + 10 && apple.y < box.y + box.h - 10;
  ctx.fillStyle = GOLD;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  if (inside) {
    const y = apple.y - 26 + Math.sin(world.time / 250) * 3;
    ctx.beginPath();
    ctx.moveTo(apple.x, y - 8);
    ctx.lineTo(apple.x + 7, y);
    ctx.lineTo(apple.x, y + 8);
    ctx.lineTo(apple.x - 7, y);
    ctx.closePath();
  } else {
    const angle = Math.atan2(apple.y - head.y, apple.x - head.x);
    ctx.translate(head.x + Math.cos(angle) * 46, head.y + Math.sin(angle) * 46);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-7, -9);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-7, 9);
    ctx.closePath();
  }
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

// The quest tracker and the acorn count, top left of the view.
function drawWorldHud(ctx, distance, top) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(8, top + 8, 190, 44);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 12px Helvetica, Arial, sans-serif';
  ctx.fillText('QUEST: The last apple', 16, top + 20);
  ctx.fillStyle = '#ddd';
  ctx.font = '12px Helvetica, Arial, sans-serif';
  ctx.fillText(distance === null ? 'Location unknown' : `${distance} m away`, 16, top + 38);
  ctx.drawImage(world.sprites.acorn, 120, top + 23, 20, 20);
  ctx.fillText(`${world.found.acorn} / ${WORLD.markers.acorn}`, 142, top + 38);
  ctx.restore();
}

// The minimap: the part of the one-pixel-a-cell world around the head, the snake and the quest.
function drawMinimap(ctx, head, apple, x, y) {
  const { px, cells } = WORLD.minimap;
  const scale = px / cells;
  const sx = Math.max(0, Math.min(WORLD.size - cells, Math.round(head.x - cells / 2)));
  const sy = Math.max(0, Math.min(WORLD.size - cells, Math.round(head.y - cells / 2)));
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(x - 3, y - 3, px + 6, px + 20);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(world.minimap, sx, sy, cells, cells, x, y, px, px);
  ctx.imageSmoothingEnabled = true;
  ctx.beginPath();
  ctx.rect(x, y, px, px);
  ctx.clip();
  if (apple) { // since v1.7 only once the apple is in view
    const ax = Math.max(x + 4, Math.min(x + px - 4, x + (apple.x - sx + 0.5) * scale));
    const ay = Math.max(y + 4, Math.min(y + px - 4, y + (apple.y - sy + 0.5) * scale));
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(ax, ay - 5);
    ctx.lineTo(ax + 5, ay);
    ctx.lineTo(ax, ay + 5);
    ctx.lineTo(ax - 5, ay);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + (head.x - sx + 0.5) * scale, y + (head.y - sy + 0.5) * scale, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#bbb';
  ctx.font = '10px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M  World map', x + px / 2, y + px + 9);
}

// The world map screen: the whole world, every marker, where you are, and the quest.
const MAP_BOX = { x: 40, y: 44, size: 400 };

function worldScreen(name) {
  if (name !== 'world-map') return;
  if (!world.ready) return;
  world.mapView = canvasOf(MAP_BOX.size, MAP_BOX.size); // the map and its markers, drawn once as it opens
  const g = world.mapView.getContext('2d');
  const scale = MAP_BOX.size / WORLD.size;
  g.imageSmoothingEnabled = false;
  g.drawImage(world.minimap, 0, 0, MAP_BOX.size, MAP_BOX.size);
  g.imageSmoothingEnabled = true;
  world.markers.forEach(marker => {
    if (marker.done && marker.kind === 'acorn') return;
    g.globalAlpha = marker.done ? 0.6 : 1;
    g.drawImage(world.sprites[marker.done ? `${marker.kind}-done` : marker.kind], (marker.x + 0.5) * scale - 6, (marker.y + 0.5) * scale - 6, 12, 12);
  });
  g.globalAlpha = 1;
  if (!world.questShown) {
    world.questShown = true;
    toast('New quest: The last apple');
  }
}

function drawWorldMap(ctx, time, width, height, head, apple, distance) {
  ctx.fillStyle = '#0c0f14';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px Helvetica, Arial, sans-serif';
  ctx.fillText('WORLD MAP', 16, 22);
  ctx.textAlign = 'right';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 13px Helvetica, Arial, sans-serif';
  ctx.fillText(distance === null ? 'QUEST: The last apple, location unknown' : `QUEST: The last apple, ${distance} m`, width - 16, 22);
  if (world.mapView) ctx.drawImage(world.mapView, MAP_BOX.x, MAP_BOX.y);
  ctx.strokeStyle = '#333';
  ctx.strokeRect(MAP_BOX.x - 0.5, MAP_BOX.y - 0.5, MAP_BOX.size + 1, MAP_BOX.size + 1);
  const scale = MAP_BOX.size / WORLD.size;
  const at = cell => ({ x: MAP_BOX.x + (cell.x + 0.5) * scale, y: MAP_BOX.y + (cell.y + 0.5) * scale });
  const pulse = 0.5 + 0.5 * Math.sin(time / 200);
  if (apple) drawMapQuest(ctx, at(apple), pulse, width);
  const you = at(head);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.font = 'bold 12px Helvetica, Arial, sans-serif';
  ctx.beginPath();
  ctx.arc(you.x, you.y, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fill();
  ctx.textAlign = you.x > width / 2 ? 'right' : 'left';
  const yx = you.x + (you.x > width / 2 ? -10 : 10);
  ctx.strokeText('You', yx, you.y);
  ctx.fillText('You', yx, you.y);

  // The legend: every kind of marker, how many there are, how many found, spread across the width.
  ctx.textAlign = 'left';
  ctx.font = '11px Helvetica, Arial, sans-serif';
  const kinds = [['question', 'Unknown'], ['viewpoint', 'Viewpoints'], ['camp', 'Camps'], ['chest', 'Chests'], ['acorn', 'Acorns']];
  const items = kinds.map(([kind, label]) => ({ kind, text: `${label} ${world.found[kind]}/${WORLD.markers[kind]}` }));
  const widths = items.map(item => 18 + ctx.measureText(item.text).width);
  const gap = (width - 32 - widths.reduce((a, b) => a + b, 0)) / (items.length - 1);
  let lx = 16;
  items.forEach((item, i) => {
    ctx.drawImage(world.sprites[item.kind], lx, 452, 16, 16);
    ctx.fillStyle = '#ccc';
    ctx.fillText(item.text, lx + 18, 460);
    lx += widths[i] + gap;
  });
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(16, 476, 214, 24);
  ctx.fillStyle = '#777';
  ctx.fillText('Fast travel: coming in a future update', 24, 488);
  if (time >= WORLD.mapListensAfter && Math.floor(time / 500) % 2 === 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = '13px Helvetica, Arial, sans-serif';
    ctx.fillText('Press Enter to continue', width - 16, 488);
  }
  ctx.restore();
}

// The quest's marker on the world map, with its label.
function drawMapQuest(ctx, q, pulse, width) {
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(q.x, q.y, 10 + pulse * 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(q.x, q.y - 7);
  ctx.lineTo(q.x + 7, q.y);
  ctx.lineTo(q.x, q.y + 7);
  ctx.lineTo(q.x - 7, q.y);
  ctx.fill();
  ctx.textAlign = q.x > width / 2 ? 'right' : 'left';
  ctx.font = 'bold 12px Helvetica, Arial, sans-serif';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  const labelX = q.x + (q.x > width / 2 ? -14 : 14);
  ctx.strokeText('The last apple', labelX, q.y);
  ctx.fillText('The last apple', labelX, q.y);
  ctx.restore();
}
