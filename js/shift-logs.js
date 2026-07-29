import { state, dom } from './state.js';
import { escHtml, fmtDate } from './utils.js';

function parseShiftDate(str) {
  const m = String(str || '').trim().match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/
  );
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const year = parseInt(m[3], 10);
  const hour = parseInt(m[4], 10);
  const minute = parseInt(m[5], 10);
  const second = parseInt(m[6], 10);
  const d = new Date(year, month, day, hour, minute, second);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatShiftDateTime(d) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  const second = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
}

function formatDurationLabel(totalSeconds) {
  const sec = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  const parts = [];
  if (hours) parts.push(`${hours} jam`);
  if (minutes) parts.push(`${minutes} menit`);
  if (!hours && !minutes) parts.push(`${seconds} detik`);
  return parts.join(' ') || '0 menit';
}

export function parseShiftLogs(text) {
  const blocks = String(text || '').split(/SHIFT\s+LOGS/i).slice(1);
  const shifts = [];

  for (const block of blocks) {
    const name = block.match(/Name:\s*(.+)/i)?.[1]?.trim();
    const identifier = block.match(/Identifier:\s*(.+)/i)?.[1]?.trim() || '';
    const startRaw = block.match(/Start date:\s*(.+)/i)?.[1]?.trim();
    const endRaw = block.match(/End date:\s*(.+)/i)?.[1]?.trim();
    if (!name || !startRaw || !endRaw) continue;

    const start = parseShiftDate(startRaw);
    const end = parseShiftDate(endRaw);
    if (!start || !end || end < start) continue;

    const durationSeconds = Math.round((end.getTime() - start.getTime()) / 1000);
    shifts.push({
      name,
      identifier,
      start,
      end,
      startStr: formatShiftDateTime(start),
      endStr: formatShiftDateTime(end),
      durationSeconds,
      durationMinutes: Math.round((durationSeconds / 60) * 100) / 100,
      durationLabel: formatDurationLabel(durationSeconds),
    });
  }

  shifts.sort((a, b) => b.end.getTime() - a.end.getTime());
  return shifts;
}

export function getShiftLogFilters() {
  const minEl = dom.formArea.querySelector('[data-field="min_minutes"]');
  const fromEl = dom.formArea.querySelector('[data-field="date_from"]');
  const toEl = dom.formArea.querySelector('[data-field="date_to"]');
  const minMinutes = parseFloat(minEl?.value ?? '5');
  return {
    minMinutes: Number.isFinite(minMinutes) ? Math.max(0, minMinutes) : 5,
    dateFrom: fromEl?.value || '',
    dateTo: toEl?.value || '',
  };
}

export function filterShiftLogs(shifts, filters) {
  const minSeconds = (filters.minMinutes || 0) * 60;
  let fromTs = null;
  let toTs = null;

  if (filters.dateFrom) {
    const [y, m, d] = filters.dateFrom.split('-').map(Number);
    fromTs = new Date(y, m - 1, d, 0, 0, 0).getTime();
  }
  if (filters.dateTo) {
    const [y, m, d] = filters.dateTo.split('-').map(Number);
    toTs = new Date(y, m - 1, d, 23, 59, 59).getTime();
  }

  return shifts.filter(s => {
    if (s.durationSeconds < minSeconds) return false;
    const t = s.start.getTime();
    if (fromTs !== null && t < fromTs) return false;
    if (toTs !== null && t > toTs) return false;
    return true;
  });
}

