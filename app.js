/* ============================================================
   KotaKita Discord Message Generator
   Pure vanilla JS — no frameworks, no build tools
   ============================================================ */

'use strict';

// ── State
let activeTpl = null;
let barangEntries = [{ nama: '', jumlah: '' }];
let pasalEntries = [{ kode: '' }];
let uuData = null;
let pasalList = [];
let pasalLookup = {};
const MAX_PENJARA = 40;

const KEPERLUAN_LIST = [
  { nama: 'Operasi Plastik', harga: 160000 },
  { nama: 'Pergantian KTP', harga: 375000 },
  { nama: 'Pembuatan Kartu Keluarga', harga: 205000 },
  { nama: 'Ahli Nikah', harga: 155000 },
  { nama: 'Visa Luar Negeri', harga: 135000 },
  { nama: 'Pembuatan Usaha', harga: 5000000 },
  { nama: 'Sewa Lahan', harga: 2500000 },
  {
    nama: 'Melamar Pekerjaan (Instansi, Pekerja EO, Perpanjangan Kontrak Karyawan EO, Swasta)',
    harga: 105000,
  },
];

// ── DOM refs
const sidebar    = document.getElementById('sidebar');
const formArea   = document.getElementById('formArea');
const formTitle  = document.getElementById('formTitle');
const formDesc   = document.getElementById('formDesc');
const btnClear   = document.getElementById('btnClear');
const previewBody = document.getElementById('previewBody');
const charCounter = document.getElementById('charCounter');
const btnCopy    = document.getElementById('btnCopy');
const toast      = document.getElementById('toast');
const overlay    = document.getElementById('overlay');
const menuBtn    = document.getElementById('menuBtn');
const previewBtn = document.getElementById('previewBtn');
const previewEl  = document.getElementById('preview');

// ── Template definitions
const TEMPLATES = {
  barang: {
    title: 'Barang Bukti',
    desc:  'Generate laporan barang bukti dari suspect.',
    icon:  '📦',
    fields: ['nama_suspect', 'keterangan', '_barang'],
  },
  peluru: {
    title: 'Pengambilan Clip',
    desc:  'Generate form pengambilan klip peluru.',
    icon:  '🎬',
    fields: ['nama', 'jenis_peluru', 'jumlah_peluru', 'status'],
  },
  'senjata-apd': {
    title: 'Senjata APD',
    desc:  'Generate laporan senjata APD.',
    icon:  '🛡️',
    fields: ['nama', 'serial_number'],
  },
  'senjata-ilegal': {
    title: 'Senjata Ilegal',
    desc:  'Generate laporan senjata ilegal.',
    icon:  '⚠️',
    fields: ['nama_suspect', 'serial_number', 'keterangan'],
  },
  pasal: {
    title: 'Pasal',
    desc:  'Generate daftar pasal, invoice, dan masa penjara.',
    icon:  '⚖️',
    fields: ['nama_suspect', '_pasal'],
  },
  skck: {
    title: 'SKCK',
    desc:  'Generate Surat Keterangan Catatan Kepolisian.',
    icon:  '📄',
    fields: ['record_type', 'identitas', 'keperluan', '_pasal'],
  },
  'shift-logs': {
    title: 'Shift Logs',
    desc:  'Parse log Discord KOTAKITA SHIFT LOGS, hitung total durasi, dan export CSV.',
    icon:  '⏱️',
    fields: ['shift_log', 'min_minutes', 'date_from', 'date_to'],
  },
};

/** @type {{ name: string, identifier: string, start: Date, end: Date, startStr: string, endStr: string, durationSeconds: number, durationMinutes: number, durationLabel: string }[]} */
let lastShiftRows = [];

function upperStr(v) {
  return typeof v === 'string' ? v.toUpperCase() : v;
}

function enforceUppercase(e) {
  const el = e.target;
  if (el.tagName !== 'INPUT' || el.type !== 'text') return;
  if (el.classList.contains('pasal-combobox-input')) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const upper = el.value.toUpperCase();
  if (el.value !== upper) {
    el.value = upper;
    el.setSelectionRange(start, end);
  }
}

// ── Undang-undang data
async function loadUndangUndang() {
  try {
    const res = await fetch('undang-undang.json');
    if (!res.ok) throw new Error('fetch failed');
    uuData = await res.json();
    pasalList = [];
    pasalLookup = {};
    for (const kat of uuData.kategori) {
      for (const p of kat.pasal) {
        const item = { ...p, kategori: kat.kategori };
        pasalList.push(item);
        pasalLookup[p.kode] = item;
      }
    }
  } catch {
    uuData = null;
    pasalList = [];
    pasalLookup = {};
  }
}

function pasalLabel(kode) {
  const p = pasalLookup[kode];
  return p ? `${p.kode} — ${p.pelanggaran}` : '';
}

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatKK(n) {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n) + ' $KK';
}

function fmtDate(d) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function getSkckDates() {
  const today = new Date();
  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + 7);
  return { today, validUntil };
}

function getKeperluanByIndex(idx) {
  const i = parseInt(idx, 10);
  return Number.isFinite(i) && KEPERLUAN_LIST[i] ? KEPERLUAN_LIST[i] : null;
}

function isSkckCriminal(recordType) {
  return recordType === 'MEMILIKI CATATAN KRIMINAL';
}

function filterPasal(query) {
  const q = query.trim().toLowerCase();
  if (!q) return pasalList.slice();
  return pasalList.filter(p =>
    p.kode.toLowerCase().includes(q) ||
    p.pelanggaran.toLowerCase().includes(q) ||
    p.kategori.toLowerCase().includes(q)
  );
}

function parsePenjaraBulan(str) {
  if (!str) return 0;
  const m = String(str).match(/(\d+)\s*bulan/i);
  return m ? parseInt(m[1], 10) : 0;
}

