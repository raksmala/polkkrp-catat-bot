export function upperStr(v) {
  return typeof v === 'string' ? v.toUpperCase() : v;
}

export function enforceUppercase(e) {
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

export function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatKK(n) {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n) + ' $KK';
}

export function fmtDate(d) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function escAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escHtml(str) {
  return escAttr(str);
}

/* Inline SVG glyphs for icon-only controls; aria-hidden because the button carries the label. */
export const ICON_REMOVE =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>';
export const ICON_CHEVRON =
  '<svg viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>';
