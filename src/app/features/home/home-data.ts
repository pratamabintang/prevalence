// Home indicator configuration. Data capaian tidak pernah dibundel:
// seluruh nilai tampil hanya dari data impor pengguna (sesi atau periode server).
export interface HomeIndicatorOption {
  key: string;
  label: string;
  shortLabel: string;
  target: number;
  operator: '>=' | '<=';
  unit: string;
  isProblem?: boolean;
  description: string;
  category: 'Remaja' | 'Ibu Hamil' | 'Balita' | 'Gizi' | 'Imunisasi' | 'Agregat';
}

export interface OutcomeQuarterData {
  sumNumerator: number | null;
  actualAchievement: number | null;
  hasData: boolean;
}

export interface InterventionOutcomeItem {
  no: string;
  categoryKey: 'sebelum-kelahiran' | 'setelah-kelahiran' | 'lintas-siklus';
  categoryLabel: string;
  indicator: string;
  target2025: string;
  realisasi2025: number | null;
  target2026: string;
  jumlahSasaranTW2: number | null;
  capaianTW1: number | null;
  capaianTW2: number | null;
  status: 'On track' | 'Perlu percepatan';
  quarters?: Record<number, OutcomeQuarterData>;
}

export interface WilayahIndicatorBox {
  indicatorKey: string;
  label: string;
  shortLabel: string;
  achievement: number | null;
  target: number | null;
  isAchieved: boolean | null;
  unit: string;
}

export const SPECIFIC_INTERVENTION_INDICATORS: HomeIndicatorOption[] = [
  {
    key: '% Konsumsi TTD',
    label: 'Remaja Putri Mengonsumsi TTD',
    shortLabel: '% Konsumsi TTD',
    target: 67,
    operator: '>=',
    unit: '%',
    description: 'Persentase remaja putri yang mengonsumsi Tablet Tambah Darah secara rutin',
    category: 'Remaja'
  },
  {
    key: '% Skrining Anemia',
    label: 'Remaja Putri Skrining Anemia',
    shortLabel: '% Skrining Anemia',
    target: 77,
    operator: '>=',
    unit: '%',
    description: 'Persentase siswi kelas 7 & 10 yang diperiksa kadar hemoglobin (Hb)',
    category: 'Remaja'
  },
  {
    key: '% ANC 6x',
    label: 'Ibu Hamil Pemeriksaan ANC Minimal 6 Kali',
    shortLabel: '% ANC 6x',
    target: 60,
    operator: '>=',
    unit: '%',
    description: 'Pemeriksaan kehamilan terstandar minimal 6 kali dengan dokter pada trimester 1 dan 3',
    category: 'Ibu Hamil'
  },
  {
    key: '% TTD/MMS',
    label: 'Ibu Hamil Konsumsi Suplementasi TTD/MMS',
    shortLabel: '% TTD/MMS',
    target: 39,
    operator: '>=',
    unit: '%',
    description: 'Ibu hamil mengonsumsi minimal 180 tablet tambah darah atau multivitamin mikro',
    category: 'Ibu Hamil'
  },
  {
    key: '% Bumil PMT',
    label: 'Ibu Hamil KEK Mendapat Tambahan Asupan Gizi',
    shortLabel: '% Bumil PMT',
    target: 85,
    operator: '>=',
    unit: '%',
    description: 'Cakupan pemberian makanan tambahan bagi ibu hamil kurang energi kronis',
    category: 'Ibu Hamil'
  },
  {
    key: '% D/S',
    label: 'Balita Ditimbang Berat Badannya (D/S)',
    shortLabel: '% D/S',
    target: 90,
    operator: '>=',
    unit: '%',
    description: 'Cakupan penimbangan balita per bulan di posyandu dibanding total sasaran',
    category: 'Balita'
  },
  {
    key: '% Tumbang',
    label: 'Balita Dipantau Tumbuh Kembang (SDIDTK)',
    shortLabel: '% Tumbang',
    target: 55,
    operator: '>=',
    unit: '%',
    description: 'Stimulasi, deteksi, dan intervensi dini tumbuh kembang balita sesuai tahapan umur',
    category: 'Balita'
  },
  {
    key: '% ASI',
    label: 'Bayi Usia <6 Bulan ASI Eksklusif',
    shortLabel: '% ASI Eksklusif',
    target: 73,
    operator: '>=',
    unit: '%',
    description: 'Pemberian air susu ibu saja tanpa makanan/minuman tambahan sejak lahir hingga 6 bulan',
    category: 'Balita'
  },
  {
    key: '% MPASI',
    label: 'Anak 6-23 Bulan Mendapat MP-ASI Berkualitas',
    shortLabel: '% MPASI',
    target: 73,
    operator: '>=',
    unit: '%',
    description: 'Makanan pendamping ASI kaya protein hewani untuk balita',
    category: 'Balita'
  },
  {
    key: '% Gizi Kurang dapat MT',
    label: 'Balita Gizi Kurang Mendapat Tambahan Gizi',
    shortLabel: '% MT Gizi Kurang',
    target: 65,
    operator: '>=',
    unit: '%',
    description: 'Intervensi pemulihan gizi balita wasting dengan PMT lokal berprotein',
    category: 'Gizi'
  },
  {
    key: '% BB Kurang dapat MT',
    label: 'Balita Berat Badan Kurang (Underweight) Mendapat MT',
    shortLabel: '% MT BB Kurang',
    target: 65,
    operator: '>=',
    unit: '%',
    description: 'Pemberian makanan tambahan balita underweight untuk mencegah stunting dini',
    category: 'Gizi'
  },
  {
    key: '% BB Tidak Naik (T) dapat MT',
    label: 'Balita Berat Badan Tidak Naik (T) Mendapat MT',
    shortLabel: '% MT BB Tidak Naik',
    target: 65,
    operator: '>=',
    unit: '%',
    description: 'Intervensi kilat weight faltering sebelum merosot menjadi gizi kurang',
    category: 'Gizi'
  },
  {
    key: '% Talak Gibur',
    label: 'Kasus Gizi Buruk Mendapat Tata Laksana Terstandar',
    shortLabel: '% Talak Gizi Buruk',
    target: 91,
    operator: '>=',
    unit: '%',
    description: 'Perawatan balita gizi buruk di fasilitas rawat inap terapeutik',
    category: 'Gizi'
  },
  {
    key: '% IDL',
    label: 'Baduta Memperoleh Imunisasi Dasar Lengkap (IDL)',
    shortLabel: '% IDL',
    target: 97,
    operator: '>=',
    unit: '%',
    description: 'Kekebalan kelompok balita terhadap infeksi PD3I yang memicu gagal tumbuh',
    category: 'Imunisasi'
  },
  {
    key: 'Capaian',
    label: 'Total Indikator Memenuhi Target Capaian',
    shortLabel: 'Skor Capaian Target',
    target: 10,
    operator: '>=',
    unit: 'Indikator',
    description: 'Jumlah total indikator intervensi spesifik yang berhasil memenuhi ambang batas',
    category: 'Agregat'
  }
];

