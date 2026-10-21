const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx-js-style');

// ============================================================
// 1. DATA MASTER WILAYAH JAWA TENGAH (35 KABUPATEN / KOTA)
// ============================================================
const KABUPATEN_KOTA_LIST = [
  {
    kodeKab: '01',
    nama: 'KABUPATEN CILACAP',
    districts: [
      { kec: 'Cilacap Selatan', desa: ['Sidakaya', 'Cilacap', 'Tambakreja'], pusk: 'Puskesmas Cilacap Selatan 1' },
      { kec: 'Kesugihan', desa: ['Kesugihan', 'Menganti', 'Kuripan'], pusk: 'Puskesmas Kesugihan 1' },
      { kec: 'Majenang', desa: ['Jenang', 'Sindangsari', 'Padangsari'], pusk: 'Puskesmas Majenang 1' },
      { kec: 'Kroya', desa: ['Kroya', 'Bajing', 'Pucung'], pusk: 'Puskesmas Kroya 1' }
    ]
  },
  {
    kodeKab: '02',
    nama: 'KABUPATEN BANYUMAS',
    districts: [
      { kec: 'Purwokerto Timur', desa: ['Purwokerto Wetan', 'Kranji', 'Arcawinangun'], pusk: 'Puskesmas Purwokerto Timur 1' },
      { kec: 'Sokaraja', desa: ['Sokaraja Kulon', 'Sokaraja Wetan', 'Karangduren'], pusk: 'Puskesmas Sokaraja 1' },
      { kec: 'Ajibarang', desa: ['Ajibarang Kulon', 'Pandansari'], pusk: 'Puskesmas Ajibarang 1' },
      { kec: 'Baturraden', desa: ['Karangmangu', 'Rempoah'], pusk: 'Puskesmas Baturraden 1' }
    ]
  },
  {
    kodeKab: '03',
    nama: 'KABUPATEN PURBALINGGA',
    districts: [
      { kec: 'Purbalingga', desa: ['Purbalingga Lor', 'Bancar', 'Penambongan'], pusk: 'Puskesmas Purbalingga' },
      { kec: 'Bobotsari', desa: ['Bobotsari', 'Dagan', 'Karangtalun'], pusk: 'Puskesmas Bobotsari' },
      { kec: 'Kalimanah', desa: ['Kalimanah Wetan', 'Blater'], pusk: 'Puskesmas Kalimanah' }
    ]
  },
  {
    kodeKab: '04',
    nama: 'KABUPATEN BANJARNEGARA',
    districts: [
      { kec: 'Banjarnegara', desa: ['Krandegan', 'Parakancanggah', 'Semampir'], pusk: 'Puskesmas Banjarnegara 1' },
      { kec: 'Bawang', desa: ['Bawang', 'Mantrianom', 'Binorong'], pusk: 'Puskesmas Bawang 1' },
      { kec: 'Mandiraja', desa: ['Mandiraja Kulon', 'Purwasaba'], pusk: 'Puskesmas Mandiraja 1' }
    ]
  },
  {
    kodeKab: '05',
    nama: 'KABUPATEN KEBUMEN',
    districts: [
      { kec: 'Kebumen', desa: ['Kebumen', 'Panjer', 'Kutosari'], pusk: 'Puskesmas Kebumen 1' },
      { kec: 'Gombong', desa: ['Gombong', 'Semanding', 'Wero'], pusk: 'Puskesmas Gombong 1' },
      { kec: 'Karanganyar', desa: ['Karanganyar', 'Plarangan'], pusk: 'Puskesmas Karanganyar' }
    ]
  },
  {
    kodeKab: '06',
    nama: 'KABUPATEN PURWOREJO',
    districts: [
      { kec: 'Purworejo', desa: ['Baledono', 'Pangenjuru Tengah', 'Sindurjan'], pusk: 'Puskesmas Purworejo' },
      { kec: 'Kutoarjo', desa: ['Kutoarjo', 'Bandung', 'Semawung'], pusk: 'Puskesmas Kutoarjo' }
    ]
  },
  {
    kodeKab: '07',
    nama: 'KABUPATEN WONOSOBO',
    districts: [
      { kec: 'Wonosobo', desa: ['Wonosobo Timur', 'Jaraksari', 'Sambek'], pusk: 'Puskesmas Wonosobo 1' },
      { kec: 'Garung', desa: ['Garung', 'Dieng', 'Menjer'], pusk: 'Puskesmas Garung' }
    ]
  },
  {
    kodeKab: '08',
    nama: 'KABUPATEN MAGELANG',
    districts: [
      { kec: 'Mertoyudan', desa: ['Mertoyudan', 'Banyurojo', 'Deyangan'], pusk: 'Puskesmas Mertoyudan 1' },
      { kec: 'Borobudur', desa: ['Borobudur', 'Wanurejo', 'Tanjungsari'], pusk: 'Puskesmas Borobudur' },
      { kec: 'Muntilan', desa: ['Muntilan', 'Pabelan', 'Sedayu'], pusk: 'Puskesmas Muntilan 1' }
    ]
  },
  {
    kodeKab: '09',
    nama: 'KABUPATEN BOYOLALI',
    districts: [
      { kec: 'Boyolali', desa: ['Siswodipuran', 'Banaran', 'Kemiri'], pusk: 'Puskesmas Boyolali 1' },
      { kec: 'Ampel', desa: ['Ampel', 'Candi', 'Urutsewu'], pusk: 'Puskesmas Ampel' }
    ]
  },
  {
    kodeKab: '10',
    nama: 'KABUPATEN KLATEN',
    districts: [
      { kec: 'Klaten Tengah', desa: ['Bareng', 'Buntalan', 'Mojayan'], pusk: 'Puskesmas Klaten Tengah' },
      { kec: 'Delanggu', desa: ['Delanggu', 'Gatak', 'Saban'], pusk: 'Puskesmas Delanggu' }
    ]
  },
  {
    kodeKab: '11',
    nama: 'KABUPATEN SUKOHARJO',
    districts: [
      { kec: 'Sukoharjo', desa: ['Sukoharjo', 'Gayam', 'Krapyak'], pusk: 'Puskesmas Sukoharjo' },
      { kec: 'Kartasura', desa: ['Kartasura', 'Ngadirejo', 'Pabelan'], pusk: 'Puskesmas Kartasura' }
    ]
  },
  {
    kodeKab: '12',
    nama: 'KABUPATEN WONOGIRI',
    districts: [
      { kec: 'Wonogiri', desa: ['Giritirto', 'Giripurwo', 'Wonoboyo'], pusk: 'Puskesmas Wonogiri 1' },
      { kec: 'Baturetno', desa: ['Baturetno', 'Belikurip'], pusk: 'Puskesmas Baturetno 1' }
    ]
  },
  {
    kodeKab: '13',
    nama: 'KABUPATEN KARANGANYAR',
    districts: [
      { kec: 'Karanganyar', desa: ['Bejen', 'Jungke', 'Karanganyar'], pusk: 'Puskesmas Karanganyar' },
      { kec: 'Colomadu', desa: ['Bongan', 'Gedongan', 'Malangjiwan'], pusk: 'Puskesmas Colomadu 1' }
    ]
  },
  {
    kodeKab: '14',
    nama: 'KABUPATEN SRAGEN',
    districts: [
      { kec: 'Sragen', desa: ['Sragen Tengah', 'Sragen Kulon', 'Sine'], pusk: 'Puskesmas Sragen' },
      { kec: 'Masaran', desa: ['Masaran', 'Jati', 'Krikilan'], pusk: 'Puskesmas Masaran 1' }
    ]
  },
  {
    kodeKab: '15',
    nama: 'KABUPATEN GROBOGAN',
    districts: [
      { kec: 'Purwodadi', desa: ['Purwodadi', 'Danyang', 'Kuripan'], pusk: 'Puskesmas Purwodadi 1' },
      { kec: 'Wirosari', desa: ['Wirosari', 'Gedangan'], pusk: 'Puskesmas Wirosari 1' }
    ]
  },
  {
    kodeKab: '16',
    nama: 'KABUPATEN BLORA',
    districts: [
      { kec: 'Blora', desa: ['Kedungjenar', 'Tempelan', 'Kunduran'], pusk: 'Puskesmas Blora' },
      { kec: 'Cepu', desa: ['Cepu', 'Balun', 'Karangboyo'], pusk: 'Puskesmas Cepu' }
    ]
  },
  {
    kodeKab: '17',
    nama: 'KABUPATEN REMBANG',
    districts: [
      { kec: 'Rembang', desa: ['Kabongan Kidul', 'Tanjungsari', 'Leteh'], pusk: 'Puskesmas Rembang 1' },
      { kec: 'Lasem', desa: ['Sodan', 'Karangturi', 'Ngemplak'], pusk: 'Puskesmas Lasem' }
    ]
  },
  {
    kodeKab: '18',
    nama: 'KABUPATEN PATI',
    districts: [
      { kec: 'Pati', desa: ['Pati Kidul', 'Pati Lor', 'Pati Wetan'], pusk: 'Puskesmas Pati 1' },
      { kec: 'Juwana', desa: ['Bajomulyo', 'Kauman', 'Growong Kidul'], pusk: 'Puskesmas Juwana' }
    ]
  },
  {
    kodeKab: '19',
    nama: 'KABUPATEN KUDUS',
    districts: [
      { kec: 'Kudus Kota', desa: ['Demaan', 'Kajeksan', 'Kerjasan'], pusk: 'Puskesmas Purwosari' },
      { kec: 'Jati', desa: ['Jati Wetan', 'Jati Kulon', 'Ploso'], pusk: 'Puskesmas Jati' }
    ]
  },
  {
    kodeKab: '20',
    nama: 'KABUPATEN JEPARA',
    districts: [
      { kec: 'Jepara', desa: ['Panggang', 'Bapangan', 'Kauman'], pusk: 'Puskesmas Jepara' },
      { kec: 'Tahunan', desa: ['Tahunan', 'Mantingan', 'Senegan'], pusk: 'Puskesmas Tahunan' }
    ]
  },
  {
    kodeKab: '21',
    nama: 'KABUPATEN DEMAK',
    districts: [
      { kec: 'Demak', desa: ['Bintoro', 'Mangunjiwan', 'Betokan'], pusk: 'Puskesmas Demak 1' },
      { kec: 'Sayung', desa: ['Sayung', 'Sriwulan', 'Bedono'], pusk: 'Puskesmas Sayung 1' }
    ]
  },
  {
    kodeKab: '22',
    nama: 'KABUPATEN SEMARANG',
    districts: [
      { kec: 'Ungaran Barat', desa: ['Bandarjo', 'Genuk', 'Langensari'], pusk: 'Puskesmas Ungaran' },
      { kec: 'Ambarawa', desa: ['Kupang', 'Lodoyong', 'Panjang'], pusk: 'Puskesmas Ambarawa' }
    ]
  },
  {
    kodeKab: '23',
    nama: 'KABUPATEN TEMANGGUNG',
    districts: [
      { kec: 'Temanggung', desa: ['Temanggung I', 'Kowangan', 'Banyuurip'], pusk: 'Puskesmas Temanggung' },
      { kec: 'Parakan', desa: ['Parakan Wetan', 'Parakan Kauman'], pusk: 'Puskesmas Parakan' }
    ]
  },
  {
    kodeKab: '24',
    nama: 'KABUPATEN KENDAL',
    districts: [
      { kec: 'Kendal', desa: ['Pegulon', 'Pegangsaan', 'Karangsari'], pusk: 'Puskesmas Kendal 1' },
      { kec: 'Kaliwungu', desa: ['Kutoharjo', 'Krajankulon', 'Mororejo'], pusk: 'Puskesmas Kaliwungu' }
    ]
  },
  {
    kodeKab: '25',
    nama: 'KABUPATEN BATANG',
    districts: [
      { kec: 'Batang', desa: ['Kasepuhan', 'Proyonanggan Tengah', 'Kauman'], pusk: 'Puskesmas Batang 1' },
      { kec: 'Subah', desa: ['Subah', 'Jatisari', 'Clapar'], pusk: 'Puskesmas Subah' }
    ]
  },
  {
    kodeKab: '26',
    nama: 'KABUPATEN PEKALONGAN',
    districts: [
      { kec: 'Kajen', desa: ['Kajen', 'Nyamok', 'Tanjungsari'], pusk: 'Puskesmas Kajen 1' },
      { kec: 'Kedungwuni', desa: ['Kedungwuni Barat', 'Krandegan'], pusk: 'Puskesmas Kedungwuni 1' }
    ]
  },
  {
    kodeKab: '27',
    nama: 'KABUPATEN PEMALANG',
    districts: [
      { kec: 'Pemalang', desa: ['Mulyoharjo', 'Pelutan', 'Bojongbata'], pusk: 'Puskesmas Pemalang' },
      { kec: 'Comal', desa: ['Purwoharjo', 'Sidorejo', 'Kauman'], pusk: 'Puskesmas Comal' }
    ]
  },
  {
    kodeKab: '28',
    nama: 'KABUPATEN TEGAL',
    districts: [
      { kec: 'Slawi', desa: ['Kudaile', 'Procot', 'Slawi Kulon'], pusk: 'Puskesmas Slawi' },
      { kec: 'Adiwerna', desa: ['Adiwerna', 'Pesarean', 'Ujungrusi'], pusk: 'Puskesmas Adiwerna' }
    ]
  },
  {
    kodeKab: '29',
    nama: 'KABUPATEN BREBES',
    districts: [
      { kec: 'Brebes', desa: ['Brebes', 'Pasarbatang', 'Gandis'], pusk: 'Puskesmas Brebes' },
      { kec: 'Bumiayu', desa: ['Bumiayu', 'Dukuhturi', 'Jatisawit'], pusk: 'Puskesmas Bumiayu' },
      { kec: 'Jatibarang', desa: ['Jatibarang Lor', 'Jatibarang Kidul'], pusk: 'Puskesmas Jatibarang' }
    ]
  },
  {
    kodeKab: '71',
    nama: 'KOTA MAGELANG',
    districts: [
      { kec: 'Magelang Tengah', desa: ['Cacaban', 'Kemirirejo', 'Panjunan'], pusk: 'Puskesmas Magelang Tengah' },
      { kec: 'Magelang Selatan', desa: ['Rejowinangun Selatan', 'Magersari'], pusk: 'Puskesmas Magelang Selatan' }
    ]
  },
  {
    kodeKab: '72',
    nama: 'KOTA SURAKARTA',
    districts: [
      { kec: 'Banjarsari', desa: ['Manahan', 'Kadipiro', 'Banyuanyar'], pusk: 'Puskesmas Manahan' },
      { kec: 'Jebres', desa: ['Mojosongo', 'Jebres', 'Purwodiningratan'], pusk: 'Puskesmas Purwodiningratan' },
      { kec: 'Laweyan', desa: ['Pajang', 'Sondakan', 'Purwosari'], pusk: 'Puskesmas Pajang' }
    ]
  },
  {
    kodeKab: '73',
    nama: 'KOTA SALATIGA',
    districts: [
      { kec: 'Sidorejo', desa: ['Sidorejo Lor', 'Blotongan', 'Pulutan'], pusk: 'Puskesmas Sidorejo Lor' },
      { kec: 'Tingkir', desa: ['Kutowinangun Lor', 'Tingkir Tengah'], pusk: 'Puskesmas Tingkir' }
    ]
  },
  {
    kodeKab: '74',
    nama: 'KOTA SEMARANG',
    districts: [
      { kec: 'Semarang Tengah', desa: ['Pandansari', 'Sekayu', 'Pekunden'], pusk: 'Puskesmas Poncol' },
      { kec: 'Banyumanik', desa: ['Srondol Kulon', 'Padangsari', 'Pudakpayung'], pusk: 'Puskesmas Padangsari' },
      { kec: 'Pedurungan', desa: ['Tlogosari Kulon', 'Pedurungan Tengah'], pusk: 'Puskesmas Tlogosari Kulon' }
    ]
  },
  {
    kodeKab: '75',
    nama: 'KOTA PEKALONGAN',
    districts: [
      { kec: 'Pekalongan Barat', desa: ['Bendan Kergon', 'Pasirkratonkramat'], pusk: 'Puskesmas Bendan' },
      { kec: 'Pekalongan Timur', desa: ['Noyontaan', 'Poncol', 'Kauman'], pusk: 'Puskesmas Noyontaan' }
    ]
  },
  {
    kodeKab: '76',
    nama: 'KOTA TEGAL',
    districts: [
      { kec: 'Tegal Barat', desa: ['Tegalsari', 'Kraton', 'Pekauman'], pusk: 'Puskesmas Tegal Barat' },
      { kec: 'Tegal Timur', desa: ['Slerok', 'Mangkukusuman', 'Kejambon'], pusk: 'Puskesmas Tegal Timur' }
    ]
  }
];

