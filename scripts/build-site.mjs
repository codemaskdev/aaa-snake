// `npm run build-site`: the GitHub Pages site, one patch a day (release-schedule.json).
// "Today" is the calendar date at a fixed UTC offset (utcOffsetHours, 3), or RELEASE_TODAY=YYYY-MM-DD to test.
// site/v<version>/ is a copy of dist/v<version>/ for every version whose date is today or earlier; a version not
// released yet is not copied at all, so its URL is a 404 until its day. site/index.html lists the released versions,
// oldest first, with the measured time to first apple (measurements/summary.csv), and names the next patch.
// Plain HTML and CSS: no scripts, no analytics, no fonts from anywhere else. No dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export function todayAt(offsetHours, now = Date.now()) {
  return new Date(now + offsetHours * 3600 * 1000).toISOString().slice(0, 10);
}

const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

// Like the counters in the shorts: seconds with three decimals, minutes past a minute.
export function formatTime(ms) {
  const total = Math.max(0, ms) / 1000;
  if (total < 60) return `${total.toFixed(3)} s`;
  const minutes = Math.floor(total / 60);
  return `${minutes}:${(total - minutes * 60).toFixed(3).padStart(6, '0')}`;
}

export function firstApples(csv) {
  const [head, ...rows] = csv.trim().split('\n').map(line => line.split(','));
  const at = head.indexOf('time_to_first_apple_ms');
  return Object.fromEntries(rows.map(r => [r[0], Number(r[at])]));
}

const escape = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// What the site shows on a given day.
export function plan(schedule, today) {
  const released = schedule.versions.filter(v => v.date <= today).sort((a, b) => a.date.localeCompare(b.date) || a.version.localeCompare(b.version, 'en', { numeric: true }));
  const next = schedule.versions.filter(v => v.date > today).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  let nextLine;
  if (!next) nextLine = 'That\'s the series. Patch 1.8 is yours: say what\'s missing in the comments.';
  else if (next.date === addDays(today, 1)) nextLine = `Patch ${next.version}: tomorrow, ${schedule.releaseTime}.`;
  else nextLine = `Patch ${next.version}: ${next.date}, ${schedule.releaseTime}.`;
  const trailer = schedule.series?.trailer && schedule.series.trailer.date <= today ? schedule.series.trailer : null;
  return { released, next, nextLine, trailer };
}

export function indexHtml(schedule, today, apples) {
  const { released, nextLine, trailer } = plan(schedule, today);
  const rows = released.map(v => {
    const ms = apples[`v${v.version}`];
    return `      <tr>
        <td class="v">${escape(v.version)}</td>
        <td>${escape(v.name)}</td>
        <td class="t">${ms === undefined ? '' : escape(formatTime(ms))}</td>
        <td><a href="v${escape(v.version)}/">Play</a></td>
        <td>${v.short ? `<a href="${escape(v.short)}">Watch the patch</a>` : ''}</td>
      </tr>`;
  }).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AAA Snake</title>
<link rel="icon" href="data:,">
<style>
  :root { color-scheme: dark; --bg: #0b0d13; --panel: #141824; --line: #262c3d; --text: #e8ecf5; --muted: #8a93a8; --cyan: #00f0ff; --yellow: #ffd23f; }
  html { background: var(--bg); }
  body { margin: 0 auto; max-width: 760px; padding: 32px 16px 48px; color: var(--text); background: var(--bg);
    font: 16px/1.5 -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif; }
  h1 { margin: 0 0 8px; font-size: 32px; }
  p { margin: 12px 0; }
  a { color: var(--cyan); }
  .table { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; background: var(--panel); border: 1px solid var(--line); }
  th, td { padding: 10px 12px; border-bottom: 1px solid var(--line); text-align: left; white-space: nowrap; }
  th { color: var(--muted); font-weight: 600; font-size: 14px; }
  td.v, td.t { font-family: Menlo, Consolas, monospace; }
  td.t { color: var(--yellow); }
  .next { color: var(--muted); }
  footer { margin-top: 40px; color: var(--muted); font-size: 14px; }
</style>
</head>
<body>
  <h1>AAA Snake</h1>
  <p>I'm turning Snake into a AAA game, one industry habit per patch, one patch a day. Every patch is real code; every number is a real measurement.</p>
  <div class="table">
  <table>
    <thead>
      <tr><th>Version</th><th>Patch</th><th>Time to first apple</th><th></th><th></th></tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
  </div>
  <p class="next">${escape(nextLine)}</p>
${trailer ? `  <p><a href="${escape(trailer.url)}">Watch the series trailer</a></p>\n` : ''}  <footer>
    <p>A parody: nothing in these games is for sale. The voices are synthetic. Time to first apple is measured by the same rig for every version; every run is in the repository.</p>
    <p><a href="${escape(schedule.repository)}">The code, the prompts and the studio diary</a></p>
  </footer>
</body>
</html>
`;
}

export function buildSite({ root = ROOT, out = path.join(ROOT, 'site'), today } = {}) {
  const schedule = JSON.parse(fs.readFileSync(path.join(root, 'release-schedule.json'), 'utf8'));
  const day = today || todayAt(schedule.utcOffsetHours);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`RELEASE_TODAY must be YYYY-MM-DD, not ${day}`);
  const apples = firstApples(fs.readFileSync(path.join(root, 'measurements/summary.csv'), 'utf8'));
  const { released, nextLine, trailer } = plan(schedule, day);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const v of released) {
    const from = path.join(root, 'dist', `v${v.version}`);
    if (!fs.existsSync(path.join(from, 'index.html'))) throw new Error(`dist/v${v.version}/ has no index.html`);
    fs.cpSync(from, path.join(out, `v${v.version}`), { recursive: true });
  }
  fs.writeFileSync(path.join(out, 'index.html'), indexHtml(schedule, day, apples));
  return { today: day, versions: released.map(v => v.version), nextLine, trailer: Boolean(trailer) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = buildSite({ today: process.env.RELEASE_TODAY || undefined });
  console.log(`site/ for ${result.today} (UTC+3): ${result.versions.map(v => `v${v}`).join(', ')}`);
  console.log(`next: ${result.nextLine}`);
  console.log(`trailer link: ${result.trailer ? 'yes' : 'no'}`);
}