function calcPasalResults(pasalObjects) {
  const numerics = pasalObjects
    .map(p => p.denda)
    .filter(d => typeof d === 'number');
  let baseInvoice = numerics.length ? Math.max(...numerics) : 0;
  const has2xInvoice = pasalObjects.some(p =>
    typeof p.denda === 'string' && /2\s*x\s*invoice/i.test(p.denda));
  if (has2xInvoice) baseInvoice *= 2;

  let rawBulan = pasalObjects.reduce((sum, p) => sum + parsePenjaraBulan(p.penjara), 0);
  const hasDpo = pasalObjects.some(p =>
    typeof p.penjara === 'string' && /x2\s*masa\s*tahanan/i.test(p.penjara));
  if (hasDpo) rawBulan *= 2;
  const penjaraBulan = Math.min(rawBulan, MAX_PENJARA);

  return {
    invoice: baseInvoice,
    has2xInvoice,
    rawBulan,
    penjaraBulan,
    capped: rawBulan > MAX_PENJARA,
    hasDpo,
    only2xNoBase: has2xInvoice && numerics.length === 0,
  };
}

function getSelectedPasalObjects(entries) {
  const seen = new Set();
  const result = [];
  for (const e of entries) {
    const kode = e.kode || '';
    if (!kode || seen.has(kode)) continue;
    const p = pasalLookup[kode];
    if (p) {
      seen.add(kode);
      result.push(p);
    }
  }
  return result;
}

