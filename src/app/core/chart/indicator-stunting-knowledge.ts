export interface IndicatorCalculationFormula {
  formulaText: string;
  numeratorDescription: string;
  denominatorDescription: string;
}

export interface IndicatorStuntingExplanation {
  key: string;
  title: string;
  targetGroup: string;
  definition: string;
  stuntingRelation: string;
  standardTargetText?: string;
  category: 'Remaja' | 'Ibu Hamil' | 'Balita' | 'Gizi' | 'Imunisasi' | 'Hasil Luaran' | 'Umum';
  calculation: IndicatorCalculationFormula;
}

/**
 * IndicatorStuntingKnowledge: Basis pengetahuan domain Dinkes yang menjelaskan
 * definisi operasional setiap indikator kesehatan, rumus perhitungannya (pembilang A / penyebut B),
 * dan keterkaitannya secara langsung terhadap pencegahan stunting pada 1000 Hari Pertama Kehidupan (HPK).
 */
export class IndicatorStuntingKnowledge {
  private static readonly KNOWLEDGE_BASE: IndicatorStuntingExplanation[] = [
    {
      key: 'ttd_rematri',
      title: 'Konsumsi TTD Remaja Putri',
      targetGroup: 'Remaja Putri (SMP/SMA sederajat)',
      category: 'Remaja',
      definition:
        'Persentase remaja putri di satuan pendidikan yang mendapatkan dan mengonsumsi minimal 1 tablet tambah darah (TTD) setiap minggu sesuai standar.',
      stuntingRelation:
        'Mencegah anemia defisiensi besi sejak dini. Remaja putri yang terbebas dari anemia akan memasuki fase calon pengantin dan kehamilan dengan cadangan zat besi yang optimal, sehingga secara signifikan mencegah bayi lahir prematur, BBLR, dan stunting.',
      standardTargetText: 'Target Standar: ≥ 58% - 67%',
      calculation: {
        formulaText: '(A / B) × 100%',
        numeratorDescription:
          'Jumlah remaja putri di satuan pendidikan yang mengonsumsi minimal 1 tablet TTD per minggu sesuai standar (A)',
        denominatorDescription:
          'Jumlah seluruh sasaran remaja putri di satuan pendidikan (SMP/SMA/sederajat) di wilayah tersebut (B)',
      },
    },
    {
      key: 'skrining_anemia',
      title: 'Skrining Anemia Remaja Putri',
      targetGroup: 'Remaja Putri Kelas 7 & 10',
      category: 'Remaja',
      definition:
        'Pemeriksaan kadar hemoglobin (Hb) darah menggunakan rapid test/Hb-meter pada remaja putri kelas 7 dan 10 untuk mendeteksi dini status anemia.',
      stuntingRelation:
        'Deteksi dini anemia memungkinkan rujukan dan tata laksana segera sebelum masa kehamilan. Menjadi langkah intervensi hulu paling krusial untuk memutus siklus stunting antargenerasi.',
      standardTargetText: 'Target Standar: ≥ 70% - 80%',
      calculation: {
        formulaText: '(A / B) × 100%',
        numeratorDescription:
          'Jumlah remaja putri kelas 7 dan 10 yang telah diskrining kadar hemoglobin (Hb) darahnya sampai periode ini (A)',
        denominatorDescription:
          'Jumlah seluruh sasaran remaja putri kelas 7 dan 10 yang terdaftar di satuan pendidikan (B)',
      },
    },
    {
      key: 'anc_k6',
      title: 'Pemeriksaan Kehamilan K6 (ANC K6)',
      targetGroup: 'Ibu Hamil',
      category: 'Ibu Hamil',
      definition:
        'Persentase ibu hamil yang memperoleh pelayanan antenatal care (ANC) minimal 6 kali selama masa kehamilan, termasuk minimal 2 kali pemeriksaan oleh dokter dengan USG dasar.',
      stuntingRelation:
        'Memantau laju pertumbuhan janin dan kesehatan ibu secara menyeluruh. Deteksi dini hambatan pertumbuhan janin dalam kandungan (IUGR) dan penanganan komplikasi kehamilan sedini mungkin mencegah bayi lahir dengan kondisi stunting bawaan.',
      standardTargetText: 'Target Standar: ≥ 85% - 90%',
      calculation: {
        formulaText: '(A / B) × 100%',
        numeratorDescription:
          'Jumlah ibu bersalin yang telah memperoleh pelayanan antenatal minimal 6 kali (K6) sesuai standar selama masa kehamilannya (A)',
        denominatorDescription:
          'Jumlah seluruh sasaran ibu bersalin/ibu hamil di wilayah kabupaten/kota pada periode tersebut (B)',
      },
    },
    {
      key: 'ttd_bumil',
      title: 'Suplementasi TTD / MMS Ibu Hamil',
      targetGroup: 'Ibu Hamil',
      category: 'Ibu Hamil',
      definition:
        'Persentase ibu hamil yang mengonsumsi minimal 90–180 tablet tambah darah (TTD) atau Multiple Micronutrient Supplements (MMS) selama masa kehamilan.',
      stuntingRelation:
        'Zat besi dan asam folat mendukung vaskularisasi plasenta dan oksigenasi janin. Kekurangan asupan mikronutrien ini memicu anemia gravidarum yang berisiko tinggi menyebabkan kelahiran bayi dengan berat badan lahir rendah (BBLR) pemicu stunting.',
      standardTargetText: 'Target Standar: ≥ 82% - 90%',
      calculation: {
        formulaText: '(A / B) × 100%',
        numeratorDescription:
          'Jumlah ibu hamil yang mengonsumsi suplementasi gizi (minimal 90–180 tablet TTD atau MMS) sampai periode ini (A)',
        denominatorDescription:
          'Jumlah seluruh sasaran ibu hamil yang ada di wilayah kerja pada periode tersebut (B)',
      },
    },
    {
      key: 'pmt_bumil_kek',
      title: 'PMT Ibu Hamil Kurang Energi Kronis (KEK)',
      targetGroup: 'Ibu Hamil KEK (LiLA < 23,5 cm)',
      category: 'Ibu Hamil',
      definition:
        'Cakupan ibu hamil dengan Kurang Energi Kronis (lingkar lengan atas < 23,5 cm) yang mendapatkan Makanan Tambahan padat gizi berbahan pangan lokal atau pabrikan.',
      stuntingRelation:
        'Ibu hamil KEK mengalami malnutrisi kronis yang menghambat suplai kalori dan asam amino ke janin. PMT Bumil KEK memulihkan status gizi ibu sehingga janin mencapai pertambahan berat dan panjang badan normal.',
      standardTargetText: 'Target Standar: ≥ 85% - 90%',
      calculation: {
        formulaText: '(A / B) × 100%',
        numeratorDescription:
          'Jumlah ibu hamil KEK yang mendapatkan makanan tambahan pemulihan sampai periode ini (A)',
        denominatorDescription:
          'Jumlah seluruh ibu hamil KEK yang ditemukan di wilayah kabupaten/kota tersebut (B)',
      },
    },
    {
      key: 'pemantauan_balita_ds',
      title: 'Pemantauan Pertumbuhan Balita (D/S)',
      targetGroup: 'Balita Usia 0–59 Bulan',
      category: 'Balita',
      definition:
        'Persentase balita yang datang dan ditimbang berat badannya serta diukur panjang/tinggi badannya di Posyandu terhadap total seluruh balita di wilayah tersebut (D/S).',
      stuntingRelation:
        'Pintu utama penemuan dini gangguan pertumbuhan (growth faltering) dan berat badan tidak naik. Kenaikan BB yang terhenti (faltering) adalah alarm awal sebelum balita merosot menjadi gizi kurang dan akhirnya stunting kronis.',
      standardTargetText: 'Target Standar: ≥ 80% - 85%',
      calculation: {
        formulaText: '(D / S) × 100%',
        numeratorDescription:
          'Jumlah balita usia 0–59 bulan yang datang dan ditimbang berat badannya di Posyandu/faskes bulan ini [D] (A)',
        denominatorDescription:
          'Jumlah seluruh balita usia 0–59 bulan yang terdaftar dan berada di wilayah tersebut [S] (B)',
      },
    },
    {
      key: 'asi_eksklusif',
      title: 'Pemberian ASI Eksklusif',
      targetGroup: 'Bayi Usia 0–5 Bulan',
      category: 'Gizi',
      definition:
        'Persentase bayi usia kurang dari 6 bulan yang hanya diberi Air Susu Ibu (ASI) tanpa makanan atau cairan tambahan lain (kecuali obat/vitamin) berdasarkan recall 24 jam.',
      stuntingRelation:
        'ASI eksklusif menyediakan zat antibodi (imunoglobulin), mikronutrien, dan faktor pertumbuhan esensial. Bayi tanpa ASI eksklusif rentan mengalami episode diare dan infeksi berulang yang mengikis cadangan nutrisi dan memicu stunting.',
      standardTargetText: 'Target Standar: ≥ 55% - 60%',
      calculation: {
        formulaText: '(A / B) × 100%',
        numeratorDescription:
          'Jumlah bayi usia 0–5 bulan yang hanya mendapat ASI eksklusif berdasarkan wawancara recall 24 jam (A)',
        denominatorDescription:
          'Jumlah seluruh bayi usia 0–5 bulan yang di-recall pada periode pemantauan (B)',
      },
    },
    {
      key: 'mpasi_beragam',
      title: 'MP-ASI Beragam Kaya Protein Hewani',
      targetGroup: 'Anak Usia 6–23 Bulan',
      category: 'Gizi',
      definition:
        'Persentase anak usia 6–23 bulan yang mendapatkan Makanan Pendamping ASI yang memenuhi keberagaman makanan (dietary diversity), terutama asupan protein hewani setiap hari.',
      stuntingRelation:
        'Setelah usia 6 bulan, ASI saja tidak mencukupi kebutuhan gizi. Asupan asam amino esensial dari protein hewani (telur, ikan, daging) menstimulasi sekresi hormon IGF-1 yang secara biologis bertanggung jawab atas pemanjangan tulang linier anak.',
      standardTargetText: 'Target Standar: ≥ 70% - 80%',
      calculation: {
        formulaText: '(A / B) × 100%',
        numeratorDescription:
          'Jumlah anak usia 6–23 bulan yang mengonsumsi MP-ASI beragam dengan protein hewani memadai (A)',
        denominatorDescription:
          'Jumlah seluruh sasaran anak usia 6–23 bulan yang dipantau di wilayah tersebut (B)',
      },
    },
    {
      key: 'pmt_gizi_kurang',
      title: 'PMT Balita Gizi Kurang',
      targetGroup: 'Balita Usia 6–59 Bulan Gizi Kurang',
      category: 'Gizi',
      definition:
        'Cakupan balita gizi kurang (wasting / berat badan menurut panjang atau tinggi badan -3 SD s.d. < -2 SD) yang menerima makanan tambahan pemulihan berbasis pangan lokal kaya protein hewani.',
      stuntingRelation:
        'Wasting (kurus akut) yang tidak tertangani dalam jangka waktu 2–3 bulan akan bermutasi menjadi stunting (pendek kronis). PMT pemulihan mengembalikan massa otot dan berat badan sebelum gangguan tumbuh kembang menjadi permanen.',
      standardTargetText: 'Target Standar: ≥ 85% - 90%',
      calculation: {
        formulaText: '(A / B) × 100%',
        numeratorDescription:
          'Jumlah balita gizi kurang yang mendapatkan makanan tambahan berbahan pangan lokal sampai periode ini (A)',
        denominatorDescription:
          'Jumlah seluruh balita usia 6–59 bulan berstatus gizi kurang yang ditemukan di wilayah tersebut (B)',
      },
    },
    {
      key: 'pmt_bb_kurang',
      title: 'PMT Balita Berat Badan Kurang (Underweight)',
      targetGroup: 'Balita Usia 6–59 Bulan BB Kurang',
      category: 'Gizi',
      definition:
        'Cakupan balita dengan berat badan menurut umur (BB/U) rendah yang menerima intervensi makanan tambahan padat nutrisi.',
      stuntingRelation:
        'Mencegah kemerosotan indeks massa tubuh balita. Memastikan pertambahan berat badan linier agar tidak mengorbankan pertumbuhan tinggi badan.',
      standardTargetText: 'Target Standar: ≥ 85%',
      calculation: {
        formulaText: '(A / B) × 100%',
        numeratorDescription:
          'Jumlah balita usia 6–59 bulan BB kurang (underweight) yang mendapatkan makanan tambahan lokal (A)',
        denominatorDescription:
          'Jumlah seluruh balita usia 6–59 bulan dengan berat badan kurang yang tercatat (B)',
      },
    },
    {
      key: 'pmt_bb_tidak_naik',
      title: 'PMT Balita Berat Badan Tidak Naik (T)',
      targetGroup: 'Balita 6–59 Bulan Status T (Tidak Naik)',
      category: 'Gizi',
      definition:
        'Persentase balita dengan status pertumbuhan berat badan tidak naik (T) pada penimbangan bulanan yang langsung mendapatkan intervensi edukasi gizi dan makanan tambahan.',
      stuntingRelation:
        'Intervensi paling awal (golden window) sebelum balita jatuh ke dalam kategori gizi kurang atau stunting. Menangani balita status T merupakan strategi pencegahan stunting paling efektif di tingkat posyandu.',
      standardTargetText: 'Target Standar: ≥ 80% - 85%',
      calculation: {
        formulaText: '(A / B) × 100%',
        numeratorDescription:
          'Jumlah balita usia 6–59 bulan status berat badan tidak naik (T) yang mendapatkan makanan tambahan (A)',
        denominatorDescription:
          'Jumlah seluruh balita dengan status pertumbuhan berat badan tidak naik (T) pada bulan pemantauan (B)',
      },
    },
    {
      key: 'tatalaksana_gizi_buruk',
      title: 'Tatalaksana Balita Gizi Buruk',
      targetGroup: 'Balita Gizi Buruk (BB/TB < -3 SD / Edema)',
      category: 'Gizi',
      definition:
        'Persentase balita gizi buruk yang mendapatkan perawatan rawat inap atau rawat jalan sesuai protokol 10 Langkah Tatalaksana Anak Gizi Buruk (TAGB).',
      stuntingRelation:
        'Gizi buruk adalah bentuk malnutrisi paling mematikan dan hampir selalu disertai stunting parah. Tatalaksana medis dan nutrisi terapeutik menyelamatkan fungsi organ vital dan memulihkan metabolisme pertumbuhan.',
      standardTargetText: 'Target Standar: 100%',
      calculation: {
        formulaText: '(A / B) × 100%',
        numeratorDescription:
          'Jumlah kasus balita gizi buruk yang mendapatkan perawatan medis dan terapi gizi sesuai standar (A)',
        denominatorDescription:
          'Jumlah seluruh kasus balita usia 6–59 bulan gizi buruk yang ditemukan di wilayah tersebut (B)',
      },
    },
    {
      key: 'imunisasi_dasar_lengkap',
      title: 'Imunisasi Dasar Lengkap (IDL) Bayi',
      targetGroup: 'Bayi Usia 0–11 Bulan',
      category: 'Imunisasi',
      definition:
        'Cakupan bayi usia di bawah 1 tahun yang telah menerima seluruh paket imunisasi dasar (HB0, BCG, DPT-HB-Hib 1-3, Polio 1-4, IPV, dan Campak-Rubella).',
      stuntingRelation:
        'Infeksi berulang seperti diare, pneumonia, dan campak merusak vili-vili usus (environmental enteropathy) dan menguras zat gizi tubuh. Imunisasi lengkap melindungi balita dari infeksi kronis yang menjadi pemicu utama stunting non-dietary.',
      standardTargetText: 'Target Standar: ≥ 90% - 95%',
      calculation: {
        formulaText: '(A / B) × 100%',
        numeratorDescription:
          'Jumlah bayi usia 0–11 bulan yang telah lengkap menerima seluruh jenis imunisasi dasar wajib (A)',
        denominatorDescription:
          'Jumlah sasaran bayi bertahan hidup (surviving infants) di wilayah tersebut pada tahun berjalan (B)',
      },
    },
    {
      key: 'prevalensi_stunting',
      title: 'Prevalensi Stunting Balita',
      targetGroup: 'Balita Usia 0–59 Bulan (TB/U < -2 SD)',
      category: 'Hasil Luaran',
      definition:
        'Persentase balita yang memiliki tinggi badan atau panjang badan menurut umur berada di bawah minus 2 standar deviasi (-2 SD) dari standar pertumbuhan anak WHO.',
      stuntingRelation:
        'Indikator luaran utama (outcome metric) yang merefleksikan kegagalan pertumbuhan jangka panjang akibat akumulasi defisit nutrisi, infeksi berulang, dan stimulasi psikososial yang tidak memadai selama 1000 HPK.',
      standardTargetText: 'Target RPJMN: < 14%',
      calculation: {
        formulaText: '(A / B) × 100%',
        numeratorDescription:
          'Jumlah balita berstatus pendek (stunted) dan sangat pendek (severely stunted) berdasarkan indeks PB/U atau TB/U < -2 SD (A)',
        denominatorDescription:
          'Jumlah seluruh balita usia 0–59 bulan yang diukur tinggi/panjang badannya pada periode pemantauan (B)',
      },
    },
  ];