export function summarizeShiftLogs(shifts) {
  const totalSeconds = shifts.reduce((sum, s) => sum + s.durationSeconds, 0);
  const names = [...new Set(shifts.map(s => s.name))];
  let earliest = null;
  let latest = null;
  for (const s of shifts) {
    if (!earliest || s.start < earliest) earliest = s.start;
    if (!latest || s.end > latest) latest = s.end;
  }
  return {
    count: shifts.length,
    totalSeconds,
    totalLabel: formatDurationLabel(totalSeconds),
    totalMinutes: Math.round((totalSeconds / 60) * 100) / 100,
    names,
    earliest,
    latest,
    spanLabel: earliest && latest
      ? `${formatShiftDateTime(earliest)} → ${formatShiftDateTime(latest)}`
      : '—',
  };
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildShiftLogsCsv(shifts, summary) {
  const header = [
    'Name',
    'Identifier',
    'Start',
    'End',
    'Duration (minutes)',
    'Duration (label)',
  ];
  const rows = shifts.map(s => [
    s.name,
    s.identifier,
    s.startStr,
    s.endStr,
    s.durationMinutes,
    s.durationLabel,
  ]);
  rows.push([
    'TOTAL',
    '',
    summary.earliest ? formatShiftDateTime(summary.earliest) : '',
    summary.latest ? formatShiftDateTime(summary.latest) : '',
    summary.totalMinutes,
    summary.totalLabel,
  ]);
  return [header, ...rows]
    .map(cols => cols.map(csvEscape).join(','))
    .join('\n');
}

export function downloadShiftLogsCsv(shifts, summary) {
  const csv = buildShiftLogsCsv(shifts, summary);
  const stamp = fmtDate(new Date()).replace(/\//g, '');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shift-logs-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function resetShiftCopyButton() {
  dom.btnCopy.classList.remove('copied');
  dom.btnCopy.innerHTML = '📋 Copy';
  dom.btnCopy.disabled = true;
}

export function setShiftExportButton(enabled) {
  dom.btnCopy.classList.remove('copied');
  dom.btnCopy.innerHTML = '⬇ Export CSV';
  dom.btnCopy.disabled = !enabled;
}

export function updateShiftLogsPreview() {
  const logEl = dom.formArea.querySelector('[data-field="shift_log"]');
  const raw = logEl?.value || '';
  const filters = getShiftLogFilters();
  const parsed = parseShiftLogs(raw);
  const filtered = filterShiftLogs(parsed, filters);
  state.lastShiftRows = filtered;

  if (!raw.trim()) {
    state.lastShiftRows = [];
    dom.charCounter.innerHTML = '0 shift';
    setShiftExportButton(false);
    dom.previewBody.innerHTML = `
      <div class="preview-empty">
        <div class="preview-empty-icon">⏱️</div>
        <div>Tempel atau upload log Discord<br>SHIFT LOGS untuk dihitung.</div>
      </div>`;
    return;
  }

  if (!parsed.length) {
    state.lastShiftRows = [];
    dom.charCounter.innerHTML = '0 shift';
    setShiftExportButton(false);
    dom.previewBody.innerHTML = `
      <div class="preview-empty">
        <div class="preview-empty-icon">⚠️</div>
        <div>Tidak ada blok SHIFT LOGS<br>yang bisa diparse.</div>
      </div>`;
    return;
  }

  const summary = summarizeShiftLogs(filtered);
  const skipped = parsed.length - filtered.length;
  dom.charCounter.innerHTML = `<span>${summary.count}</span> shift`;
  setShiftExportButton(summary.count > 0);

  const namesHtml = summary.names.length
    ? summary.names.map(n => `<span class="shift-chip">${escHtml(n)}</span>`).join('')
    : '<span class="shift-chip">—</span>';

  const skipNote = skipped > 0
    ? `<div class="result-summary-note">${skipped} shift disembunyikan oleh filter</div>`
    : '';

  const cardsHtml = filtered.length
    ? filtered.map(s => `
        <div class="shift-card">
          <div class="shift-card-top">
            <div class="shift-card-title">SHIFT LOGS</div>
            <div class="shift-card-badge">${escHtml(s.durationLabel)}</div>
          </div>
          <div class="shift-card-name">${escHtml(s.name)}</div>
          <div class="shift-card-id">${escHtml(s.identifier || '—')}</div>
          <div class="shift-card-times">
            <div><span>Start</span>${escHtml(s.startStr)}</div>
            <div><span>End</span>${escHtml(s.endStr)}</div>
          </div>
        </div>`).join('')
    : `<div class="preview-empty" style="height:auto;padding:24px 0">
        <div>Semua shift tersaring filter saat ini.</div>
      </div>`;

  dom.previewBody.innerHTML = `
    <div class="shift-preview">
      <div class="result-summary shift-summary">
        <div class="shift-summary-names">${namesHtml}</div>
        <div class="result-summary-row">
          <span class="result-summary-label">Jumlah Shift</span>
          <span class="result-summary-value">${summary.count}</span>
        </div>
        <div class="result-summary-row">
          <span class="result-summary-label">Total Durasi</span>
          <span class="result-summary-value">${escHtml(summary.totalLabel)}</span>
        </div>
        <div class="result-summary-row">
          <span class="result-summary-label">Rentang</span>
          <span class="result-summary-value shift-summary-span">${escHtml(summary.spanLabel)}</span>
        </div>
        ${skipNote}
      </div>
      <div class="shift-card-list">${cardsHtml}</div>
    </div>`;
}
