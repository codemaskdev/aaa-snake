// v1.4, always online: SnakeNet is a stub, its numbers come from the seed, the terms must be
// scrolled, and the voice lines still come from the one place they live (src/voice/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { chromium } from 'playwright';
import { startServer } from '../tools/serve.mjs';
import { buildsOutOfStep, syncBuilds } from '../tools/voice.mjs';
import { patchNote } from '../tools/short.mjs';
import { offOrigin } from '../tools/rig/stats.mjs';
import { ROOT, tempDir } from './helpers.mjs';

const dir = fs.existsSync(path.join(ROOT, 'dist/v1.4')) ? path.join(ROOT, 'dist/v1.4') : path.join(ROOT, 'src');

function loadOnline(seed) {
  const code = ['rules.js', 'online.js'].map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
  const context = vm.createContext({});
  return vm.runInContext(`${code}\n;startOnline(${seed}); ({ online, ONLINE, connectionDrops, queuePosition, queueDone })`, context);
}

// Values from the sandbox, as plain values of this realm (deepEqual compares prototypes).
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('SnakeNet: the guest account, the queue and the drops come from the seed', () => {
  const a = loadOnline(1);
  const b = loadOnline(1);
  assert.equal(a.online.guest, b.online.guest);
  assert.match(a.online.guest, /^guest-\d{5}$/);
  assert.notEqual(loadOnline(2).online.guest, a.online.guest);
  assert.deepEqual(plain(a.online.queue), plain(b.online.queue));
  const positions = a.online.queue.map(step => step.position);
  assert.ok(positions[0] >= 30 && positions[0] < 70, 'the queue starts between 30 and 69');
  assert.equal(positions[positions.length - 1], 0);
  positions.slice(1).forEach((p, i) => assert.ok(p < positions[i], 'the position only goes down'));

  // Drops: between 150 and 300 moves of play apart, 3000 to 6000 ms long, the same every time.
  const drops = run => {
    const out = [];
    for (let tick = 1; tick <= 3000; tick++) if (run.connectionDrops()) out.push([run.online.playTicks, run.online.dropMs]);
    return out;
  };
  const dropsA = drops(a);
  assert.deepEqual(dropsA, drops(b));
  assert.ok(dropsA.length >= 10);
  let last = 0;
  for (const [tick, ms] of dropsA) {
    assert.ok(tick - last >= 150 && tick - last <= 300, `${tick - last} moves between drops`);
    assert.ok(ms >= 3000 && ms <= 6000 && ms % 100 === 0, `${ms} ms`);
    last = tick;
  }
});

test('SnakeNet has its own generator: the apples are the ones of v1.3', () => {
  const code = fs.readFileSync(path.join(dir, 'game.js'), 'utf8');
  assert.match(fs.readFileSync(path.join(dir, 'online.js'), 'utf8'), /makeRandom\(\(seed \^ 0x[0-9a-f]+\) >>> 0\)/);
  assert.match(code, /const random = makeRandom\(seed\);\nlet game = newGame\(random\);\nstartOnline\(seed\);/);
});

test('the game shows every patch note so far, as UPDATES.md has them', () => {
  const code = fs.readFileSync(path.join(dir, 'update.js'), 'utf8');
  const notes = plain(vm.runInContext(`${code}\n;PATCH_NOTES`, vm.createContext({})));
  const md = fs.readFileSync(path.join(ROOT, 'UPDATES.md'), 'utf8');
  assert.deepEqual(notes.map(([version]) => version), ['v1.0', 'v1.1', 'v1.2', 'v1.3', 'v1.4']);
  for (const [version, note] of notes) assert.equal(note, patchNote(md, version), version);
});

test('the voice lines live in one place: every build plays the files in src/voice/', () => {
  const builds = buildsOutOfStep();
  assert.ok(builds.some(b => b.version === 'v1.3'));
  for (const { version, differ } of builds) assert.deepEqual(differ, [], `dist/${version}/voice/ differs from src/voice/: run npm run voice`);
  assert.equal(fs.readFileSync(path.join(dir, 'story.js'), 'utf8'), fs.readFileSync(path.join(ROOT, 'src/story.js'), 'utf8'));
});

