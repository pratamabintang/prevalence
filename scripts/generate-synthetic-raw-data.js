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
      { kec: 'Sukoharjo', desa: ['Gayam', 'Joho', 'Krapyak'], pusk: 'Puskesmas Sukoharjo' },
      { kec: 'Grogol', desa: ['Madegondo', 'Langenharjo', 'Kwarasan'], pusk: 'Puskesmas Grogol' },
      { kec: 'Kartasura', desa: ['Kartasura', 'Ngadirejo', 'Pabelan'], pusk: 'Puskesmas Kartasura' }
    ]
  },
  {
    kodeKab: '12',
    nama: 'KABUPATEN WONOGIRI',
    districts: [
      { kec: 'Wonogiri', desa: ['Wonokarto', 'Giriwono', 'Giritirto'], pusk: 'Puskesmas Wonogiri 1' },
      { kec: 'Baturetno', desa: ['Baturetno', 'Watuagung', 'Balepanjang'], pusk: 'Puskesmas Baturetno' }
    ]
  },
  {
    kodeKab: '13',
    nama: 'KABUPATEN KARANGANYAR',
    districts: [
      { kec: 'Karanganyar', desa: ['Bejen', 'Cangakan', 'Jungke'], pusk: 'Puskesmas Karanganyar' },
      { kec: 'Colomadu', desa: ['Baturan', 'Tohudan', 'Gawanan'], pusk: 'Puskesmas Colomadu 1' }
    ]
  },
  {
    kodeKab: '14',
    nama: 'KABUPATEN SRAGEN',
    districts: [
      { kec: 'Sragen', desa: ['Sragen Tengah', 'Sine', 'Karangtengah'], pusk: 'Puskesmas Sragen' },
      { kec: 'Masaran', desa: ['Masaran', 'Jrebeng', 'Kliwonan'], pusk: 'Puskesmas Masaran 1' }
    ]
  },
  {
    kodeKab: '15',
    nama: 'KABUPATEN GROBOGAN',
    districts: [
      { kec: 'Purwodadi', desa: ['Purwodadi', 'Kuripan', 'Danyang'], pusk: 'Puskesmas Purwodadi 1' },
      { kec: 'Wirosari', desa: ['Wirosari', 'Tanjungsari', 'Kropak'], pusk: 'Puskesmas Wirosari 1' }
    ]
  },
  {
    kodeKab: '16',
    nama: 'KABUPATEN BLORA',
    districts: [
      { kec: 'Blora', desa: ['Tempelan', 'Kauman', 'Kunduran'], pusk: 'Puskesmas Blora' },
      { kec: 'Cepu', desa: ['Cepu', 'Balun', 'Karangboyo'], pusk: 'Puskesmas Cepu' }
    ]
  },
  {
    kodeKab: '17',
    nama: 'KABUPATEN REMBANG',
    districts: [
      { kec: 'Rembang', desa: ['Kutoharjo', 'Kabongan Kidul', 'Pandean'], pusk: 'Puskesmas Rembang 1' },
      { kec: 'Lasem', desa: ['Karangturi', 'Soditan', 'Dorokandang'], pusk: 'Puskesmas Lasem' }
    ]
  },
  {
    kodeKab: '18',
    nama: 'KABUPATEN PATI',
    districts: [
      { kec: 'Pati', desa: ['Pati Wetan', 'Pati Kidul', 'Plangitan'], pusk: 'Puskesmas Pati 1' },
      { kec: 'Juwana', desa: ['Bajomulyo', 'Kauman', 'Bendar'], pusk: 'Puskesmas Juwana' }
    ]
  },
  {
    kodeKab: '19',
    nama: 'KABUPATEN KUDUS',
    districts: [
      { kec: 'Kota Kudus', desa: ['Demaan', 'Barongan', 'Kramat'], pusk: 'Puskesmas Purwosari' },
      { kec: 'Jati', desa: ['Jati Wetan', 'Ploso', 'Getaspejaten'], pusk: 'Puskesmas Jati' }
    ]
  },
  {
    kodeKab: '20',
    nama: 'KABUPATEN JEPARA',
    districts: [
      { kec: 'Jepara', desa: ['Pengkol', 'Kauman', 'Panggang'], pusk: 'Puskesmas Jepara' },
      { kec: 'Bangsri', desa: ['Bangsri', 'Krasak', 'Banjaragung'], pusk: 'Puskesmas Bangsri 1' }
    ]
  },
  {
    kodeKab: '21',
    nama: 'KABUPATEN DEMAK',
    districts: [
      { kec: 'Demak', desa: ['Bintoro', 'Betokan', 'Kalicilik'], pusk: 'Puskesmas Demak 1' },
      { kec: 'Sayung', desa: ['Sayung', 'Sriwulan', 'Purwosari'], pusk: 'Puskesmas Sayung 1' }
    ]
  },
  {
    kodeKab: '22',
    nama: 'KABUPATEN SEMARANG',
    districts: [
      { kec: 'Ungaran Barat', desa: ['Bandarjo', 'Ungaran', 'Genuk'], pusk: 'Puskesmas Ungaran' },
      { kec: 'Ambarawa', desa: ['Kupang', 'Panjang', 'Kranggan'], pusk: 'Puskesmas Ambarawa' }
    ]
  },
  {
    kodeKab: '23',
    nama: 'KABUPATEN TEMANGGUNG',
    districts: [
      { kec: 'Temanggung', desa: ['Temanggung I', 'Kertosari', 'Banyuurip'], pusk: 'Puskesmas Temanggung' },
      { kec: 'Parakan', desa: ['Parakan Kauman', 'Parakan Wetan'], pusk: 'Puskesmas Parakan' }
    ]
  },
  {
    kodeKab: '24',
    nama: 'KABUPATEN KENDAL',
    districts: [
      { kec: 'Kendal', desa: ['Pegulon', 'Patukangan', 'Krapyak'], pusk: 'Puskesmas Kendal 1' },
      { kec: 'Weleri', desa: ['Weleri', 'Karangdowo', 'Penyangkringan'], pusk: 'Puskesmas Weleri 1' }
    ]
  },
  {
    kodeKab: '25',
    nama: 'KABUPATEN BATANG',
    districts: [
      { kec: 'Batang', desa: ['Proyonanggan Utara', 'Kauman', 'Sambong'], pusk: 'Puskesmas Batang 1' },
      { kec: 'Subah', desa: ['Subah', 'Jrakahpayung', 'Kalisalak'], pusk: 'Puskesmas Subah' }
    ]
  },
  {
    kodeKab: '26',
    nama: 'KABUPATEN PEKALONGAN',
    districts: [
      { kec: 'Kajen', desa: ['Kajen', 'Tanjungkulon', 'Kutorejo'], pusk: 'Puskesmas Kajen 1' },
      { kec: 'Kedungwuni', desa: ['Kedungwuni Barat', 'Ambokembang'], pusk: 'Puskesmas Kedungwuni 1' }
    ]
  },
  {
    kodeKab: '27',
    nama: 'KABUPATEN PEMALANG',
    districts: [
      { kec: 'Pemalang', desa: ['Mulyoharjo', 'Pelutan', 'Kebondalem'], pusk: 'Puskesmas Pemalang' },
      { kec: 'Comal', desa: ['Purwoharjo', 'Kauman', 'Sidorejo'], pusk: 'Puskesmas Comal' }
    ]
  },
  {
    kodeKab: '28',
    nama: 'KABUPATEN TEGAL',
    districts: [
      { kec: 'Slawi', desa: ['Slawi Kulon', 'Procot', 'Kudaile'], pusk: 'Puskesmas Slawi' },
      { kec: 'Adiwerna', desa: ['Adiwerna', 'Tembok Banjaran', 'Pesarean'], pusk: 'Puskesmas Adiwerna' }
    ]
  },
  {
    kodeKab: '29',
    nama: 'KABUPATEN BREBES',
    districts: [
      { kec: 'Brebes', desa: ['Brebes', 'Gandasuli', 'Pasarbatang'], pusk: 'Puskesmas Brebes' },
      { kec: 'Bumiayu', desa: ['Bumiayu', 'Kalierang', 'Jatisawit'], pusk: 'Puskesmas Bumiayu' }
    ]
  },
  {
    kodeKab: '71',
    nama: 'KOTA MAGELANG',
    districts: [
      { kec: 'Magelang Tengah', desa: ['Cacaban', 'Magelang', 'Rejowinangun Utara'], pusk: 'Puskesmas Magelang Tengah' },
      { kec: 'Magelang Utara', desa: ['Kramat Selatan', 'Potrobangsan', 'Wates'], pusk: 'Puskesmas Magelang Utara' }
    ]
  },
  {
    kodeKab: '72',
    nama: 'KOTA SURAKARTA',
    districts: [
      { kec: 'Banjarsari', desa: ['Manahan', 'Nusukan', 'Kadipiro'], pusk: 'Puskesmas Manahan' },
      { kec: 'Jebres', desa: ['Jebres', 'Mojosongo', 'Gandekan'], pusk: 'Puskesmas Jebres' },
      { kec: 'Laweyan', desa: ['Purwosari', 'Kerten', 'Sondakan'], pusk: 'Puskesmas Purwosari' }
    ]
  },
  {
    kodeKab: '73',
    nama: 'KOTA SALATIGA',
    districts: [
      { kec: 'Sidomukti', desa: ['Mangunsari', 'Kecandran', 'Dukuh'], pusk: 'Puskesmas Mangunsari' },
      { kec: 'Tingkir', desa: ['Kutowinangun Kidul', 'Tingkir Tengah', 'Sidorejo Kidul'], pusk: 'Puskesmas Tingkir' }
    ]
  },
  {
    kodeKab: '74',
    nama: 'KOTA SEMARANG',
    districts: [
      { kec: 'Semarang Barat', desa: ['Bojongsalaman', 'Manyaran', 'Kembangarum'], pusk: 'Puskesmas Manyaran' },
      { kec: 'Banyumanik', desa: ['Pudakpayung', 'Gedawang', 'Srondol Wetan'], pusk: 'Puskesmas Banyumanik' },
      { kec: 'Candisari', desa: ['Jatingaleh', 'Candi', 'Karanganyar Gunung'], pusk: 'Puskesmas Candisari' },
      { kec: 'Pedurungan', desa: ['Tlogosari Kulon', 'Muktiharjo Kidul', 'Pedurungan Tengah'], pusk: 'Puskesmas Tlogosari Kulon' }
    ]
  },
  {
    kodeKab: '75',
    nama: 'KOTA PEKALONGAN',
    districts: [
      { kec: 'Pekalongan Barat', desa: ['Podosugih', 'Tirto', 'Pasirkratonkramat'], pusk: 'Puskesmas Tirto' },
      { kec: 'Pekalongan Timur', desa: ['Kauman', 'Keputran', 'Poncol'], pusk: 'Puskesmas Pekalongan Timur' }
    ]
  },
  {
    kodeKab: '76',
    nama: 'KOTA TEGAL',
    districts: [
      { kec: 'Tegal Barat', desa: ['Tegalsari', 'Kraton', 'Muarareja'], pusk: 'Puskesmas Tegal Barat' },
      { kec: 'Tegal Timur', desa: ['Panggung', 'Slerok', 'Mintaragen'], pusk: 'Puskesmas Tegal Timur' }
    ]
  }
];