  /**
   * Menemukan penjelasan indikator berdasarkan pencocokan teks cerdas (fuzzy / keyword).
   */
  static getExplanation(indicatorLabelOrKey: string): IndicatorStuntingExplanation {
    if (!indicatorLabelOrKey) {
      return this.createFallbackExplanation(indicatorLabelOrKey);
    }

    const norm = indicatorLabelOrKey.toLowerCase().replace(/[^a-z0-9]/g, ' ');

    // 1. Pencocokan langsung dari kata kunci spesifik
    if (norm.includes('anemia') || norm.includes('skrining')) {
      return this.findEntry('skrining_anemia')!;
    }
    if (
      norm.includes('rematri') ||
      norm.includes('remaja') ||
      (norm.includes('ttd') && !norm.includes('bumil') && !norm.includes('hamil'))
    ) {
      return this.findEntry('ttd_rematri')!;
    }
    if (
      norm.includes('k6') ||
      norm.includes('anc') ||
      norm.includes('bersalin') ||
      norm.includes('persalinan')
    ) {
      return this.findEntry('anc_k6')!;
    }
    if (
      (norm.includes('ttd') && (norm.includes('bumil') || norm.includes('hamil'))) ||
      norm.includes('mms') ||
      norm.includes('suplementasi')
    ) {
      return this.findEntry('ttd_bumil')!;
    }
    if (
      norm.includes('kek') &&
      (norm.includes('bumil') || norm.includes('hamil') || norm.includes('pmt'))
    ) {
      return this.findEntry('pmt_bumil_kek')!;
    }
    if (
      norm.includes('mpasi') ||
      norm.includes('mp asi') ||
      norm.includes('makanan pendamping') ||
      norm.includes('beragam')
    ) {
      return this.findEntry('mpasi_beragam')!;
    }
    if (
      norm.includes('eksklusif') ||
      /\basi\b/.test(norm) ||
      (norm.includes('asi') && !norm.includes('mpasi'))
    ) {
      return this.findEntry('asi_eksklusif')!;
    }
    if (norm.includes('gizi buruk') || norm.includes('buruk')) {
      return this.findEntry('tatalaksana_gizi_buruk')!;
    }
    if (
      norm.includes('gizi kurang') ||
      (norm.includes('kurang') && !norm.includes('berat badan') && !norm.includes('bb'))
    ) {
      return this.findEntry('pmt_gizi_kurang')!;
    }
    if (
      norm.includes('tidak naik') ||
      norm.includes('status t') ||
      norm.includes('berat badan tidak naik')
    ) {
      return this.findEntry('pmt_bb_tidak_naik')!;
    }
    if (
      norm.includes('berat badan kurang') ||
      norm.includes('bb kurang') ||
      norm.includes('underweight')
    ) {
      return this.findEntry('pmt_bb_kurang')!;
    }
    if (
      norm.includes('ditimbang') ||
      norm.includes('d s') ||
      norm.includes('pantau') ||
      norm.includes('pertumbuhan')
    ) {
      return this.findEntry('pemantauan_balita_ds')!;
    }
    if (norm.includes('idl') || norm.includes('imunisasi')) {
      return this.findEntry('imunisasi_dasar_lengkap')!;
    }
    if (
      norm.includes('stunting') ||
      norm.includes('pendek') ||
      norm.includes('tb u') ||
      norm.includes('pb u')
    ) {
      return this.findEntry('prevalensi_stunting')!;
    }

    // 2. Fallback untuk triwulan atau metrik generik
    if (/tw\s*[1-4]|triwulan\s*[1-4]|quarter/i.test(norm)) {
      const match = norm.match(/tw\s*([1-4])|triwulan\s*([1-4])/i);
      const q = match ? match[1] || match[2] : 'Berjalan';
      return {
        key: `tw_${q}`,
        title: `Progres Triwulan ${q}`,
        targetGroup: 'Semua Sasaran 1000 HPK',
        category: 'Umum',
        definition: `Evaluasi akumulasi capaian intervensi gizi spesifik pada Triwulan ke-${q} tahun berjalan.`,
        stuntingRelation: `Pemantauan berkala per triwulan memastikan kesenjangan (gap) cakupan intervensi dapat segera dievaluasi dan diintervensi oleh Puskesmas/Dinkes sebelum memasuki akhir tahun anggaran, meminimalkan laju kasus stunting baru.`,
        standardTargetText: `Target Kumulatif TW ${q}`,
        calculation: {
          formulaText: '(A / B) × 100%',
          numeratorDescription: `Akumulasi capaian riil sasaran terlayani sampai dengan Triwulan ${q} (A)`,
          denominatorDescription: `Total target sasaran pelayanan yang ditetapkan untuk Triwulan ${q} (B)`,
        },
      };
    }

    return this.createFallbackExplanation(indicatorLabelOrKey);
  }

