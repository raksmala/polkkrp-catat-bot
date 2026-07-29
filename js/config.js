export const MAX_PENJARA = 40;

export const KEPERLUAN_LIST = [
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

export const TEMPLATES = {
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
    fields: ['nama', 'pangkat', 'tipe_senjata', 'serial_number'],
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