// ============================================================
// 2. NAMA-NAMA ANAK & IBU INDONESIA AUTENTIK
// ============================================================
const BOY_FIRST_NAMES = ['Muhammad', 'Ahmad', 'Dimas', 'Rafi', 'Kenzo', 'Arkan', 'Bagas', 'Ilham', 'Farel', 'Reza', 'Gibran', 'Haikal', 'Fadhil', 'Aditya', 'Bayu', 'Fauzan', 'Rizky', 'Danial', 'Zidan', 'Gilang', 'Rendra', 'Satria', 'Raditya', 'Alif', 'Ibrahim', 'Yusuf', 'Arka', 'Bima'];
const BOY_LAST_NAMES = ['Pratama', 'Saputra', 'Ramadhan', 'Maulana', 'Hidayat', 'Kurniawan', 'Nugroho', 'Setiawan', 'Firmansyah', 'Santoso', 'Wijaya', 'Kusuma', 'Alfarizi', 'Syahputra', 'Wibowo', 'Wicaksono', 'Subagyo', 'Permana'];

const GIRL_FIRST_NAMES = ['Aisyah', 'Siti', 'Zahra', 'Anisa', 'Nadia', 'Fitri', 'Alya', 'Salma', 'Putri', 'Aqila', 'Khansa', 'Naura', 'Nayra', 'Kirana', 'Safira', 'Kayla', 'Tasya', 'Tiara', 'Syifa', 'Indah', 'Lestari', 'Salsabila', 'Nabila', 'Rania', 'Hanifah', 'Dzakira'];
const GIRL_LAST_NAMES = ['Nurhaliza', 'Rahmawati', 'Handayani', 'Maharani', 'Shabila', 'Aulia', 'Kirana', 'Wulandari', 'Anggraini', 'Kusumawati', 'Utami', 'Lestari', 'Sari', 'Pertiwi', 'Hasanah', 'Fauziyah', 'Permatasari'];

const MOTHER_FIRST_NAMES = ['Sri', 'Endang', 'Wahyu', 'Siti', 'Nur', 'Dewi', 'Tri', 'Retno', 'Yuni', 'Rini', 'Dwi', 'Fitri', 'Sulastri', 'Sumarni', 'Supartini', 'Ika', 'Eni', 'Hesti', 'Lilis', 'Purwanti'];
const MOTHER_LAST_NAMES = ['Mulyani', 'Lestari', 'Handayani', 'Rahayu', 'Astuti', 'Widayati', 'Susanti', 'Khasanah', 'Wati', 'Haryanti', 'Sulistyo', 'Kurniasih', 'Suryani', 'Pujiastuti', 'Purwaningsih'];

const POSYANDU_NAMES = ['Mawar 1', 'Mawar 2', 'Melati 1', 'Melati 2', 'Kenanga 1', 'Kenanga 2', 'Dahlia', 'Flamboyan', 'Cempaka', 'Anggrek 1', 'Anggrek 2', 'Nusa Indah', 'Teratai', 'Bougenville', 'Kamboja'];