  private static findEntry(key: string): IndicatorStuntingExplanation | undefined {
    return this.KNOWLEDGE_BASE.find((k) => k.key === key);
  }

  private static createFallbackExplanation(label: string): IndicatorStuntingExplanation {
    const cleanLabel = (label || 'Indikator Kesehatan').trim();
    return {
      key: 'general_indicator',
      title: cleanLabel,
      targetGroup: 'Masyarakat & Sasaran Kesehatan',
      category: 'Umum',
      definition: `Indikator pengukuran capaian program kesehatan "${cleanLabel}" di tingkat kabupaten/kota.`,
      stuntingRelation: `Sebagai bagian dari intervensi kesehatan komprehensif, pencapaian target pada indikator ini berkontribusi memperkuat ekosistem kesehatan keluarga dan ketahanan nutrisi yang secara tidak langsung mendukung penurunan prevalensi stunting.`,
      standardTargetText: 'Sesuai Standar Pelayanan Minimal (SPM)',
      calculation: {
        formulaText: '(A / B) × 100%',
        numeratorDescription: `Jumlah capaian riil atau sasaran yang memperoleh pelayanan pada indikator "${cleanLabel}" (A)`,
        denominatorDescription: `Jumlah seluruh target sasaran pelayanan yang diwajibkan (B)`,
      },
    };
  }
}
