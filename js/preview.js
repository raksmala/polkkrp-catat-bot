import { MAX_PENJARA } from './config.js';
import { state, dom } from './state.js';
import { formatRupiah, formatKK, escHtml } from './utils.js';
import {
  normalizePasalFormInputs,
  buildPasalOutputs,
  isSkckCriminal,
} from './pasal.js';
import { formatOutput, buildSkckOutput } from './format.js';
import { updateShiftLogsPreview } from './shift-logs.js';
import { collectValues } from './forms.js';
import { hooks } from './hooks.js';

export function updatePreview() {
  if (!state.activeTpl) return;

  if (state.activeTpl === 'pasal') {
    normalizePasalFormInputs();
    updatePasalPreview(collectValues());
    return;
  }

  if (state.activeTpl === 'skck') {
    updateSkckPreview(collectValues());
    return;
  }

  if (state.activeTpl === 'shift-logs') {
    updateShiftLogsPreview();
    return;
  }

  const vals = collectValues();
  const output = formatOutput(state.activeTpl, vals);
  const chars  = output.length;

  dom.charCounter.innerHTML = `<span>${chars}</span> karakter`;
  dom.btnCopy.disabled = chars === 0;

  dom.previewBody.innerHTML = `
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

  dom.btnCopy.disabled = true;
  dom.charCounter.innerHTML = pasalObjects.length
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

  dom.previewBody.innerHTML = hasContent ? `
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

  dom.charCounter.innerHTML = `<span>${chars}</span> karakter`;
  dom.btnCopy.disabled = !hasContent;

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

  dom.previewBody.innerHTML = hasContent ? `
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

hooks.updatePreview = updatePreview;