function formatPasalNames(pasalObjects) {
  const seen = new Set();
  const names = [];
  for (const p of pasalObjects) {
    const name = upperStr(p.pelanggaran);
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names.join(', ') || '—';
}

function normalizePasalFormInputs() {
  const suspectEl = formArea.querySelector('[data-field="nama_suspect"]');
  if (suspectEl) suspectEl.value = upperStr(suspectEl.value);
}

function buildPasalOutputs(vals) {
  const pasalObjects = getSelectedPasalObjects(vals._pasal || []);
  const names = formatPasalNames(pasalObjects);
  const suspect = (vals.nama_suspect || '').trim() ? upperStr(vals.nama_suspect) : '—';
  const format1Body = `${suspect} | ${names}`;
  const format2Body = names;
  return {
    pasalObjects,
    format1: '```\n' + format1Body + '\n```',
    format2: format2Body,
    calc: calcPasalResults(pasalObjects),
  };
}

// ── Format output for each template (exact spacing as spec)
function formatOutput(tpl, vals) {
  let body = '';
  switch (tpl) {
    case 'barang': {
      const barangStr = (vals._barang || [])
        .filter(b => b.nama.trim())
        .map(b => `${b.nama.trim()} (${b.jumlah || 0}x)`)
        .join(', ') || '—';
      body =
        `NAMA SUSPECT    : ${vals.nama_suspect || '—'}\n` +
        `JENIS BARANG    : ${barangStr}\n` +
        `KETERANGAN      : BB ${vals.keterangan || '—'}`;
      break;
    }
    case 'peluru':
      body =
        `NAMA LENGKAP  : ${vals.nama || '—'}\n` +
        `JENIS PELURU  : ${vals.jenis_peluru || '—'}\n` +
        `JUMLAH PELURU : ${vals.jumlah_peluru || '—'} paket\n` +
        `STATUS        : ${vals.status || '—'}`;
      break;
    case 'senjata-apd':
      body =
        `NAMA            : ${vals.nama || '—'}\n` +
        `SERIAL NUMBER   : ${vals.serial_number || '—'}\n` +
        `KETERANGAN      : BB WD APD`;
      break;
    case 'senjata-ilegal':
      body =
        `NAMA SUSPECT    : ${vals.nama_suspect || '—'}\n` +
        `SERIAL NUMBER   : ${vals.serial_number || '—'}\n` +
        `KETERANGAN      : BB ${vals.keterangan || '—'}`;
      break;
    case 'skck':
      return buildSkckOutput(vals).output;
    default:
      return '';
  }
  if (!body) return '';
  return '```\n' + body + '\n```';
}

function buildSkckOutput(vals) {
  const { today, validUntil } = getSkckDates();
  const tercatat = fmtDate(today);
  const sampai = fmtDate(validUntil);
  const dikeluarkan = fmtDate(today);

  const identitas = (vals.identitas || '').trim();
  const keperluan = getKeperluanByIndex(vals.keperluan);
  const keperluanNama = keperluan ? keperluan.nama : '—';

  const criminal = isSkckCriminal(vals.record_type);
  const pasalObjects = criminal ? getSelectedPasalObjects(vals._pasal || []) : [];

  let catatanBlock;
  if (criminal) {
    const lines = pasalObjects.map(p => `- PASAL ${p.kode}, ${upperStr(p.pelanggaran)}`);
    catatanBlock =
      `BAHWASANNYA NAMA TERSEBUT DIATAS MEMILIKI CATATAN ATAU KETERLIBATAN DALAM KEGIATAN KEJAHATAN ATAU CATATAN KRIMINAL RINGAN YG TERCANTUM SEBAGAI BERIKUT:\n\n` +
      `Catatan : \n` +
      (lines.length ? lines.join('\n') : '-');
  } else {
    catatanBlock =
      `BAHWASANNYA NAMA TERSEBUT DIATAS TIDAK MEMILIKI CATATAN ATAU KETERLIBATAN DALAM KEGIATAN KEJAHATAN ATAU KRIMINAL APAPUN.\n\n` +
      `Catatan : -`;
  }

  const body =
    `SURAT KETERANGAN CATATAN KEPOLISIAN\n` +
    `---------------------------------------------------------------------\n` +
    `        POLICE RECORD\n\n` +
    (identitas ? identitas + '\n' : '') +
    `KEPERLUAN : ${keperluanNama}\n\n` +
    `TERCATAT PER TANGGAL ${tercatat}, \n` +
    `SAMPAI DENGAN. ${sampai}\n\n` +
    catatanBlock + `\n\n` +
    `BERIKUT SURAT INI DIBUAT DARI PIHAK KEPOLISIAN KOTA KITA, DIANJURKAN UNTUK MELAKUKAN PEMERIKSAAN SECARA BERKALA PER SURAT INI DIGUNAKAN KARENA BISA SAJA ADA PERUBAHAN SETELAH PEMBUATAN SKCK. TERTANDA, KEPOLISIAN KOTA KITA.\n\n` +
    `                    DIKELUARKAN DI : KOTA KITA\n` +
    ` (${dikeluarkan})\n` +
    `                    MENGETAHUI.\n` +
    `PERTIKA KUNCORO DININGRAT`;

  return {
    body,
    output: body,
    keperluan,
    pasalObjects,
  };
}

// ── Collect current form values
function collectValues() {
  const vals = {};
  formArea.querySelectorAll('[data-field]').forEach(el => {
    const v = el.value;
    if (el.tagName === 'TEXTAREA') {
      vals[el.dataset.field] = v;
    } else if (el.tagName === 'SELECT') {
      vals[el.dataset.field] = el.dataset.field === 'keperluan' ? v : upperStr(v);
    } else if (el.tagName === 'INPUT' && el.type === 'text') {
      vals[el.dataset.field] = upperStr(v);
    } else {
      vals[el.dataset.field] = v;
    }
  });
  if (activeTpl === 'barang') {
    vals._barang = barangEntries.map((_, i) => {
      const namaEl  = formArea.querySelector(`[data-barang-nama="${i}"]`);
      const jumlahEl = formArea.querySelector(`[data-barang-jumlah="${i}"]`);
      return {
        nama:   namaEl   ? upperStr(namaEl.value)   : '',
        jumlah: jumlahEl ? jumlahEl.value : '',
      };
    });
  }
  if (activeTpl === 'pasal' || activeTpl === 'skck') {
    vals._pasal = syncPasalEntriesFromDOM();
  }
  return vals;
}

function syncPasalEntriesFromDOM() {
  return [...formArea.querySelectorAll('[data-pasal-wrap]')].map(wrap => ({
    kode: wrap.dataset.pasalKode || '',
  }));
}

// ── Shift logs parser
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

function parseShiftLogs(text) {
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

function getShiftLogFilters() {
  const minEl = formArea.querySelector('[data-field="min_minutes"]');
  const fromEl = formArea.querySelector('[data-field="date_from"]');
  const toEl = formArea.querySelector('[data-field="date_to"]');
  const minMinutes = parseFloat(minEl?.value ?? '5');
  return {
    minMinutes: Number.isFinite(minMinutes) ? Math.max(0, minMinutes) : 5,
    dateFrom: fromEl?.value || '',
    dateTo: toEl?.value || '',
  };
}

function filterShiftLogs(shifts, filters) {
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

function summarizeShiftLogs(shifts) {
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

function buildShiftLogsCsv(shifts, summary) {
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

function downloadShiftLogsCsv(shifts, summary) {
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

function resetShiftCopyButton() {
  btnCopy.classList.remove('copied');
  btnCopy.innerHTML = '📋 Copy';
  btnCopy.disabled = true;
}

function setShiftExportButton(enabled) {
  btnCopy.classList.remove('copied');
  btnCopy.innerHTML = '⬇ Export CSV';
  btnCopy.disabled = !enabled;
}

function updateShiftLogsPreview() {
  const logEl = formArea.querySelector('[data-field="shift_log"]');
  const raw = logEl?.value || '';
  const filters = getShiftLogFilters();
  const parsed = parseShiftLogs(raw);
  const filtered = filterShiftLogs(parsed, filters);
  lastShiftRows = filtered;

  if (!raw.trim()) {
    lastShiftRows = [];
    charCounter.innerHTML = '0 shift';
    setShiftExportButton(false);
    previewBody.innerHTML = `
      <div class="preview-empty">
        <div class="preview-empty-icon">⏱️</div>
        <div>Tempel atau upload log Discord<br>SHIFT LOGS untuk dihitung.</div>
      </div>`;
    return;
  }

  if (!parsed.length) {
    lastShiftRows = [];
    charCounter.innerHTML = '0 shift';
    setShiftExportButton(false);
    previewBody.innerHTML = `
      <div class="preview-empty">
        <div class="preview-empty-icon">⚠️</div>
        <div>Tidak ada blok SHIFT LOGS<br>yang bisa diparse.</div>
      </div>`;
    return;
  }

  const summary = summarizeShiftLogs(filtered);
  const skipped = parsed.length - filtered.length;
  charCounter.innerHTML = `<span>${summary.count}</span> shift`;
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

  previewBody.innerHTML = `
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

// ── Update live preview
function updatePreview() {
  if (!activeTpl) return;

  if (activeTpl === 'pasal') {
    normalizePasalFormInputs();
    updatePasalPreview(collectValues());
    return;
  }

  if (activeTpl === 'skck') {
    updateSkckPreview(collectValues());
    return;
  }

  if (activeTpl === 'shift-logs') {
    updateShiftLogsPreview();
    return;
  }

  const vals = collectValues();
  const output = formatOutput(activeTpl, vals);
  const chars  = output.length;

  charCounter.innerHTML = `<span>${chars}</span> karakter`;
  btnCopy.disabled = chars === 0;

  previewBody.innerHTML = `
    <div class="discord-mock">
      <div class="discord-mock-bar">
        <span class="discord-channel">laporan-bb</span>
      </div>
      <div class="discord-msg">
        <div class="discord-avatar">🚔</div>
        <div class="discord-msg-body">
          <div class="discord-username">
            Petugas KotaKita
            <span class="discord-role-badge">POLISI</span>
          </div>
          <div class="discord-text" id="discordText"></div>
        </div>
      </div>
    </div>`;

  document.getElementById('discordText').textContent = output;
}

function updatePasalPreview(vals) {
  const { format1, format2, calc, pasalObjects } = buildPasalOutputs(vals);
  const hasContent = pasalObjects.length > 0 || (vals.nama_suspect || '').trim();

  btnCopy.disabled = true;
  charCounter.innerHTML = pasalObjects.length
    ? `<span>${pasalObjects.length}</span> pasal`
    : '0 pasal';

  let penjaraText = calc.penjaraBulan > 0
    ? `${calc.penjaraBulan} bulan${calc.capped ? ' (maks)' : ''}`
    : '—';

  let notes = [];
  if (calc.capped) notes.push(`Akumulasi ${calc.rawBulan} bulan → dibatasi ${MAX_PENJARA} bulan`);
  if (calc.only2xNoBase) notes.push('Multiplier 2x Invoice butuh pasal dengan denda numerik');
  if (calc.has2xInvoice && !calc.only2xNoBase) notes.push('Denda ×2 (Pasal 7.9)');
  if (calc.hasDpo) notes.push('Masa tahanan ×2 (DPO)');

  const notesHtml = notes.length
    ? `<div class="result-summary-note">${notes.map(escHtml).join('<br>')}</div>`
    : '';

  previewBody.innerHTML = hasContent ? `
    <div class="pasal-preview">
      <div class="result-block">
        <div class="result-block-header">
          <span>Suspect | Pasal</span>
          <button class="btn-copy-sm" type="button" data-copy-target="format1">📋 Copy</button>
        </div>
        <pre class="result-block-code">${escHtml(format1)}</pre>
      </div>
      <div class="result-block">
        <div class="result-block-header">
          <span>Pasal Saja</span>
          <button class="btn-copy-sm" type="button" data-copy-target="format2">📋 Copy</button>
        </div>
        <pre class="result-block-code">${escHtml(format2)}</pre>
      </div>
      <div class="result-summary">
        <div class="result-summary-row">
          <span class="result-summary-label">Invoice</span>
          <span class="result-summary-value">${escHtml(formatRupiah(calc.invoice))}</span>
        </div>
        <div class="result-summary-row">
          <span class="result-summary-label">Masa Penjara</span>
          <span class="result-summary-value">${escHtml(penjaraText)}</span>
        </div>
        ${notesHtml}
      </div>
    </div>` : `
    <div class="preview-empty">
      <div class="preview-empty-icon">⚖️</div>
      <div>Isi nama suspect dan<br>pilih pasal untuk preview.</div>
    </div>`;
}

function updateSkckPreview(vals) {
  const { output, keperluan, pasalObjects } = buildSkckOutput(vals);
  const hasContent = (vals.identitas || '').trim() || keperluan;
  const chars = output.length;

  charCounter.innerHTML = `<span>${chars}</span> karakter`;
  btnCopy.disabled = !hasContent;

  const hargaHtml = keperluan
    ? `<div class="result-summary-row">
        <span class="result-summary-label">Harga SKCK</span>
        <span class="result-summary-value">${escHtml(formatKK(keperluan.harga))}</span>
      </div>`
    : '';

  const pasalNote = isSkckCriminal(vals.record_type) && pasalObjects.length
    ? `<div class="result-summary-row">
        <span class="result-summary-label">Pasal</span>
        <span class="result-summary-value">${pasalObjects.length} terpilih</span>
      </div>`
    : '';

  previewBody.innerHTML = hasContent ? `
    <div class="pasal-preview">
      <div class="discord-mock">
        <div class="discord-mock-bar">
          <span class="discord-channel">skck-kotakita</span>
        </div>
        <div class="discord-msg">
          <div class="discord-avatar">🚔</div>
          <div class="discord-msg-body">
            <div class="discord-username">
              Petugas KotaKita
              <span class="discord-role-badge">POLISI</span>
            </div>
            <div class="discord-text">${escHtml(output)}</div>
          </div>
        </div>
      </div>
      <div class="result-summary">
        <div class="result-summary-row">
          <span class="result-summary-label">Keperluan</span>
          <span class="result-summary-value">${escHtml(keperluan ? keperluan.nama : '—')}</span>
        </div>
        ${hargaHtml}
        ${pasalNote}
      </div>
    </div>` : `
    <div class="preview-empty">
      <div class="preview-empty-icon">📄</div>
      <div>Tempel data identitas dan<br>pilih keperluan untuk preview.</div>
    </div>`;
}

// ── Build form HTML for a template
function buildForm(tpl) {
  if (tpl === 'barang') {
    barangEntries = [{ nama: '', jumlah: '' }];
  } else if (tpl === 'pasal' || tpl === 'skck') {
    pasalEntries = [{ kode: '' }];
  }

  let html = '<div class="form-card">';

  switch (tpl) {

    /* ── barang ── */
    case 'barang':
      html += field('text', 'nama_suspect', 'Nama Suspect', '', 'Contoh: MALA MORGENSTER');
      html += `
        <div class="field-group">
          <label>Jenis Barang <span class="required">*</span></label>
          <div class="barang-list" id="barangList">
            ${barangEntries.map((b, i) => barangRow(i, upperStr(b.nama), b.jumlah)).join('')}
          </div>
          <button class="btn-add-barang" id="btnAddBarang" type="button">＋ Tambah Barang</button>
        </div>`;
      html += field('text', 'keterangan', 'Keterangan', '', 'Contoh: PZI, PERAMPOKAN WARUNG, dll');
      break;

    /* ── peluru ── */
    case 'peluru':
      html += field('text', 'nama', 'Nama Lengkap', '', 'Contoh: MALA MORGENSTER');
      html += selectField('jenis_peluru', 'Jenis Peluru', [
        '.45 ACP', '.38 LC', '5.56x45', '12 Gauge', '.50 BMG',
      ], '');
      html += field('number', 'jumlah_peluru', 'Jumlah Peluru (paket)', '', '0');
      html += selectField('status', 'Status', ['FREE', 'PAID'], '');
      break;

    /* ── senjata-apd ── */
    case 'senjata-apd':
      html += field('text', 'nama', 'Nama', '', 'Contoh: MALA MORGENSTER');
      html += field('text', 'serial_number', 'Serial Number', '', 'Contoh: SN-12345');
      break;

    /* ── senjata-ilegal ── */
    case 'senjata-ilegal':
      html += field('text', 'nama_suspect', 'Nama Suspect', '', 'Contoh: MALA MORGENSTER');
      html += field('text', 'serial_number', 'Serial Number', '', 'Contoh: SN-12345');
      html += field('text', 'keterangan', 'Keterangan', '', 'Contoh: PZI, PERAMPOKAN WARUNG');
      break;

    /* ── pasal ── */
    case 'pasal':
      if (!uuData) {
        html += '<div class="form-error">Gagal memuat undang-undang.json. Pastikan file ada dan dibuka via HTTP server (XAMPP).</div>';
      } else {
        html += field('text', 'nama_suspect', 'Nama Suspect', '', 'Contoh: MALA MORGENSTER');
        html += `
          <div class="field-group">
            <label>Pasal <span class="required">*</span></label>
            <div class="barang-list" id="pasalList">
              ${pasalEntries.map((p, i) => pasalRow(i, p.kode)).join('')}
            </div>
            <button class="btn-add-barang" id="btnAddPasal" type="button">＋ Tambah Pasal</button>
          </div>`;
      }
      break;

    /* ── skck ── */
    case 'skck':
      html += selectField('record_type', 'Jenis Catatan', [
        'CATATAN BERSIH',
        'MEMILIKI CATATAN KRIMINAL',
      ], 'CATATAN BERSIH');
      html += textareaField(
        'identitas',
        'Data Identitas (Paste)',
        '',
        'NAMA : \nSTEAM : \nJENIS KELAMIN : \nKEBANGSAAN : \nTANGGAL LAHIR : \nNOMOR HP : \nUMUR : \nPEKERJAAN : '
      );
      html += keperluanSelectField('keperluan', 'Keperluan', '');
      if (!uuData) {
        html += '<div class="form-error">Gagal memuat undang-undang.json. Pasal kriminal tidak tersedia.</div>';
      }
      html += `<div id="skckPasalSection"></div>`;
      break;

    /* ── shift-logs ── */
    case 'shift-logs':
      html += `
        <div class="field-group">
          <label for="shiftLogFile">Upload File Log</label>
          <div class="shift-file-row">
            <input type="file" id="shiftLogFile" accept=".txt,.log,.md,text/plain" />
            <span class="shift-file-hint">.txt / .log — atau tempel di bawah</span>
          </div>
        </div>`;
      html += `
        <div class="field-group">
          <label for="f_shift_log">Log Discord (Paste) <span class="required">*</span></label>
          <textarea
            id="f_shift_log"
            class="shift-log-textarea"
            data-field="shift_log"
            placeholder="Tempel log KOTAKITA SHIFT LOGS di sini..."
            autocomplete="off"
            spellcheck="false"
          ></textarea>
        </div>
        <div class="shift-filters">
          <div class="field-group">
            <label for="f_min_minutes">Min. Durasi (menit)</label>
            <input
              type="number"
              id="f_min_minutes"
              data-field="min_minutes"
              value="5"
              min="0"
              step="1"
              autocomplete="off"
            />
          </div>
          <div class="field-group">
            <label for="f_date_from">Dari Tanggal</label>
            <input type="date" id="f_date_from" data-field="date_from" />
          </div>
          <div class="field-group">
            <label for="f_date_to">Sampai Tanggal</label>
            <input type="date" id="f_date_to" data-field="date_to" />
          </div>
        </div>
        <p class="shift-form-note">Durasi dihitung ulang dari Start/End. Shift di bawah min. durasi disembunyikan (default 5 menit).</p>`;
      break;
  }

  html += '</div>';
  return html;
}

function field(type, id, labelText, value, placeholder) {
  return `
    <div class="field-group">
      <label for="f_${id}">${labelText} <span class="required">*</span></label>
      <input
        type="${type}"
        id="f_${id}"
        data-field="${id}"
        value="${escAttr(value)}"
        placeholder="${escAttr(placeholder)}"
        autocomplete="off"
        ${type === 'number' ? 'min="0"' : ''}
      />
    </div>`;
}

function selectField(id, labelText, options, selected) {
  const opts = options.map(o =>
    `<option value="${escAttr(o)}" ${o === selected ? 'selected' : ''}>${o}</option>`
  ).join('');
  return `
    <div class="field-group">
      <label for="f_${id}">${labelText} <span class="required">*</span></label>
      <select id="f_${id}" data-field="${id}">${opts}</select>
    </div>`;
}

function textareaField(id, labelText, value, placeholder) {
  return `
    <div class="field-group">
      <label for="f_${id}">${labelText} <span class="required">*</span></label>
      <textarea
        id="f_${id}"
        data-field="${id}"
        placeholder="${escAttr(placeholder)}"
        autocomplete="off"
      >${escHtml(value)}</textarea>
    </div>`;
}

function keperluanSelectField(id, labelText, selected) {
  const opts = ['<option value="">— Pilih Keperluan —</option>']
    .concat(KEPERLUAN_LIST.map((k, i) =>
      `<option value="${i}" ${String(i) === String(selected) ? 'selected' : ''}>${escHtml(k.nama)} — ${escHtml(formatKK(k.harga))}</option>`
    ))
    .join('');
  return `
    <div class="field-group">
      <label for="f_${id}">${labelText} <span class="required">*</span></label>
      <select id="f_${id}" data-field="${id}">${opts}</select>
    </div>`;
}

function renderSkckPasalSection(recordType) {
  if (!isSkckCriminal(recordType) || !uuData) return '';
  return `
    <div class="field-group">
      <label>Pasal Kriminal <span class="required">*</span></label>
      <div class="barang-list" id="pasalList">
        ${pasalEntries.map((p, i) => pasalRow(i, p.kode)).join('')}
      </div>
      <button class="btn-add-barang" id="btnAddPasal" type="button">＋ Tambah Pasal</button>
    </div>`;
}

function mountSkckPasalSection(recordType) {
  const section = document.getElementById('skckPasalSection');
  if (!section) return;
  section.innerHTML = renderSkckPasalSection(recordType);
  bindPasalAddButton();
  initAllPasalComboboxes();
}

function barangRow(i, nama, jumlah) {
  return `
    <div class="barang-entry" id="barang_row_${i}">
      <input
        type="text"
        placeholder="Nama Barang"
        data-barang-nama="${i}"
        value="${escAttr(nama)}"
        autocomplete="off"
      />
      <input
        type="number"
        placeholder="Jumlah"
        min="0"
        data-barang-jumlah="${i}"
        value="${escAttr(jumlah)}"
      />
      <button class="btn-remove-barang" data-remove="${i}" aria-label="Hapus" type="button">✕</button>
    </div>`;
}

function pasalRow(i, selectedKode) {
  const label = pasalLabel(selectedKode);
  return `
    <div class="barang-entry pasal-entry" data-pasal-wrap="${i}" data-pasal-kode="${escAttr(selectedKode)}">
      <div class="pasal-combobox" data-pasal-combobox="${i}">
        <input
          type="text"
          class="pasal-combobox-input"
          data-pasal-input="${i}"
          placeholder="Cari pasal (kode / pelanggaran)..."
          value="${escAttr(label)}"
          autocomplete="off"
        />
        <button type="button" class="pasal-combobox-toggle" data-pasal-toggle="${i}" aria-label="Buka daftar pasal">▼</button>
        <div class="pasal-combobox-dropdown hidden" data-pasal-dropdown="${i}"></div>
      </div>
      <button class="btn-remove-barang" data-remove-pasal="${i}" aria-label="Hapus" type="button">✕</button>
    </div>`;
}

function escAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escHtml(str) {
  return escAttr(str);
}

function renderPasalDropdownList(listEl, items, activeIdx) {
  if (!items.length) {
    listEl.innerHTML = '<div class="pasal-combobox-empty">Pasal tidak ditemukan</div>';
    return;
  }
  const groups = new Map();
  items.forEach((p, idx) => {
    if (!groups.has(p.kategori)) groups.set(p.kategori, []);
    groups.get(p.kategori).push({ p, idx });
  });
  let html = '';
  for (const [kat, entries] of groups) {
    html += `<div class="pasal-combobox-group">${escHtml(kat)}</div>`;
    for (const { p, idx } of entries) {
      html += `<button type="button" class="pasal-combobox-item${idx === activeIdx ? ' active' : ''}" data-kode="${escAttr(p.kode)}" data-idx="${idx}">${escHtml(p.kode)} — ${escHtml(p.pelanggaran)}</button>`;
    }
  }
  listEl.innerHTML = html;
}

function closeAllPasalDropdowns(exceptCombo) {
  document.querySelectorAll('.pasal-combobox-dropdown').forEach(dd => {
    const combo = dd._ownerCombo || dd.closest('.pasal-combobox');
    if (exceptCombo && combo === exceptCombo) return;
    dd.classList.add('hidden');
    if (combo) {
      combo.classList.remove('open');
      const wrap = combo.closest('[data-pasal-wrap]');
      if (wrap) wrap.classList.remove('is-open');
      if (dd.parentElement === document.body) {
        combo.appendChild(dd);
        dd._ownerCombo = null;
      }
    }
  });
}

function selectPasalItem(item) {
  const dd = item.closest('.pasal-combobox-dropdown');
  const combo = dd?._ownerCombo;
  const wrap = combo?.closest('[data-pasal-wrap]');
  if (!wrap || !item.dataset.kode) return;
  wrap.dataset.pasalKode = item.dataset.kode;
  const input = wrap.querySelector('.pasal-combobox-input');
  if (input) input.value = pasalLabel(item.dataset.kode);
  closeAllPasalDropdowns();
  updatePreview();
}

function positionPasalDropdown(combo, dropdown, input) {
  const rect = input.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom + 4}px`;
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.width = `${rect.width}px`;
}

function initPasalCombobox(wrapEl) {
  if (wrapEl.dataset.pasalInit === '1') return;
  wrapEl.dataset.pasalInit = '1';

  const combo   = wrapEl.querySelector('.pasal-combobox');
  const input   = wrapEl.querySelector('.pasal-combobox-input');
  const toggle  = wrapEl.querySelector('.pasal-combobox-toggle');
  const dropdown = wrapEl.querySelector('.pasal-combobox-dropdown');
  if (!combo || !input || !toggle || !dropdown) return;

  let filtered = pasalList.slice();
  let activeIdx = -1;

  function mountDropdown() {
    if (dropdown.parentElement !== document.body) {
      document.body.appendChild(dropdown);
      dropdown._ownerCombo = combo;
    }
    positionPasalDropdown(combo, dropdown, input);
  }

  function openDropdown() {
    closeAllPasalDropdowns(combo);
    filtered = filterPasal(input.value);
    activeIdx = filtered.length ? 0 : -1;
    renderPasalDropdownList(dropdown, filtered, activeIdx);
    dropdown.classList.remove('hidden');
    combo.classList.add('open');
    wrapEl.classList.add('is-open');
    mountDropdown();
  }

  function closeDropdown() {
    dropdown.classList.add('hidden');
    combo.classList.remove('open');
    wrapEl.classList.remove('is-open');
    activeIdx = -1;
    if (dropdown._ownerCombo === combo) {
      combo.appendChild(dropdown);
      dropdown._ownerCombo = null;
    }
  }

  function selectPasal(kode) {
    wrapEl.dataset.pasalKode = kode;
    input.value = pasalLabel(kode);
    closeDropdown();
    updatePreview();
  }

  dropdown._selectPasal = selectPasal;
  dropdown._getFiltered = () => filtered;
  dropdown._setActiveIdx = (idx) => { activeIdx = idx; };
  dropdown._getActiveIdx = () => activeIdx;

  function restoreLabelIfNeeded() {
    const kode = wrapEl.dataset.pasalKode || '';
    if (kode && input.value !== pasalLabel(kode)) {
      wrapEl.dataset.pasalKode = '';
    }
  }

  function onScrollReposition() {
    if (!dropdown.classList.contains('hidden')) {
      positionPasalDropdown(combo, dropdown, input);
    }
  }

  toggle.addEventListener('mousedown', (e) => e.preventDefault());
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dropdown.classList.contains('hidden')) openDropdown();
    else closeDropdown();
  });

  input.addEventListener('focus', () => openDropdown());

  input.addEventListener('input', () => {
    restoreLabelIfNeeded();
    filtered = filterPasal(input.value);
    activeIdx = filtered.length ? 0 : -1;
    renderPasalDropdownList(dropdown, filtered, activeIdx);
    if (dropdown.classList.contains('hidden')) {
      combo.classList.add('open');
      wrapEl.classList.add('is-open');
    }
    dropdown.classList.remove('hidden');
    mountDropdown();
    updatePreview();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (dropdown.classList.contains('hidden')) openDropdown();
      else if (filtered.length) {
        activeIdx = Math.min(activeIdx + 1, filtered.length - 1);
        renderPasalDropdownList(dropdown, filtered, activeIdx);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length) {
        activeIdx = Math.max(activeIdx - 1, 0);
        renderPasalDropdownList(dropdown, filtered, activeIdx);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && filtered[activeIdx]) selectPasal(filtered[activeIdx].kode);
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  dropdown.addEventListener('mouseover', (e) => {
    const btn = e.target.closest('.pasal-combobox-item');
    if (!btn) return;
    activeIdx = parseInt(btn.dataset.idx, 10);
    dropdown.querySelectorAll('.pasal-combobox-item.active').forEach(el => {
      el.classList.toggle('active', el === btn);
    });
  });

  window.addEventListener('scroll', onScrollReposition, true);
  window.addEventListener('resize', onScrollReposition);
}

function initAllPasalComboboxes() {
  formArea.querySelectorAll('[data-pasal-wrap]').forEach(initPasalCombobox);
}

function attachPasalEvents() {
  bindPasalAddButton();
  if (!formArea.dataset.pasalClickBound) {
    formArea.dataset.pasalClickBound = '1';
    formArea.addEventListener('click', handleRemovePasal);
  }
  initAllPasalComboboxes();
}

function bindPasalAddButton() {
  const btnAdd = document.getElementById('btnAddPasal');
  if (!btnAdd || btnAdd.dataset.pasalBound === '1') return;
  btnAdd.dataset.pasalBound = '1';
  btnAdd.addEventListener('click', addPasal);
}

// ── Activate a template
function activateTemplate(tpl) {
  activeTpl = tpl;
  const def = TEMPLATES[tpl];

  // Sidebar highlight
  document.querySelectorAll('.tpl-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tpl === tpl);
  });

  // Update header
  formTitle.textContent = `${def.icon} ${def.title}`;
  formDesc.textContent  = def.desc;
  btnClear.style.display = 'flex';

  // Render form
  formArea.innerHTML = buildForm(tpl);

  // Attach events
  formArea.addEventListener('input', onFormInput);
  formArea.addEventListener('change', onFormInput);
  formArea.addEventListener('paste', onFormInput);

  if (tpl === 'barang') {
    document.getElementById('btnAddBarang').addEventListener('click', addBarang);
    formArea.addEventListener('click', handleRemoveBarang);
  }

  if (tpl === 'pasal' && uuData) {
    attachPasalEvents();
  }

  if (tpl === 'skck') {
    mountSkckPasalSection(
      formArea.querySelector('[data-field="record_type"]')?.value || 'CATATAN BERSIH'
    );
    if (uuData) attachPasalEvents();
  }

  if (tpl === 'shift-logs') {
    bindShiftLogsForm();
    lastShiftRows = [];
  } else {
    resetShiftCopyButton();
  }

  uppercaseAllTextInputs();
  updatePreview();
}

function bindShiftLogsForm() {
  const fileInput = document.getElementById('shiftLogFile');
  if (!fileInput || fileInput.dataset.bound === '1') return;
  fileInput.dataset.bound = '1';
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ta = formArea.querySelector('[data-field="shift_log"]');
      if (ta) {
        ta.value = String(reader.result || '');
        updatePreview();
      }
    };
    reader.readAsText(file);
  });
}

function onFormInput(e) {
  enforceUppercase(e);
  if (e.type === 'paste' && e.target.dataset?.field === 'nama_suspect') {
    requestAnimationFrame(() => {
      e.target.value = upperStr(e.target.value);
      updatePreview();
    });
    return;
  }
  if (
    activeTpl === 'skck' &&
    e.target.dataset?.field === 'record_type'
  ) {
    closeAllPasalDropdowns();
    pasalEntries = [{ kode: '' }];
    mountSkckPasalSection(e.target.value);
  }
  updatePreview();
}

function uppercaseAllTextInputs() {
  formArea.querySelectorAll('input[type="text"]').forEach(el => {
    if (el.classList.contains('pasal-combobox-input')) return;
    el.value = upperStr(el.value);
  });
}

// ── Add barang row
function addBarang() {
  const vals = collectValues();
  // Sync current state first
  barangEntries = (vals._barang || []).concat([{ nama: '', jumlah: '' }]);
  const i   = barangEntries.length - 1;
  const list = document.getElementById('barangList');
  const div  = document.createElement('div');
  div.innerHTML = barangRow(i, '', '');
  list.appendChild(div.firstElementChild);
}

// ── Remove barang row
function handleRemoveBarang(e) {
  const btn = e.target.closest('[data-remove]');
  if (!btn) return;
  const i = parseInt(btn.dataset.remove, 10);
  // Collect current values before removal
  const rows = formArea.querySelectorAll('[data-barang-nama]');
  const entries = [];
  rows.forEach((el, idx) => {
    if (idx === i) return;
    const jumlahEl = formArea.querySelector(`[data-barang-jumlah="${idx}"]`);
    entries.push({ nama: el.value, jumlah: jumlahEl ? jumlahEl.value : '' });
  });
  barangEntries = entries.length ? entries : [{ nama: '', jumlah: '' }];
  // Re-render just the barang list
  const list = document.getElementById('barangList');
  list.innerHTML = barangEntries.map((b, j) => barangRow(j, b.nama, b.jumlah)).join('');
  updatePreview();
}

// ── Add pasal row
function addPasal() {
  closeAllPasalDropdowns();
  pasalEntries = syncPasalEntriesFromDOM().concat([{ kode: '' }]);
  const list = document.getElementById('pasalList');
  list.innerHTML = pasalEntries.map((p, j) => pasalRow(j, p.kode)).join('');
  initAllPasalComboboxes();
  updatePreview();
}

// ── Remove pasal row
function handleRemovePasal(e) {
  const btn = e.target.closest('[data-remove-pasal]');
  if (!btn) return;
  closeAllPasalDropdowns();
  const i = parseInt(btn.dataset.removePasal, 10);
  const entries = syncPasalEntriesFromDOM().filter((_, idx) => idx !== i);
  pasalEntries = entries.length ? entries : [{ kode: '' }];
  const list = document.getElementById('pasalList');
  list.innerHTML = pasalEntries.map((p, j) => pasalRow(j, p.kode)).join('');
  initAllPasalComboboxes();
  updatePreview();
}

function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast();
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast();
  });
}

