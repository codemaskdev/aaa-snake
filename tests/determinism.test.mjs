// The rule: no Math.random and no wall-clock time in game state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers.mjs';

const sources = dir => fs.readdirSync(dir, { recursive: true })
  .filter(f => /\.(js|mjs|html)$/.test(f))
  .map(f => ({ file: path.join(dir, f), text: withoutComments(fs.readFileSync(path.join(dir, f), 'utf8')) }));

// Code only: comments may say "we never use Math.random()".
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const builds = () => (fs.existsSync(path.join(ROOT, 'dist')) ? fs.readdirSync(path.join(ROOT, 'dist')) : []);
const games = () => [path.join(ROOT, 'src'), ...builds().filter(v => /^v\d+\.\d+$/.test(v)).map(v => path.join(ROOT, 'dist', v))]
  .filter(d => fs.existsSync(d));

test('no Math.random anywhere in the game (src and every build)', () => {
  for (const dir of games()) {
    for (const { file, text } of sources(dir)) assert.ok(!/Math\.random/.test(text), `${path.relative(ROOT, file)} uses Math.random`);
  }
});

test('rules.js never reads a clock', () => {
  const text = fs.readFileSync(path.join(ROOT, 'src/rules.js'), 'utf8');
  assert.ok(!/performance\.now|Date\.now|new Date|setTimeout|setInterval|requestAnimationFrame/.test(text));
});

test('game.js reads the clock only in report(), the log for the measuring bot', () => {
  const text = fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8');
  assert.ok(!/Date\.now|new Date/.test(text));
  const uses = text.split('\n').filter(line => /performance\.now/.test(line));
  assert.equal(uses.length, 1);
  assert.match(uses[0], /log\.push\(\{ t: performance\.now\(\)/);
  const logUses = text.match(/\blog\b[.,]?\w*/g);
  assert.deepEqual([...new Set(logUses)], ['log', 'log.push', 'log,'], 'the game only writes its log, never reads it');
});
