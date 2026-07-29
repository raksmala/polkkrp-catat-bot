export const state = {
  activeTpl: null,
  barangEntries: [{ nama: '', jumlah: '' }],
  pasalEntries: [{ kode: '' }],
  uuData: null,
  pasalList: [],
  pasalLookup: {},
  /** @type {{ name: string, identifier: string, start: Date, end: Date, startStr: string, endStr: string, durationSeconds: number, durationMinutes: number, durationLabel: string }[]} */
  lastShiftRows: [],
};

export const dom = {
  sidebar: document.getElementById('sidebar'),
  formArea: document.getElementById('formArea'),
  formTitle: document.getElementById('formTitle'),
  formDesc: document.getElementById('formDesc'),
  btnClear: document.getElementById('btnClear'),
  previewBody: document.getElementById('previewBody'),
  charCounter: document.getElementById('charCounter'),
  btnCopy: document.getElementById('btnCopy'),
  toast: document.getElementById('toast'),
  overlay: document.getElementById('overlay'),
  menuBtn: document.getElementById('menuBtn'),
  previewBtn: document.getElementById('previewBtn'),
  previewEl: document.getElementById('preview'),
};
