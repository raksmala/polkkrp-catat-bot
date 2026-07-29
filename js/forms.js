import { TEMPLATES, KEPERLUAN_LIST } from './config.js';
import { state, dom } from './state.js';
import { upperStr, enforceUppercase, formatKK, escAttr, escHtml } from './utils.js';
import {
  pasalRow,
  mountSkckPasalSection,
  attachPasalEvents,
  closeAllPasalDropdowns,
  syncPasalEntriesFromDOM,
} from './pasal.js';
import { resetShiftCopyButton } from './shift-logs.js';
import { hooks } from './hooks.js';

export function collectValues() {
  const vals = {};
  dom.formArea.querySelectorAll('[data-field]').forEach(el => {
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
  if (state.activeTpl === 'barang') {
    vals._barang = state.barangEntries.map((_, i) => {
      const namaEl  = dom.formArea.querySelector(`[data-barang-nama="${i}"]`);
      const jumlahEl = dom.formArea.querySelector(`[data-barang-jumlah="${i}"]`);
      return {
        nama:   namaEl   ? upperStr(namaEl.value)   : '',
        jumlah: jumlahEl ? jumlahEl.value : '',
      };
    });
  }
  if (state.activeTpl === 'pasal' || state.activeTpl === 'skck') {
    vals._pasal = syncPasalEntriesFromDOM();
  }
  return vals;
}

export function buildForm(tpl) {
  if (tpl === 'barang') {
    state.barangEntries = [{ nama: '', jumlah: '' }];
  } else if (tpl === 'pasal' || tpl === 'skck') {
    state.pasalEntries = [{ kode: '' }];
  }

  let html = '<div class="form-card">';

  switch (tpl) {

    case 'barang':
      html += field('text', 'nama_suspect', 'Nama Suspect', '', 'Contoh: MALA MORGENSTER');
      html += `
        <div class="field-group">
          <label>Jenis Barang <span class="required">*</span></label>
          <div class="barang-list" id="barangList">
            ${state.barangEntries.map((b, i) => barangRow(i, upperStr(b.nama), b.jumlah)).join('')}
          </div>
          <button class="btn-add-barang" id="btnAddBarang" type="button">＋ Tambah Barang</button>
        </div>`;
      html += field('text', 'keterangan', 'Keterangan', '', 'Contoh: PZI, PERAMPOKAN WARUNG, dll');
      break;

    case 'peluru':
      html += field('text', 'nama', 'Nama Lengkap', '', 'Contoh: MALA MORGENSTER');
      html += selectField('jenis_peluru', 'Jenis Peluru', [
        '.45 ACP', '.38 LC', '5.56x45', '12 Gauge', '.50 BMG',
      ], '');
      html += field('number', 'jumlah_peluru', 'Jumlah Peluru (paket)', '', '0');
      html += selectField('status', 'Status', ['FREE', 'PAID'], '');
      break;

    case 'senjata-apd':
      html += field('text', 'nama', 'Nama', '', 'Contoh: MALA MORGENSTER');
      html += field('text', 'pangkat', 'Pangkat', '', 'Contoh: PEDA');
      html += field('text', 'tipe_senjata', 'Tipe Senjata', '', 'Contoh: SPECIAL CARBINE');
      html += field('text', 'serial_number', 'Serial Number', '', 'Contoh: 136593POL284003');
      break;

    case 'senjata-ilegal':
      html += field('text', 'nama_suspect', 'Nama Suspect', '', 'Contoh: MALA MORGENSTER');
      html += field('text', 'serial_number', 'Serial Number', '', 'Contoh: SN-12345');
      html += field('text', 'keterangan', 'Keterangan', '', 'Contoh: PZI, PERAMPOKAN WARUNG');
      break;

    case 'pasal':
      if (!state.uuData) {
        html += '<div class="form-error">Gagal memuat data/undang-undang.json. Pastikan file ada dan dibuka via HTTP server (XAMPP).</div>';
      } else {
        html += field('text', 'nama_suspect', 'Nama Suspect', '', 'Contoh: MALA MORGENSTER');
        html += `
          <div class="field-group">
            <label>Pasal <span class="required">*</span></label>
            <div class="barang-list" id="pasalList">
              ${state.pasalEntries.map((p, i) => pasalRow(i, p.kode)).join('')}
            </div>
            <button class="btn-add-barang" id="btnAddPasal" type="button">＋ Tambah Pasal</button>
          </div>`;
      }
      break;

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
      if (!state.uuData) {
        html += '<div class="form-error">Gagal memuat data/undang-undang.json. Pasal kriminal tidak tersedia.</div>';
      }
      html += `<div id="skckPasalSection"></div>`;
      break;

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

export function barangRow(i, nama, jumlah) {
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

export function activateTemplate(tpl) {
  state.activeTpl = tpl;
  const def = TEMPLATES[tpl];

  document.querySelectorAll('.tpl-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tpl === tpl);
  });

  dom.formTitle.textContent = `${def.icon} ${def.title}`;
  dom.formDesc.textContent  = def.desc;
  dom.btnClear.style.display = 'flex';

  dom.formArea.innerHTML = buildForm(tpl);

  dom.formArea.addEventListener('input', onFormInput);
  dom.formArea.addEventListener('change', onFormInput);
  dom.formArea.addEventListener('paste', onFormInput);

  if (tpl === 'barang') {
    document.getElementById('btnAddBarang').addEventListener('click', addBarang);
    dom.formArea.addEventListener('click', handleRemoveBarang);
  }

  if (tpl === 'pasal' && state.uuData) {
    attachPasalEvents();
  }

  if (tpl === 'skck') {
    mountSkckPasalSection(
      dom.formArea.querySelector('[data-field="record_type"]')?.value || 'CATATAN BERSIH'
    );
    if (state.uuData) attachPasalEvents();
  }

  if (tpl === 'shift-logs') {
    bindShiftLogsForm();
    state.lastShiftRows = [];
  } else {
    resetShiftCopyButton();
  }

  uppercaseAllTextInputs();
  hooks.updatePreview();
}

export function bindShiftLogsForm() {
  const fileInput = document.getElementById('shiftLogFile');
  if (!fileInput || fileInput.dataset.bound === '1') return;
  fileInput.dataset.bound = '1';
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ta = dom.formArea.querySelector('[data-field="shift_log"]');
      if (ta) {
        ta.value = String(reader.result || '');
        hooks.updatePreview();
      }
    };
    reader.readAsText(file);
  });
}

export function onFormInput(e) {
  enforceUppercase(e);
  if (e.type === 'paste' && e.target.dataset?.field === 'nama_suspect') {
    requestAnimationFrame(() => {
      e.target.value = upperStr(e.target.value);
      hooks.updatePreview();
    });
    return;
  }
  if (
    state.activeTpl === 'skck' &&
    e.target.dataset?.field === 'record_type'
  ) {
    closeAllPasalDropdowns();
    state.pasalEntries = [{ kode: '' }];
    mountSkckPasalSection(e.target.value);
  }
  hooks.updatePreview();
}

export function uppercaseAllTextInputs() {
  dom.formArea.querySelectorAll('input[type="text"]').forEach(el => {
    if (el.classList.contains('pasal-combobox-input')) return;
    el.value = upperStr(el.value);
  });
}

export function addBarang() {
  const vals = collectValues();
  state.barangEntries = (vals._barang || []).concat([{ nama: '', jumlah: '' }]);
  const i   = state.barangEntries.length - 1;
  const list = document.getElementById('barangList');
  const div  = document.createElement('div');
  div.innerHTML = barangRow(i, '', '');
  list.appendChild(div.firstElementChild);
}

export function handleRemoveBarang(e) {
  const btn = e.target.closest('[data-remove]');
  if (!btn) return;
  const i = parseInt(btn.dataset.remove, 10);
  const rows = dom.formArea.querySelectorAll('[data-barang-nama]');
  const entries = [];
  rows.forEach((el, idx) => {
    if (idx === i) return;
    const jumlahEl = dom.formArea.querySelector(`[data-barang-jumlah="${idx}"]`);
    entries.push({ nama: el.value, jumlah: jumlahEl ? jumlahEl.value : '' });
  });
  state.barangEntries = entries.length ? entries : [{ nama: '', jumlah: '' }];
  const list = document.getElementById('barangList');
  list.innerHTML = state.barangEntries.map((b, j) => barangRow(j, b.nama, b.jumlah)).join('');
  hooks.updatePreview();
}

export function clearForm() {
  if (!state.activeTpl) return;
  state.barangEntries = [{ nama: '', jumlah: '' }];
  state.pasalEntries = [{ kode: '' }];
  dom.formArea.innerHTML = buildForm(state.activeTpl);
  dom.formArea.addEventListener('input', onFormInput);
  dom.formArea.addEventListener('change', onFormInput);
  dom.formArea.addEventListener('paste', onFormInput);
  uppercaseAllTextInputs();
  if (state.activeTpl === 'barang') {
    document.getElementById('btnAddBarang').addEventListener('click', addBarang);
    dom.formArea.addEventListener('click', handleRemoveBarang);
  }
  if (state.activeTpl === 'pasal' && state.uuData) {
    attachPasalEvents();
  }
  if (state.activeTpl === 'skck') {
    mountSkckPasalSection(
      dom.formArea.querySelector('[data-field="record_type"]')?.value || 'CATATAN BERSIH'
    );
    if (state.uuData) attachPasalEvents();
  }
  if (state.activeTpl === 'shift-logs') {
    bindShiftLogsForm();
    state.lastShiftRows = [];
  } else {
    resetShiftCopyButton();
  }
  hooks.updatePreview();
}
