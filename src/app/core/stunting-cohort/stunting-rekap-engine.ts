import * as XLSX from 'xlsx-js-style';

export interface RekapRowData {
  no: number;
  wilayah: string;
  // BB/U
  sangatKurangBbu: number;
  kurangBbu: number;
  normalBbu: number;
  risikoLebihBbu: number;
  outlierBbu: number;
  // TB/U
  sangatPendekTbu: number;
  pendekTbu: number;
  normalTbu: number;
  tinggiTbu: number;
  outlierTbu: number;
  // BB/TB
  giziBurukBbtb: number;
  giziKurangBbtb: number;
  normalBbtb: number;
  risikoGiziLebihBbtb: number;
  giziLebihBbtb: number;
  obesitasBbtb: number;
  outlierBbtb: number;
  // Indikator Agregat
  jumlahDitimbangDiukur: number; // Total D (sum of BB/TB categories)
  stuntingCount: number; // sangatPendek + pendek
  stuntingPercent: number; // stuntingCount / D * 100
  wastingCount: number; // giziBuruk + giziKurang
  wastingPercent: number; // wastingCount / D * 100
  underweightCount: number; // sangatKurang + kurang
  underweightPercent: number; // underweightCount / D * 100
  giziBurukCount: number; // giziBuruk
  giziBurukPercent: number; // giziBurukCount / D * 100
  overweightCount: number; // giziLebih + obesitas
  overweightPercent: number; // overweightCount / D * 100
  sasaranAnak: number; // S
  persenDS: number; // D / S * 100
}

export interface RekapTotalData extends Omit<RekapRowData, 'no' | 'wilayah'> {
  label: 'JUMLAH';
}

export interface RekapSummary {
  totalAnak: number;
  totalStunting: number;
  persenStunting: number;
  totalWasting: number;
  persenWasting: number;
  totalUnderweight: number;
  persenUnderweight: number;
  totalOverweight: number;
  persenOverweight: number;
  totalGiziBuruk: number;
  persenGiziBuruk: number;
  totalOutlier: number;
  persenOutlier: number;
  totalSasaran: number;
  persenDS: number;
}

export interface RekapResult {
  cutoffDate: string;
  groupingKey: string;
  rows: RekapRowData[];
  totals: RekapTotalData;
  summary: RekapSummary;
}

export interface RekapOptions {
  cutoffDate?: string;
  groupingLevel?: 'kabupaten_kota' | 'kecamatan' | 'puskesmas' | 'desa_kelurahan' | string;
  customSasaranMap?: Record<string, number>;
}

// Authentic Central Java Sasaran Anak per Kabupaten/Kota (Cutoff Rekap Dinkes Jateng 2025/2026)
export const JATENG_SASARAN_MAP: Record<string, number> = {
  'KABUPATEN CILACAP': 103989,
  'KABUPATEN BANYUMAS': 91761,
  'KABUPATEN PURBALINGGA': 59230,
  'KABUPATEN BANJARNEGARA': 56015,
  'KABUPATEN KEBUMEN': 70916,
  'KABUPATEN PURWOREJO': 36666,
  'KABUPATEN WONOSOBO': 47986,
  'KABUPATEN MAGELANG': 69236,
  'KABUPATEN BOYOLALI': 57963,
  'KABUPATEN KLATEN': 60627,
  'KABUPATEN SUKOHARJO': 45555,
  'KABUPATEN WONOGIRI': 41404,
  'KABUPATEN KARANGANYAR': 50160,
  'KABUPATEN SRAGEN': 49940,
  'KABUPATEN GROBOGAN': 78601,
  'KABUPATEN BLORA': 45377,
  'KABUPATEN REMBANG': 38351,
  'KABUPATEN PATI': 71327,
  'KABUPATEN KUDUS': 53719,
  'KABUPATEN JEPARA': 74421,
  'KABUPATEN DEMAK': 83552,
  'KABUPATEN SEMARANG': 63050,
  'KABUPATEN TEMANGGUNG': 42729,
  'KABUPATEN KENDAL': 59459,
  'KABUPATEN BATANG': 49462,
  'KABUPATEN PEKALONGAN': 60171,
  'KABUPATEN PEMALANG': 80903,
  'KABUPATEN TEGAL': 92968,
  'KABUPATEN BREBES': 108108,
  'KOTA MAGELANG': 4446,
  'KOTA SURAKARTA': 20149,
  'KOTA SALATIGA': 8632,
  'KOTA SEMARANG': 79001,
  'KOTA PEKALONGAN': 18501,
  'KOTA TEGAL': 10109,
};