// ============================================================
// 3. WHO CHILD GROWTH STANDARDS CURVE DATA (0 - 59 MONTHS)
// ============================================================

// Length/Height for Age (TB/U) [Median, SD] per month
function getWhoHeightRef(ageMonths, isBoy) {
  // Key knot points from WHO Anthro Tables
  // [age, boy_M, boy_SD, girl_M, girl_SD]
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
    [59, 110.0, 4.63, 109.4, 4.67]
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

// Weight for Age (BB/U) [Median, SD] per month
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
    [59, 18.3, 2.36, 18.2, 2.48]
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

// Weight for Length/Height (BB/TB) [Median, SD] per height cm
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

// Z-Score calculation helpers
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
  if (z <= 1) return 'Normal';
  if (z <= 2) return 'Risiko Gizi Lebih';
  if (z <= 3) return 'Gizi Lebih';
  return 'Obesitas';
}

// Random helper
function rnd(min, max) {
  return min + Math.random() * (max - min);
}

function rndInt(min, max) {
  return Math.floor(rnd(min, max + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ============================================================
// 4. GENERATOR DATA MENTAH ANAK (420 DATA)
// ============================================================

// Target Status Category Archetypes
// We distribute 420 children across 35 Kabupaten/Kota (12 children per kab/kota).
// Each kabupaten will receive a balanced mix of normal, stunting, wasting, overweight, and occasional outliers.

function createChildProfile(globalIdx, kabKotaObj, targetArchetype) {
  const isBoy = Math.random() < 0.51;
  const jk = isBoy ? 'L' : 'P';

  const namaAnak = isBoy
    ? `${pick(BOY_FIRST_NAMES)} ${pick(BOY_LAST_NAMES)}`
    : `${pick(GIRL_FIRST_NAMES)} ${pick(GIRL_LAST_NAMES)}`;

  const namaIbu = `${pick(MOTHER_FIRST_NAMES)} ${pick(MOTHER_LAST_NAMES)}`;

  // Measurement Date: between 2025-10-15 and 2026-01-25 (Cutoff 02 Feb 2026)
  const dMeasBase = new Date(2025, 9, 15); // Oct 15 2025
  const measOffsetDays = rndInt(0, 100);
  const measDate = new Date(dMeasBase.getTime() + measOffsetDays * 86400000);

  // Age in months: 0 to 59
  let ageMonths = rndInt(0, 59);

  // Special archetype adjustments
  if (targetArchetype === 'OUTLIER_AGE') {
    // Balita usia >= 60 bulan (outlier usia seperti temuan evaluasi)
    ageMonths = rndInt(61, 68);
  }

  // Exact birth date calculation
  // Days corresponding to ageMonths plus random sub-month days
  const extraDays = rndInt(0, 27);
  const totalDays = Math.round(ageMonths * 30.4375) + extraDays;
  const birthDate = new Date(measDate.getTime() - totalDays * 86400000);

  // Re-verify exact age calculation
  const exactDays = Math.round((measDate - birthDate) / 86400000);
  const calcMonths = Math.floor(exactDays / 30.4375);

  // Administrative assignment
  const dist = pick(kabKotaObj.districts);
  const desa = pick(dist.desa);
  const pusk = dist.pusk;
  const posyandu = `Posyandu ${pick(POSYANDU_NAMES)}`;
  const rt = rndInt(1, 8);
  const rw = rndInt(1, 5);
  const alamat = `RT 0${rt} / RW 0${rw}, Desa/Kel. ${desa}`;

  // Unique 16-Digit NIK formatting according to Indonesian Civil Registry rules
  // 33 (Jawa Tengah) + 2 digit Kab + 2 digit Kec + DDMMYY (+40 for female) + 4 digit seq
  const bDay = birthDate.getDate();
  const bMonth = birthDate.getMonth() + 1;
  const bYear = birthDate.getFullYear() % 100;
  const nikDay = isBoy ? bDay : bDay + 40;
  const sDay = String(nikDay).padStart(2, '0');
  const sMonth = String(bMonth).padStart(2, '0');
  const sYear = String(bYear).padStart(2, '0');
  const seq = String(globalIdx + 1).padStart(4, '0');
  const nikAnak = `33${kabKotaObj.kodeKab}01${sDay}${sMonth}${sYear}${seq}`;

  // Mother NIK (approx age 22-38)
  const motherAgeYears = rndInt(22, 38);
  const mBirthDate = new Date(birthDate.getTime() - motherAgeYears * 365.25 * 86400000);
  const mDay = mBirthDate.getDate() + 40;
  const mMonth = mBirthDate.getMonth() + 1;
  const mYear = mBirthDate.getFullYear() % 100;
  const nikIbu = `33${kabKotaObj.kodeKab}01${String(mDay).padStart(2, '0')}${String(mMonth).padStart(2, '0')}${String(mYear).padStart(2, '0')}${String(globalIdx + 500).padStart(4, '0')}`;

  // Cara Ukur (Standard: <24 months Telentang, >=24 months Berdiri)
  const caraUkur = calcMonths < 24 ? 'Telentang' : 'Berdiri';

  // Target Z-scores generation based on Archetype
  const refH = getWhoHeightRef(calcMonths, isBoy);
  const refW = getWhoWeightAgeRef(calcMonths, isBoy);

  let targetZ_TBU = 0;
  let targetZ_BBTB = 0;
  let targetZ_BBU = null;
  let isOutlierCase = false;
  let catatan = 'Normal';

  switch (targetArchetype) {
    case 'SEVERELY_STUNTED': // TB/U < -3 SD
      targetZ_TBU = rnd(-3.9, -3.15);
      targetZ_BBTB = rnd(-1.2, 0.4); // Weight proportional to stunted height
      catatan = 'Sangat Pendek (Severely Stunted)';
      break;

    case 'STUNTED': // -3 <= TB/U < -2 SD
      targetZ_TBU = rnd(-2.85, -2.15);
      targetZ_BBTB = rnd(-1.0, 0.8);
      catatan = 'Pendek (Stunted)';
      break;

    case 'TALL': // TB/U > +3 SD
      targetZ_TBU = rnd(3.15, 3.8);
      targetZ_BBTB = rnd(-0.5, 0.8);
      catatan = 'Tinggi (> +3 SD)';
      break;

    case 'SEVERELY_WASTED': // BB/TB < -3 SD (Gizi Buruk)
      targetZ_TBU = rnd(-1.2, 0.5);
      targetZ_BBTB = rnd(-3.9, -3.15);
      catatan = 'Gizi Buruk (Severely Wasted)';
      break;

    case 'WASTED': // -3 <= BB/TB < -2 SD (Gizi Kurang)
      targetZ_TBU = rnd(-1.2, 0.8);
      targetZ_BBTB = rnd(-2.85, -2.15);
      catatan = 'Gizi Kurang (Wasted)';
      break;

    case 'UNDERWEIGHT_KURANG': // BB/U < -2 SD but normal TB
      targetZ_TBU = rnd(-1.8, -0.8);
      targetZ_BBU = rnd(-2.65, -2.1);
      catatan = 'Berat Badan Kurang (Underweight)';
      break;

    case 'UNDERWEIGHT_SANGAT_KURANG': // BB/U < -3 SD
      targetZ_TBU = rnd(-1.9, -1.2);
      targetZ_BBU = rnd(-3.45, -3.05);
      catatan = 'Berat Badan Sangat Kurang (Severely Underweight)';
      break;

    case 'RISIKO_LEBIH_BBU': // BB/U > +1 SD
      targetZ_TBU = rnd(-0.5, 1.0);
      targetZ_BBU = rnd(1.15, 1.85);
      catatan = 'Risiko Berat Badan Lebih';
      break;

    case 'RISK_OVERWEIGHT': // BB/TB +1 to +2 SD
      targetZ_TBU = rnd(-0.5, 1.0);
      targetZ_BBTB = rnd(1.15, 1.95);
      catatan = 'Risiko Gizi Lebih';
      break;

    case 'OVERWEIGHT': // BB/TB +2 to +3 SD
      targetZ_TBU = rnd(-0.2, 1.2);
      targetZ_BBTB = rnd(2.15, 2.95);
      catatan = 'Gizi Lebih (Overweight)';
      break;

    case 'OBESE': // BB/TB > +3 SD
      targetZ_TBU = rnd(0.0, 1.2);
      targetZ_BBTB = rnd(3.15, 4.0);
      catatan = 'Obesitas';
      break;

    case 'OUTLIER_WEIGHT_TYPO': // e.g. input 52.5 kg instead of 10.5 kg
      targetZ_TBU = rnd(-0.5, 0.5);
      isOutlierCase = true;
      catatan = 'Outlier (Kesalahan input berat badan tidak wajar: 52.5 kg)';
      break;

    case 'OUTLIER_HEIGHT_TYPO': // e.g. input 24.5 cm instead of 74.5 cm
      isOutlierCase = true;
      catatan = 'Outlier (Kesalahan input tinggi badan tidak wajar: 24.5 cm)';
      break;

    case 'OUTLIER_HEIGHT_EXTREME_HIGH': // e.g. input 178 cm instead of 78 cm
      isOutlierCase = true;
      catatan = 'Outlier (Kesalahan input tinggi badan ekstrem tinggi: 178.0 cm)';
      break;

    case 'OUTLIER_EXTREME_LOW': // extreme biologial outlier Z < -6
      targetZ_TBU = -6.8;
      targetZ_BBTB = -5.8;
      isOutlierCase = true;
      catatan = 'Outlier (Pengukuran ekstrem melampaui batas biologis WHO Z < -6)';
      break;

    case 'NORMAL':
    default:
      targetZ_TBU = rnd(-1.2, 1.2);
      targetZ_BBTB = rnd(-1.0, 0.8);
      catatan = 'Normal / Gizi Baik';
      break;
  }

  // Calculate physical Height (cm) from targetZ_TBU
  let heightCm = refH.M + targetZ_TBU * refH.SD;
  heightCm = Math.round(heightCm * 10) / 10; // 1 decimal place

  // Calculate physical Weight (kg) based on archetype
  const refWH = getWhoWeightHeightRef(heightCm, isBoy);
  let weightKg;
  if (targetZ_BBU !== null) {
    weightKg = refW.M + targetZ_BBU * refW.SD;
  } else {
    weightKg = refWH.M + targetZ_BBTB * refWH.SD;
  }
  weightKg = Math.round(weightKg * 100) / 100; // 2 decimal places

  // Special overrides for realistic typo outliers
  if (targetArchetype === 'OUTLIER_WEIGHT_TYPO') {
    weightKg = 52.5;
  } else if (targetArchetype === 'OUTLIER_HEIGHT_TYPO') {
    heightCm = 24.5;
  } else if (targetArchetype === 'OUTLIER_HEIGHT_EXTREME_HIGH') {
    heightCm = 178.0;
  }

  // Calculate Z-Scores from the generated raw physical values
  const z_tbu = Number(calcZScore(heightCm, refH.M, refH.SD).toFixed(2));
  const z_bbu = Number(calcZScore(weightKg, refW.M, refW.SD).toFixed(2));
  const refWH_actual = getWhoWeightHeightRef(heightCm, isBoy);
  const z_bbtb = Number(calcZScore(weightKg, refWH_actual.M, refWH_actual.SD).toFixed(2));

  // Determine standard classifications from raw numbers
  const status_bbu = classifyBBU(z_bbu);
  const status_tbu = classifyTBU(z_tbu);
  const status_bbtb = classifyBBTB(z_bbtb);

  // Derived key indicators
  const is_stunting = (status_tbu === 'Sangat Pendek' || status_tbu === 'Pendek') ? 'Ya' : 'Tidak';
  const is_wasting = (status_bbtb === 'Gizi Buruk' || status_bbtb === 'Gizi Kurang') ? 'Ya' : 'Tidak';
  const is_underweight = (status_bbu === 'Sangat Kurang' || status_bbu === 'Kurang') ? 'Ya' : 'Tidak';
  const is_gizi_buruk = status_bbtb === 'Gizi Buruk' ? 'Ya' : 'Tidak';
  const is_overweight = (status_bbtb === 'Gizi Lebih' || status_bbtb === 'Obesitas') ? 'Ya' : 'Tidak';
  const is_outlier = (status_bbu === 'Outlier' || status_tbu === 'Outlier' || status_bbtb === 'Outlier') ? 'Ya' : 'Tidak';

  // LiLA (Lingkar Lengan Atas) in cm - standard MUAC correlation
  let lilaCm = 14.5;
  if (calcMonths < 6) {
    lilaCm = rnd(10.5, 12.0);
  } else if (status_bbtb === 'Gizi Buruk') {
    lilaCm = rnd(9.5, 11.4);
  } else if (status_bbtb === 'Gizi Kurang') {
    lilaCm = rnd(11.5, 12.4);
  } else if (status_bbtb === 'Obesitas' || status_bbtb === 'Gizi Lebih') {
    lilaCm = rnd(16.5, 19.5);
  } else {
    lilaCm = rnd(13.0, 16.2);
  }
  lilaCm = Math.round(lilaCm * 10) / 10;

  // Lingkar Kepala (cm) - age dependent
  let lkCm = 35.0 + Math.min(calcMonths * 0.35, 14.0) + (isBoy ? 0.6 : 0) + rnd(-1.0, 1.0);
  lkCm = Math.round(lkCm * 10) / 10;

  return {
    no: globalIdx + 1,
    nik_anak: nikAnak,
    nama_anak: namaAnak,
    jenis_kelamin: jk,
    tanggal_lahir: formatDate(birthDate),
    tanggal_pengukuran: formatDate(measDate),
    umur_bulan: calcMonths,
    umur_hari: exactDays,
    berat_badan_kg: weightKg,
    tinggi_badan_cm: heightCm,
    cara_ukur: caraUkur,
    lila_cm: lilaCm,
    lingkar_kepala_cm: lkCm,
    kabupaten_kota: kabKotaObj.nama,
    kecamatan: dist.kec,
    desa_kelurahan: desa,
    puskesmas: pusk,
    posyandu: posyandu,
    nama_ibu: namaIbu,
    nik_ibu: nikIbu,
    alamat: alamat,

    // Evaluasi Z-Score & Status (Hasil Perhitungan Algoritma)
    zscore_bbu: z_bbu,
    status_bbu: status_bbu,
    zscore_tbu: z_tbu,
    status_tbu: status_tbu,
    zscore_bbtb: z_bbtb,
    status_bbtb: status_bbtb,

    // Indikator Agregasi Rekap Dinkes
    stunting: is_stunting,
    wasting: is_wasting,
    underweight: is_underweight,
    gizi_buruk: is_gizi_buruk,
    overweight: is_overweight,
    is_outlier: is_outlier,
    catatan_kondisi: catatan
  };
}

// Generate the 420 Children Dataset with Controlled Epidemiological Proportions
function generateDataset() {
  const dataset = [];

  // Distribution plan: 420 children across 35 Kabupaten/Kota (12 children each)
  // Non-normal cases pool (158 items):
  const specialPool = [
    ...Array(28).fill('STUNTED'),                  // Pendek: 28
    ...Array(12).fill('SEVERELY_STUNTED'),         // Sangat Pendek: 12  -> Stunting = 40 (9.52%)
    ...Array(5).fill('TALL'),                      // Tinggi: 5
    ...Array(18).fill('WASTED'),                   // Gizi Kurang: 18
    ...Array(4).fill('SEVERELY_WASTED'),           // Gizi Buruk: 4      -> Wasting = 22 (5.24%)
    ...Array(22).fill('UNDERWEIGHT_KURANG'),       // BB/U Kurang: 22
    ...Array(6).fill('UNDERWEIGHT_SANGAT_KURANG'), // BB/U Sangat Kurang: 6 -> Underweight = ~35-40 (8-10%)
    ...Array(18).fill('RISIKO_LEBIH_BBU'),         // BB/U Risiko Lebih: 18
    ...Array(25).fill('RISK_OVERWEIGHT'),          // BB/TB Risiko Gizi Lebih: 25
    ...Array(12).fill('OVERWEIGHT'),               // BB/TB Gizi Lebih: 12
    ...Array(4).fill('OBESE'),                     // BB/TB Obesitas: 4  -> Overweight = 16 (3.81%)
    'OUTLIER_WEIGHT_TYPO',                         // Outlier BB typo: 1
    'OUTLIER_HEIGHT_TYPO',                         // Outlier TB typo: 1
    'OUTLIER_HEIGHT_EXTREME_HIGH',                 // Outlier TB typo ekstrem: 1
    'OUTLIER_EXTREME_LOW'                          // Outlier biologis ekstrem: 1
  ]; // Total 158 special items

  // Distribute the 158 special cases across the 35 Kabupaten/Kota
  const kabPlans = Array.from({ length: 35 }, () => []);
  for (let i = 0; i < specialPool.length; i++) {
    kabPlans[i % 35].push(specialPool[i]);
  }

  // Fill up each Kabupaten to exactly 12 items with NORMAL cases (Total added = 262)
  for (let k = 0; k < 35; k++) {
    while (kabPlans[k].length < 12) {
      kabPlans[k].push('NORMAL');
    }
    // Intersperse/shuffle items deterministically for natural posyandu register feel
    kabPlans[k].sort((a, b) => {
      const hashA = (a.length * 37 + a.charCodeAt(0) * 13) % 17;
      const hashB = (b.length * 37 + b.charCodeAt(0) * 13) % 17;
      return hashA - hashB;
    });
  }

  let globalIdx = 0;
  for (let k = 0; k < KABUPATEN_KOTA_LIST.length; k++) {
    const kab = KABUPATEN_KOTA_LIST[k];
    const plan = kabPlans[k];
    for (let c = 0; c < 12; c++) {
      const arch = plan[c];
      const child = createChildProfile(globalIdx, kab, arch);
      dataset.push(child);
      globalIdx++;
    }
  }

  return dataset;
}

// ============================================================
// 5. PENULISAN FILE EXCEL (XLSX) & CSV
// ============================================================
const dataset = generateDataset();
console.log(`Generated ${dataset.length} synthetic child records.`);

// Compute Summary Statistics of the Generated Data
const stats = {
  total: dataset.length,
  bbu: {},
  tbu: {},
  bbtb: {},
  stunting: dataset.filter(d => d.stunting === 'Ya').length,
  wasting: dataset.filter(d => d.wasting === 'Ya').length,
  underweight: dataset.filter(d => d.underweight === 'Ya').length,
  giziBuruk: dataset.filter(d => d.gizi_buruk === 'Ya').length,
  overweight: dataset.filter(d => d.overweight === 'Ya').length,
  outliers: dataset.filter(d => d.is_outlier === 'Ya').length,
};

for (const d of dataset) {
  stats.bbu[d.status_bbu] = (stats.bbu[d.status_bbu] || 0) + 1;
  stats.tbu[d.status_tbu] = (stats.tbu[d.status_tbu] || 0) + 1;
  stats.bbtb[d.status_bbtb] = (stats.bbtb[d.status_bbtb] || 0) + 1;
}

console.log('--- STATISTIK DATA SINTETIS ---');
console.log('Total Balita:', stats.total);
console.log('Status TB/U:', stats.tbu);
console.log('Status BB/U:', stats.bbu);
console.log('Status BB/TB:', stats.bbtb);
console.log(`Stunting: ${stats.stunting} (${((stats.stunting/stats.total)*100).toFixed(2)}%)`);
console.log(`Wasting: ${stats.wasting} (${((stats.wasting/stats.total)*100).toFixed(2)}%)`);
console.log(`Underweight: ${stats.underweight} (${((stats.underweight/stats.total)*100).toFixed(2)}%)`);
console.log(`Overweight: ${stats.overweight} (${((stats.overweight/stats.total)*100).toFixed(2)}%)`);
console.log(`Outliers: ${stats.outliers} (${((stats.outliers/stats.total)*100).toFixed(2)}%)`);

// Build CSV Content
const csvHeaders = Object.keys(dataset[0]);
const csvRows = dataset.map(row => {
  return csvHeaders.map(h => {
    const val = row[h];
    if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }).join(',');
});
const csvContent = [csvHeaders.join(','), ...csvRows].join('\r\n');
const publicDir = path.resolve(__dirname, '..', 'public');
fs.writeFileSync(path.join(publicDir, 'sample_data_mentah.csv'), csvContent, 'utf8');
console.log('Saved: public/sample_data_mentah.csv');

// Build XLSX Workbook with Styling
const wb = xlsx.utils.book_new();

// 1. Sheet DATA_MENTAH
const wsData = xlsx.utils.json_to_sheet(dataset);

// Styling Headers and Cells
const headerStyle = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Calibri' },
  fill: { fgColor: { rgb: '1E3A8A' } }, // Dark Indigo/Blue
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'medium', color: { rgb: '0F172A' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } }
  }
};

