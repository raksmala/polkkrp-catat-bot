/* Serial number combiner: one serial per line (or comma/semicolon/tab separated),
   padded with "-" up to the item count, joined with ", ". */

export const SERIAL_EMPTY = '-';

export function parseSerials(text) {
  return String(text || '')
    .split(/[\n,;\t]+/)
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
}

export function combineSerials(text, jumlahRaw) {
  const serials = parseSerials(text);
  const jumlah = Math.max(0, parseInt(jumlahRaw, 10) || 0);
  const total = Math.max(jumlah, serials.length);
  const items = Array.from({ length: total }, (_, i) => serials[i] || SERIAL_EMPTY);

  const seen = new Set();
  const duplicates = new Set();
  serials.forEach(s => (seen.has(s) ? duplicates.add(s) : seen.add(s)));

  return {
    output: items.join(', '),
    serials,
    jumlah,
    total,
    empty: total - serials.length,
    overflow: jumlah > 0 && serials.length > jumlah,
    duplicates: [...duplicates],
  };
}
