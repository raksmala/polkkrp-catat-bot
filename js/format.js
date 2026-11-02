import { fmtDate, upperStr } from './utils.js';
import { combineSerials } from './serial.js';
import {
  getSkckDates,
  getKeperluanByIndex,
  isSkckCriminal,
  getSelectedPasalObjects,
} from './pasal.js';

export function formatOutput(tpl, vals) {
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
        `PANGKAT         : ${vals.pangkat || '—'}\n` +
        `TIPE SENJATA    : ${vals.tipe_senjata || '—'}\n` +
        `SERIAL NUMBER   : ${vals.serial_number || '—'}\n` +
        `TANGGAL         : ${fmtDate(new Date())}\n` +
        `KETERANGAN      : WD APD\n` +
        `WD/DP BY        : WD`;
      break;
    case 'senjata-ilegal':
      body =
        `NAMA SUSPECT    : ${vals.nama_suspect || '—'}\n` +
        `SERIAL NUMBER   : ${vals.serial_number || '—'}\n` +
        `KETERANGAN      : BB ${vals.keterangan || '—'}`;
      break;
    case 'jam-duty': {
      const jam   = parseInt(vals.jam, 10) || 0;
      const menit = parseInt(vals.menit, 10) || 0;
      const tanggal = vals.tanggal
        ? fmtDate(new Date(vals.tanggal + 'T00:00:00'))
        : fmtDate(new Date());
      body =
        `KEPOLISIAN NEGARA KOTA KITA\n` +
        `               KEPOLISIAN KOTA\n` +
        `-------------------------------------------------\n` +
        `Sifat       :  DATA KEANGGOTAAN\n` +
        `Perihal     :  JUMLAH JAM BERTUGAS BULAN ${vals.bulan || '—'}\n\n` +
        `BERIKUT HASIL DATA JUMLAH JAM BERTUGAS\n` +
        `ANGGOTA KEPOLISIAN DENGAN IDENTITAS\n\n` +
        `NAMA          : ${vals.nama || '—'}\n` +
        `CODE NAME     : ${vals.code_name || '—'}\n` +
        `DIVISI        : ${vals.divisi || '—'}\n` +
        `JUMLAH        : ${jam} jam ${menit} menit Bertugas\n\n` +
        `DATA DI ATAS MERUPAKAN HASIL PENJUMLAHAN SECARA SAH DARI JAM BERTUGAS ANGGOTA TERSEBUT. DAN SURAT INI DAPAT DI GUNAKAN SEBAGAIMANA SEMESTINYA\n\n\n` +
        `      DIKELUARKAN DI : KANTOR POLISI PUSAT KOTA KITA\n` +
        ` (${tanggal})\n` +
        `                    MENGETAHUI.\n` +
        `${vals.mengetahui || '—'}`;
      break;
    }
    case 'pencairan-gaji':
      body =
        `========== SURAT PENCAIRAN GAJI PAMEN & PATI ==========\n\n` +
        `Dengan hormat, disampaikan kepada Bapak/Ibu bahwa terdapat hak gaji yang perlu dibayarkan kepada perwira dengan data sebagai berikut:\n\n` +
        `    Nama          : ${vals.nama || ''}\n` +
        `    Pangkat       : ${vals.pangkat || ''}\n` +
        `    Divisi        : ${vals.divisi || ''}\n` +
        `Dengan ini menetapkan bahwa perwira yang bersangkutan telah dinyatakan memenuhi syarat, sehingga dapat dibayarkan tunjangannya. Dan dapat dicairkan melalui PERTIKA GABRIEL RAKHA SOEDJAJA dan SEKJEN DHYRA MESLER LANSKY`;
      break;
    case 'skck':
      return buildSkckOutput(vals).output;
    case 'serial-number': {
      const r = combineSerials(vals.serials, vals.jumlah_item);
      return r.total ? r.output : '';
    }
    default:
      return '';
  }
  if (!body) return '';
  return '```\n' + body + '\n```';
}

export function buildSkckOutput(vals) {
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