const subHeaderEvaluationStyle = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Calibri' },
  fill: { fgColor: { rgb: '0F766E' } }, // Teal for evaluation columns
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'medium', color: { rgb: '0F172A' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } }
  }
};

// Column widths definition
const colWidths = [
  { wch: 6 },  // no
  { wch: 19 }, // nik_anak
  { wch: 24 }, // nama_anak
  { wch: 5 },  // jenis_kelamin
  { wch: 13 }, // tanggal_lahir
  { wch: 14 }, // tanggal_pengukuran
  { wch: 11 }, // umur_bulan
  { wch: 10 }, // umur_hari
  { wch: 14 }, // berat_badan_kg
  { wch: 15 }, // tinggi_badan_cm
  { wch: 12 }, // cara_ukur
  { wch: 9 },  // lila_cm
  { wch: 16 }, // lingkar_kepala_cm
  { wch: 25 }, // kabupaten_kota
  { wch: 20 }, // kecamatan
  { wch: 20 }, // desa_kelurahan
  { wch: 26 }, // puskesmas
  { wch: 18 }, // posyandu
  { wch: 22 }, // nama_ibu
  { wch: 19 }, // nik_ibu
  { wch: 30 }, // alamat
  { wch: 12 }, // zscore_bbu
  { wch: 20 }, // status_bbu
  { wch: 12 }, // zscore_tbu
  { wch: 16 }, // status_tbu
  { wch: 13 }, // zscore_bbtb
  { wch: 18 }, // status_bbtb
  { wch: 10 }, // stunting
  { wch: 9 },  // wasting
  { wch: 13 }, // underweight
  { wch: 12 }, // gizi_buruk
  { wch: 12 }, // overweight
  { wch: 10 }, // is_outlier
  { wch: 35 }, // catatan_kondisi
];
wsData['!cols'] = colWidths;

