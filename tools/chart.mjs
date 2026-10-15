// `npm run chart`: the bloat chart. Reads measurements/summary.csv and renders
// out/bloat.png (1920 x 1080): one small panel per metric, versions along the bottom.
// Every value comes from the CSV; the labels show it shortened for reading,
// the CSV keeps it exact.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { parseCsv } from './rig/summary.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const W = 1920;
const H = 1080;
const C = { bg: '#0b0d13', panel: '#121622', grid: '#232a3a', axis: '#3a4357', text: '#e8ecf5', muted: '#8a93a8', line: '#00f0ff', ref: '#ffd23f' };

// Each panel: a column of the CSV, how to show it, and an optional budget line.
export const PANELS = [
  { col: 'time_to_first_apple_ms', title: 'Time to first apple', unit: 's', scale: v => v / 1000, fmt: v => `${v.toFixed(2)} s` },
  { col: 'control_share', title: 'Control share', unit: '%', scale: v => v * 100, fmt: v => `${v.toFixed(2)} %`, max: 100 },
  { col: 'load_ms', title: 'Load time', unit: 'ms', scale: v => v, fmt: v => `${v.toFixed(0)} ms` },
  { col: 'download_bytes', title: 'Download', unit: 'KB', scale: v => v / 1000, fmt: v => `${v.toFixed(1)} KB` },
  { col: 'heap_used_after_gc_bytes', title: 'JS heap after 60 s of play', unit: 'MB', scale: v => v / 1e6, fmt: v => `${v.toFixed(2)} MB` },
  { col: 'js_lines', title: 'Lines of JS', unit: 'lines', scale: v => v, fmt: v => `${v.toFixed(0)}` },
  { col: 'fps_median', title: 'Frame rate, median', unit: 'fps', scale: v => v, fmt: v => `${v.toFixed(1)} fps`, ref: 50, min60: true },
  { col: 'fps_p5', title: 'Frame rate, 5th percentile', unit: 'fps', scale: v => v, fmt: v => `${v.toFixed(1)} fps`, ref: 30, min60: true },
];

// Round axis maximum and 4 tick steps that read well (1, 2, 2.5, 5 x 10^n).
export function niceMax(value) {
  if (!(value > 0)) return 1;
  const raw = value / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(s => s * pow).find(s => s >= raw);
  return step * 4;
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function renderSvg(rows) {
  const cols = 4;
  const pad = { outer: 48, top: 130 };
  const gap = 28;
  const pw = (W - pad.outer * 2 - gap * (cols - 1)) / cols;
  const ph = (H - pad.top - pad.outer - gap) / 2;
  const versions = rows.map(r => r.version);
  // Since prompt 15: a version whose game ended before 60 s of control says so, with the time.
  const ended = rows.filter(r => (r.kind || '').includes('game ended')).map(r => `${r.version}: ${r.kind.slice(r.kind.indexOf('game ended'))}`);
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">`;
  out += `<rect width="${W}" height="${H}" fill="${C.bg}"/>`;
  out += `<text x="${pad.outer}" y="74" font-size="44" font-weight="700" fill="${C.text}">The bloat chart</text>`;
  out += `<text x="${pad.outer}" y="108" font-size="22" fill="${C.muted}">AAA Snake, every metric by version: medians of 5 runs; * a single run${ended.length ? `; † ${ended.join(', ')}` : ''} (measurements/summary.csv).</text>`;

  PANELS.forEach((p, i) => {
    const x0 = pad.outer + (i % cols) * (pw + gap);
    const y0 = pad.top + Math.floor(i / cols) * (ph + gap);
    const plot = { x: x0 + 70, y: y0 + 104, w: pw - 100, h: ph - 150 };
    const values = rows.map(r => (r[p.col] === '' || r[p.col] === undefined ? null : p.scale(Number(r[p.col]))));
    const known = values.filter(v => v !== null);
    const top = p.max ?? niceMax(Math.max(...known, p.ref ?? 0, p.min60 ? 60 : 0, 0));
    const yOf = v => plot.y + plot.h - (v / top) * plot.h;
    const xOf = j => (versions.length === 1 ? plot.x + plot.w / 2 : plot.x + (j / (versions.length - 1)) * plot.w);

    out += `<rect x="${x0}" y="${y0}" width="${pw}" height="${ph}" rx="14" fill="${C.panel}"/>`;
    out += `<text x="${x0 + 22}" y="${y0 + 40}" font-size="24" font-weight="700" fill="${C.text}">${esc(p.title)} <tspan font-weight="400" fill="${C.muted}">(${esc(p.unit)})</tspan></text>`;
    for (let k = 0; k <= 4; k++) {
      const v = (top / 4) * k;
      const y = yOf(v);
      out += `<line x1="${plot.x}" x2="${plot.x + plot.w}" y1="${y}" y2="${y}" stroke="${k === 0 ? C.axis : C.grid}" stroke-width="1"/>`;
      out += `<text x="${plot.x - 10}" y="${y + 6}" font-size="16" fill="${C.muted}" text-anchor="end">${+v.toFixed(2)}</text>`;
    }
    if (p.ref !== undefined) {
      const y = yOf(p.ref);
      out += `<line x1="${plot.x}" x2="${plot.x + plot.w}" y1="${y}" y2="${y}" stroke="${C.ref}" stroke-width="2" stroke-dasharray="6 6"/>`;
      out += `<text x="${plot.x + plot.w}" y="${y - 8}" font-size="15" fill="${C.muted}" text-anchor="end">budget ${p.ref}</text>`;
    }
    versions.forEach((v, j) => {
      // Every other label one line lower, so ten versions' labels (and their marks) do not run into each other.
      out += `<text x="${xOf(j)}" y="${plot.y + plot.h + 24 + (j % 2) * 18}" font-size="15" fill="${C.muted}" text-anchor="middle">${esc(v)}${(rows[j].kind || '').startsWith('single run') ? '*' : ''}${(rows[j].kind || '').includes('game ended') ? '†' : ''}</text>`;
    });
    const pts = values.map((v, j) => (v === null ? null : [xOf(j), yOf(v)]));
    const path = pts.filter(Boolean).map((pt, j) => `${j ? 'L' : 'M'}${pt[0]},${pt[1]}`).join(' ');
    if (known.length > 1) out += `<path d="${path}" fill="none" stroke="${C.line}" stroke-width="2"/>`;
    pts.forEach(pt => {
      if (pt) out += `<circle cx="${pt[0]}" cy="${pt[1]}" r="6" fill="${C.line}" stroke="${C.panel}" stroke-width="2"/>`;
    });
    // The latest value goes under the title, clear of the line.
    const lastIndex = values.map(v => v !== null).lastIndexOf(true);
    if (lastIndex >= 0) {
      out += `<text x="${x0 + 22}" y="${y0 + 74}" font-size="26" font-weight="700" fill="${C.text}">${esc(p.fmt(values[lastIndex]))} <tspan font-size="16" font-weight="400" fill="${C.muted}">${esc(versions[lastIndex])}</tspan></text>`;
    }
  });
  return out + '</svg>';
}

export async function renderPng(svg, file) {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file });
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const csv = path.join(ROOT, 'measurements/summary.csv');
  const rows = parseCsv(fs.readFileSync(csv, 'utf8'));
  await renderPng(renderSvg(rows), path.join(ROOT, 'out/bloat.png'));
  console.log(`wrote out/bloat.png from measurements/summary.csv (${rows.length} version${rows.length === 1 ? '' : 's'}: ${rows.map(r => r.version).join(', ')})`);
}