export const NUTRITION_PROBLEM_INDICATORS: HomeIndicatorOption[] = [
  {
    key: 'Stunting - %',
    label: 'Prevalensi Balita Stunting (Pendek & Sangat Pendek)',
    shortLabel: 'Prevalensi Stunting',
    target: 14.0,
    operator: '<=',
    unit: '%',
    isProblem: true,
    description: 'Persentase balita dengan status gizi TB/U di bawah -2 standar deviasi WHO',
    category: 'Balita'
  },
  {
    key: 'Insiden Stunting - %',
    label: 'Insiden Kasus Baru Stunting',
    shortLabel: 'Insiden Stunting',
    target: 2.3,
    operator: '<=',
    unit: '%',
    isProblem: true,
    description: 'Proporsi balita normal yang mengalami penurunan status menjadi stunting baru',
    category: 'Balita'
  },
  {
    key: 'BBLR - %',
    label: 'Bayi Berat Badan Lahir Rendah (<2500 gram)',
    shortLabel: 'BBLR',
    target: 5.5,
    operator: '<=',
    unit: '%',
    isProblem: true,
    description: 'Bayi lahir dengan berat badan kurang dari 2.500 gram',
    category: 'Balita'
  },
  {
    key: 'BB Tidak Naik - %',
    label: 'Balita Berat Badan Tidak Naik (T)',
    shortLabel: 'BB Tidak Naik (T)',
    target: 40.0,
    operator: '<=',
    unit: '%',
    isProblem: true,
    description: 'Balita yang kurva pertumbuhannya datar atau menurun saat penimbangan posyandu',
    category: 'Balita'
  },
  {
    key: 'BB Kurang - %',
    label: 'Balita Berat Badan Kurang (Underweight)',
    shortLabel: 'BB Kurang (Underweight)',
    target: 14.0,
    operator: '<=',
    unit: '%',
    isProblem: true,
    description: 'Balita dengan indeks BB/U di bawah -2 SD',
    category: 'Balita'
  },
  {
    key: 'Gizi Kurang - %',
    label: 'Balita Wasting (Gizi Kurang)',
    shortLabel: 'Gizi Kurang (Wasting)',
    target: 7.5,
    operator: '<=',
    unit: '%',
    isProblem: true,
    description: 'Balita kurus dengan indeks BB/TB di bawah -2 SD',
    category: 'Balita'
  },
  {
    key: 'Gizi Buruk - %',
    label: 'Balita Gizi Buruk (Severe Wasting)',
    shortLabel: 'Gizi Buruk',
    target: 0.5,
    operator: '<=',
    unit: '%',
    isProblem: true,
    description: 'Balita dengan tanda klinis malnutrisi berat atau BB/TB < -3 SD',
    category: 'Balita'
  },
  {
    key: 'Bumil KEK - %',
    label: 'Ibu Hamil Risiko KEK (LiLA < 23.5 cm)',
    shortLabel: 'Bumil KEK',
    target: 13.0,
    operator: '<=',
    unit: '%',
    isProblem: true,
    description: 'Ibu hamil kurang energi kronis dengan lingkar lengan atas di bawah 23,5 cm',
    category: 'Ibu Hamil'
  },
  {
    key: 'Bumil Anemia - %',
    label: 'Ibu Hamil Anemia (Hb < 11 g/dL)',
    shortLabel: 'Bumil Anemia',
    target: 23.0,
    operator: '<=',
    unit: '%',
    isProblem: true,
    description: 'Ibu hamil dengan kadar hemoglobin rendah yang berisiko melahirkan BBLR',
    category: 'Ibu Hamil'
  },
  {
    key: 'Rematri Anemia - %',
    label: 'Remaja Putri Teridentifikasi Anemia',
    shortLabel: 'Rematri Anemia',
    target: 25.0,
    operator: '<=',
    unit: '%',
    isProblem: true,
    description: 'Remaja putri dengan kadar Hb rendah yang menjadi calon ibu',
    category: 'Remaja'
  }
];

