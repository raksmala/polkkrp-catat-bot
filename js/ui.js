import { state, dom } from './state.js';
import {
  activateTemplate,
  clearForm,
  collectValues,
} from './forms.js';
import { formatOutput } from './format.js';
import {
  buildPasalOutputs,
  closeAllPasalDropdowns,
  selectPasalItem,
} from './pasal.js';
import {
  summarizeShiftLogs,
  downloadShiftLogsCsv,
  setShiftExportButton,
} from './shift-logs.js';

export function showToast() {
  dom.toast.classList.add('show');
  setTimeout(() => dom.toast.classList.remove('show'), 2500);
}

export function copyToClipboard(text) {
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

export function closeMobile() {
  dom.sidebar.classList.remove('open');
  dom.previewEl.classList.remove('open');
  dom.overlay.classList.remove('visible');
  dom.overlay.classList.add('hidden');
}

export function bindGlobalEvents() {
  dom.btnCopy.addEventListener('click', () => {
    if (!state.activeTpl || state.activeTpl === 'pasal') return;

    if (state.activeTpl === 'shift-logs') {
      if (!state.lastShiftRows.length) return;
      const summary = summarizeShiftLogs(state.lastShiftRows);
      downloadShiftLogsCsv(state.lastShiftRows, summary);
      dom.btnCopy.classList.add('copied');
      dom.btnCopy.textContent = '✓ Exported!';
      setTimeout(() => {
        setShiftExportButton(state.lastShiftRows.length > 0);
      }, 2000);
      return;
    }

    const vals   = collectValues();
    const output = formatOutput(state.activeTpl, vals);
    if (!output) return;
    copyToClipboard(output);
    dom.btnCopy.classList.add('copied');
    dom.btnCopy.textContent = '✓ Disalin!';
    setTimeout(() => {
      dom.btnCopy.classList.remove('copied');
      dom.btnCopy.innerHTML = '📋 Copy';
    }, 2000);
  });

  dom.previewBody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copy-target]');
    if (!btn || state.activeTpl !== 'pasal') return;
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

  dom.btnClear.addEventListener('click', clearForm);

  document.querySelectorAll('.tpl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activateTemplate(btn.dataset.tpl);
      closeMobile();
    });
  });

  dom.menuBtn.addEventListener('click', () => {
    const open = dom.sidebar.classList.toggle('open');
    dom.overlay.classList.toggle('visible', open);
    dom.overlay.classList.toggle('hidden', !open);
    if (dom.previewEl.classList.contains('open')) {
      dom.previewEl.classList.remove('open');
    }
  });

  dom.previewBtn.addEventListener('click', () => {
    const open = dom.previewEl.classList.toggle('open');
    dom.overlay.classList.toggle('visible', open);
    dom.overlay.classList.toggle('hidden', !open);
    if (dom.sidebar.classList.contains('open')) {
      dom.sidebar.classList.remove('open');
    }
  });

  dom.overlay.addEventListener('click', closeMobile);
}
