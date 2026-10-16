// The GitHub Pages site (prompt 24): one patch a day, by release-schedule.json, at UTC+3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { buildSite, plan, todayAt, formatTime } from '../scripts/build-site.mjs';
import { startServer } from '../tools/serve.mjs';
import { decide, KEY_FOR } from '../tools/rig/bot.mjs';
import { ROOT, tempDir } from './helpers.mjs';

const schedule = JSON.parse(fs.readFileSync(path.join(ROOT, 'release-schedule.json'), 'utf8'));

test('the schedule: v1.0 and v1.1 on 16 Oct, then one patch a day to v2.0 on 24 Oct; no 1.8; the trailer from 25 Oct', () => {
  assert.deepEqual(schedule.versions.map(v => [v.version, v.date]), [
    ['1.0', '2026-10-16'], ['1.1', '2026-10-16'], ['1.2', '2026-10-17'], ['1.3', '2026-10-18'], ['1.4', '2026-10-19'],
    ['1.5', '2026-10-20'], ['1.6', '2026-10-21'], ['1.7', '2026-10-22'], ['1.9', '2026-10-23'], ['2.0', '2026-10-24'],
  ]);
  for (const v of schedule.versions) assert.ok(fs.existsSync(path.join(ROOT, 'dist', `v${v.version}`, 'index.html')), v.version);
  assert.equal(schedule.versions.filter(v => v.short).length, 9, 'every patch has its short; 1.0 has none');
  const at = d => { const p = plan(schedule, d); return [p.released.map(v => v.version).join(' '), p.nextLine, Boolean(p.trailer)]; };
  assert.deepEqual(at('2026-10-16'), ['1.0 1.1', 'Patch 1.2: tomorrow, 19:00 UTC+3.', false]);
  assert.deepEqual(at('2026-10-18'), ['1.0 1.1 1.2 1.3', 'Patch 1.4: tomorrow, 19:00 UTC+3.', false]);
  assert.deepEqual(at('2026-10-22'), ['1.0 1.1 1.2 1.3 1.4 1.5 1.6 1.7', 'Patch 1.9: tomorrow, 19:00 UTC+3.', false]);
  assert.equal(at('2026-10-24')[1], 'That\'s the series. Patch 1.8 is yours: say what\'s missing in the comments.');
  assert.equal(at('2026-10-24')[2], false);
  assert.equal(at('2026-10-26')[2], true, 'the trailer from 25 Oct');
  assert.equal(todayAt(3, Date.parse('2026-10-16T20:59:59Z')), '2026-10-16', 'a fixed UTC+3, not a place');
  assert.equal(todayAt(3, Date.parse('2026-10-16T21:00:00Z')), '2026-10-17');
  assert.equal(formatTime(1104786), '18:24.786');
});

test('the site on 16 Oct: v1.0 and v1.1 only; later versions are not there at all', () => {
  const out = path.join(tempDir('site'), 'site');
  const r = buildSite({ out, today: '2026-10-16' });
  assert.deepEqual(r.versions, ['1.0', '1.1']);
  assert.deepEqual(fs.readdirSync(out).sort(), ['index.html', 'v1.0', 'v1.1']);
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.match(html, /href="v1\.1\/">Play</);
  assert.match(html, /href="https:\/\/youtube\.com\/shorts\/u-KBgk6uRTA">Watch the patch</);
  assert.match(html, /18\.928 s/, 'v1.1\'s measured time to first apple');
  assert.match(html, /Patch 1\.2: tomorrow, 19:00 UTC\+3\./);
  assert.ok(!/<script|https?:\/\/(?!youtube\.com\/shorts\/|github\.com\/codemaskdev\/aaa-snake)/.test(html), 'no scripts, no other hosts');
});

test('every version, copied into the site, opens under /aaa-snake/ and runs; v1.0 plays to its first apple', async () => {
  const out = path.join(tempDir('site'), 'site');
  buildSite({ out, today: '2026-10-24' });
  const server = await startServer({ '/aaa-snake': out });
  const browser = await chromium.launch();
  try {
    const index = await (await fetch(`${server.url}/aaa-snake/`)).text();
    for (const v of schedule.versions) {
      assert.ok(index.includes(`href="v${v.version}/"`), v.version);
      const page = await browser.newPage();
      const errors = [];
      const bad = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
      page.on('request', r => { if (!r.url().startsWith(server.url) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) bad.push(`off-site ${r.url()}`); });
      await page.goto(`${server.url}/aaa-snake/v${v.version}/?seed=1`);
      await page.waitForFunction(() => window.snakeGame && window.snakeGame.log.some(e => e.type === 'frame'), null, { timeout: 30000 });
      assert.equal(await page.evaluate(() => window.snakeGame.version), `v${v.version}`);
      if (v.version === '1.0') {
        for (let i = 0; i < 200 && !(await page.evaluate(() => window.snakeGame.log.some(e => e.type === 'apple'))); i++) {
          const p = await page.evaluate(() => window.snakeGame.probe());
          if (p.screen === 'ready' || p.screen === 'play') {
            const d = decide(p);
            if (p.screen === 'ready' || d !== p.heading) await page.keyboard.press(KEY_FOR[d]);
          }
          await page.waitForTimeout(20);
        }
        assert.ok(await page.evaluate(() => window.snakeGame.log.some(e => e.type === 'apple')), 'v1.0 ate an apple');
      } else {
        await page.waitForTimeout(1500);
      }
      assert.deepEqual(errors, [], `v${v.version}: page errors`);
      assert.deepEqual(bad, [], `v${v.version}: failed or off-site requests`);
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
});