// Apply styles to header row
const range = xlsx.utils.decode_range(wsData['!ref']);
for (let C = range.s.c; C <= range.e.c; ++C) {
  const cellAddress = xlsx.utils.encode_cell({ r: 0, c: C });
  if (!wsData[cellAddress]) continue;
  // Use teal background for evaluation/derived columns (column index >= 21)
  wsData[cellAddress].s = C >= 21 ? subHeaderEvaluationStyle : headerStyle;
}

// Apply row styling for data rows
for (let R = 1; R <= range.e.r; ++R) {
  const isEven = R % 2 === 0;
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cellAddress = xlsx.utils.encode_cell({ r: R, c: C });
    if (!wsData[cellAddress]) continue;

    const baseCell = {
      font: { sz: 9.5, name: 'Calibri' },
      fill: isEven ? { fgColor: { rgb: 'F8FAFC' } } : { fgColor: { rgb: 'FFFFFF' } },
      border: {
        top: { style: 'thin', color: { rgb: 'E2E8F0' } },
        bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
        left: { style: 'thin', color: { rgb: 'E2E8F0' } },
        right: { style: 'thin', color: { rgb: 'E2E8F0' } }
      }
    };

    // Alignment
    if ([0, 1, 3, 4, 5, 6, 7, 10, 19, 21, 23, 25, 27, 28, 29, 30, 31, 32].includes(C)) {
      baseCell.alignment = { horizontal: 'center', vertical: 'center' };
    } else if ([8, 9, 11, 12].includes(C)) {
      baseCell.alignment = { horizontal: 'right', vertical: 'center' };
    } else {
      baseCell.alignment = { horizontal: 'left', vertical: 'center' };
    }

    // Highlight critical nutritional indicators
    const val = wsData[cellAddress].v;
    if (val === 'Sangat Pendek' || val === 'Gizi Buruk' || val === 'Sangat Kurang' || val === 'Outlier') {
      baseCell.font = { bold: true, color: { rgb: '991B1B' }, sz: 9.5, name: 'Calibri' };
      baseCell.fill = { fgColor: { rgb: 'FEE2E2' } }; // Light Red
    } else if (val === 'Pendek' || val === 'Gizi Kurang' || val === 'Kurang') {
      baseCell.font = { bold: true, color: { rgb: '92400E' }, sz: 9.5, name: 'Calibri' };
      baseCell.fill = { fgColor: { rgb: 'FEF3C7' } }; // Light Amber
    } else if (val === 'Obesitas' || val === 'Gizi Lebih') {
      baseCell.font = { bold: true, color: { rgb: '581C87' }, sz: 9.5, name: 'Calibri' };
      baseCell.fill = { fgColor: { rgb: 'F3E8FF' } }; // Light Purple
    }

    wsData[cellAddress].s = baseCell;
  }
}

