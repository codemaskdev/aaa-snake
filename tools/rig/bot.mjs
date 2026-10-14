// The bot's brain: given what the game shows (the probe), which way to go.
// Pure functions, no browser, so the tests can check every choice.
//
// Rules the bot follows in every version:
//   - On a control screen it takes the shortest path to the apple it can see.
//   - On any other screen it presses the key the screen offers to leave it
//     (skip, continue, restart) as soon as it is offered.
//   - It only sees what the probe reports and only acts through key presses.

export const KEY_FOR = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const STEP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

const key = (x, y) => x * 100003 + y;

// Moves the snake may make next: every direction except straight back.
// The current heading comes first, so ties keep going straight (fewer key presses).
function moves(heading) {
  const all = ['up', 'right', 'down', 'left'].filter(d => d !== OPPOSITE[heading]);
  return [heading, ...all.filter(d => d !== heading)];
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
  const toApple = pathToApple(probe);
  if (toApple) return toApple;
  let best = probe.heading;
  let bestRoom = -1;
  for (const d of moves(probe.heading)) {
    const room = roomAfter(probe, d);
    if (room > bestRoom) {
      best = d;
      bestRoom = room;
    }
  }
  return best;
}
