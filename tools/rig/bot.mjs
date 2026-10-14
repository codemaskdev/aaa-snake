// The bot's brain: given what the game shows (the probe), which way to go.
// Pure functions, no browser, so the tests can check every choice.
//
// Rules the bot follows in every version:
//   - On a control screen it takes the shortest path to the apple it can see,
//     using only the turns the probe says are allowed (v1.6: right only, until "Turn left").
//   - On any other screen it presses the key the screen offers to leave it
//     (skip, continue, restart) as soon as it is offered.
//   - On v1.6's skill tree it spends the point on "Turn left" first, then on whatever
//     comes first in the list (skillKey).
//   - It only sees what the probe reports and only acts through key presses.

export const KEY_FOR = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const STEP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const RIGHT_OF = { up: 'right', right: 'down', down: 'left', left: 'up' }; // a quarter turn clockwise
const LEFT_OF = { up: 'left', left: 'down', down: 'right', right: 'up' };  // counter-clockwise
const DIRS = ['up', 'right', 'down', 'left'];

const key = (x, y) => x * 100003 + y;

// Moves the snake may make next: every direction except straight back.
// The current heading comes first, so ties keep going straight (fewer key presses).
function moves(heading) {
  const all = ['up', 'right', 'down', 'left'].filter(d => d !== OPPOSITE[heading]);
  return [heading, ...all.filter(d => d !== heading)];
}

// Moves the snake may make next when the probe limits its turns: straight, then right, then left if allowed.
function allowedMoves(heading, allowedTurns) {
  const out = [heading];
  if (allowedTurns.includes('right')) out.push(RIGHT_OF[heading]);
  if (allowedTurns.includes('left')) out.push(LEFT_OF[heading]);
  return out;
}

// When each body cell becomes free: segment i (0 = head) leaves after (length - i) moves.
function freeAfter(snake) {
  const map = new Map();
  snake.forEach((part, i) => map.set(key(part.x, part.y), snake.length - i));
  return map;
}

// Breadth-first search from the head to the apple. A cell can be entered on move k
// if it is inside the grid and no body part is still on it by then.
// Returns the first direction of a shortest path, or null if there is none.
export function pathToApple({ snake, apple, grid, heading }) {
  if (!apple) return null;
  const free = freeAfter(snake);
  const head = snake[0];
  const seen = new Set([key(head.x, head.y)]);
  let layer = [];
  for (const d of moves(heading)) layer.push({ x: head.x, y: head.y, first: d, dir: d });
  for (let k = 1; layer.length > 0; k++) {
    const next = [];
    for (const { x, y, first, dir } of layer) {
      const nx = x + STEP[dir][0];
      const ny = y + STEP[dir][1];
      const id = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= grid || ny >= grid || seen.has(id)) continue;
      if (free.has(id) && free.get(id) > k) continue;
      if (nx === apple.x && ny === apple.y) return first;
      seen.add(id);
      for (const d of moves(dir)) next.push({ x: nx, y: ny, first, dir: d });
    }
    layer = next;
  }
  return null;
}

// The same search when the probe limits the turns (v1.6). Which way the snake faces now matters
// for where it can go next, so a state is a cell and a heading: up to 4 x grid x grid states,
// searched with flat number arrays so a 256-cell world takes a few ms per move.
export function pathWithTurns({ snake, apple, grid, heading, allowedTurns }) {
  if (!apple) return null;
  const cells = grid * grid;
  const freeAt = new Int32Array(cells); // the move from which a body cell is free (0: free now)
  snake.forEach((part, i) => { freeAt[part.y * grid + part.x] = snake.length - i; });
  const dx = DIRS.map(d => STEP[d][0]);
  const dy = DIRS.map(d => STEP[d][1]);
  const next = DIRS.map(d => allowedMoves(d, allowedTurns).map(n => DIRS.indexOf(n))); // straight, right, left
  const firstOf = new Int8Array(cells * 4).fill(-1); // the first move of the path that reached a state; -1: not yet
  const depth = new Int32Array(cells * 4);
  const queue = new Int32Array(cells * 4);
  const target = apple.y * grid + apple.x;
  let tail = 0;
  // Enter cell (x, y) on move k facing d, by a path that began with `first`. Returns true at the apple.
  const enter = (x, y, d, k, first) => {
    if (x < 0 || y < 0 || x >= grid || y >= grid) return false;
    const cell = y * grid + x;
    if (freeAt[cell] > k) return false;
    const state = cell * 4 + d;
    if (firstOf[state] !== -1) return false;
    if (cell === target) return true;
    firstOf[state] = first;
    depth[state] = k;
    queue[tail++] = state;
    return false;
  };
  const h = snake[0];
  for (const d of next[DIRS.indexOf(heading)]) {
    if (enter(h.x + dx[d], h.y + dy[d], d, 1, d)) return DIRS[d];
  }
  for (let at = 0; at < tail; at++) {
    const state = queue[at];
    const cell = state >> 2;
    const x = cell % grid;
    const y = (cell - x) / grid;
    const k = depth[state] + 1;
    const first = firstOf[state];
    for (const d of next[state & 3]) {
      if (enter(x + dx[d], y + dy[d], d, k, first)) return DIRS[first];
    }
  }
  return null;
}

// How many cells the head could still reach after moving one step this way.
function roomAfter({ snake, grid }, dir) {
  const head = snake[0];
  const start = { x: head.x + STEP[dir][0], y: head.y + STEP[dir][1] };
  const blocked = new Set(snake.slice(0, -1).map(p => key(p.x, p.y)));
  const inside = c => c.x >= 0 && c.y >= 0 && c.x < grid && c.y < grid;
  if (!inside(start) || blocked.has(key(start.x, start.y))) return 0;
  const seen = new Set([key(start.x, start.y)]);
  const stack = [start];
  while (stack.length > 0) {
    const c = stack.pop();
    for (const d of Object.keys(STEP)) {
      const n = { x: c.x + STEP[d][0], y: c.y + STEP[d][1] };
      const id = key(n.x, n.y);
      if (inside(n) && !blocked.has(id) && !seen.has(id)) {
        seen.add(id);
        stack.push(n);
      }
    }
  }
  return seen.size;
}

// The direction the bot wants next on a control screen.
// Shortest path to the apple if there is one; otherwise the move with the most room.
export function decide(probe) {
  const limited = Array.isArray(probe.allowedTurns);
  const toApple = limited ? pathWithTurns(probe) : pathToApple(probe);
  if (toApple) return toApple;
  let best = probe.heading;
  let bestRoom = -1;
  for (const d of limited ? allowedMoves(probe.heading, probe.allowedTurns) : moves(probe.heading)) {
    const room = roomAfter(probe, d);
    if (room > bestRoom) {
      best = d;
      bestRoom = room;
    }
  }
  return best;
}

// The key the bot presses on v1.6's skill tree (UPDATES.md, v1.6): it moves the cursor to "Turn left"
// if that can be learned, otherwise to the first skill in the list that can, then presses the key
// the screen offers (Enter). If nothing can be learned, it presses what the screen offers to go on.
export function skillKey({ skills, cursor, next }) {
  let target = skills.findIndex(s => s.id === 'left' && s.learnable);
  if (target === -1) target = skills.findIndex(s => s.learnable);
  if (target === -1 || target === cursor) return next;
  return target > cursor ? 'ArrowDown' : 'ArrowUp';
}