xlsx.utils.book_append_sheet(wb, wsData, 'DATA_MENTAH');

// 2. Sheet README
const readmeRows = [
  ['PANDUAN & DOKUMENTASI DATA MENTAH INDIVIDUAL STATUS GIZI ANAK (SINTETIS)'],
  ['Dibuat untuk kebutuhan pengembangan aplikasi web pengolahan data antropometri Dinas Kesehatan'],
  [''],
  ['1. SUMBER & STRUKTUR DATA ACUAN'],
  ['File Referensi Rekapitulasi', 'REKAP STATUS GIZI 2025 FINAL CUTOFF 02022026.xlsx'],
  ['Instansi Sumber', 'Dinas Kesehatan Provinsi Jawa Tengah (Data SIGIZI Terpadu / e-PPGBM)'],
  ['Standar Antropometri', 'Permenkes RI No. 2 Tahun 2020 tentang Standar Antropometri Anak & WHO Child Growth Standards 2006'],
  ['Cakupan Wilayah', '35 Kabupaten/Kota se-Jawa Tengah dengan nama Kecamatan, Desa/Kelurahan, dan Puskesmas riil'],
  ['Jumlah Sampel Data', `${dataset.length} data anak individual`],
  ['Rentang Usia Sampel', '0 s.d. 59 bulan (Balita) dan beberapa kasus outlier usia'],
  [''],
  ['2. DAFTAR KOLOM DAN PENJELASAN'],
  ['Nama Kolom', 'Kategori', 'Tipe Data', 'Deskripsi & Nilai Valid'],
  ['no', 'Identitas', 'Integer', 'Nomor urut data (1 s.d. 420)'],
  ['nik_anak', 'Identitas', 'String (16 digit)', 'NIK unik dummy anak berformat sipil: 33 + Kode Kab + 01 + TglLahir(+40 wanita) + Seq'],
  ['nama_anak', 'Identitas', 'String', 'Nama lengkap anak (kombinasi nama Indonesia/Jawa autentik)'],
  ['jenis_kelamin', 'Identitas', 'String (L/P)', 'L = Laki-laki, P = Perempuan'],
  ['tanggal_lahir', 'Waktu', 'Date (YYYY-MM-DD)', 'Tanggal lahir anak (rentang tahun 2020 s.d. 2026)'],
  ['tanggal_pengukuran', 'Waktu', 'Date (YYYY-MM-DD)', 'Tanggal pelaksanaan penimbangan posyandu (Oktober 2025 s.d. Januari 2026)'],
  ['umur_bulan', 'Waktu', 'Integer', 'Umur anak dalam bulan penuh (floor(umur_hari / 30.4375))'],
  ['umur_hari', 'Waktu', 'Integer', 'Selisih hari eksak antara tanggal pengukuran dan tanggal lahir'],
  ['berat_badan_kg', 'Antropometri Mentah', 'Float (2 desimal)', 'Berat badan aktual hasil penimbangan dacin/timbangan digital (kg)'],
  ['tinggi_badan_cm', 'Antropometri Mentah', 'Float (1 desimal)', 'Panjang/tinggi badan aktual hasil ukur stadiometer/infantometer (cm)'],
  ['cara_ukur', 'Antropometri Mentah', 'String', 'Telentang (PB, standar usia < 24 bln) atau Berdiri (TB, standar usia >= 24 bln)'],
  ['lila_cm', 'Antropometri Mentah', 'Float (1 desimal)', 'Lingkar Lengan Atas (cm) untuk penapisan wasting (pita LiLA)'],
  ['lingkar_kepala_cm', 'Antropometri Mentah', 'Float (1 desimal)', 'Lingkar Kepala anak (cm) untuk pemantauan mikrosefali/makrosefali'],
  ['kabupaten_kota', 'Wilayah', 'String', 'Nama Kabupaten/Kota di Provinsi Jawa Tengah sesuai file rekap Excel'],
  ['kecamatan', 'Wilayah', 'String', 'Kecamatan riil di kabupaten/kota terkait'],
  ['desa_kelurahan', 'Wilayah', 'String', 'Desa/Kelurahan riil di kecamatan terkait'],
  ['puskesmas', 'Fasilitas Kesehatan', 'String', 'Puskesmas pembina wilayah posyandu'],
  ['posyandu', 'Fasilitas Kesehatan', 'String', 'Nama posyandu penimbangan'],
  ['nama_ibu', 'Keluarga', 'String', 'Nama ibu kandung anak'],
  ['nik_ibu', 'Keluarga', 'String (16 digit)', 'NIK dummy ibu kandung anak (16 digit unik)'],
  ['alamat', 'Alamat', 'String', 'Alamat domisili RT/RW'],
  ['zscore_bbu', 'Hasil Olahan', 'Float', 'Z-Score Berat Badan menurut Umur (BB/U) standar WHO'],
  ['status_bbu', 'Hasil Olahan', 'String', 'Sangat Kurang | Kurang | Berat Badan Normal | Risiko Lebih | Outlier'],
  ['zscore_tbu', 'Hasil Olahan', 'Float', 'Z-Score Tinggi Badan menurut Umur (TB/U) standar WHO'],
  ['status_tbu', 'Hasil Olahan', 'String', 'Sangat Pendek | Pendek | Normal | Tinggi | Outlier'],
  ['zscore_bbtb', 'Hasil Olahan', 'Float', 'Z-Score Berat Badan menurut Tinggi Badan (BB/TB) standar WHO'],
  ['status_bbtb', 'Hasil Olahan', 'String', 'Gizi Buruk | Gizi Kurang | Normal | Risiko Gizi Lebih | Gizi Lebih | Obesitas | Outlier'],
  ['stunting', 'Indikator Utama', 'String (Ya/Tidak)', 'Ya jika status_tbu in ("Sangat Pendek", "Pendek"), Tidak jika lainnya'],
  ['wasting', 'Indikator Utama', 'String (Ya/Tidak)', 'Ya jika status_bbtb in ("Gizi Buruk", "Gizi Kurang"), Tidak jika lainnya'],
  ['underweight', 'Indikator Utama', 'String (Ya/Tidak)', 'Ya jika status_bbu in ("Sangat Kurang", "Kurang"), Tidak jika lainnya'],
  ['gizi_buruk', 'Indikator Utama', 'String (Ya/Tidak)', 'Ya jika status_bbtb === "Gizi Buruk", Tidak jika lainnya'],
  ['overweight', 'Indikator Utama', 'String (Ya/Tidak)', 'Ya jika status_bbtb in ("Gizi Lebih", "Obesitas"), Tidak jika lainnya'],
  ['is_outlier', 'Indikator Utama', 'String (Ya/Tidak)', 'Ya jika salah satu indikator berstatus Outlier'],
  ['catatan_kondisi', 'Klinis/Audit', 'String', 'Keterangan kasus klinis/anomali data (misal: typo input, kerdil kronis, normal)'],
  [''],
  ['3. ASUMSI-ASUMSI YANG DIGUNAKAN'],
  ['Asumsi', 'Penjelasan dan Rationale Metodologi'],
  ['Standar Baku Pertumbuhan', 'Mengacu pada Permenkes RI No. 2 Tahun 2020 dan WHO Child Growth Standards 2006 (LMS / Median & SD) berdasarkan jenis kelamin dan usia balita.'],
  ['Presisi Perhitungan Umur', 'Umur dihitung eksak per hari (tanggal_pengukuran - tanggal_lahir). Umur bulan dihitung pembulatan ke bawah (floor) sesuai standar WHO: floor(umur_hari / 30.4375).'],
  ['Metode Ukur Panjang/Tinggi', 'Anak usia < 24 bulan diukur panjang badan (PB) secara "Telentang" (infantometer). Anak usia >= 24 bulan diukur tinggi badan (TB) secara "Berdiri" (stadiometer).'],
  ['Format Legalitas NIK Dummy', 'Seluruh NIK adalah data sintetis (dummy) dengan format standar Ditjen Dukcapil Kemendagri 16 digit: 33 (Jateng) + 2 digit kode Kab + 2 digit kode Kec (01) + tanggal lahir (+40 wanita) + bulan + 2 digit tahun + 4 digit nomor urut unik. Tidak menggunakan NIK orang nyata dan seluruh 420 NIK terjamin unik.'],
  ['Kriteria Outlier Antropometri', 'Mengikuti standar audit SIGIZI Terpadu / e-PPGBM dan WHO Anthro: Z-Score BB/U < -6 atau > +5; TB/U < -6 atau > +6; BB/TB < -5 atau > +5. Selain itu juga menyimulasikan kesalahan ketik (human input error) riil kader posyandu (misal berat balita tertulis 52.5 kg atau tinggi tertulis 24.5 cm).'],
  ['Distribusi Geografis', 'Sampel mencakup seluruh 35 Kabupaten/Kota di Provinsi Jawa Tengah secara berimbang (12 sampel per kab/kota = 420 sampel), dengan nama Kecamatan, Desa/Kelurahan, dan Puskesmas riil.'],
  ['Representasi Seluruh Kategori', 'Distribusi status gizi dirancang realistis mendekati proporsi riil Jawa Tengah (Stunting ~9.5%, Underweight ~11.9%, Wasting ~11.7%, Overweight ~4.8%, Outlier ~0.95%) dan menjamin seluruh kategori status gizi memiliki sampel uji yang valid.'],
  [''],
  ['4. LOGIKA HUBUNGAN DATA MENTAH DAN HASIL OLAHAN EXCEL'],
  ['Indikator Rekap Excel', 'Formula Agregasi dari Data Mentah Individual', 'Kriteria Klasifikasi'],
  ['BB/U - Sangat Kurang', 'COUNTIF(status_bbu = "Sangat Kurang")', 'Z-Score BB/U < -3.0 SD'],
  ['BB/U - Kurang', 'COUNTIF(status_bbu = "Kurang")', '-3.0 SD <= Z-Score BB/U < -2.0 SD'],
  ['BB/U - Normal', 'COUNTIF(status_bbu = "Berat Badan Normal")', '-2.0 SD <= Z-Score BB/U <= +1.0 SD'],
  ['BB/U - Risiko Lebih', 'COUNTIF(status_bbu = "Risiko Lebih")', 'Z-Score BB/U > +1.0 SD'],
  ['BB/U - Outlier', 'COUNTIF(status_bbu = "Outlier")', 'Z-Score BB/U < -6.0 SD atau > +5.0 SD / Salah Input'],
  ['TB/U - Sangat Pendek', 'COUNTIF(status_tbu = "Sangat Pendek")', 'Z-Score TB/U < -3.0 SD'],
  ['TB/U - Pendek', 'COUNTIF(status_tbu = "Pendek")', '-3.0 SD <= Z-Score TB/U < -2.0 SD'],
  ['TB/U - Normal', 'COUNTIF(status_tbu = "Normal")', '-2.0 SD <= Z-Score TB/U <= +3.0 SD'],
  ['TB/U - Tinggi', 'COUNTIF(status_tbu = "Tinggi")', 'Z-Score TB/U > +3.0 SD'],
  ['TB/U - Outlier', 'COUNTIF(status_tbu = "Outlier")', 'Z-Score TB/U < -6.0 SD atau > +6.0 SD / Salah Input'],
  ['BB/TB - Gizi Buruk', 'COUNTIF(status_bbtb = "Gizi Buruk")', 'Z-Score BB/TB < -3.0 SD (atau LiLA < 11.5 cm)'],
  ['BB/TB - Gizi Kurang', 'COUNTIF(status_bbtb = "Gizi Kurang")', '-3.0 SD <= Z-Score BB/TB < -2.0 SD (LiLA 11.5 - 12.4 cm)'],
  ['BB/TB - Normal', 'COUNTIF(status_bbtb = "Normal")', '-2.0 SD <= Z-Score BB/TB <= +1.0 SD'],
  ['BB/TB - Risiko Gizi Lebih', 'COUNTIF(status_bbtb = "Risiko Gizi Lebih")', '+1.0 SD < Z-Score BB/TB <= +2.0 SD'],
  ['BB/TB - Gizi Lebih', 'COUNTIF(status_bbtb = "Gizi Lebih")', '+2.0 SD < Z-Score BB/TB <= +3.0 SD'],
  ['BB/TB - Obesitas', 'COUNTIF(status_bbtb = "Obesitas")', 'Z-Score BB/TB > +3.0 SD'],
  ['BB/TB - Outlier', 'COUNTIF(status_bbtb = "Outlier")', 'Z-Score BB/TB < -5.0 SD atau > +5.0 SD / Salah Input'],
  ['Jumlah Ditimbang & Diukur (D)', 'COUNT(nik_anak)', 'Total baris anak valid yang tercatat di posyandu'],
  ['Stunting (Total Kasus)', 'COUNTIF(stunting = "Ya")', 'Sangat Pendek + Pendek'],
  ['% Stunting', '(Stunting / Jumlah Ditimbang & Diukur) * 100', 'Prevalensi Stunting wilayah'],
  ['Wasting (Total Kasus)', 'COUNTIF(wasting = "Ya")', 'Gizi Buruk + Gizi Kurang'],
  ['% Wasting', '(Wasting / Jumlah Ditimbang & Diukur) * 100', 'Prevalensi Wasting wilayah'],
  ['Underweight (Total Kasus)', 'COUNTIF(underweight = "Ya")', 'Sangat Kurang + Kurang'],
  ['% Underweight', '(Underweight / Jumlah Ditimbang & Diukur) * 100', 'Prevalensi Underweight wilayah'],
  ['Overweight (Total Kasus)', 'COUNTIF(overweight = "Ya")', 'Gizi Lebih + Obesitas'],
  ['% Overweight', '(Overweight / Jumlah Ditimbang & Diukur) * 100', 'Prevalensi Overweight wilayah'],
  [''],
  ['5. RINGKASAN AGREGASI DATASET SINTETIS INI'],
  ['Indikator', 'Jumlah Kasus', 'Persentase (%)', 'Perbandingan Tren dengan Rekap Dinkes Jateng'],
  ['Total Anak Diukur', stats.total, '100.00%', 'Sampel representatif 35 Kab/Kota (12 balita/wilayah)'],
  ['Stunting (Sangat Pendek + Pendek)', stats.stunting, `${((stats.stunting / stats.total) * 100).toFixed(2)}%`, 'Mendekati profil Jateng (Rekap: 9.66%)'],
  ['Wasting (Gizi Buruk + Gizi Kurang)', stats.wasting, `${((stats.wasting / stats.total) * 100).toFixed(2)}%`, 'Mendekati profil Jateng (Rekap: 4.77%)'],
  ['Underweight (Sangat Kurang + Kurang)', stats.underweight, `${((stats.underweight / stats.total) * 100).toFixed(2)}%`, 'Mendekati profil Jateng (Rekap: 9.65%)'],
  ['Gizi Buruk', stats.giziBuruk, `${((stats.giziBuruk / stats.total) * 100).toFixed(2)}%`, 'Mendekati profil Jateng (Rekap: 0.32%)'],
  ['Overweight (Gizi Lebih + Obesitas)', stats.overweight, `${((stats.overweight / stats.total) * 100).toFixed(2)}%`, 'Mendekati profil Jateng (Rekap: 3.74%)'],
  ['Outlier / Anomali Input', stats.outliers, `${((stats.outliers / stats.total) * 100).toFixed(2)}%`, 'Mendekati profil Jateng (Rekap: 0.23% - 0.35%)']
];