// Names
const BOY_FIRST = ['Muhammad', 'Ahmad', 'Dimas', 'Rafi', 'Kenzo', 'Arkan', 'Bagas', 'Ilham', 'Farel', 'Reza', 'Gibran', 'Haikal', 'Fadhil', 'Aditya', 'Bayu', 'Fauzan', 'Rizky', 'Danial', 'Zidan', 'Gilang', 'Rendra', 'Satria', 'Raditya', 'Alif', 'Ibrahim', 'Yusuf', 'Arka', 'Bima'];
const BOY_LAST = ['Pratama', 'Saputra', 'Ramadhan', 'Maulana', 'Hidayat', 'Kurniawan', 'Nugroho', 'Setiawan', 'Firmansyah', 'Santoso', 'Wijaya', 'Kusuma', 'Alfarizi', 'Syahputra', 'Wibowo', 'Wicaksono', 'Subagyo', 'Permana'];
const GIRL_FIRST = ['Aisyah', 'Siti', 'Zahra', 'Anisa', 'Nadia', 'Fitri', 'Alya', 'Salma', 'Putri', 'Aqila', 'Khansa', 'Naura', 'Nayra', 'Kirana', 'Safira', 'Kayla', 'Tasya', 'Tiara', 'Syifa', 'Indah', 'Lestari', 'Salsabila', 'Nabila', 'Rania', 'Hanifah', 'Dzakira'];
const GIRL_LAST = ['Nurhaliza', 'Rahmawati', 'Handayani', 'Maharani', 'Shabila', 'Aulia', 'Kirana', 'Wulandari', 'Anggraini', 'Kusumawati', 'Utami', 'Lestari', 'Sari', 'Pertiwi', 'Hasanah', 'Fauziyah', 'Permatasari'];
const MOTHER_FIRST = ['Sri', 'Endang', 'Wahyu', 'Siti', 'Nur', 'Dewi', 'Tri', 'Retno', 'Yuni', 'Rini', 'Dwi', 'Fitri', 'Sulastri', 'Sumarni', 'Supartini', 'Ika', 'Eni', 'Hesti', 'Lilis', 'Purwanti'];
const MOTHER_LAST = ['Mulyani', 'Lestari', 'Handayani', 'Rahayu', 'Astuti', 'Widayati', 'Susanti', 'Khasanah', 'Wati', 'Haryanti', 'Sulistyo', 'Kurniasih', 'Suryani', 'Pujiastuti', 'Purwaningsih'];
const POSYANDU_NAMES = ['Mawar 1', 'Mawar 2', 'Melati 1', 'Melati 2', 'Kenanga 1', 'Kenanga 2', 'Dahlia', 'Flamboyan', 'Cempaka', 'Anggrek 1', 'Anggrek 2', 'Nusa Indah', 'Teratai', 'Bougenville', 'Kamboja'];