// ── Copy to clipboard / export CSV
btnCopy.addEventListener('click', () => {
  if (!activeTpl || activeTpl === 'pasal') return;

  if (activeTpl === 'shift-logs') {
    if (!lastShiftRows.length) return;
    const summary = summarizeShiftLogs(lastShiftRows);
    downloadShiftLogsCsv(lastShiftRows, summary);
    btnCopy.classList.add('copied');
    btnCopy.textContent = '✓ Exported!';
    setTimeout(() => {
      setShiftExportButton(lastShiftRows.length > 0);
    }, 2000);
    return;
  }

  const vals   = collectValues();
  const output = formatOutput(activeTpl, vals);
  if (!output) return;
  copyToClipboard(output);
  btnCopy.classList.add('copied');
  btnCopy.textContent = '✓ Disalin!';
  setTimeout(() => {
    btnCopy.classList.remove('copied');
    btnCopy.innerHTML = '📋 Copy';
  }, 2000);
});

previewBody.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-copy-target]');
  if (!btn || activeTpl !== 'pasal') return;
  const outputs = buildPasalOutputs(collectValues());
  const text = outputs[btn.dataset.copyTarget];
  if (text) copyToClipboard(text);
});

document.addEventListener('pointerdown', (e) => {
  const item = e.target.closest('.pasal-combobox-item');
  if (item) {
    const dd = item.closest('.pasal-combobox-dropdown');
    if (dd && !dd.classList.contains('hidden')) {
      e.preventDefault();
      e.stopPropagation();
      selectPasalItem(item);
    }
    return;
  }
  if (!e.target.closest('.pasal-combobox') && !e.target.closest('.pasal-combobox-dropdown')) {
    closeAllPasalDropdowns();
  }
}, true);