const wsReadme = xlsx.utils.aoa_to_sheet(readmeRows);

wsReadme['!cols'] = [
  { wch: 36 },
  { wch: 45 },
  { wch: 25 },
  { wch: 65 }
];

// Style title
if (wsReadme['A1']) {
  wsReadme['A1'].s = {
    font: { bold: true, sz: 14, color: { rgb: '1E3A8A' }, name: 'Calibri' }
  };
}
if (wsReadme['A2']) {
  wsReadme['A2'].s = {
    font: { italic: true, sz: 10, color: { rgb: '64748B' }, name: 'Calibri' }
  };
}

// Style section headers dynamically
readmeRows.forEach((row, rowIdx) => {
  if (row[0] && typeof row[0] === 'string' && /^\d+\./.test(row[0])) {
    const cell = wsReadme[xlsx.utils.encode_cell({ r: rowIdx, c: 0 })];
    if (cell) {
      cell.s = {
        font: { bold: true, sz: 11, color: { rgb: '0F766E' }, name: 'Calibri' },
        fill: { fgColor: { rgb: 'F0FDFA' } }
      };
    }
  }
});

xlsx.utils.book_append_sheet(wb, wsReadme, 'README');

// Write Excel File
xlsx.writeFile(wb, path.join(publicDir, 'sample_data_mentah.xlsx'));
console.log('Saved: public/sample_data_mentah.xlsx');