test('npm run voice copies a new recording into every build that has voice lines', () => {
  const root = tempDir('voice');
  const src = path.join(root, 'src-voice');
  fs.mkdirSync(src);
  fs.writeFileSync(path.join(src, '01.mp3'), 'placeholder');
  for (const v of ['v1.2', 'v1.3', 'v1.4']) fs.mkdirSync(path.join(root, 'dist', v), { recursive: true });
  for (const v of ['v1.3', 'v1.4']) {
    fs.mkdirSync(path.join(root, 'dist', v, 'voice'));
    fs.writeFileSync(path.join(root, 'dist', v, 'voice', '01.mp3'), 'placeholder');
  }
  assert.deepEqual(syncBuilds(path.join(root, 'dist'), src), []);
  fs.writeFileSync(path.join(src, '01.mp3'), 'the recording');
  assert.deepEqual(syncBuilds(path.join(root, 'dist'), src), ['v1.3/voice/01.mp3', 'v1.4/voice/01.mp3']);
  for (const v of ['v1.3', 'v1.4']) assert.equal(fs.readFileSync(path.join(root, 'dist', v, 'voice', '01.mp3'), 'utf8'), 'the recording');
  assert.ok(!fs.existsSync(path.join(root, 'dist', 'v1.2', 'voice')), 'a build without voice lines gets none');
});

test('v1.4: SnakeNet makes no request; sign in, the queue, and terms you must scroll', async () => {
  const server = await startServer({ '/': dir });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const requests = [];
    page.on('request', request => requests.push({ url: request.url(), at: null }));
    await page.goto(`${server.url}/index.html?seed=1`);
    const probe = () => page.evaluate(() => window.snakeGame.probe());
    const until = (fn, timeout, arg) => page.waitForFunction(fn, arg, { timeout, polling: 10 });
    for (const screen of ['warning', 'title']) {
      await until(s => window.snakeGame.probe().screen === s && window.snakeGame.probe().next, 60000, screen);
      await page.keyboard.press('Enter');
    }
    const before = requests.length;
    await until(() => window.snakeGame.probe().screen === 'sign-in' && window.snakeGame.probe().next === 'Enter', 10000);
    assert.equal(requests.length, before, 'connecting to SnakeNet made no request');
    assert.equal(await page.evaluate(() => online.status), 'online');
    await page.keyboard.press('KeyX');
    assert.equal((await probe()).screen, 'sign-in', 'only Enter signs in');
    await page.keyboard.press('Enter');
    assert.equal((await probe()).screen, 'signing-in');

    await until(() => window.snakeGame.probe().screen === 'queue', 5000);
    const expected = plain(loadOnline(1).online.queue);
    assert.deepEqual(await page.evaluate(() => online.queue), expected, 'the same queue as the seed gives');
    assert.equal(await page.evaluate(() => online.scales), 100, 'the daily login bonus');

    await until(() => window.snakeGame.probe().screen === 'terms' && window.snakeGame.probe().shown, 20000);
    assert.equal((await probe()).next, 'PageDown', 'the terms ask to be scrolled first');
    await page.keyboard.press('Enter');
    assert.equal((await probe()).screen, 'terms', 'Accept does not work before the bottom');
    let presses = 0;
    while ((await probe()).next === 'PageDown') {
      await page.keyboard.press('PageDown');
      presses++;
      await page.waitForTimeout(250);
      assert.ok(presses < 100);
    }
    assert.equal((await probe()).next, 'Enter');
    assert.ok(presses > 3, `${presses} pages of terms`);
    await page.keyboard.press('Enter');
    assert.equal((await probe()).screen, 'loading');
    assert.equal(requests.length, before, 'no request from connecting to the end of the terms');
    assert.deepEqual(offOrigin(requests.map(r => r.url), new URL(server.url).origin), [], 'the rig\'s own-origin check');
  } finally {
    await browser.close();
    await server.close();
  }
});