// ── Clear form
btnClear.addEventListener('click', () => {
  if (!activeTpl) return;
  barangEntries = [{ nama: '', jumlah: '' }];
  pasalEntries = [{ kode: '' }];
  formArea.innerHTML = buildForm(activeTpl);
  formArea.addEventListener('input', onFormInput);
  formArea.addEventListener('change', onFormInput);
  formArea.addEventListener('paste', onFormInput);
  uppercaseAllTextInputs();
  if (activeTpl === 'barang') {
    document.getElementById('btnAddBarang').addEventListener('click', addBarang);
    formArea.addEventListener('click', handleRemoveBarang);
  }
  if (activeTpl === 'pasal' && uuData) {
    attachPasalEvents();
  }
  if (activeTpl === 'skck') {
    mountSkckPasalSection(
      formArea.querySelector('[data-field="record_type"]')?.value || 'CATATAN BERSIH'
    );
    if (uuData) attachPasalEvents();
  }
  if (activeTpl === 'shift-logs') {
    bindShiftLogsForm();
    lastShiftRows = [];
  } else {
    resetShiftCopyButton();
  }
  updatePreview();
});

// ── Toast
function showToast() {
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ── Template button clicks (sidebar)
document.querySelectorAll('.tpl-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activateTemplate(btn.dataset.tpl);
    closeMobile();
  });
});

// ── Mobile sidebar toggle
menuBtn.addEventListener('click', () => {
  const open = sidebar.classList.toggle('open');
  overlay.classList.toggle('visible', open);
  overlay.classList.toggle('hidden', !open);
  if (previewEl.classList.contains('open')) {
    previewEl.classList.remove('open');
  }
});

// ── Mobile preview toggle
previewBtn.addEventListener('click', () => {
  const open = previewEl.classList.toggle('open');
  overlay.classList.toggle('visible', open);
  overlay.classList.toggle('hidden', !open);
  if (sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
  }
});

// ── Overlay click → close drawers
overlay.addEventListener('click', closeMobile);

function closeMobile() {
  sidebar.classList.remove('open');
  previewEl.classList.remove('open');
  overlay.classList.remove('visible');
  overlay.classList.add('hidden');
}

// ── Init
(async function init() {
  await loadUndangUndang();
})();
