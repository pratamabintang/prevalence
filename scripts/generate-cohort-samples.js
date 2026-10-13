const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Sample children list
// 1. Tetap Stunting (Ada di P1 dan P2) - 6 anak
const persistentChildren = [
  { nik: '3301011204220001', nama: 'Ahmad Fauzan', tglLahir: '2022-04-12', jk: 'L', puskesmas: 'Puskesmas Banyumanik', desa: 'Pudakpayung' },
  { nik: '3301015508220002', nama: 'Siti Nurhaliza', tglLahir: '2022-08-15', jk: 'P', puskesmas: 'Puskesmas Candisari', desa: 'Candi' },
  { nik: '3301020301230003', nama: 'Budi Santoso', tglLahir: '2023-01-03', jk: 'L', puskesmas: 'Puskesmas Gajahmungkur', desa: 'Sampangan' },
  { nik: '3301026011220004', nama: 'Dewi Lestari', tglLahir: '2022-11-20', jk: 'P', puskesmas: 'Puskesmas Genuk', desa: 'Bangetayu' },
  { nik: '3301032506230005', nama: 'Muhammad Rizky', tglLahir: '2023-06-25', jk: 'L', puskesmas: 'Puskesmas Gunungpati', desa: 'Sekaran' },
  { nik: '3301036802230006', nama: 'Anisa Rahmawati', tglLahir: '2023-02-28', jk: 'P', puskesmas: 'Puskesmas Mijen', desa: 'Pesantren' }
];

// 2. Sudah Tidak Stunting / Lolos (Ada di P1, TIDAK ada di P2) - 5 anak
const recoveredChildren = [
  { nik: '3301041109220007', nama: 'Dimas Aditya', tglLahir: '2022-09-11', jk: 'L', puskesmas: 'Puskesmas Ngaliyan', desa: 'Tambakaji' },
  { nik: '3301045210220008', nama: 'Fitri Handayani', tglLahir: '2022-10-12', jk: 'P', puskesmas: 'Puskesmas Pedurungan', desa: 'Tlogosari' },
  { nik: '3301050505230009', nama: 'Farhan Maulana', tglLahir: '2023-05-05', jk: 'L', puskesmas: 'Puskesmas Semarang Barat', desa: 'Krobokan' },
  { nik: '3301054707220010', nama: 'Nadia Putri', tglLahir: '2022-07-07', jk: 'P', puskesmas: 'Puskesmas Semarang Selatan', desa: 'Peterongan' },
  { nik: '3301061912220011', nama: 'Rafi Pratama', tglLahir: '2022-12-19', jk: 'L', puskesmas: 'Puskesmas Semarang Timur', desa: 'Rejosari' }
];

// 3. Kasus Baru Masuk Stunting (TIDAK ada di P1, ADA di P2) - 5 anak
const newStuntingChildren = [
  { nik: '3301066103230012', nama: 'Zahra Aulia', tglLahir: '2023-03-21', jk: 'P', puskesmas: 'Puskesmas Semarang Utara', desa: 'Bandarharjo' },
  { nik: '3301071408230013', nama: 'Ilham Hidayat', tglLahir: '2023-08-14', jk: 'L', puskesmas: 'Puskesmas Tembalang', desa: 'Sendangmulyo' },
  { nik: '3301075609230014', nama: 'Putri Maharani', tglLahir: '2023-09-16', jk: 'P', puskesmas: 'Puskesmas Tugu', desa: 'Mangkang' },
  { nik: '3301082201240015', nama: 'Kenzo Alfarizi', tglLahir: '2024-01-22', jk: 'L', puskesmas: 'Puskesmas Banyumanik', desa: 'Srondol' },
  { nik: '3301086504230016', nama: 'Alya Shabila', tglLahir: '2023-04-25', jk: 'P', puskesmas: 'Puskesmas Gunungpati', desa: 'Sadeng' }
];

// Period 1 Dataset (P1) = Persistent + Recovered (11 anak)
const p1Data = [...persistentChildren, ...recoveredChildren].map((c, idx) => ({
  'No': idx + 1,
  'NIK': String(c.nik),
  'Nama Balita': c.nama,
  'Tanggal Lahir': c.tglLahir,
  'Jenis Kelamin': c.jk,
  'Puskesmas': c.puskesmas,
  'Desa/Kelurahan': c.desa,
  'Status Stunting': 'Stunting'
}));

// Period 2 Dataset (P2) = Persistent + New (11 anak)
const p2Data = [...persistentChildren, ...newStuntingChildren].map((c, idx) => ({
  'No': idx + 1,
  'NIK': String(c.nik),
  'Nama Balita': c.nama,
  'Tanggal Lahir': c.tglLahir,
  'Jenis Kelamin': c.jk,
  'Puskesmas': c.puskesmas,
  'Desa/Kelurahan': c.desa,
  'Status Stunting': 'Stunting'
}));

function writeExcelFile(data, filePath, sheetName) {
  const ws = XLSX.utils.json_to_sheet(data);
  // Ensure NIK column format is forced to text format
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = 1; R <= range.e.r; ++R) {
    const cellRef = XLSX.utils.encode_cell({ c: 1, r: R }); // col 1 is NIK
    if (ws[cellRef]) {
      ws[cellRef].t = 's'; // string type
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filePath);
  console.log(`Saved: ${filePath} (${data.length} rows)`);
}

const outDir = path.join(__dirname, '..', 'public', 'data');
writeExcelFile(p1Data, path.join(outDir, 'sample-stunting-periode-1.xlsx'), 'Stunting_Periode_1');
writeExcelFile(p2Data, path.join(outDir, 'sample-stunting-periode-2.xlsx'), 'Stunting_Periode_2');
