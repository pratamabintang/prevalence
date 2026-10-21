const path = require('path');
const XLSX = require('xlsx');

// 1. Kategori: Tetap Stunting (Ada di Periode 1 dan Periode 2) - 6 Balita
const persistentChildren = [
  { nik: '3301011204220001', nama: 'Ahmad Fauzan', tglLahir: '2022-04-12', jk: 'L', puskesmas: 'Puskesmas Banyumanik', desa: 'Pudakpayung' },
  { nik: '3301015508220002', nama: 'Siti Nurhaliza', tglLahir: '2022-08-15', jk: 'P', puskesmas: 'Puskesmas Candisari', desa: 'Candi' },
  // Budi Santoso: Usia 66 Bulan (Lulus usia >= 60 Bulan tapi masih diinput stunting di P2 sebagai outlier/kesalahan input)
  { nik: '3301020301210003', nama: 'Budi Santoso (Outlier Usia)', tglLahir: '2021-04-10', jk: 'L', puskesmas: 'Puskesmas Gajahmungkur', desa: 'Sampangan' },
  { nik: '3301026011220004', nama: 'Dewi Lestari', tglLahir: '2022-11-20', jk: 'P', puskesmas: 'Puskesmas Genuk', desa: 'Bangetayu' },
  { nik: '3301032506230005', nama: 'Muhammad Rizky', tglLahir: '2023-06-25', jk: 'L', puskesmas: 'Puskesmas Gunungpati', desa: 'Sekaran' },
  { nik: '3301036802230006', nama: 'Anisa Rahmawati', tglLahir: '2023-02-28', jk: 'P', puskesmas: 'Puskesmas Mijen', desa: 'Pesantren' }
];

// 2. Kategori: Bebas Stunting (Ada di Periode 1, Tidak ada di Periode 2, Usia < 60 Bulan per Okt 2026) - 4 Balita
const recoveredChildren = [
  { nik: '3301041109220007', nama: 'Dimas Aditya', tglLahir: '2022-09-11', jk: 'L', puskesmas: 'Puskesmas Ngaliyan', desa: 'Tambakaji' },
  { nik: '3301045210220008', nama: 'Fitri Handayani', tglLahir: '2022-10-12', jk: 'P', puskesmas: 'Puskesmas Pedurungan', desa: 'Tlogosari' },
  { nik: '3301050505230009', nama: 'Farhan Maulana', tglLahir: '2023-05-05', jk: 'L', puskesmas: 'Puskesmas Semarang Barat', desa: 'Krobokan' },
  { nik: '3301054707220010', nama: 'Nadia Putri', tglLahir: '2022-07-07', jk: 'P', puskesmas: 'Puskesmas Semarang Selatan', desa: 'Peterongan' }
];

// 3. Kategori: Lulus Usia Balita (Ada di Periode 1, Tidak ada di Periode 2, Usia >= 60 Bulan per Okt 2026) - 2 Balita
const agedOutChildren = [
  { nik: '3301061908210011', nama: 'Rafi Pratama', tglLahir: '2021-08-19', jk: 'L', puskesmas: 'Puskesmas Semarang Timur', desa: 'Rejosari' },
  { nik: '3301065103210012', nama: 'Salma Kirana', tglLahir: '2021-03-15', jk: 'P', puskesmas: 'Puskesmas Gayamsari', desa: 'Pandean Lamper' }
];

// 4. Kategori: Kasus Baru Stunting (Tidak ada di Periode 1, Baru muncul di Periode 2) - 5 Balita
const newCaseChildren = [
  { nik: '3301066103230013', nama: 'Zahra Aulia', tglLahir: '2023-03-21', jk: 'P', puskesmas: 'Puskesmas Semarang Utara', desa: 'Bandarharjo' },
  { nik: '3301071408230014', nama: 'Ilham Hidayat', tglLahir: '2023-08-14', jk: 'L', puskesmas: 'Puskesmas Tembalang', desa: 'Sendangmulyo' },
  { nik: '3301075609230015', nama: 'Putri Maharani', tglLahir: '2023-09-16', jk: 'P', puskesmas: 'Puskesmas Tugu', desa: 'Mangkang' },
  { nik: '3301082201240016', nama: 'Kenzo Alfarizi', tglLahir: '2024-01-22', jk: 'L', puskesmas: 'Puskesmas Banyumanik', desa: 'Srondol' },
  { nik: '3301086504230017', nama: 'Alya Shabila', tglLahir: '2023-04-25', jk: 'P', puskesmas: 'Puskesmas Gunungpati', desa: 'Sadeng' }
];

// Dataset Periode 1 (Baseline): Persistent + Recovered + AgedOut = 6 + 4 + 2 = 12 Balita
const datasetPeriode1 = [...persistentChildren, ...recoveredChildren, ...agedOutChildren].map((c, idx) => ({
  'No': idx + 1,
  'NIK': String(c.nik),
  'Nama Balita': c.nama,
  'Tanggal Lahir': c.tglLahir,
  'Jenis Kelamin': c.jk,
  'Puskesmas': c.puskesmas,
  'Desa/Kelurahan': c.desa,
  'Status Gizi': 'Stunting'
}));

// Dataset Periode 2 (Evaluasi): Persistent + NewCase = 6 + 5 = 11 Balita
const datasetPeriode2 = [...persistentChildren, ...newCaseChildren].map((c, idx) => ({
  'No': idx + 1,
  'NIK': String(c.nik),
  'Nama Balita': c.nama,
  'Tanggal Lahir': c.tglLahir,
  'Jenis Kelamin': c.jk,
  'Puskesmas': c.puskesmas,
  'Desa/Kelurahan': c.desa,
  'Status Gizi': 'Stunting'
}));

function createStyledExcelFile(data, filePath, sheetName) {
  const ws = XLSX.utils.json_to_sheet(data);

  // Set explicit string type for NIK column (col index 1)
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = 1; R <= range.e.r; ++R) {
    const cellRef = XLSX.utils.encode_cell({ c: 1, r: R });
    if (ws[cellRef]) {
      ws[cellRef].t = 's';
    }
  }

  // Set column widths
  ws['!cols'] = [
    { wch: 6 },  // No
    { wch: 20 }, // NIK
    { wch: 22 }, // Nama Balita
    { wch: 14 }, // Tanggal Lahir
    { wch: 14 }, // Jenis Kelamin
    { wch: 25 }, // Puskesmas
    { wch: 20 }, // Desa/Kelurahan
    { wch: 14 }  // Status Gizi
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filePath);
  console.log(`Generated: ${filePath} (${data.length} baris)`);
}

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public', 'data');

// Simpan ke public/data untuk tombol "Muat Data Contoh"
createStyledExcelFile(datasetPeriode1, path.join(publicDir, 'sample-stunting-periode-1.xlsx'), 'Stunting_Periode_1');
createStyledExcelFile(datasetPeriode2, path.join(publicDir, 'sample-stunting-periode-2.xlsx'), 'Stunting_Periode_2');