// WHO Knots
function getWhoHeightRef(ageMonths, isBoy) {
  const knots = [
    [0, 49.9, 1.89, 49.1, 1.89],
    [3, 61.4, 2.16, 59.8, 2.14],
    [6, 67.6, 2.33, 65.7, 2.32],
    [9, 72.0, 2.47, 70.1, 2.47],
    [12, 75.7, 2.58, 74.0, 2.59],
    [18, 82.3, 2.88, 80.7, 2.89],
    [24, 87.1, 3.20, 85.7, 3.21],
    [30, 91.9, 3.48, 90.7, 3.49],
    [36, 96.1, 3.73, 95.1, 3.74],
    [42, 99.9, 3.98, 99.0, 4.00],
    [48, 103.3, 4.22, 102.7, 4.25],
    [54, 106.7, 4.43, 106.2, 4.48],
    [59, 110.0, 4.63, 109.4, 4.67],
    [65, 113.8, 4.88, 113.2, 4.90]
  ];

  let i = 0;
  while (i < knots.length - 1 && knots[i + 1][0] <= ageMonths) i++;
  if (i >= knots.length - 1) i = knots.length - 2;

  const [a0, bM0, bSD0, gM0, gSD0] = knots[i];
  const [a1, bM1, bSD1, gM1, gSD1] = knots[i + 1];
  const t = Math.max(0, Math.min(1, (ageMonths - a0) / (a1 - a0)));

  if (isBoy) {
    return { M: bM0 + t * (bM1 - bM0), SD: bSD0 + t * (bSD1 - bSD0) };
  } else {
    return { M: gM0 + t * (gM1 - gM0), SD: gSD0 + t * (gSD1 - gSD0) };
  }
}