// Nama kolom pada hasil join bisa berbeda dari kunci katalog indikator.
// Petakan kunci katalog ke kolom data aktual agar nilai tetap terbaca.
export const GIZI_COLUMN_ALIASES: Record<string, string[]> = {
  'Bumil KEK - %': ['Bumil KEK/Risiko KEK - %'],
};

// Kerangka 15 indikator capaian: hanya metadata dan target standar.
// Nilai realisasi/capaian diisi dari dataset pengguna melalui buildScopeOutcomes.
export const INTERVENTION_OUTCOMES_DATA: InterventionOutcomeItem[] = [
  {
    "no": "1",
    "categoryKey": "sebelum-kelahiran",
    "categoryLabel": "Intervensi untuk remaja putri dan  ibu hamil (sebelum kelahiran)",
    "indicator": "Remaja putri mendapat skrining anemia",
    "target2025": "75%",
    "realisasi2025": null,
    "target2026": "77%",
    "jumlahSasaranTW2": null,
    "capaianTW1": null,
    "capaianTW2": null,
    "status": "Perlu percepatan"
  },
  {
    "no": "2",
    "categoryKey": "sebelum-kelahiran",
    "categoryLabel": "Intervensi untuk remaja putri dan  ibu hamil (sebelum kelahiran)",
    "indicator": "Remaja putri mengonsumsi TTD (tablet tambah darah)",
    "target2025": "65%",
    "realisasi2025": null,
    "target2026": "67%",
    "jumlahSasaranTW2": null,
    "capaianTW1": null,
    "capaianTW2": null,
    "status": "Perlu percepatan"
  },
  {
    "no": "3",
    "categoryKey": "sebelum-kelahiran",
    "categoryLabel": "Intervensi untuk remaja putri dan  ibu hamil (sebelum kelahiran)",
    "indicator": "Ibu hamil ANC minimal 6x*",
    "target2025": "80%",
    "realisasi2025": null,
    "target2026": "60%",
    "jumlahSasaranTW2": null,
    "capaianTW1": null,
    "capaianTW2": null,
    "status": "Perlu percepatan"
  },
  {
    "no": "4",
    "categoryKey": "sebelum-kelahiran",
    "categoryLabel": "Intervensi untuk remaja putri dan  ibu hamil (sebelum kelahiran)",
    "indicator": "Ibu hamil mengonsumsi suplementasi gizi (TTD/MMS) minimal 180 tablet selama kehamilan**",
    "target2025": "48%",
    "realisasi2025": null,
    "target2026": "39%",
    "jumlahSasaranTW2": null,
    "capaianTW1": null,
    "capaianTW2": null,
    "status": "Perlu percepatan"
  },
  {
    "no": "5",
    "categoryKey": "sebelum-kelahiran",
    "categoryLabel": "Intervensi untuk remaja putri dan  ibu hamil (sebelum kelahiran)",
    "indicator": "Ibu hamil KEK mendapat tambahan asupan gizi",
    "target2025": "84%",
    "realisasi2025": null,
    "target2026": "85%",
    "jumlahSasaranTW2": null,
    "capaianTW1": null,
    "capaianTW2": null,
    "status": "Perlu percepatan"
  },
  {
    "no": "6a",
    "categoryKey": "setelah-kelahiran",
    "categoryLabel": "Intervensi untuk balita (setelah kelahiran)",
    "indicator": "Pemantauan pertumbuhan balita",
    "target2025": "80%",
    "realisasi2025": null,
    "target2026": "90%",
    "jumlahSasaranTW2": null,
    "capaianTW1": null,
    "capaianTW2": null,
    "status": "Perlu percepatan"
  },
  {
    "no": "6b",
    "categoryKey": "setelah-kelahiran",
    "categoryLabel": "Intervensi untuk balita (setelah kelahiran)",
    "indicator": "Pemantauan pertumbuhan dan perkembangan balita",
    "target2025": "50%",
    "realisasi2025": null,
    "target2026": "55%",
    "jumlahSasaranTW2": null,
    "capaianTW1": null,
    "capaianTW2": null,
    "status": "Perlu percepatan"
  },
  {
    "no": "7",
    "categoryKey": "setelah-kelahiran",
    "categoryLabel": "Intervensi untuk balita (setelah kelahiran)",
    "indicator": "Bayi usia kurang dari 6 bulan mendapat ASI eksklusif",
    "target2025": "73%",
    "realisasi2025": null,
    "target2026": "76%",
    "jumlahSasaranTW2": null,
    "capaianTW1": null,
    "capaianTW2": null,
    "status": "Perlu percepatan"
  },
  {
    "no": "8",
    "categoryKey": "setelah-kelahiran",
    "categoryLabel": "Intervensi untuk balita (setelah kelahiran)",
    "indicator": "Anak 6-23 bulan mendapat MP-ASI",
    "target2025": "73%",
    "realisasi2025": null,
    "target2026": "76%",
    "jumlahSasaranTW2": null,
    "capaianTW1": null,
    "capaianTW2": null,
    "status": "Perlu percepatan"
  },
  {
    "no": "9a",
    "categoryKey": "setelah-kelahiran",
    "categoryLabel": "Intervensi untuk balita (setelah kelahiran)",
    "indicator": "Balita berat badan tidak naik (T) mendapat tambahan asupan gizi",
    "target2025": "65%",
    "realisasi2025": null,
    "target2026": "70%",
    "jumlahSasaranTW2": null,
    "capaianTW1": null,
    "capaianTW2": null,
    "status": "Perlu percepatan"
  },
  {
    "no": "9b",
    "categoryKey": "setelah-kelahiran",
    "categoryLabel": "Intervensi untuk balita (setelah kelahiran)",
    "indicator": "Balita berat badan kurang mendapat tambahan asupan gizi",
    "target2025": "65%",
    "realisasi2025": null,
    "target2026": "70%",
    "jumlahSasaranTW2": null,
    "capaianTW1": null,
    "capaianTW2": null,
    "status": "Perlu percepatan"
  },
  {
    "no": "9c",
    "categoryKey": "setelah-kelahiran",
    "categoryLabel": "Intervensi untuk balita (setelah kelahiran)",
    "indicator": "Balita gizi kurang mendapat tambahan asupan gizi",
    "target2025": "65%",
    "realisasi2025": null,
    "target2026": "70%",
    "jumlahSasaranTW2": null,
    "capaianTW1": null,
    "capaianTW2": null,
    "status": "Perlu percepatan"
  },
  {
    "no": "9d",
    "categoryKey": "setelah-kelahiran",
    "categoryLabel": "Intervensi untuk balita (setelah kelahiran)",
    "indicator": "Balita gizi buruk mendapat pelayanan tata laksana gizi buruk",
    "target2025": "91%",
    "realisasi2025": null,
    "target2026": "92%",
    "jumlahSasaranTW2": null,
    "capaianTW1": null,
    "capaianTW2": null,
    "status": "Perlu percepatan"
  },
  {
    "no": "10",
    "categoryKey": "setelah-kelahiran",
    "categoryLabel": "Intervensi untuk balita (setelah kelahiran)",
    "indicator": "Baduta memperoleh imunisasi lengkap",
    "target2025": "97%",
    "realisasi2025": null,
    "target2026": "56.25%",
    "jumlahSasaranTW2": null,
    "capaianTW1": null,
    "capaianTW2": null,
    "status": "Perlu percepatan"
  },
  {
    "no": "11",
    "categoryKey": "lintas-siklus",
    "categoryLabel": "Intervensi lintas siklus hidup",
    "indicator": "Kab/Kota yang telah terverifikasi 100% Kepala Keluarga stop Buang Air Besar Sembarangan (BABS)***",
    "target2025": "8653 desa",
    "realisasi2025": null,
    "target2026": "8653 desa",
    "jumlahSasaranTW2": null,
    "capaianTW1": null,
    "capaianTW2": null,
    "status": "Perlu percepatan"
  }
];
