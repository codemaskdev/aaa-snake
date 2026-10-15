// measurements/summary.csv: one row per version, the medians from measurements/<version>.json.
// Measuring a version again replaces its row; rows stay in version order.
import fs from 'node:fs';

export const COLUMNS = [
  'version',
  'time_to_first_apple_ms',
  'control_share',
  'load_ms',
  'js_lines',
  'code_lines',
  'js_bytes',
  'asset_bytes',
  'build_bytes',
  'download_bytes',
  'heap_used_after_gc_bytes',
  'fps_median',
  'fps_p5',
  'fps_window',
  'runs',
  'measured_at',
  'kind', // since prompt 13: "single run" (during the build) or "median of 5 runs" (npm run measure:final, and v1.0 to v1.6)
];

export const kindOf = runs => (Number(runs) === 1 ? 'single run' : `median of ${runs} runs`);

export function rowFor(result, fpsWindow) {
  const m = result.median;
  return {
    version: result.version,
    time_to_first_apple_ms: m.timeToFirstAppleMs,
    control_share: m.controlShare,
    load_ms: m.loadMs,
    js_lines: result.size.jsLines,
    code_lines: result.size.codeLines,
    js_bytes: result.size.jsBytes,
    asset_bytes: result.size.assetBytes,
    build_bytes: result.size.buildBytes,
    download_bytes: m.downloadBytes,
    heap_used_after_gc_bytes: m.heapUsedAfterGcBytes,
    fps_median: m.fpsMedian,
    fps_p5: m.fpsP5,
    fps_window: fpsWindow,
    runs: result.settings.runs,
    measured_at: result.measuredAt,
    kind: kindOf(result.settings.runs) + (result.median.endedAtMs ? ` / game ended at ${result.median.endedAtMs / 1000} s` : ''),
  };
}

export function parseCsv(text) {
  const [head, ...rows] = text.trim().split('\n');
  const cols = head.split(',');
  return rows.filter(Boolean).map(line => {
    const cells = line.split(',');
    return Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
  });
}

function versionKey(v) {
  const m = /^v(\d+)\.(\d+)$/.exec(v);
  return m ? Number(m[1]) * 1000 + Number(m[2]) : Infinity;
}

export function upsertSummary(file, result, fpsWindow) {
  const rows = fs.existsSync(file) ? parseCsv(fs.readFileSync(file, 'utf8')) : [];
  const row = rowFor(result, fpsWindow);
  const kept = rows.filter(r => r.version !== row.version).map(r => ({ ...r, kind: r.kind || kindOf(r.runs) }));
  kept.push(Object.fromEntries(COLUMNS.map(c => [c, row[c] === null || row[c] === undefined ? '' : String(row[c])])));
  kept.sort((a, b) => versionKey(a.version) - versionKey(b.version) || a.version.localeCompare(b.version));
  const text = [COLUMNS.join(','), ...kept.map(r => COLUMNS.map(c => r[c] ?? '').join(','))].join('\n') + '\n';
  fs.writeFileSync(file, text);
  return kept;
}