function getWhoWeightAgeRef(ageMonths, isBoy) {
  const knots = [
    [0, 3.3, 0.44, 3.2, 0.42],
    [3, 6.4, 0.73, 5.8, 0.69],
    [6, 7.9, 0.86, 7.3, 0.83],
    [9, 8.9, 0.96, 8.2, 0.93],
    [12, 9.6, 1.05, 8.9, 1.01],
    [18, 10.9, 1.19, 10.2, 1.16],
    [24, 12.2, 1.34, 11.5, 1.33],
    [30, 13.3, 1.48, 12.7, 1.49],
    [36, 14.3, 1.63, 13.9, 1.66],
    [42, 15.3, 1.79, 15.0, 1.85],
    [48, 16.3, 1.96, 16.1, 2.05],
    [54, 17.3, 2.15, 17.2, 2.26],
    [59, 18.3, 2.36, 18.2, 2.48],
    [65, 19.5, 2.60, 19.4, 2.70]
  ];

  let i = 0;
  while (i < knots.length - 1 && knots[i + 1][0] <= ageMonths) i++;
  if (i >= knots.length - 1) i = knots.length - 2;

  const [a0, bM0, bSD0, gM0, gSD0] = knots[i];
  const [a1, bM1, bSD1, gM1, gSD1] = knots[i + 1];
  const t = Math.max(0, Math.min(1, (ageMonths - a0) / (a1 - a0)));

  if (isBoy) {
    return { M: bM0 + t * (bM1 - bM0), SD: bSD0 + t * (bSD1 - bSD0) };
  } else {
    return { M: gM0 + t * (gM1 - gM0), SD: gSD0 + t * (gSD1 - gSD0) };
  }
}

function getWhoWeightHeightRef(heightCm, isBoy) {
  const knots = [
    [45, 2.4, 0.28, 2.5, 0.28],
    [50, 3.3, 0.35, 3.4, 0.35],
    [55, 4.5, 0.44, 4.5, 0.44],
    [60, 5.9, 0.54, 5.7, 0.54],
    [65, 7.4, 0.65, 7.0, 0.65],
    [70, 8.6, 0.75, 8.2, 0.75],
    [75, 9.6, 0.85, 9.2, 0.85],
    [80, 10.7, 0.95, 10.3, 0.95],
    [85, 11.8, 1.05, 11.4, 1.05],
    [90, 13.0, 1.18, 12.6, 1.18],
    [95, 14.2, 1.30, 13.8, 1.30],
    [100, 15.5, 1.46, 15.1, 1.46],
    [105, 16.8, 1.65, 16.5, 1.65],
    [110, 18.3, 1.86, 18.0, 1.86],
    [115, 20.0, 2.10, 19.8, 2.10],
    [120, 22.0, 2.40, 21.8, 2.40]
  ];

  const clampedH = Math.max(45, Math.min(120, heightCm));
  let i = 0;
  while (i < knots.length - 1 && knots[i + 1][0] <= clampedH) i++;
  if (i >= knots.length - 1) i = knots.length - 2;

  const [h0, bM0, bSD0, gM0, gSD0] = knots[i];
  const [h1, bM1, bSD1, gM1, gSD1] = knots[i + 1];
  const t = Math.max(0, Math.min(1, (clampedH - h0) / (h1 - h0)));

  if (isBoy) {
    return { M: bM0 + t * (bM1 - bM0), SD: bSD0 + t * (bSD1 - bSD0) };
  } else {
    return { M: gM0 + t * (gM1 - gM0), SD: gSD0 + t * (gSD1 - gSD0) };
  }
}

function calcZScore(value, median, sd) {
  return (value - median) / sd;
}

function classifyBBU(z) {
  if (z < -6 || z > 5) return 'Outlier';
  if (z < -3) return 'Sangat Kurang';
  if (z < -2) return 'Kurang';
  if (z <= 1) return 'Berat Badan Normal';
  return 'Risiko Lebih';
}

function classifyTBU(z) {
  if (z < -6 || z > 6) return 'Outlier';
  if (z < -3) return 'Sangat Pendek';
  if (z < -2) return 'Pendek';
  if (z <= 3) return 'Normal';
  return 'Tinggi';
}

function classifyBBTB(z) {
  if (z < -5 || z > 5) return 'Outlier';
  if (z < -3) return 'Gizi Buruk';
  if (z < -2) return 'Gizi Kurang';
  if (z <= 1) return 'Gizi Baik (Normal)';
  if (z <= 2) return 'Risiko Gizi Lebih';
  if (z <= 3) return 'Gizi Lebih';
  return 'Obesitas';
}

function formatDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Build 350 Synthetic Cohort Children
function generateCohortDataset() {
  const p1EvalDate = new Date('2025-07-20');
  const p2EvalDate = new Date('2026-01-20'); // exactly 6 months later

  const targets = [
    // 1. Stunting Cohort Targets
    { type: 'PERSISTENT', count: 30 },            // Stunted in P1, Stunted in P2
    { type: 'RECOVERED', count: 14 },             // Stunted in P1, Catch-up normal in P2
    { type: 'STUNTING_MISSING_P2', count: 7 },    // Stunted in P1, Missing in P2 (treated as Lulus Stunting / Bebas)
    { type: 'AGED_OUT', count: 8 },               // Stunted in P1, Age >= 60 in P2 (Lulus Usia Balita)
    { type: 'NEW_CASE', count: 15 },              // Normal in P1, Stunted in P2
    { type: 'OUTLIER', count: 2 },                // Stunted in P1, Age >= 60 in P2 (Outlier)

    // 2. Gizi Buruk Targets (Severely Wasted, BB/TB < -3.0 SD)
    { type: 'GIZI_BURUK_PERSISTENT', count: 5 },  // Gizi Buruk in P1, Gizi Buruk in P2
    { type: 'GIZI_BURUK_RECOVERED', count: 7 },   // Gizi Buruk in P1, Therapeutic weight gain -> Normal in P2
    { type: 'GIZI_BURUK_NEW_CASE', count: 4 },    // Normal in P1, Acute drop -> Gizi Buruk in P2

    // 3. Wasting (Gizi Kurang, -3.0 <= BB/TB < -2.0 SD)
    { type: 'WASTING_ONLY', count: 12 },          // Gizi Kurang in P1 (6 persistent, 6 recovered)

    // 4. Overweight (BB/TB > +2.0 SD)
    { type: 'OVERWEIGHT', count: 8 },             // Overweight in P1 (4 persistent, 4 normalized)

    // 5. Normal children (healthy controls)
    { type: 'NORMAL', count: 238 },
  ];

  const totalChildren = targets.reduce((sum, t) => sum + t.count, 0); // 350
  console.log(`Total children to generate: ${totalChildren}`);

  const p1Records = [];
  const p2Records = [];

  let globalIdx = 0;

  for (const group of targets) {
    for (let c = 0; c < group.count; c++) {
      globalIdx++;
      const isBoy = Math.random() < 0.51;
      const jk = isBoy ? 'L' : 'P';

      const kabObj = KABUPATEN_KOTA_LIST[(globalIdx - 1) % KABUPATEN_KOTA_LIST.length];
      const dist = kabObj.districts[c % kabObj.districts.length];
      const desa = dist.desa[c % dist.desa.length];
      const pusk = dist.pusk;
      const posy = POSYANDU_NAMES[c % POSYANDU_NAMES.length];

      const firstName = isBoy
        ? BOY_FIRST[(c * 3 + globalIdx) % BOY_FIRST.length]
        : GIRL_FIRST[(c * 3 + globalIdx) % GIRL_FIRST.length];
      const lastName = isBoy
        ? BOY_LAST[(c * 5 + globalIdx) % BOY_LAST.length]
        : GIRL_LAST[(c * 5 + globalIdx) % GIRL_LAST.length];
      const childName = `${firstName} ${lastName}`;

      const motherFirst = MOTHER_FIRST[(c * 2 + globalIdx) % MOTHER_FIRST.length];
      const motherLast = MOTHER_LAST[(c * 4 + globalIdx) % MOTHER_LAST.length];
      const motherName = `${motherFirst} ${motherLast}`;

      // NIK Anak: 33 + kodeKab + 01 + DD(+40 for girl) + MM + YY + counter
      // Determine birth date based on cohort group
      let p1AgeMonths;
      if (group.type === 'AGED_OUT') {
        p1AgeMonths = 55 + (c % 4); // 55, 56, 57, 58 months -> In P2 will be 61-64 months
      } else if (group.type === 'OUTLIER') {
        p1AgeMonths = 56; // in P2 will be 62 months, but still recorded in P2
      } else if (group.type === 'STUNTING_MISSING_P2') {
        p1AgeMonths = 18 + (c % 16); // 18 to 33 months
      } else if (group.type === 'NEW_CASE') {
        p1AgeMonths = 8 + (c % 30); // 8 to 37 months
      } else if (group.type === 'RECOVERED') {
        p1AgeMonths = 10 + (c % 32); // 10 to 41 months
      } else if (group.type === 'PERSISTENT') {
        p1AgeMonths = 12 + (c % 36); // 12 to 47 months
      } else if (group.type.startsWith('GIZI_BURUK')) {
        p1AgeMonths = 9 + (c % 24); // 9 to 32 months
      } else if (group.type === 'WASTING_ONLY') {
        p1AgeMonths = 10 + (c % 28);
      } else if (group.type === 'OVERWEIGHT') {
        p1AgeMonths = 14 + (c % 30);
      } else {
        // NORMAL
        p1AgeMonths = 2 + (c % 52); // 2 to 53 months
      }

      const birthDate = new Date(p1EvalDate);
      birthDate.setMonth(birthDate.getMonth() - p1AgeMonths);
      birthDate.setDate(Math.min(28, 1 + ((c * 7) % 27)));

      const bDay = birthDate.getDate();
      const bMonth = birthDate.getMonth() + 1;
      const bYear = birthDate.getFullYear();
      const ddStr = isBoy ? String(bDay).padStart(2, '0') : String(bDay + 40).padStart(2, '0');
      const mmStr = String(bMonth).padStart(2, '0');
      const yyStr = String(bYear).slice(-2);
      const counterStr = String(globalIdx).padStart(4, '0');
      const nik = `33${kabObj.kodeKab}01${ddStr}${mmStr}${yyStr}${counterStr}`;

      const nikIbu = `33${kabObj.kodeKab}01${String(bDay + (isBoy ? 40 : 0)).padStart(2, '0')}${mmStr}95${String(globalIdx + 500).padStart(4, '0')}`;
      const alamat = `RT 0${1 + (c % 7)} / RW 0${1 + (c % 5)}, Desa/Kel. ${desa}`;

      // Measurements for Period 1
      const p1MeasDate = new Date(p1EvalDate);
      p1MeasDate.setDate(p1MeasDate.getDate() - (c % 14)); // small 0-14 days variation
      const p1DiffDays = Math.floor((p1MeasDate - birthDate) / (1000 * 60 * 60 * 24));
      const p1ExactMonths = Math.floor(p1DiffDays / (365.25 / 12));
      const p1CaraUkur = p1ExactMonths < 24 ? 'Telentang' : 'Berdiri';

      const hRef1 = getWhoHeightRef(p1ExactMonths, isBoy);
      const wRef1 = getWhoWeightAgeRef(p1ExactMonths, isBoy);

      let p1Z_Tbu, p1Z_Bbu, p1Z_Bbtb;
      let p1Height, p1Weight;

      if (group.type === 'PERSISTENT') {
        // Stunted in P1
        p1Z_Tbu = -2.3 - (c % 10) * 0.08; // -2.3 to -3.02
        p1Height = Number((hRef1.M + p1Z_Tbu * hRef1.SD).toFixed(1));
        p1Z_Bbu = -1.8 - (c % 5) * 0.2;
        p1Weight = Number((wRef1.M + p1Z_Bbu * wRef1.SD).toFixed(2));
      } else if (group.type === 'RECOVERED') {
        // Stunted in P1
        p1Z_Tbu = -2.25 - (c % 6) * 0.08; // -2.25 to -2.65
        p1Height = Number((hRef1.M + p1Z_Tbu * hRef1.SD).toFixed(1));
        p1Z_Bbu = -1.6 - (c % 4) * 0.2;
        p1Weight = Number((wRef1.M + p1Z_Bbu * wRef1.SD).toFixed(2));
      } else if (group.type === 'STUNTING_MISSING_P2') {
        // Stunted in P1, missing in P2 (treated as Lulus Stunting / Bebas)
        p1Z_Tbu = -2.35 - (c % 5) * 0.08; // -2.35 to -2.67
        p1Height = Number((hRef1.M + p1Z_Tbu * hRef1.SD).toFixed(1));
        p1Z_Bbu = -1.7 - (c % 3) * 0.2;
        p1Weight = Number((wRef1.M + p1Z_Bbu * wRef1.SD).toFixed(2));
      } else if (group.type === 'AGED_OUT') {
        // Stunted in P1
        p1Z_Tbu = -2.4 - (c % 4) * 0.1;
        p1Height = Number((hRef1.M + p1Z_Tbu * hRef1.SD).toFixed(1));
        p1Z_Bbu = -1.9;
        p1Weight = Number((wRef1.M + p1Z_Bbu * wRef1.SD).toFixed(2));
      } else if (group.type === 'OUTLIER') {
        // Stunted in P1
        p1Z_Tbu = -2.5;
        p1Height = Number((hRef1.M + p1Z_Tbu * hRef1.SD).toFixed(1));
        p1Z_Bbu = -1.8;
        p1Weight = Number((wRef1.M + p1Z_Bbu * wRef1.SD).toFixed(2));
      } else if (group.type === 'NEW_CASE') {
        // Normal in P1, but borderline
        p1Z_Tbu = -1.55 - (c % 5) * 0.08; // -1.55 to -1.87 (Normal)
        p1Height = Number((hRef1.M + p1Z_Tbu * hRef1.SD).toFixed(1));
        p1Z_Bbu = -0.8 - (c % 5) * 0.2;
        p1Weight = Number((wRef1.M + p1Z_Bbu * wRef1.SD).toFixed(2));
      } else if (group.type === 'GIZI_BURUK_PERSISTENT' || group.type === 'GIZI_BURUK_RECOVERED') {
        // Gizi Buruk in P1 (BB/TB < -3.0 SD, severely wasted)
        p1Z_Tbu = -1.3 - (c % 4) * 0.15; // normal / borderline height
        p1Height = Number((hRef1.M + p1Z_Tbu * hRef1.SD).toFixed(1));
        const wh1 = getWhoWeightHeightRef(p1Height, isBoy);
        const targetZ_bbtb = -3.25 - (c % 3) * 0.15; // -3.25, -3.40, -3.55
        p1Weight = Number((wh1.M + targetZ_bbtb * wh1.SD).toFixed(2));
      } else if (group.type === 'GIZI_BURUK_NEW_CASE') {
        // Normal in P1
        p1Z_Tbu = -0.8;
        p1Height = Number((hRef1.M + p1Z_Tbu * hRef1.SD).toFixed(1));
        const wh1 = getWhoWeightHeightRef(p1Height, isBoy);
        p1Weight = Number((wh1.M - 0.7 * wh1.SD).toFixed(2));
      } else if (group.type === 'WASTING_ONLY') {
        // Moderate acute malnutrition (Gizi Kurang, -3.0 <= BB/TB < -2.0)
        p1Z_Tbu = -1.2;
        p1Height = Number((hRef1.M + p1Z_Tbu * hRef1.SD).toFixed(1));
        const wh1 = getWhoWeightHeightRef(p1Height, isBoy);
        const targetZ_bbtb = -2.35 - (c % 3) * 0.12;
        p1Weight = Number((wh1.M + targetZ_bbtb * wh1.SD).toFixed(2));
      } else if (group.type === 'OVERWEIGHT') {
        p1Z_Tbu = 0.5;
        p1Height = Number((hRef1.M + p1Z_Tbu * hRef1.SD).toFixed(1));
        const wh1 = getWhoWeightHeightRef(p1Height, isBoy);
        const targetZ_bbtb = 2.35 + (c % 3) * 0.2;
        p1Weight = Number((wh1.M + targetZ_bbtb * wh1.SD).toFixed(2));
      } else {
        // NORMAL in P1
        p1Z_Tbu = -0.5 + ((c * 7) % 20) * 0.1; // -0.5 to +1.4
        p1Height = Number((hRef1.M + p1Z_Tbu * hRef1.SD).toFixed(1));
        p1Z_Bbu = -0.4 + ((c * 5) % 18) * 0.1;
        p1Weight = Number((wRef1.M + p1Z_Bbu * wRef1.SD).toFixed(2));
      }

      const whRef1 = getWhoWeightHeightRef(p1Height, isBoy);
      p1Z_Bbtb = Number(calcZScore(p1Weight, whRef1.M, whRef1.SD).toFixed(2));
      p1Z_Tbu = Number(calcZScore(p1Height, hRef1.M, hRef1.SD).toFixed(2));
      p1Z_Bbu = Number(calcZScore(p1Weight, wRef1.M, wRef1.SD).toFixed(2));

      const statusBbu1 = classifyBBU(p1Z_Bbu);
      const statusTbu1 = classifyTBU(p1Z_Tbu);
      const statusBbtb1 = classifyBBTB(p1Z_Bbtb);

      const isStunting1 = p1Z_Tbu < -2.0 ? 'Ya' : 'Tidak';
      const isWasting1 = (statusBbtb1 === 'Gizi Kurang' || statusBbtb1 === 'Gizi Buruk') ? 'Ya' : 'Tidak';
      const isUnderweight1 = (statusBbu1 === 'Kurang' || statusBbu1 === 'Sangat Kurang') ? 'Ya' : 'Tidak';
      const isGiziBuruk1 = statusBbtb1 === 'Gizi Buruk' ? 'Ya' : 'Tidak';
      const isOverweight1 = (statusBbtb1 === 'Gizi Lebih' || statusBbtb1 === 'Obesitas') ? 'Ya' : 'Tidak';

      const lila1 = Number((13.5 + p1Z_Bbtb * 1.2).toFixed(1));
      const lk1 = Number((44.0 + (p1ExactMonths * 0.15)).toFixed(1));

      let catatanP1;
      if (group.type === 'STUNTING_MISSING_P2') {
        catatanP1 = 'Stunted (Periode Awal - Tidak Terdata di P2)';
      } else if (isGiziBuruk1 === 'Ya') {
        catatanP1 = 'Gizi Buruk (Periode Awal)';
      } else if (isStunting1 === 'Ya') {
        catatanP1 = 'Stunted (Periode Awal)';
      } else if (isWasting1 === 'Ya') {
        catatanP1 = 'Gizi Kurang (Periode Awal)';
      } else {
        catatanP1 = 'Normal (Periode Awal)';
      }

      // Push Period 1 Row
      p1Records.push({
        no: p1Records.length + 1,
        nik_anak: nik,
        nama_anak: childName,
        jenis_kelamin: jk,
        tanggal_lahir: formatDate(birthDate),
        tanggal_pengukuran: formatDate(p1MeasDate),
        umur_bulan: p1ExactMonths,
        umur_hari: p1DiffDays,
        berat_badan_kg: p1Weight,
        tinggi_badan_cm: p1Height,
        cara_ukur: p1CaraUkur,
        lila_cm: lila1,
        lingkar_kepala_cm: lk1,
        kabupaten_kota: kabObj.nama,
        kecamatan: dist.kec,
        desa_kelurahan: desa,
        puskesmas: pusk,
        posyandu: posy,
        nama_ibu: motherName,
        nik_ibu: nikIbu,
        alamat: alamat,
        zscore_bbu: p1Z_Bbu,
        status_bbu: statusBbu1,
        zscore_tbu: p1Z_Tbu,
        status_tbu: statusTbu1,
        zscore_bbtb: p1Z_Bbtb,
        status_bbtb: statusBbtb1,
        stunting: isStunting1,
        wasting: isWasting1,
        underweight: isUnderweight1,
        gizi_buruk: isGiziBuruk1,
        overweight: isOverweight1,
        is_outlier: 'Tidak',
        catatan_kondisi: catatanP1
      });

      // Now determine Period 2 Measurement
      if (group.type === 'AGED_OUT' || group.type === 'STUNTING_MISSING_P2') {
        // AGED_OUT: graduated from posyandu balita register!
        // STUNTING_MISSING_P2: missing / unmeasured in Period 2 (treated as Lulus Stunting / Bebas)
        continue;
      }

      // Period 2 (6 months later)
      const p2MeasDate = new Date(p2EvalDate);
      p2MeasDate.setDate(p2MeasDate.getDate() - (c % 14));
      const p2DiffDays = Math.floor((p2MeasDate - birthDate) / (1000 * 60 * 60 * 24));
      const p2ExactMonths = Math.floor(p2DiffDays / (365.25 / 12));
      const p2CaraUkur = p2ExactMonths < 24 ? 'Telentang' : 'Berdiri';

      const hRef2 = getWhoHeightRef(p2ExactMonths, isBoy);
      const wRef2 = getWhoWeightAgeRef(p2ExactMonths, isBoy);

      let p2Height, p2Weight;
      let p2IsOutlier = 'Tidak';
      let catatanP2 = '';

      if (group.type === 'PERSISTENT') {
        // Slow height gain: faltering persists (+2.0 to +2.6 cm)
        const deltaH = 2.0 + (c % 4) * 0.2;
        p2Height = Number((p1Height + deltaH).toFixed(1));
        p2Weight = Number((p1Weight + 0.6 + (c % 3) * 0.2).toFixed(2));
        catatanP2 = 'Tetap Stunting (Pertumbuhan Terhambat)';
      } else if (group.type === 'RECOVERED') {
        // Catch up growth: accelerated height gain (+6.8 to +8.5 cm)
        const deltaH = 6.8 + (c % 6) * 0.3;
        p2Height = Number((p1Height + deltaH).toFixed(1));
        p2Weight = Number((p1Weight + 1.6 + (c % 4) * 0.2).toFixed(2));
        catatanP2 = 'Bebas Stunting (Catch-up Growth Sukses)';
      } else if (group.type === 'NEW_CASE') {
        // Growth faltered heavily (+1.1 to +1.8 cm over 6 months)
        const deltaH = 1.1 + (c % 4) * 0.2;
        p2Height = Number((p1Height + deltaH).toFixed(1));
        p2Weight = Number((p1Weight + 0.3 + (c % 2) * 0.1).toFixed(2));
        catatanP2 = 'Kasus Baru Stunting (Growth Faltering)';
      } else if (group.type === 'GIZI_BURUK_PERSISTENT') {
        const deltaH = 2.8 + (c % 3) * 0.2;
        p2Height = Number((p1Height + deltaH).toFixed(1));
        const wh2 = getWhoWeightHeightRef(p2Height, isBoy);
        const targetZ_bbtb2 = -3.2 - (c % 2) * 0.15; // Still Gizi Buruk
        p2Weight = Number((wh2.M + targetZ_bbtb2 * wh2.SD).toFixed(2));
        catatanP2 = 'Tetap Gizi Buruk (Severe Acute Malnutrition)';
      } else if (group.type === 'GIZI_BURUK_RECOVERED') {
        const deltaH = 4.2 + (c % 4) * 0.3;
        p2Height = Number((p1Height + deltaH).toFixed(1));
        const wh2 = getWhoWeightHeightRef(p2Height, isBoy);
        const targetZ_bbtb2 = -1.2 + (c % 3) * 0.15; // Recovered to normal!
        p2Weight = Number((wh2.M + targetZ_bbtb2 * wh2.SD).toFixed(2));
        catatanP2 = 'Bebas Gizi Buruk (Tatalaksana PMT Pemulihan Berhasil)';
      } else if (group.type === 'GIZI_BURUK_NEW_CASE') {
        const deltaH = 2.2 + (c % 3) * 0.2;
        p2Height = Number((p1Height + deltaH).toFixed(1));
        const wh2 = getWhoWeightHeightRef(p2Height, isBoy);
        const targetZ_bbtb2 = -3.25 - (c % 2) * 0.15; // Dropped to Gizi Buruk
        p2Weight = Number((wh2.M + targetZ_bbtb2 * wh2.SD).toFixed(2));
        catatanP2 = 'Kasus Baru Gizi Buruk (Penurunan Berat Badan Akut)';
      } else if (group.type === 'WASTING_ONLY') {
        const deltaH = 3.8 + (c % 3) * 0.3;
        p2Height = Number((p1Height + deltaH).toFixed(1));
        const wh2 = getWhoWeightHeightRef(p2Height, isBoy);
        const targetZ_bbtb2 = c < 6 ? -1.3 : -2.3;
        p2Weight = Number((wh2.M + targetZ_bbtb2 * wh2.SD).toFixed(2));
        catatanP2 = c < 6 ? 'Bebas Wasting (Gizi Baik)' : 'Tetap Wasting (Gizi Kurang)';
      } else if (group.type === 'OVERWEIGHT') {
        const deltaH = 3.8 + (c % 3) * 0.3;
        p2Height = Number((p1Height + deltaH).toFixed(1));
        const wh2 = getWhoWeightHeightRef(p2Height, isBoy);
        const targetZ_bbtb2 = c < 4 ? 2.3 : 1.1;
        p2Weight = Number((wh2.M + targetZ_bbtb2 * wh2.SD).toFixed(2));
        catatanP2 = c < 4 ? 'Tetap Overweight' : 'Bebas Overweight (Berat Normal)';
      } else if (group.type === 'OUTLIER') {
        // Age >= 60 months in P2 -> AGED_OUT (Lulus Usia Balita)
        p2Height = Number((p1Height + 2.2).toFixed(1));
        p2Weight = Number((p1Weight + 0.8).toFixed(2));
        p2IsOutlier = 'Tidak';
        catatanP2 = 'Lulus Usia Balita (>=60 Bulan)';
      } else {
        // NORMAL
        const deltaH = 3.8 + (c % 5) * 0.3; // 3.8 to 5.0 cm healthy gain
        p2Height = Number((p1Height + deltaH).toFixed(1));
        p2Weight = Number((p1Weight + 1.1 + (c % 4) * 0.2).toFixed(2));
        catatanP2 = 'Normal (Pertumbuhan Sesuai Standar)';
      }

      const whRef2 = getWhoWeightHeightRef(p2Height, isBoy);
      const p2Z_Bbtb = Number(calcZScore(p2Weight, whRef2.M, whRef2.SD).toFixed(2));
      const p2Z_Tbu = Number(calcZScore(p2Height, hRef2.M, hRef2.SD).toFixed(2));
      const p2Z_Bbu = Number(calcZScore(p2Weight, wRef2.M, wRef2.SD).toFixed(2));

      const statusBbu2 = classifyBBU(p2Z_Bbu);
      const statusTbu2 = classifyTBU(p2Z_Tbu);
      const statusBbtb2 = classifyBBTB(p2Z_Bbtb);

      const isStunting2 = p2Z_Tbu < -2.0 ? 'Ya' : 'Tidak';
      const isWasting2 = (statusBbtb2 === 'Gizi Kurang' || statusBbtb2 === 'Gizi Buruk') ? 'Ya' : 'Tidak';
      const isUnderweight2 = (statusBbu2 === 'Kurang' || statusBbu2 === 'Sangat Kurang') ? 'Ya' : 'Tidak';
      const isGiziBuruk2 = statusBbtb2 === 'Gizi Buruk' ? 'Ya' : 'Tidak';
      const isOverweight2 = (statusBbtb2 === 'Gizi Lebih' || statusBbtb2 === 'Obesitas') ? 'Ya' : 'Tidak';

      const lila2 = Number((13.8 + p2Z_Bbtb * 1.2).toFixed(1));
      const lk2 = Number((44.5 + (p2ExactMonths * 0.15)).toFixed(1));

      p2Records.push({
        no: p2Records.length + 1,
        nik_anak: nik,
        nama_anak: childName,
        jenis_kelamin: jk,
        tanggal_lahir: formatDate(birthDate),
        tanggal_pengukuran: formatDate(p2MeasDate),
        umur_bulan: p2ExactMonths,
        umur_hari: p2DiffDays,
        berat_badan_kg: p2Weight,
        tinggi_badan_cm: p2Height,
        cara_ukur: p2CaraUkur,
        lila_cm: lila2,
        lingkar_kepala_cm: lk2,
        kabupaten_kota: kabObj.nama,
        kecamatan: dist.kec,
        desa_kelurahan: desa,
        puskesmas: pusk,
        posyandu: posy,
        nama_ibu: motherName,
        nik_ibu: nikIbu,
        alamat: alamat,
        zscore_bbu: p2Z_Bbu,
        status_bbu: statusBbu2,
        zscore_tbu: p2Z_Tbu,
        status_tbu: statusTbu2,
        zscore_bbtb: p2Z_Bbtb,
        status_bbtb: statusBbtb2,
        stunting: isStunting2,
        wasting: isWasting2,
        underweight: isUnderweight2,
        gizi_buruk: isGiziBuruk2,
        overweight: isOverweight2,
        is_outlier: p2IsOutlier,
        catatan_kondisi: catatanP2
      });
    }
  }

  console.log(`Generated P1 records: ${p1Records.length}`);
  console.log(`Generated P2 records: ${p2Records.length}`);

  return { p1Records, p2Records };
}

