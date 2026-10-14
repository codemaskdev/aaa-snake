// Shared helpers for the tests.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Load src/rules.js (a plain browser script) into a sandbox and hand back its functions.
export function loadRules(dir = path.join(ROOT, 'src')) {
  const code = fs.readFileSync(path.join(dir, 'rules.js'), 'utf8');
  const context = vm.createContext({});
  return vm.runInContext(`${code}\n;({ GRID, START_LENGTH, DIRECTIONS, makeRandom, newGame, placeApple, queueTurn, step, isOnSnake })`, context);
}

export function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `aaa-snake-${name}-`));
}

// Width and height of a PNG file, from its IHDR chunk.
export function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}