export class StuntingRekapEngine {
  /**
   * Resiliently finds column key matching possible keywords
   */
  public static findColumnKey(columns: string[], patterns: string[]): string | undefined {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const pat of patterns) {
      const pNorm = norm(pat);
      // 1. Exact normalized match
      const exact = columns.find((c) => norm(c) === pNorm);
      if (exact) return exact;
    }

    for (const pat of patterns) {
      const pNorm = norm(pat);
      // 2. Contains match
      const contains = columns.find((c) => norm(c).includes(pNorm));
      if (contains) return contains;
    }

    return undefined;
  }

  /**
   * Normalizes category strings to standard domain classification
   */
  public static normalizeBBU(val: unknown): 'Sangat Kurang' | 'Kurang' | 'Berat Badan Normal' | 'Risiko Lebih' | 'Outlier' {
    if (!val) return 'Berat Badan Normal';
    const s = String(val).trim().toLowerCase();
    if (s.includes('outlier')) return 'Outlier';
    if (s.includes('sangat kurang') || s.includes('severely underweight')) return 'Sangat Kurang';
    if (s.includes('kurang') || s.includes('underweight')) return 'Kurang';
    if (s.includes('risiko') || s.includes('lebih') || s.includes('overweight')) return 'Risiko Lebih';
    return 'Berat Badan Normal';
  }

  public static normalizeTBU(val: unknown): 'Sangat Pendek' | 'Pendek' | 'Normal' | 'Tinggi' | 'Outlier' {
    if (!val) return 'Normal';
    const s = String(val).trim().toLowerCase();
    if (s.includes('outlier')) return 'Outlier';
    if (s.includes('sangat pendek') || s.includes('severely stunted')) return 'Sangat Pendek';
    if (s.includes('pendek') || s.includes('stunted')) return 'Pendek';
    if (s.includes('tinggi') || s.includes('tall')) return 'Tinggi';
    return 'Normal';
  }

  public static normalizeBBTB(
    val: unknown
  ): 'Gizi Buruk' | 'Gizi Kurang' | 'Normal' | 'Risiko Gizi Lebih' | 'Gizi Lebih' | 'Obesitas' | 'Outlier' {
    if (!val) return 'Normal';
    const s = String(val).trim().toLowerCase();
    if (s.includes('outlier')) return 'Outlier';
    if (s.includes('gizi buruk') || s.includes('severely wasted')) return 'Gizi Buruk';
    if (s.includes('gizi kurang') || s.includes('wasted')) return 'Gizi Kurang';
    if (s.includes('obesitas') || s.includes('obese')) return 'Obesitas';
    if (s.includes('risiko') || s.includes('berisiko')) return 'Risiko Gizi Lebih';
    if (s.includes('gizi lebih') || s.includes('overweight')) return 'Gizi Lebih';
    return 'Normal';
  }

  /**
   * Evaluates WHO Z-score based categories if status columns are missing in raw data
   */
  public static evaluateZScores(
    weightKg: number,
    heightCm: number,
    ageMonths: number,
    isBoy: boolean
  ): { bbu: string; tbu: string; bbtb: string } {
    // Simplified approximation when raw classifications are absent
    const medianH = 50 + ageMonths * 1.05;
    const sdH = 3.2;
    const zTbu = (heightCm - medianH) / sdH;

    const medianW = 3.3 + ageMonths * 0.42;
    const sdW = 1.3;
    const zBbu = (weightKg - medianW) / sdW;

    const medianWh = 3.0 + (heightCm - 48) * 0.25;
    const sdWh = 1.2;
    const zBbtb = (weightKg - medianWh) / sdWh;

    let bbu = 'Berat Badan Normal';
    if (zBbu < -6 || zBbu > 5) bbu = 'Outlier';
    else if (zBbu < -3) bbu = 'Sangat Kurang';
    else if (zBbu < -2) bbu = 'Kurang';
    else if (zBbu > 1) bbu = 'Risiko Lebih';

    let tbu = 'Normal';
    if (zTbu < -6 || zTbu > 6) tbu = 'Outlier';
    else if (zTbu < -3) tbu = 'Sangat Pendek';
    else if (zTbu < -2) tbu = 'Pendek';
    else if (zTbu > 3) tbu = 'Tinggi';

    let bbtb = 'Normal';
    if (zBbtb < -5 || zBbtb > 5) bbtb = 'Outlier';
    else if (zBbtb < -3) bbtb = 'Gizi Buruk';
    else if (zBbtb < -2) bbtb = 'Gizi Kurang';
    else if (zBbtb > 3) bbtb = 'Obesitas';
    else if (zBbtb > 2) bbtb = 'Gizi Lebih';
    else if (zBbtb > 1) bbtb = 'Risiko Gizi Lebih';

    return { bbu, tbu, bbtb };
  }

  /**
   * Main aggregation method: converts raw child records into complete status gizi rekap
   */
  public static aggregate(records: Record<string, unknown>[], options: RekapOptions = {}): RekapResult {
    const cutoffDate = options.cutoffDate || new Date().toISOString().replace('T', ' ').substring(0, 19);
    const groupingLevel = options.groupingLevel || 'kabupaten_kota';

    if (!records || records.length === 0) {
      return {
        cutoffDate,
        groupingKey: groupingLevel,
        rows: [],
        totals: {
          label: 'JUMLAH',
          sangatKurangBbu: 0,
          kurangBbu: 0,
          normalBbu: 0,
          risikoLebihBbu: 0,
          outlierBbu: 0,
          sangatPendekTbu: 0,
          pendekTbu: 0,
          normalTbu: 0,
          tinggiTbu: 0,
          outlierTbu: 0,
          giziBurukBbtb: 0,
          giziKurangBbtb: 0,
          normalBbtb: 0,
          risikoGiziLebihBbtb: 0,
          giziLebihBbtb: 0,
          obesitasBbtb: 0,
          outlierBbtb: 0,
          jumlahDitimbangDiukur: 0,
          stuntingCount: 0,
          stuntingPercent: 0,
          wastingCount: 0,
          wastingPercent: 0,
          underweightCount: 0,
          underweightPercent: 0,
          giziBurukCount: 0,
          giziBurukPercent: 0,
          overweightCount: 0,
          overweightPercent: 0,
          sasaranAnak: 0,
          persenDS: 0,
        },
        summary: {
          totalAnak: 0,
          totalStunting: 0,
          persenStunting: 0,
          totalWasting: 0,
          persenWasting: 0,
          totalUnderweight: 0,
          persenUnderweight: 0,
          totalOverweight: 0,
          persenOverweight: 0,
          totalGiziBuruk: 0,
          persenGiziBuruk: 0,
          totalOutlier: 0,
          persenOutlier: 0,
          totalSasaran: 0,
          persenDS: 0,
        },
      };
    }

    const columns = Object.keys(records[0] || {});

    // Detect column mappings
    const regionKey =
      StuntingRekapEngine.findColumnKey(columns, [
        groupingLevel,
        'kabupaten_kota',
        'kabupaten',
        'kota',
        'kecamatan',
        'puskesmas',
        'desa_kelurahan',
        'wilayah',
      ]) || columns[0];

    const bbuKey = StuntingRekapEngine.findColumnKey(columns, [
      'status_bbu',
      'status_bb_u',
      'bbu',
      'bb/u',
      'status bbu',
    ]);
    const tbuKey = StuntingRekapEngine.findColumnKey(columns, [
      'status_tbu',
      'status_tb_u',
      'tbu',
      'tb/u',
      'status tbu',
    ]);
    const bbtbKey = StuntingRekapEngine.findColumnKey(columns, [
      'status_bbtb',
      'status_bb_tb',
      'bbtb',
      'bb/tb',
      'status bbtb',
    ]);

    // Anthropometry keys (fallback if status keys are missing)
    const weightKey = StuntingRekapEngine.findColumnKey(columns, ['berat_badan_kg', 'berat', 'bb', 'weight']);
    const heightKey = StuntingRekapEngine.findColumnKey(columns, ['tinggi_badan_cm', 'tinggi', 'tb', 'height']);
    const genderKey = StuntingRekapEngine.findColumnKey(columns, ['jenis_kelamin', 'jk', 'gender', 'sex']);
    const ageKey = StuntingRekapEngine.findColumnKey(columns, ['umur_bulan', 'usia_bulan', 'umur', 'age_months']);

    // Grouping container
    const groupMap = new Map<
      string,
      {
        sangatKurangBbu: number;
        kurangBbu: number;
        normalBbu: number;
        risikoLebihBbu: number;
        outlierBbu: number;

        sangatPendekTbu: number;
        pendekTbu: number;
        normalTbu: number;
        tinggiTbu: number;
        outlierTbu: number;

        giziBurukBbtb: number;
        giziKurangBbtb: number;
        normalBbtb: number;
        risikoGiziLebihBbtb: number;
        giziLebihBbtb: number;
        obesitasBbtb: number;
        outlierBbtb: number;

        count: number;
      }
    >();

    // Process every individual child record
    for (const row of records) {
      let regVal = String(row[regionKey] || '').trim();
      if (!regVal) regVal = 'WILAYAH TIDAK TERDEFINISI';

      let data = groupMap.get(regVal);
      if (!data) {
        data = {
          sangatKurangBbu: 0,
          kurangBbu: 0,
          normalBbu: 0,
          risikoLebihBbu: 0,
          outlierBbu: 0,
          sangatPendekTbu: 0,
          pendekTbu: 0,
          normalTbu: 0,
          tinggiTbu: 0,
          outlierTbu: 0,
          giziBurukBbtb: 0,
          giziKurangBbtb: 0,
          normalBbtb: 0,
          risikoGiziLebihBbtb: 0,
          giziLebihBbtb: 0,
          obesitasBbtb: 0,
          outlierBbtb: 0,
          count: 0,
        };
        groupMap.set(regVal, data);
      }

      data.count++;

      // Resolve classifications
      let bbuCat: string;
      let tbuCat: string;
      let bbtbCat: string;

      if (bbuKey && tbuKey && bbtbKey) {
        bbuCat = StuntingRekapEngine.normalizeBBU(row[bbuKey]);
        tbuCat = StuntingRekapEngine.normalizeTBU(row[tbuKey]);
        bbtbCat = StuntingRekapEngine.normalizeBBTB(row[bbtbKey]);
      } else {
        const w = Number(row[weightKey || '']) || 10;
        const h = Number(row[heightKey || '']) || 75;
        const age = Number(row[ageKey || '']) || 24;
        const isBoy = String(row[genderKey || '']).toLowerCase().startsWith('l');
        const evaluated = StuntingRekapEngine.evaluateZScores(w, h, age, isBoy);
        bbuCat = evaluated.bbu;
        tbuCat = evaluated.tbu;
        bbtbCat = evaluated.bbtb;
      }

      // 1. BB/U increments
      switch (bbuCat) {
        case 'Sangat Kurang':
          data.sangatKurangBbu++;
          break;
        case 'Kurang':
          data.kurangBbu++;
          break;
        case 'Risiko Lebih':
          data.risikoLebihBbu++;
          break;
        case 'Outlier':
          data.outlierBbu++;
          break;
        case 'Berat Badan Normal':
        default:
          data.normalBbu++;
          break;
      }

      // 2. TB/U increments
      switch (tbuCat) {
        case 'Sangat Pendek':
          data.sangatPendekTbu++;
          break;
        case 'Pendek':
          data.pendekTbu++;
          break;
        case 'Tinggi':
          data.tinggiTbu++;
          break;
        case 'Outlier':
          data.outlierTbu++;
          break;
        case 'Normal':
        default:
          data.normalTbu++;
          break;
      }

      // 3. BB/TB increments
      switch (bbtbCat) {
        case 'Gizi Buruk':
          data.giziBurukBbtb++;
          break;
        case 'Gizi Kurang':
          data.giziKurangBbtb++;
          break;
        case 'Risiko Gizi Lebih':
          data.risikoGiziLebihBbtb++;
          break;
        case 'Gizi Lebih':
          data.giziLebihBbtb++;
          break;
        case 'Obesitas':
          data.obesitasBbtb++;
          break;
        case 'Outlier':
          data.outlierBbtb++;
          break;
        case 'Normal':
        default:
          data.normalBbtb++;
          break;
      }
    }

    // Sort regions alphabetically (or preserve provincial sequence if Jateng list)
    const sortedRegions = Array.from(groupMap.keys()).sort((a, b) => a.localeCompare(b));

    const sasaranSource = options.customSasaranMap || JATENG_SASARAN_MAP;

    const rows: RekapRowData[] = [];
    let totD = 0;
    let totSkBbu = 0;
    let totKBbu = 0;
    let totNormBbu = 0;
    let totRikBbu = 0;
    let totOutBbu = 0;

    let totSpTbu = 0;
    let totPTbu = 0;
    let totNormTbu = 0;
    let totTTbu = 0;
    let totOutTbu = 0;

    let totGbBbtb = 0;
    let totGkBbtb = 0;
    let totNormBbtb = 0;
    let totRgBbtb = 0;
    let totGlBbtb = 0;
    let totObBbtb = 0;
    let totOutBbtb = 0;

    let totStunting = 0;
    let totWasting = 0;
    let totUnderweight = 0;
    let totOverweight = 0;
    let totGiziBuruk = 0;
    let totSasaran = 0;

    sortedRegions.forEach((wilayah, index) => {
      const d = groupMap.get(wilayah)!;

      // In authentic Dinkes table:
      // Jumlah Balita Ditimbang dan Diukur = sum of BB/TB categories (col M to col S)
      const measuredTotal =
        d.giziBurukBbtb +
        d.giziKurangBbtb +
        d.normalBbtb +
        d.risikoGiziLebihBbtb +
        d.giziLebihBbtb +
        d.obesitasBbtb +
        d.outlierBbtb;

      const stuntingCount = d.sangatPendekTbu + d.pendekTbu;
      const stuntingPct = measuredTotal > 0 ? (stuntingCount / measuredTotal) * 100 : 0;

      const wastingCount = d.giziBurukBbtb + d.giziKurangBbtb;
      const wastingPct = measuredTotal > 0 ? (wastingCount / measuredTotal) * 100 : 0;

      const underweightCount = d.sangatKurangBbu + d.kurangBbu;
      const underweightPct = measuredTotal > 0 ? (underweightCount / measuredTotal) * 100 : 0;

      const giziBurukCount = d.giziBurukBbtb;
      const giziBurukPct = measuredTotal > 0 ? (giziBurukCount / measuredTotal) * 100 : 0;

      const overweightCount = d.giziLebihBbtb + d.obesitasBbtb;
      const overweightPct = measuredTotal > 0 ? (overweightCount / measuredTotal) * 100 : 0;

      // Sasaran resolution: fallback to authentic map or default measuredTotal
      const upperWil = wilayah.toUpperCase();
      const sasaran = sasaranSource[upperWil] || sasaranSource[wilayah] || measuredTotal;
      const persenDS = sasaran > 0 ? (measuredTotal / sasaran) * 100 : 0;

      // Accumulate totals
      totD += measuredTotal;
      totSkBbu += d.sangatKurangBbu;
      totKBbu += d.kurangBbu;
      totNormBbu += d.normalBbu;
      totRikBbu += d.risikoLebihBbu;
      totOutBbu += d.outlierBbu;

      totSpTbu += d.sangatPendekTbu;
      totPTbu += d.pendekTbu;
      totNormTbu += d.normalTbu;
      totTTbu += d.tinggiTbu;
      totOutTbu += d.outlierTbu;

      totGbBbtb += d.giziBurukBbtb;
      totGkBbtb += d.giziKurangBbtb;
      totNormBbtb += d.normalBbtb;
      totRgBbtb += d.risikoGiziLebihBbtb;
      totGlBbtb += d.giziLebihBbtb;
      totObBbtb += d.obesitasBbtb;
      totOutBbtb += d.outlierBbtb;

      totStunting += stuntingCount;
      totWasting += wastingCount;
      totUnderweight += underweightCount;
      totOverweight += overweightCount;
      totGiziBuruk += giziBurukCount;
      totSasaran += sasaran;

      rows.push({
        no: index + 1,
        wilayah,
        sangatKurangBbu: d.sangatKurangBbu,
        kurangBbu: d.kurangBbu,
        normalBbu: d.normalBbu,
        risikoLebihBbu: d.risikoLebihBbu,
        outlierBbu: d.outlierBbu,

        sangatPendekTbu: d.sangatPendekTbu,
        pendekTbu: d.pendekTbu,
        normalTbu: d.normalTbu,
        tinggiTbu: d.tinggiTbu,
        outlierTbu: d.outlierTbu,

        giziBurukBbtb: d.giziBurukBbtb,
        giziKurangBbtb: d.giziKurangBbtb,
        normalBbtb: d.normalBbtb,
        risikoGiziLebihBbtb: d.risikoGiziLebihBbtb,
        giziLebihBbtb: d.giziLebihBbtb,
        obesitasBbtb: d.obesitasBbtb,
        outlierBbtb: d.outlierBbtb,

        jumlahDitimbangDiukur: measuredTotal,
        stuntingCount,
        stuntingPercent: Number(stuntingPct.toFixed(2)),
        wastingCount,
        wastingPercent: Number(wastingPct.toFixed(2)),
        underweightCount,
        underweightPercent: Number(underweightPct.toFixed(2)),
        giziBurukCount,
        giziBurukPercent: Number(giziBurukPct.toFixed(2)),
        overweightCount,
        overweightPercent: Number(overweightPct.toFixed(2)),
        sasaranAnak: sasaran,
        persenDS: Number(persenDS.toFixed(2)),
      });
    });

    const totals: RekapTotalData = {
      label: 'JUMLAH',
      sangatKurangBbu: totSkBbu,
      kurangBbu: totKBbu,
      normalBbu: totNormBbu,
      risikoLebihBbu: totRikBbu,
      outlierBbu: totOutBbu,

      sangatPendekTbu: totSpTbu,
      pendekTbu: totPTbu,
      normalTbu: totNormTbu,
      tinggiTbu: totTTbu,
      outlierTbu: totOutTbu,

      giziBurukBbtb: totGbBbtb,
      giziKurangBbtb: totGkBbtb,
      normalBbtb: totNormBbtb,
      risikoGiziLebihBbtb: totRgBbtb,
      giziLebihBbtb: totGlBbtb,
      obesitasBbtb: totObBbtb,
      outlierBbtb: totOutBbtb,

      jumlahDitimbangDiukur: totD,
      stuntingCount: totStunting,
      stuntingPercent: totD > 0 ? Number(((totStunting / totD) * 100).toFixed(2)) : 0,
      wastingCount: totWasting,
      wastingPercent: totD > 0 ? Number(((totWasting / totD) * 100).toFixed(2)) : 0,
      underweightCount: totUnderweight,
      underweightPercent: totD > 0 ? Number(((totUnderweight / totD) * 100).toFixed(2)) : 0,
      giziBurukCount: totGiziBuruk,
      giziBurukPercent: totD > 0 ? Number(((totGiziBuruk / totD) * 100).toFixed(2)) : 0,
      overweightCount: totOverweight,
      overweightPercent: totD > 0 ? Number(((totOverweight / totD) * 100).toFixed(2)) : 0,
      sasaranAnak: totSasaran,
      persenDS: totSasaran > 0 ? Number(((totD / totSasaran) * 100).toFixed(2)) : 0,
    };

    const totalOutlier = totOutBbu + totOutTbu + totOutBbtb;

    return {
      cutoffDate,
      groupingKey: groupingLevel,
      rows,
      totals,
      summary: {
        totalAnak: totD,
        totalStunting: totStunting,
        persenStunting: totals.stuntingPercent,
        totalWasting: totWasting,
        persenWasting: totals.wastingPercent,
        totalUnderweight: totUnderweight,
        persenUnderweight: totals.underweightPercent,
        totalOverweight: totOverweight,
        persenOverweight: totals.overweightPercent,
        totalGiziBuruk: totGiziBuruk,
        persenGiziBuruk: totals.giziBurukPercent,
        totalOutlier,
        persenOutlier: totD > 0 ? Number(((totalOutlier / totD) * 100).toFixed(2)) : 0,
        totalSasaran: totSasaran,
        persenDS: totals.persenDS,
      },
    };
  }

  /**
   * Generates a styled Excel workbook replicating REKAP STATUS GIZI 2025 FINAL CUTOFF 02022026.xlsx
   */
  public static generateExcelWorkbook(result: RekapResult, sheetName = 'Application List'): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();

    // Prepare Array-of-Arrays (AOA)
    const aoa: (string | number | null)[][] = [];

    // Row 0: Cutoff Title
    aoa.push([`Data Tanggal : ${result.cutoffDate}`]);

    // Row 1: Primary Category Header
    aoa.push([
      'No',
      'Kabupaten/Kota',
      'BB/U',
      null,
      null,
      null,
      null,
      'TB/U',
      null,
      null,
      null,
      null,
      'BB/TB',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);

    // Row 2: Sub-headers
    aoa.push([
      null,
      null,
      'Sangat Kurang',
      'Kurang',
      'Berat Badan Normal',
      'Risiko Lebih',
      'Outlier',
      'Sangat Pendek',
      'Pendek',
      'Normal',
      'Tinggi',
      'Outlier',
      'Gizi Buruk',
      'Gizi Kurang',
      'Normal',
      'Risiko Gizi Lebih',
      'Gizi Lebih',
      'Obesitas',
      'Outlier',
      'Jumlah Balita Ditimbang dan Diukur',
      'Stunting',
      '%',
      'Wasting',
      '%',
      'Underweight',
      '%',
      'Gizi Buruk',
      '%',
      'Overweight',
      '%',
      'Sasaran Anak',
      '% D/S',
    ]);

    // Data rows
    result.rows.forEach((r, idx) => {
      aoa.push([
        `${idx + 1}.`,
        r.wilayah,
        r.sangatKurangBbu,
        r.kurangBbu,
        r.normalBbu,
        r.risikoLebihBbu,
        r.outlierBbu,

        r.sangatPendekTbu,
        r.pendekTbu,
        r.normalTbu,
        r.tinggiTbu,
        r.outlierTbu,

        r.giziBurukBbtb,
        r.giziKurangBbtb,
        r.normalBbtb,
        r.risikoGiziLebihBbtb,
        r.giziLebihBbtb,
        r.obesitasBbtb,
        r.outlierBbtb,

        r.jumlahDitimbangDiukur,
        r.stuntingCount,
        r.stuntingPercent,
        r.wastingCount,
        r.wastingPercent,
        r.underweightCount,
        r.underweightPercent,
        r.giziBurukCount,
        r.giziBurukPercent,
        r.overweightCount,
        r.overweightPercent,
        r.sasaranAnak,
        r.persenDS,
      ]);
    });

    // JUMLAH row
    const tot = result.totals;
    aoa.push([
      'JUMLAH',
      null,
      tot.sangatKurangBbu,
      tot.kurangBbu,
      tot.normalBbu,
      tot.risikoLebihBbu,
      tot.outlierBbu,

      tot.sangatPendekTbu,
      tot.pendekTbu,
      tot.normalTbu,
      tot.tinggiTbu,
      tot.outlierTbu,

      tot.giziBurukBbtb,
      tot.giziKurangBbtb,
      tot.normalBbtb,
      tot.risikoGiziLebihBbtb,
      tot.giziLebihBbtb,
      tot.obesitasBbtb,
      tot.outlierBbtb,

      tot.jumlahDitimbangDiukur,
      tot.stuntingCount,
      tot.stuntingPercent,
      tot.wastingCount,
      tot.wastingPercent,
      tot.underweightCount,
      tot.underweightPercent,
      tot.giziBurukCount,
      tot.giziBurukPercent,
      tot.overweightCount,
      tot.overweightPercent,
      tot.sasaranAnak,
      tot.persenDS,
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Apply exact merges matching original format
    const totalRowIndex = aoa.length - 1;
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 31 } }, // Cutoff header across all cols
      { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },  // No
      { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },  // Kabupaten/Kota
      { s: { r: 1, c: 2 }, e: { r: 1, c: 6 } },  // BB/U
      { s: { r: 1, c: 7 }, e: { r: 1, c: 11 } }, // TB/U
      { s: { r: 1, c: 12 }, e: { r: 1, c: 18 } },// BB/TB
      { s: { r: totalRowIndex, c: 0 }, e: { r: totalRowIndex, c: 1 } }, // JUMLAH label
    ];

    // Column widths
    ws['!cols'] = [
      { wch: 6 },  // A: No
      { wch: 28 }, // B: Kabupaten/Kota
      { wch: 14 }, // C: Sangat Kurang
      { wch: 11 }, // D: Kurang
      { wch: 18 }, // E: BB Normal
      { wch: 14 }, // F: Risiko Lebih
      { wch: 10 }, // G: Outlier
      { wch: 14 }, // H: Sangat Pendek
      { wch: 11 }, // I: Pendek
      { wch: 12 }, // J: Normal
      { wch: 10 }, // K: Tinggi
      { wch: 10 }, // L: Outlier
      { wch: 12 }, // M: Gizi Buruk
      { wch: 13 }, // N: Gizi Kurang
      { wch: 12 }, // O: Normal
      { wch: 16 }, // P: Risiko Gizi Lebih
      { wch: 12 }, // Q: Gizi Lebih
      { wch: 11 }, // R: Obesitas
      { wch: 10 }, // S: Outlier
      { wch: 20 }, // T: Jumlah Balita Ditimbang
      { wch: 11 }, // U: Stunting
      { wch: 8 },  // V: % Stunting
      { wch: 11 }, // W: Wasting
      { wch: 8 },  // X: % Wasting
      { wch: 14 }, // Y: Underweight
      { wch: 8 },  // Z: % Underweight
      { wch: 12 }, // AA: Gizi Buruk
      { wch: 8 },  // AB: % Gizi Buruk
      { wch: 13 }, // AC: Overweight
      { wch: 8 },  // AD: % Overweight
      { wch: 14 }, // AE: Sasaran Anak
      { wch: 9 },  // AF: % D/S
    ];

    // Styling
    const headerBlueStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 9.5, name: 'Calibri' },
      fill: { fgColor: { rgb: '1E3A8A' } }, // Navy
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: 'CBD5E1' } },
        bottom: { style: 'medium', color: { rgb: '0F172A' } },
        left: { style: 'thin', color: { rgb: 'CBD5E1' } },
        right: { style: 'thin', color: { rgb: 'CBD5E1' } },
      },
    };

    const headerTealStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 9.5, name: 'Calibri' },
      fill: { fgColor: { rgb: '0F766E' } }, // Teal for indicators
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: 'CBD5E1' } },
        bottom: { style: 'medium', color: { rgb: '0F172A' } },
        left: { style: 'thin', color: { rgb: 'CBD5E1' } },
        right: { style: 'thin', color: { rgb: 'CBD5E1' } },
      },
    };

    const totalStyle = {
      font: { bold: true, color: { rgb: '0F172A' }, sz: 10, name: 'Calibri' },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: {
        top: { style: 'medium', color: { rgb: '0F172A' } },
        bottom: { style: 'double', color: { rgb: '0F172A' } },
        left: { style: 'thin', color: { rgb: '94A3B8' } },
        right: { style: 'thin', color: { rgb: '94A3B8' } },
      },
    };

    // Apply header styles to Row 1 and Row 2
    for (let c = 0; c <= 31; c++) {
      const cell1 = ws[XLSX.utils.encode_cell({ r: 1, c })];
      const cell2 = ws[XLSX.utils.encode_cell({ r: 2, c })];
      const style = c >= 19 ? headerTealStyle : headerBlueStyle;
      if (cell1) cell1.s = style;
      if (cell2) cell2.s = style;
    }

    // Apply cell styles to Data Rows
    for (let r = 3; r < totalRowIndex; r++) {
      const isEven = r % 2 === 0;
      for (let c = 0; c <= 31; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (!cell) continue;

        const cellStyle: Record<string, unknown> = {
          font: { sz: 9, name: 'Calibri' },
          fill: isEven ? { fgColor: { rgb: 'F8FAFC' } } : { fgColor: { rgb: 'FFFFFF' } },
          border: {
            top: { style: 'thin', color: { rgb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
            left: { style: 'thin', color: { rgb: 'E2E8F0' } },
            right: { style: 'thin', color: { rgb: 'E2E8F0' } },
          },
          alignment: c === 1 ? { horizontal: 'left' } : c === 0 ? { horizontal: 'center' } : { horizontal: 'right' },
        };

        // Number format for percentages
        if ([21, 23, 25, 27, 29, 31].includes(c)) {
          cell.z = '0.00';
        }

        cell.s = cellStyle;
      }
    }

    // Apply Total Row Style
    for (let c = 0; c <= 31; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: totalRowIndex, c })];
      if (cell) {
        cell.s = totalStyle;
        if (c === 0 || c === 1) {
          cell.s = { ...totalStyle, alignment: { horizontal: 'center', vertical: 'center' } };
        }
        if ([21, 23, 25, 27, 29, 31].includes(c)) {
          cell.z = '0.00';
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return wb;
  }
}
