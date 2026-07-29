import { MAX_PENJARA, KEPERLUAN_LIST } from './config.js';
import { state, dom } from './state.js';
import { upperStr, escAttr, escHtml } from './utils.js';
import { hooks } from './hooks.js';

export async function loadUndangUndang() {
  try {
    const res = await fetch('data/undang-undang.json');
    if (!res.ok) throw new Error('fetch failed');
    state.uuData = await res.json();
    state.pasalList = [];
    state.pasalLookup = {};
    for (const kat of state.uuData.kategori) {
      for (const p of kat.pasal) {
        const item = { ...p, kategori: kat.kategori };
        state.pasalList.push(item);
        state.pasalLookup[p.kode] = item;
      }
    }
  } catch {
    state.uuData = null;
    state.pasalList = [];
    state.pasalLookup = {};
  }
}

export function pasalLabel(kode) {
  const p = state.pasalLookup[kode];
  return p ? `${p.kode} — ${p.pelanggaran}` : '';
}

export function getSkckDates() {
  const today = new Date();
  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + 7);
  return { today, validUntil };
}

export function getKeperluanByIndex(idx) {
  const i = parseInt(idx, 10);
  return Number.isFinite(i) && KEPERLUAN_LIST[i] ? KEPERLUAN_LIST[i] : null;
}

export function isSkckCriminal(recordType) {
  return recordType === 'MEMILIKI CATATAN KRIMINAL';
}

export function filterPasal(query) {
  const q = query.trim().toLowerCase();
  if (!q) return state.pasalList.slice();
  return state.pasalList.filter(p =>
    p.kode.toLowerCase().includes(q) ||
    p.pelanggaran.toLowerCase().includes(q) ||
    p.kategori.toLowerCase().includes(q)
  );
}

export function parsePenjaraBulan(str) {
  if (!str) return 0;
  const m = String(str).match(/(\d+)\s*bulan/i);
  return m ? parseInt(m[1], 10) : 0;
}

export function calcPasalResults(pasalObjects) {
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

export function getSelectedPasalObjects(entries) {
  const seen = new Set();
  const result = [];
  for (const e of entries) {
    const kode = e.kode || '';
    if (!kode || seen.has(kode)) continue;
    const p = state.pasalLookup[kode];
    if (p) {
      seen.add(kode);
      result.push(p);
    }
  }
  return result;
}

export function formatPasalNames(pasalObjects) {
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

export function normalizePasalFormInputs() {
  const suspectEl = dom.formArea.querySelector('[data-field="nama_suspect"]');
  if (suspectEl) suspectEl.value = upperStr(suspectEl.value);
}

export function buildPasalOutputs(vals) {
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

export function syncPasalEntriesFromDOM() {
  return [...dom.formArea.querySelectorAll('[data-pasal-wrap]')].map(wrap => ({
    kode: wrap.dataset.pasalKode || '',
  }));
}

export function pasalRow(i, selectedKode) {
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

export function renderSkckPasalSection(recordType) {
  if (!isSkckCriminal(recordType) || !state.uuData) return '';
  return `
    <div class="field-group">
      <label>Pasal Kriminal <span class="required">*</span></label>
      <div class="barang-list" id="pasalList">
        ${state.pasalEntries.map((p, i) => pasalRow(i, p.kode)).join('')}
      </div>
      <button class="btn-add-barang" id="btnAddPasal" type="button">＋ Tambah Pasal</button>
    </div>`;
}

export function mountSkckPasalSection(recordType) {
  const section = document.getElementById('skckPasalSection');
  if (!section) return;
  section.innerHTML = renderSkckPasalSection(recordType);
  bindPasalAddButton();
  initAllPasalComboboxes();
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

export function closeAllPasalDropdowns(exceptCombo) {
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

export function selectPasalItem(item) {
  const dd = item.closest('.pasal-combobox-dropdown');
  const combo = dd?._ownerCombo;
  const wrap = combo?.closest('[data-pasal-wrap]');
  if (!wrap || !item.dataset.kode) return;
  wrap.dataset.pasalKode = item.dataset.kode;
  const input = wrap.querySelector('.pasal-combobox-input');
  if (input) input.value = pasalLabel(item.dataset.kode);
  closeAllPasalDropdowns();
  hooks.updatePreview();
}

function positionPasalDropdown(combo, dropdown, input) {
  const rect = input.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom + 4}px`;
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.width = `${rect.width}px`;
}

export function initPasalCombobox(wrapEl) {
  if (wrapEl.dataset.pasalInit === '1') return;
  wrapEl.dataset.pasalInit = '1';

  const combo   = wrapEl.querySelector('.pasal-combobox');
  const input   = wrapEl.querySelector('.pasal-combobox-input');
  const toggle  = wrapEl.querySelector('.pasal-combobox-toggle');
  const dropdown = wrapEl.querySelector('.pasal-combobox-dropdown');
  if (!combo || !input || !toggle || !dropdown) return;

  let filtered = state.pasalList.slice();
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
    hooks.updatePreview();
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
    hooks.updatePreview();
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

export function initAllPasalComboboxes() {
  dom.formArea.querySelectorAll('[data-pasal-wrap]').forEach(initPasalCombobox);
}

export function attachPasalEvents() {
  bindPasalAddButton();
  if (!dom.formArea.dataset.pasalClickBound) {
    dom.formArea.dataset.pasalClickBound = '1';
    dom.formArea.addEventListener('click', handleRemovePasal);
  }
  initAllPasalComboboxes();
}

export function bindPasalAddButton() {
  const btnAdd = document.getElementById('btnAddPasal');
  if (!btnAdd || btnAdd.dataset.pasalBound === '1') return;
  btnAdd.dataset.pasalBound = '1';
  btnAdd.addEventListener('click', addPasal);
}

export function addPasal() {
  closeAllPasalDropdowns();
  state.pasalEntries = syncPasalEntriesFromDOM().concat([{ kode: '' }]);
  const list = document.getElementById('pasalList');
  list.innerHTML = state.pasalEntries.map((p, j) => pasalRow(j, p.kode)).join('');
  initAllPasalComboboxes();
  hooks.updatePreview();
}

export function handleRemovePasal(e) {
  const btn = e.target.closest('[data-remove-pasal]');
  if (!btn) return;
  closeAllPasalDropdowns();
  const i = parseInt(btn.dataset.removePasal, 10);
  const entries = syncPasalEntriesFromDOM().filter((_, idx) => idx !== i);
  state.pasalEntries = entries.length ? entries : [{ kode: '' }];
  const list = document.getElementById('pasalList');
  list.innerHTML = state.pasalEntries.map((p, j) => pasalRow(j, p.kode)).join('');
  initAllPasalComboboxes();
  hooks.updatePreview();
}