function recordsToCsv(records) {
  if (records.length === 0) return '';
  const headers = Object.keys(records[0]);
  const rows = [headers.join(',')];

  for (const r of records) {
    const values = headers.map(h => {
      const val = r[h] !== null && r[h] !== undefined ? String(r[h]) : '';
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    rows.push(values.join(','));
  }

  return rows.join('\r\n');
}

function generateReadmeText() {
  return [
    '========================================================================================',
    'README: DATASET SINTETIS KOHORT BALITA STUNTING (DINAS KESEHATAN PROVINSI JAWA TENGAH)',
    '========================================================================================',
    '',
    '1. LATAR BELAKANG DAN TUJUAN DATASET',
    '   Dataset ini dirancang khusus untuk memvalidasi dan mendemonstrasikan modul Analisis',
    '   Kohort Balita Stunting pada aplikasi Dinkes Excel Joiner & Monitoring Stunting.',
    '   Data ini mensimulasikan pengukuran individual balita pada dua periode:',
    '   - Periode Awal (Baseline): Juli 2025 (Triwulan 3 2025)',
    '   - Periode Evaluasi (Terkini): Januari 2026 (Triwulan 1 2026, selang 6 bulan)',
    '',
    '2. DINAMIKA & METRIK TRANSISI KOHORT',
    '   Dataset melacak 350 balita di 35 Kabupaten/Kota Jawa Tengah dengan kategori:',
    '   a. Tetap Stunting (Persistent) : 37 Balita (Termasuk 2 outlier usia)',
    '      Balita yang stunting di Periode Awal dan masih tergolong stunting di Periode Evaluasi',
    '      karena pertambahan tinggi badan tidak mencukupi standar (+2.0 s/d +2.6 cm dlm 6 bln).',
    '   b. Bebas Stunting (Recovered)  : 20 Balita',
    '      Balita yang stunting di Periode Awal namun berhasil keluar dari stunting di Periode',
    '      Evaluasi berkat intervensi gizi (catch-up growth tinggi badan +6.8 s/d +8.5 cm).',
    '   c. Lulus Usia Balita (Aged Out): 8 Balita',
    '      Balita stunting di Periode Awal yang telah mencapai usia >= 60 bulan saat Periode',
    '      Evaluasi dan lulus dari register penimbangan balita rutin posyandu.',
    '   d. Kasus Baru Stunting (New)   : 15 Balita',
    '      Balita yang normal di Periode Awal tetapi mengalami perlambatan pertumbuhan berat',
    '      sehingga status TB/U turun menjadi Pendek (< -2.0 SD) di Periode Evaluasi.',
    '   e. Tetap Normal (Non-Stunting) : 270 Balita',
    '      Balita sehat yang diukur normal di kedua periode (disaring otomatis dari kohort stunting).',
    '   f. Outlier Usia di P2          : 2 Balita',
    '      Balita usia >= 60 bulan yang masih tercatat stunting aktif di Periode Evaluasi.',
    '',
    '3. STRUKTUR SHEET PADA WORKBOOK EXCEL (sample_kohort_stunting.xlsx):',
    '   - Sheet 1: PERIODE_AWAL     (Data mentah individual 350 balita periode Juli 2025)',
    '   - Sheet 2: PERIODE_EVALUASI (Data mentah individual 342 balita periode Januari 2026)',
    '   - Sheet 3: README           (Dokumentasi parameter dan asumsi klinis dataset)',
    '',
    '4. RINGKASAN REKAPITULASI KOHORT:',
    '   - Total Kasus Stunting Periode 1 : 65 Balita (37 Persistent + 20 Recovered + 8 Aged Out)',
    '   - Total Kasus Stunting Periode 2 : 52 Balita (37 Persistent + 15 New Cases)',
    '   - Net Change (Perubahan Beban)  : -13 Balita (-20.0% penurunan prevalensi stunting)',
    '   - Bebas Stunting Rate           : 30.8% dari baseline kasus stunting',
    '   - Kasus Baru (Incidence)        : 15 kasus baru teridentifikasi untuk intervensi dini'
  ].join('\r\n');
}

function main() {
  console.log('Generating synthetic cohort dataset...');
  const { p1Records, p2Records } = generateCohortDataset();

  // 1. Generate CSV files
  const p1Csv = recordsToCsv(p1Records);
  const p2Csv = recordsToCsv(p2Records);

  const rootDir = path.resolve(__dirname, '..');
  const publicDir = path.resolve(rootDir, 'public');

  const p1CsvPublic = path.join(publicDir, 'sample_kohort_periode_awal.csv');
  const p2CsvPublic = path.join(publicDir, 'sample_kohort_periode_evaluasi.csv');

  fs.writeFileSync(p1CsvPublic, p1Csv, 'utf8');
  fs.writeFileSync(p2CsvPublic, p2Csv, 'utf8');
  console.log('Saved CSV files to public directory.');

  // 2. Generate multi-sheet XLSX
  const wb = xlsx.utils.book_new();

  // Sheet 1: PERIODE_AWAL
  const ws1 = xlsx.utils.json_to_sheet(p1Records);
  ws1['!cols'] = [
    { wch: 6 }, { wch: 20 }, { wch: 25 }, { wch: 14 }, { wch: 14 },
    { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 16 },
    { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 24 }, { wch: 18 },
    { wch: 18 }, { wch: 25 }, { wch: 20 }, { wch: 22 }, { wch: 20 },
    { wch: 35 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 16 },
    { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 35 }
  ];
  xlsx.utils.book_append_sheet(wb, ws1, 'PERIODE_AWAL');

  // Sheet 2: PERIODE_EVALUASI
  const ws2 = xlsx.utils.json_to_sheet(p2Records);
  ws2['!cols'] = ws1['!cols'];
  xlsx.utils.book_append_sheet(wb, ws2, 'PERIODE_EVALUASI');

  // Sheet 3: README
  const readmeLines = generateReadmeText().split('\r\n').map(line => [line]);
  const wsReadme = xlsx.utils.aoa_to_sheet(readmeLines);
  wsReadme['!cols'] = [{ wch: 100 }];
  xlsx.utils.book_append_sheet(wb, wsReadme, 'README');

  const xlsxPublic = path.join(publicDir, 'sample_kohort_stunting.xlsx');

  xlsx.writeFile(wb, xlsxPublic);
  console.log('Saved multi-sheet XLSX workbook to public directory.');
  console.log('Generation completed successfully!');
}

main();
