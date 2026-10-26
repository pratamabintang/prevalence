import { IndicatorEvaluator } from '../evaluation/indicator-evaluator';

export type StuntingLifecycleCategory =
  | 'sebelum_kelahiran' // Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)
  | 'setelah_kelahiran' // Intervensi untuk balita (setelah kelahiran)
  | 'lainnya'; // Intervensi lainnya

export type StuntingPerformanceStatus =
  | 'on_track' // On Track
  | 'perlu_percepatan' // Perlu Percepatan
  | 'belum_dinilai'; // Belum Dapat Dinilai

export type StuntingAnalysisPattern =
  | 'meningkat_on_track' // A. Meningkat dan On Track
  | 'meningkat_belum_on_track' // B. Meningkat tetapi Belum On Track
  | 'menurun_on_track' // C. Menurun tetapi Masih On Track
  | 'menurun_perlu_percepatan' // D. Menurun dan Perlu Percepatan
  | 'target_tercapai' // E. Target Sudah Tercapai
  | 'belum_dapat_dinilai';

export type IndicatorPolarity = 'positive' | 'negative';

export interface StuntingIndicatorInput {
  id?: string;
  category?: string;
  no?: number | string;
  name: string;
  polarity?: IndicatorPolarity; // default: 'positive'
  targetPrevYear?: number | string | null;
  actualPrevYear?: number | string | null;
  targetCurrentYear?: number | string | null;
  tw1Actual?: number | string | null;
  tw1Target?: number | string | null;
  tw2Actual?: number | string | null;
  tw2Target?: number | string | null;
  tw3Actual?: number | string | null;
  tw3Target?: number | string | null;
  tw4Actual?: number | string | null;
  tw4Target?: number | string | null;
  rawRowData?: Record<string, unknown>;
}

export interface EvaluatedQuarterData {
  quarter: 1 | 2 | 3 | 4;
  expectedAchievement: number | null;
  actualAchievement: number | null;
  gap: number | null;
  numeratorCol?: string;
  sumCol?: string;
  meanCol?: string;
  sumNumerator?: number | null;
  sumDenominator?: number | null;
  hasData?: boolean;
}

export interface EvaluatedStuntingRow {
  id: string;
  category: string;
  canonicalCategory: StuntingLifecycleCategory;
  no: number | string;
  name: string;
  polarity: IndicatorPolarity;
  targetPrevYear: number | null;
  actualPrevYear: number | null;
  targetCurrentYear: number | null;
  quarters: {
    1: EvaluatedQuarterData;
    2: EvaluatedQuarterData;
    3: EvaluatedQuarterData;
    4: EvaluatedQuarterData;
  };
  activeQuarter: 1 | 2 | 3 | 4;
  activeExpected: number | null;
  activeActual: number | null;
  activeGap: number | null;
  yoyChange: number | null;
  status: StuntingPerformanceStatus;
  statusReason: string;
  pattern: StuntingAnalysisPattern;
  isTargetReached: boolean;
  isImproved: boolean;
  isDeclined: boolean;
  needsValidation: boolean;
  sumCol?: string;
  meanCol?: string;
  targetCol?: string;
  numeratorCol?: string;
  denominatorCol?: string;
  sumNumerator?: number | null;
  sumDenominator?: number | null;
  calculationMode?: 'percentage' | 'absolute';
}

export interface StuntingQuarterInputConfig {
  numeratorCol?: string;
  denominatorCol?: string;
  sumCol?: string;
  meanCol?: string;
  actualValue?: number | null;
  countValue?: number | null;
}

export interface StuntingSubCategoryConfig {
  id: string;
  no?: string | number;
  name?: string;
  sumCol?: string; // Kolom Jumlah / SUM (e.g. 'Rematri  Konsumsi TTD')
  meanCol?: string; // Kolom Capaian / MEAN (%) (e.g. '% Konsumsi TTD')
  targetCol?: string; // Kolom acuan target jika diambil dari kolom data
  numeratorCol: string; // Kolom Data (Realisasi/Capaian yang sudah ada / fallback meanCol)
  denominatorCol?: string; // Opsional / tidak wajib (tidak ada input kolom sasaran)
  dataCol?: string; // Alias untuk numeratorCol
  actualValue?: number | null; // Nilai capaian langsung dari data yang sudah ada
  countValue?: number | null; // Jumlah absolut sasaran/cakupan jika tersedia
  quarterColumns?: {
    1?: StuntingQuarterInputConfig;
    2?: StuntingQuarterInputConfig;
    3?: StuntingQuarterInputConfig;
    4?: StuntingQuarterInputConfig;
  };
  calculationMode?: 'percentage' | 'absolute';
  targetCurrentYear: number | string | null;
  prevYearMode?: 'columns' | 'manual';
  prevNumeratorCol?: string;
  prevDenominatorCol?: string;
  actualPrevYear?: number | string | null;
  targetPrevYear?: number | string | null;
  polarity?: IndicatorPolarity;
}

export interface StuntingCategoryConfig {
  id: string;
  name: string;
  subCategories: StuntingSubCategoryConfig[];
}

export interface AggregatedEvaluationOptions {
  activeQuarter?: 1 | 2 | 3 | 4;
  quarterWeight?: number;
  toleranceThresholdPercent?: number;
  calculationDataSource?: 'summary_row' | 'all_rows' | 'aggregated_rows';
}

export interface RegionalEvaluationOptions extends AggregatedEvaluationOptions {
  sortBy?: 'need_acceleration' | 'on_track' | 'name' | 'percentage';
  sortDirection?: 'asc' | 'desc';
  sortIndicatorId?: string;
}

export interface EvaluatedRegionalScorecard {
  regionId: string;
  regionName: string;
  summary: StuntingKpiSummary;
  rows: EvaluatedStuntingRow[];
  activeQuarter: 1 | 2 | 3 | 4;
}

export interface StuntingEvaluationOptions {
  activeQuarter: 1 | 2 | 3 | 4;
  toleranceThresholdPercent?: number; // default -5.0%
  quarterWeights?: {
    tw1: number;
    tw2: number;
    tw3: number;
    tw4: number;
  };
}

export interface StuntingKpiSummary {
  totalIndicators: number;
  onTrackCount: number;
  perluPerhatianCount: number;
  perluPercepatanCount: number;
  belumDinilaiCount: number;
  targetReachedCount: number;
  improvedCount: number;
  declinedCount: number;
  patternCounts: {
    meningkat_on_track: number;
    meningkat_belum_on_track: number;
    menurun_on_track: number;
    menurun_perlu_percepatan: number;
    target_tercapai: number;
  };
}

export interface StuntingEvaluationResult {
  rows: EvaluatedStuntingRow[];
  groupedRows: {
    categoryName: string;
    canonicalCategory: StuntingLifecycleCategory;
    rows: EvaluatedStuntingRow[];
  }[];
  summary: StuntingKpiSummary;
  accelerationList: EvaluatedStuntingRow[];
  topPerformanceList: EvaluatedStuntingRow[];
  activeQuarter: 1 | 2 | 3 | 4;
  availableQuarters: (1 | 2 | 3 | 4)[];
}

/**
 * StuntingEvaluationEngine: Engine komputasi murni untuk pemantauan intervensi stunting
 * dan analisis kinerja multi-periode Dinas Kesehatan.
 */
export class StuntingEvaluationEngine {
  private static readonly DEFAULT_TOLERANCE = -5.0; // Deviasi batas toleransi selisih capaian
  private static readonly DEFAULT_WEIGHTS = {
    1: 1.0,
    2: 1.0,
    3: 1.0,
    4: 1.0,
  };

  /**
   * Menghitung capaian yang diharapkan (Expected Achievement) per triwulan.
   * Mengutamakan target khusus triwulan jika ada; jika tidak, selalu menggunakan target 100%.
   */
  static calculateExpectedAchievement(
    annualTarget: number | null,
    quarter: 1 | 2 | 3 | 4,
    specificQuarterTarget?: number | null,
    quarterWeight?: number,
  ): number | null {
    if (specificQuarterTarget !== null && specificQuarterTarget !== undefined) {
      return specificQuarterTarget;
    }
    if (annualTarget === null || annualTarget === undefined) {
      return null;
    }
    const weight = quarterWeight ?? this.DEFAULT_WEIGHTS[quarter];
    return Math.round(annualTarget * weight * 100) / 100;
  }

  /**
   * Menghitung kesenjangan (Gap) antara capaian aktual dan capaian yang diharapkan.
   * Memperhitungkan polaritas indikator (makin tinggi makin baik vs makin rendah makin baik).
   */
  static calculateGap(
    actual: number | null,
    expected: number | null,
    polarity: IndicatorPolarity = 'positive',
  ): number | null {
    if (actual === null || expected === null) {
      return null;
    }
    const rawGap = polarity === 'negative' ? expected - actual : actual - expected;
    return Math.round(rawGap * 100) / 100;
  }

  /**
   * Menghitung perubahan capaian terhadap tahun sebelumnya (YoY change).
   */
  static calculateYoYChange(
    currentActual: number | null,
    prevActual: number | null,
  ): number | null {
    if (currentActual === null || prevActual === null) {
      return null;
    }
    return Math.round((currentActual - prevActual) * 100) / 100;
  }

  /**
   * Menentukan status kinerja 4 tingkat berdasarkan gap, batas toleransi, dan tren tahun lalu.
   */
  static evaluateStatus(
    actual: number | null,
    expected: number | null,
    yoyChange: number | null,
    toleranceThreshold: number = this.DEFAULT_TOLERANCE,
    polarity: IndicatorPolarity = 'positive',
  ): { status: StuntingPerformanceStatus; reason: string } {
    if (actual === null || expected === null) {
      return {
        status: 'belum_dinilai',
        reason: 'Data capaian periode berjalan atau target belum tersedia',
      };
    }

    const gap = this.calculateGap(actual, expected, polarity);
    if (gap === null) {
      return { status: 'belum_dinilai', reason: 'Nilai gap tidak dapat dihitung' };
    }

    // 1. Capaian >= Expected -> On Track
    if (gap >= 0) {
      return {
        status: 'on_track',
        reason: `Capaian memenuhi target periode (Gap: ${gap > 0 ? '+' : ''}${gap})`,
      };
    }

    // 2. Capaian di bawah target -> Perlu Percepatan
    const reasonParts: string[] = [`Capaian di bawah target periode (Gap: ${gap})`];
    const isTrendingDown = yoyChange !== null && (polarity === 'negative' ? yoyChange > 0 : yoyChange < 0);
    if (isTrendingDown) {
      reasonParts.push(`tren capaian mengalami penurunan dibandingkan periode sebelumnya (${yoyChange})`);
    }

    return {
      status: 'perlu_percepatan',
      reason: reasonParts.join(' serta '),
    };
  }

  /**
   * Mengklasifikasikan ke dalam 5 kategori pola analisis kinerja (A s.d. E).
   */
  static classifyPattern(
    actual: number | null,
    annualTarget: number | null,
    prevActual: number | null,
    status: StuntingPerformanceStatus,
    polarity: IndicatorPolarity = 'positive',
  ): StuntingAnalysisPattern {
    if (actual === null) {
      return 'belum_dapat_dinilai';
    }

    // E. Target Sudah Tercapai
    if (annualTarget !== null) {
      const isTargetReached =
        polarity === 'negative' ? actual <= annualTarget : actual >= annualTarget;
      if (isTargetReached) {
        return 'target_tercapai';
      }
    }

    const yoy = this.calculateYoYChange(actual, prevActual);
    const isImproved = yoy !== null && (polarity === 'negative' ? yoy < 0 : yoy > 0);
    const isDeclined = yoy !== null && (polarity === 'negative' ? yoy > 0 : yoy < 0);

    if (isImproved && status === 'on_track') {
      return 'meningkat_on_track';
    }
    if (isImproved && status !== 'on_track') {
      return 'meningkat_belum_on_track';
    }
    if (isDeclined && status === 'on_track') {
      return 'menurun_on_track';
    }
    if (isDeclined && status === 'perlu_percepatan') {
      return 'menurun_perlu_percepatan';
    }

    return status === 'on_track' ? 'meningkat_on_track' : 'meningkat_belum_on_track';
  }

  /**
   * Normalisasi dan identifikasi kategori siklus hidup intervensi stunting.
   */
  static identifyCanonicalCategory(rawCategory: string): StuntingLifecycleCategory {
    if (!rawCategory) return 'lainnya';
    const lower = rawCategory.toLowerCase();

    if (
      lower.includes('remaja') ||
      lower.includes('ibu hamil') ||
      lower.includes('hamil') ||
      lower.includes('sebelum') ||
      lower.includes('kek') ||
      lower.includes('ttd') ||
      lower.includes('anemia')
    ) {
      return 'sebelum_kelahiran';
    }

    if (
      lower.includes('balita') ||
      lower.includes('baduta') ||
      lower.includes('anak') ||
      lower.includes('bayi') ||
      lower.includes('asi') ||
      lower.includes('setelah') ||
      lower.includes('gizi') ||
      lower.includes('wasting')
    ) {
      return 'setelah_kelahiran';
    }

    return 'lainnya';
  }

  /**
   * Format label kategori siklus hidup resmi nasional.
   */
  static getCategoryLabel(canonical: StuntingLifecycleCategory): string {
    switch (canonical) {
      case 'sebelum_kelahiran':
        return 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)';
      case 'setelah_kelahiran':
        return 'Intervensi untuk balita (setelah kelahiran)';
      case 'lainnya':
      default:
        return 'Intervensi lainnya';
    }
  }

  /**
   * Mengevaluasi seluruh dataset indikator stunting secara menyeluruh.
   */
  static evaluateDataset(
    inputs: StuntingIndicatorInput[],
    options: StuntingEvaluationOptions,
  ): StuntingEvaluationResult {
    const q = options.activeQuarter || 1;
    const tolerance = options.toleranceThresholdPercent ?? this.DEFAULT_TOLERANCE;

    const evaluatedRows: EvaluatedStuntingRow[] = inputs.map((input, idx) => {
      const polarity: IndicatorPolarity = input.polarity === 'negative' ? 'negative' : 'positive';
      const targetPrev = IndicatorEvaluator.parseSmartNumber(input.targetPrevYear);
      const actualPrev = IndicatorEvaluator.parseSmartNumber(input.actualPrevYear);
      const targetCurrent = IndicatorEvaluator.parseSmartNumber(input.targetCurrentYear);

      const quarterActuals: Record<1 | 2 | 3 | 4, number | null> = {
        1: IndicatorEvaluator.parseSmartNumber(input.tw1Actual),
        2: IndicatorEvaluator.parseSmartNumber(input.tw2Actual),
        3: IndicatorEvaluator.parseSmartNumber(input.tw3Actual),
        4: IndicatorEvaluator.parseSmartNumber(input.tw4Actual),
      };

      const quarterTargets: Record<1 | 2 | 3 | 4, number | null> = {
        1: IndicatorEvaluator.parseSmartNumber(input.tw1Target),
        2: IndicatorEvaluator.parseSmartNumber(input.tw2Target),
        3: IndicatorEvaluator.parseSmartNumber(input.tw3Target),
        4: IndicatorEvaluator.parseSmartNumber(input.tw4Target),
      };

      const quarters: Record<1 | 2 | 3 | 4, EvaluatedQuarterData> = {
        1: { quarter: 1, expectedAchievement: null, actualAchievement: quarterActuals[1], gap: null },
        2: { quarter: 2, expectedAchievement: null, actualAchievement: quarterActuals[2], gap: null },
        3: { quarter: 3, expectedAchievement: null, actualAchievement: quarterActuals[3], gap: null },
        4: { quarter: 4, expectedAchievement: null, actualAchievement: quarterActuals[4], gap: null },
      };

      for (const k of [1, 2, 3, 4] as const) {
        const weight = options.quarterWeights ? options.quarterWeights[`tw${k}` as keyof typeof options.quarterWeights] : undefined;
        const exp = this.calculateExpectedAchievement(targetCurrent, k, quarterTargets[k], weight);
        const act = quarterActuals[k];
        const gap = this.calculateGap(act, exp, polarity);
        quarters[k] = {
          quarter: k,
          expectedAchievement: exp,
          actualAchievement: act,
          gap,
          sumNumerator: act,
          sumDenominator: null,
          hasData: act !== null,
        };
      }

      const activeExpected = quarters[q].expectedAchievement;
      const activeActual = quarters[q].actualAchievement;
      const activeGap = quarters[q].gap;
      const yoyChange = this.calculateYoYChange(activeActual, actualPrev);

      const { status, reason: statusReason } = this.evaluateStatus(
        activeActual,
        activeExpected,
        yoyChange,
        tolerance,
        polarity,
      );

      const pattern = this.classifyPattern(activeActual, targetCurrent, actualPrev, status, polarity);

      const isTargetReached =
        targetCurrent !== null &&
        activeActual !== null &&
        (polarity === 'negative' ? activeActual <= targetCurrent : activeActual >= targetCurrent);

      const isImproved = yoyChange !== null && (polarity === 'negative' ? yoyChange < 0 : yoyChange > 0);
      const isDeclined = yoyChange !== null && (polarity === 'negative' ? yoyChange > 0 : yoyChange < 0);

      const canonical = this.identifyCanonicalCategory(input.category || '');
      const categoryLabel = input.category || this.getCategoryLabel(canonical);

      return {
        id: input.id || `stunting-ind-${idx + 1}`,
        category: categoryLabel,
        canonicalCategory: canonical,
        no: input.no || idx + 1,
        name: input.name,
        polarity,
        targetPrevYear: targetPrev,
        actualPrevYear: actualPrev,
        targetCurrentYear: targetCurrent,
        quarters,
        activeQuarter: q,
        activeExpected,
        activeActual,
        activeGap,
        yoyChange,
        status,
        statusReason,
        pattern,
        isTargetReached,
        isImproved,
        isDeclined,
        needsValidation: status === 'belum_dinilai' || targetCurrent === null,
      };
    });

    return this.compileEvaluationResult(evaluatedRows, q);
  }

  /**
   * Menjumlahkan nilai kolom numerik pada sekumpulan baris yang telah di-join.
   */
  static sumColumnValues(
    rows: Record<string, unknown>[],
    columnName: string | undefined | null,
  ): number | null {
    if (!columnName || rows.length === 0) return null;
    let sum = 0;
    let hasValidNum = false;
    for (const r of rows) {
      const val = r[columnName];
      const parsed = IndicatorEvaluator.parseSmartNumber(val);
      if (parsed !== null && !isNaN(parsed)) {
        sum += parsed;
        hasValidNum = true;
      }
    }
    return hasValidNum ? Math.round(sum * 100) / 100 : null;
  }

  /**
   * Menghitung nilai rata-rata (mean) kolom numerik pada sekumpulan baris yang telah di-join.
   */
  static averageColumnValues(
    rows: Record<string, unknown>[],
    columnName: string | undefined | null,
  ): number | null {
    if (!columnName || rows.length === 0) return null;
    let sum = 0;
    let count = 0;
    for (const r of rows) {
      const val = r[columnName];
      const parsed = IndicatorEvaluator.parseSmartNumber(val);
      if (parsed !== null && !isNaN(parsed)) {
        sum += parsed;
        count++;
      }
    }
    return count > 0 ? Math.round((sum / count) * 100) / 100 : null;
  }

  /**
   * Daftar 15 Indikator Intervensi Spesifik Standar Dinkes Jawa Tengah
   * sesuai lembar kerja 'capaian intervensi spesifik' (TW1 - TW4).
   */
  static readonly DINKES_STANDARD_INDICATORS = [
    {
      no: '1',
      name: 'Remaja putri mendapat skrining anemia',
      category: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
      canonicalCategory: 'sebelum_kelahiran' as StuntingLifecycleCategory,
      sumKeywords: ['rematri skrining anemia', 'skrining anemia', 'rematri anemia'],
      meanKeywords: ['% skrining anemia', '% rematri anemia', '% anemia'],
      defaultTargetCurrent: 77,
      defaultTargetPrev: 75,
      defaultActualPrev: 90.58,
      polarity: 'positive' as IndicatorPolarity,
    },
    {
      no: '2',
      name: 'Remaja putri mengonsumsi TTD (tablet tambah darah)',
      category: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
      canonicalCategory: 'sebelum_kelahiran' as StuntingLifecycleCategory,
      sumKeywords: ['rematri  konsumsi ttd', 'rematri konsumsi ttd', 'konsumsi ttd', 'rematri ttd'],
      meanKeywords: ['% konsumsi ttd', '% rematri ttd', '% ttd'],
      defaultTargetCurrent: 67,
      defaultTargetPrev: 65,
      defaultActualPrev: 89.34,
      polarity: 'positive' as IndicatorPolarity,
    },
    {
      no: '3',
      name: 'Ibu hamil ANC minimal 6x*',
      category: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
      canonicalCategory: 'sebelum_kelahiran' as StuntingLifecycleCategory,
      sumKeywords: ['ibu hamil anc 6x', 'anc 6x', 'bumil anc 6x'],
      meanKeywords: ['% anc 6x', '% anc'],
      defaultTargetCurrent: 60,
      defaultTargetPrev: 80,
      defaultActualPrev: 91.46,
      polarity: 'positive' as IndicatorPolarity,
    },
    {
      no: '4',
      name: 'Ibu hamil mengonsumsi suplementasi gizi (TTD/MMS) minimal 180 tablet selama kehamilan**',
      category: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
      canonicalCategory: 'sebelum_kelahiran' as StuntingLifecycleCategory,
      sumKeywords: ['ibu hamil konsumsi ttd/mms', 'ibu hamil konsumsi ttd', 'bumil ttd/mms', 'bumil konsumsi ttd'],
      meanKeywords: ['% ttd/mms', '% bumil ttd', '% ttd bumil'],
      defaultTargetCurrent: 39,
      defaultTargetPrev: 48,
      defaultActualPrev: 91.1,
      polarity: 'positive' as IndicatorPolarity,
    },
    {
      no: '5',
      name: 'Ibu hamil KEK mendapat tambahan asupan gizi',
      category: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
      canonicalCategory: 'sebelum_kelahiran' as StuntingLifecycleCategory,
      sumKeywords: ['ibu hamil kek konsumsi mt', 'kek konsumsi mt', 'bumil kek mt', 'kek mt', 'bumil pmt'],
      meanKeywords: ['% bumil pmt', '% pmt bumil', '% kek mt', '% bumil kek'],
      defaultTargetCurrent: 85,
      defaultTargetPrev: 84,
      defaultActualPrev: 71.72,
      polarity: 'positive' as IndicatorPolarity,
    },
    {
      no: '6a',
      name: 'Pemantauan pertumbuhan balita',
      category: 'Intervensi untuk balita (setelah kelahiran)',
      canonicalCategory: 'setelah_kelahiran' as StuntingLifecycleCategory,
      sumKeywords: ['balita dipantau pertumbuhan (d/s)', 'pertumbuhan (d/s)', 'balita d/s', 'd/s'],
      meanKeywords: ['% d/s', '% pertumbuhan'],
      defaultTargetCurrent: 90,
      defaultTargetPrev: 80,
      defaultActualPrev: 94.38,
      polarity: 'positive' as IndicatorPolarity,
    },
    {
      no: '6b',
      name: 'Pemantauan pertumbuhan dan perkembangan balita',
      category: 'Intervensi untuk balita (setelah kelahiran)',
      canonicalCategory: 'setelah_kelahiran' as StuntingLifecycleCategory,
      sumKeywords: ['jumlah balita dipantau tumbang', 'balita dipantau tumbang', 'dipantau tumbang', 'tumbang'],
      meanKeywords: ['% tumbang', '% perkembangan'],
      defaultTargetCurrent: 55,
      defaultTargetPrev: 50,
      defaultActualPrev: 88.51,
      polarity: 'positive' as IndicatorPolarity,
    },
    {
      no: '7',
      name: 'Bayi usia kurang dari 6 bulan mendapat ASI eksklusif',
      category: 'Intervensi untuk balita (setelah kelahiran)',
      canonicalCategory: 'setelah_kelahiran' as StuntingLifecycleCategory,
      sumKeywords: ['asi eksklusif', 'bayi asi eksklusif', 'asi'],
      meanKeywords: ['% asi', '% asi eksklusif'],
      defaultTargetCurrent: 76,
      defaultTargetPrev: 73,
      defaultActualPrev: 90.24,
      polarity: 'positive' as IndicatorPolarity,
    },
    {
      no: '8',
      name: 'Anak 6-23 bulan mendapat MP-ASI',
      category: 'Intervensi untuk balita (setelah kelahiran)',
      canonicalCategory: 'setelah_kelahiran' as StuntingLifecycleCategory,
      sumKeywords: ['mpasi', 'mp-asi', 'anak mpasi'],
      meanKeywords: ['% mpasi', '% mp-asi'],
      defaultTargetCurrent: 76,
      defaultTargetPrev: 73,
      defaultActualPrev: 93.66,
      polarity: 'positive' as IndicatorPolarity,
    },
    {
      no: '9a',
      name: 'Balita berat badan tidak naik (T) mendapat tambahan asupan gizi',
      category: 'Intervensi untuk balita (setelah kelahiran)',
      canonicalCategory: 'setelah_kelahiran' as StuntingLifecycleCategory,
      sumKeywords: ['jumlah bb tidak naik (t) dapat mt', 'bb tidak naik (t) dapat mt', 'bb tidak naik (t)', 'tidak naik (t)'],
      meanKeywords: ['% bb tidak naik (t) dapat mt', '% bb tidak naik', '% tidak naik (t)'],
      defaultTargetCurrent: 70,
      defaultTargetPrev: 65,
      defaultActualPrev: 23.4,
      polarity: 'positive' as IndicatorPolarity,
    },
    {
      no: '9b',
      name: 'Balita berat badan kurang mendapat tambahan asupan gizi',
      category: 'Intervensi untuk balita (setelah kelahiran)',
      canonicalCategory: 'setelah_kelahiran' as StuntingLifecycleCategory,
      sumKeywords: ['jumlah bb kurang dapat mt', 'bb kurang dapat mt', 'bb kurang mt'],
      meanKeywords: ['% bb kurang dapat mt', '% bb kurang mt', '% bb kurang'],
      defaultTargetCurrent: 70,
      defaultTargetPrev: 65,
      defaultActualPrev: 55.6,
      polarity: 'positive' as IndicatorPolarity,
    },
    {
      no: '9c',
      name: 'Balita gizi kurang mendapat tambahan asupan gizi',
      category: 'Intervensi untuk balita (setelah kelahiran)',
      canonicalCategory: 'setelah_kelahiran' as StuntingLifecycleCategory,
      sumKeywords: ['jumlah  gizi kurang dapat mt', 'jumlah gizi kurang dapat mt', 'gizi kurang dapat mt', 'gizi kurang mt'],
      meanKeywords: ['% gizi kurang dapat mt', '% gizi kurang mt', '% gizi kurang'],
      defaultTargetCurrent: 70,
      defaultTargetPrev: 65,
      defaultActualPrev: 59.81,
      polarity: 'positive' as IndicatorPolarity,
    },
    {
      no: '9d',
      name: 'Balita gizi buruk mendapat pelayanan tata laksana gizi buruk ',
      category: 'Intervensi untuk balita (setelah kelahiran)',
      canonicalCategory: 'setelah_kelahiran' as StuntingLifecycleCategory,
      sumKeywords: ['jumlah kasus gizi buruk mendapat tata laksana', 'kasus gizi buruk mendapat tata laksana', 'talak gibur', 'tata laksana gizi buruk'],
      meanKeywords: ['% talak gibur', '% gizi buruk', '% talak'],
      defaultTargetCurrent: 92,
      defaultTargetPrev: 91,
      defaultActualPrev: 96.86,
      polarity: 'positive' as IndicatorPolarity,
    },
    {
      no: '10',
      name: 'Baduta memperoleh imunisasi lengkap',
      category: 'Intervensi untuk balita (setelah kelahiran)',
      canonicalCategory: 'setelah_kelahiran' as StuntingLifecycleCategory,
      sumKeywords: ['baduta idl', 'imunisasi lengkap', 'idl'],
      meanKeywords: ['% idl', '% imunisasi lengkap'],
      defaultTargetCurrent: 56.25,
      defaultTargetPrev: 97,
      defaultActualPrev: 99.46,
      polarity: 'positive' as IndicatorPolarity,
    },
    {
      no: '11',
      name: 'Kab/Kota yang telah terverifikasi 100% Kepala Keluarga stop Buang Air Besar Sembarangan (BABS)***',
      category: 'Intervensi lintas siklus hidup',
      canonicalCategory: 'lainnya' as StuntingLifecycleCategory,
      sumKeywords: ['babs', 'stop babs', 'desa babs'],
      meanKeywords: ['% babs', '% stop babs'],
      defaultTargetCurrent: '8653 desa',
      defaultTargetPrev: '8653 desa',
      defaultActualPrev: 100,
      polarity: 'positive' as IndicatorPolarity,
    },
  ];

  /**
   * Membersihkan nilai target dari string campuran huruf / format dokumen
   * (contoh: "tw3: 60", "≤23", "TW3: 56,25", "85%", "≤13", "8653 desa")
   * dan mendeteksi polaritas jika memuat simbol ≤ atau <.
   */
  static cleanTargetValue(rawTarget: unknown): { value: number | null; polarity: IndicatorPolarity } {
    if (rawTarget === null || rawTarget === undefined) {
      return { value: null, polarity: 'positive' };
    }

    if (typeof rawTarget === 'number') {
      return { value: isNaN(rawTarget) ? null : rawTarget, polarity: 'positive' };
    }

    const str = String(rawTarget).trim();
    if (str === '' || str === '-') {
      return { value: null, polarity: 'positive' };
    }

    // Deteksi polaritas negatif dari simbol
    const isNegative = str.includes('≤') || str.includes('<=') || str.includes('<');

    // Bersihkan awalan/akhiran teks
    let cleaned = str
      .replace(/(tw\s*[1-4]\s*:?)/gi, '')
      .replace(/[≤<>=]/g, '')
      .replace(/desa/gi, '')
      .replace(/%/g, '')
      .trim();

    const num = IndicatorEvaluator.parseSmartNumber(cleaned);
    return {
      value: num,
      polarity: isNegative ? 'negative' : 'positive',
    };
  }

  /**
   * Mengevaluasi dataset indikator teragregasi (Numerator / Denominator)
   * berdasarkan konfigurasi kategori dan sub-kategori dari baris hasil join multi-sheet.
   */
  static evaluateAggregatedDataset(
    categories: StuntingCategoryConfig[],
    joinedRows: Record<string, unknown>[],
    options: AggregatedEvaluationOptions,
  ): StuntingEvaluationResult {
    const q = options.activeQuarter || 1;
    const tolerance = options.toleranceThresholdPercent ?? this.DEFAULT_TOLERANCE;
    const weight = options.quarterWeight ?? this.DEFAULT_WEIGHTS[q];

    const evaluatedRows: EvaluatedStuntingRow[] = [];
    let itemNo = 1;

    for (const cat of categories) {
      const canonical = this.identifyCanonicalCategory(cat.name);

      for (const sub of cat.subCategories) {
        const polarity: IndicatorPolarity = sub.polarity === 'negative' ? 'negative' : 'positive';
        const calcMode = sub.calculationMode || 'percentage';
        const indicatorName = (sub.name || sub.meanCol || sub.numeratorCol || `Indikator ${itemNo}`).trim();

        // Targets
        const targetCurrent = IndicatorEvaluator.parseSmartNumber(sub.targetCurrentYear);
        const targetPrev = IndicatorEvaluator.parseSmartNumber(sub.targetPrevYear);

        // Previous Year Actual Calculation
        let actualPrev: number | null = null;
        if ((sub.prevYearMode === 'columns' || sub.prevNumeratorCol) && sub.prevNumeratorCol) {
          const prevSumNum = this.sumColumnValues(joinedRows, sub.prevNumeratorCol);
          const prevSumDen = sub.prevDenominatorCol ? this.sumColumnValues(joinedRows, sub.prevDenominatorCol) : null;
          if (prevSumNum !== null) {
            if (calcMode === 'absolute' || prevSumDen === null) {
              actualPrev = prevSumNum;
            } else if (prevSumDen > 0) {
              actualPrev = Math.round((prevSumNum / prevSumDen) * 10000) / 100;
            } else {
              actualPrev = null;
            }
          }
        } else if (sub.actualPrevYear !== null && sub.actualPrevYear !== undefined && String(sub.actualPrevYear).trim() !== '') {
          actualPrev = IndicatorEvaluator.parseSmartNumber(sub.actualPrevYear);
        }

        // Quarters structure
        const quarters: Record<1 | 2 | 3 | 4, EvaluatedQuarterData> = {
          1: { quarter: 1, expectedAchievement: null, actualAchievement: null, gap: null, sumNumerator: null, sumDenominator: null, hasData: false },
          2: { quarter: 2, expectedAchievement: null, actualAchievement: null, gap: null, sumNumerator: null, sumDenominator: null, hasData: false },
          3: { quarter: 3, expectedAchievement: null, actualAchievement: null, gap: null, sumNumerator: null, sumDenominator: null, hasData: false },
          4: { quarter: 4, expectedAchievement: null, actualAchievement: null, gap: null, sumNumerator: null, sumDenominator: null, hasData: false },
        };

        const hasExplicitQuarterConfigs =
          !!sub.quarterColumns &&
          Object.values(sub.quarterColumns).some(
            (qc) =>
              !!qc &&
              (!!qc.sumCol ||
                !!qc.meanCol ||
                !!qc.numeratorCol ||
                (qc.actualValue !== undefined && qc.actualValue !== null) ||
                (qc.countValue !== undefined && qc.countValue !== null)),
          );

        for (const k of [1, 2, 3, 4] as const) {
          const qConfig = sub.quarterColumns?.[k];
          const isQuarterConfigured =
            !!qConfig &&
            (!!qConfig.sumCol ||
              !!qConfig.meanCol ||
              !!qConfig.numeratorCol ||
              (qConfig.actualValue !== undefined && qConfig.actualValue !== null) ||
              (qConfig.countValue !== undefined && qConfig.countValue !== null));

          const qWeight = options.quarterWeight && k === q ? options.quarterWeight : this.DEFAULT_WEIGHTS[k];
          const exp = this.calculateExpectedAchievement(targetCurrent, k, null, qWeight);

          // If explicit quarter configs are used, skip unconfigured quarters completely
          if (hasExplicitQuarterConfigs && !isQuarterConfigured) {
            quarters[k] = {
              quarter: k,
              expectedAchievement: exp,
              actualAchievement: null,
              gap: null,
              sumNumerator: null,
              sumDenominator: null,
              hasData: false,
            };
            continue;
          }

          // If legacy single-quarter config is used, ONLY evaluate active quarter q
          if (!hasExplicitQuarterConfigs && k !== q) {
            quarters[k] = {
              quarter: k,
              expectedAchievement: exp,
              actualAchievement: null,
              gap: null,
              sumNumerator: null,
              sumDenominator: null,
              hasData: false,
            };
            continue;
          }

          const sumCol = qConfig?.sumCol || (k === q ? sub.sumCol : undefined);
          let meanCol = qConfig?.meanCol || qConfig?.numeratorCol || (k === q ? (sub.meanCol || sub.numeratorCol) : undefined);
          let numCol = qConfig?.numeratorCol || (k === q ? sub.numeratorCol : undefined);
          if (!meanCol && numCol) {
            meanCol = numCol;
          }

          const denCol = qConfig?.denominatorCol || sub.denominatorCol;
          const directActualVal = qConfig?.actualValue !== undefined ? qConfig.actualValue : (k === q ? sub.actualValue : undefined);
          const directCountVal = qConfig?.countValue !== undefined ? qConfig.countValue : (k === q ? sub.countValue : undefined);

          let act: number | null = null;
          let sumNum: number | null = null;
          let sumDen: number | null = null;

          const isSummaryMode = options.calculationDataSource === 'summary_row' || joinedRows.length <= 1;
          if (isSummaryMode && directActualVal !== undefined && directActualVal !== null) {
            act = directActualVal;
            sumNum = directCountVal ?? null;
          } else {
            // 1. Calculate sumNum (Jumlah Triwulan Ini / SUM)
            const targetSumCol = denCol ? (numCol || sumCol) : (sumCol || (calcMode === 'absolute' ? (meanCol || numCol) : undefined));
            if (targetSumCol) {
              if (joinedRows.length === 1) {
                const directSum = joinedRows[0][targetSumCol];
                sumNum = IndicatorEvaluator.parseSmartNumber(directSum);
              } else {
                sumNum = this.sumColumnValues(joinedRows, targetSumCol);
              }
            }
            if (sumNum === null && directCountVal !== undefined && directCountVal !== null) {
              sumNum = directCountVal;
            }

            // 2. Calculate act (Capaian Triwulan Ini / MEAN %)
            if (denCol && joinedRows.length > 0) {
              sumDen = this.sumColumnValues(joinedRows, denCol);
              if (sumDen && sumDen > 0 && sumNum !== null) {
                act = Math.round((sumNum / sumDen) * 10000) / 100;
              }
            }

            if (act === null) {
              const targetMeanCol = meanCol || (!denCol ? numCol : undefined);
              if (joinedRows.length === 1 && targetMeanCol) {
                const directVal = joinedRows[0][targetMeanCol];
                act = IndicatorEvaluator.parseSmartNumber(directVal);
                if (sumNum === null) {
                  sumNum = directCountVal ?? (typeof directVal === 'number' && directVal > 100 ? directVal : null);
                }
              } else if (joinedRows.length > 0) {
                if (targetMeanCol && calcMode !== 'absolute') {
                  act = this.averageColumnValues(joinedRows, targetMeanCol);
                } else if (targetSumCol && calcMode === 'absolute') {
                  act = sumNum;
                }
              }
            }
          }

          if (sumCol || meanCol || numCol || act !== null || sumNum !== null) {
            const gap = this.calculateGap(act, exp, polarity);
            quarters[k] = {
              quarter: k,
              sumCol,
              meanCol,
              numeratorCol: numCol || meanCol,
              sumNumerator: sumNum,
              sumDenominator: sumDen,
              expectedAchievement: exp,
              actualAchievement: act,
              gap,
              hasData: sumNum !== null || act !== null,
            };
          } else {
            quarters[k] = {
              quarter: k,
              expectedAchievement: exp,
              actualAchievement: null,
              gap: null,
              sumNumerator: null,
              sumDenominator: null,
              hasData: false,
            };
          }
        }

        // Tentukan triwulan evaluasi untuk indikator ini berdasarkan ketersediaan triwulan
        let evalQ: 1 | 2 | 3 | 4 = options.activeQuarter || 1;
        if (!options.activeQuarter) {
          for (const k of [4, 3, 2, 1] as const) {
            if (quarters[k].hasData && quarters[k].actualAchievement !== null) {
              evalQ = k;
              break;
            }
          }
        }

        // Active Quarter values
        const activeExpected = quarters[evalQ].expectedAchievement;
        const activeActual = quarters[evalQ].actualAchievement;
        const activeGap = quarters[evalQ].gap;
        const activeSumNum = quarters[evalQ].sumNumerator;
        const activeSumDen = quarters[evalQ].sumDenominator;

        // Gap & YoY
        const yoyChange = this.calculateYoYChange(activeActual, actualPrev);

        // Status & Pattern
        let { status, reason: statusReason } = this.evaluateStatus(
          activeActual,
          activeExpected,
          yoyChange,
          tolerance,
          polarity,
        );
        if (status === 'belum_dinilai') {
          if (activeSumDen === 0) {
            statusReason = 'Sasaran 0 (Data Belum Tersedia)';
          } else if (activeActual === null) {
            statusReason = 'Data Belum Dilaporkan';
          }
        }
        const pattern = this.classifyPattern(activeActual, targetCurrent, actualPrev, status, polarity);

        const isTargetReached =
          targetCurrent !== null &&
          activeActual !== null &&
          (polarity === 'negative' ? activeActual <= targetCurrent : activeActual >= targetCurrent);
        const isImproved = yoyChange !== null && (polarity === 'negative' ? yoyChange < 0 : yoyChange > 0);
        const isDeclined = yoyChange !== null && (polarity === 'negative' ? yoyChange > 0 : yoyChange < 0);

        const displayNo =
          sub.no !== undefined && sub.no !== null && String(sub.no).trim() !== ''
            ? sub.no
            : itemNo;
        itemNo++;

        evaluatedRows.push({
          id: sub.id || `stunting-agg-${displayNo}`,
          category: cat.name,
          canonicalCategory: canonical,
          no: displayNo,
          name: indicatorName,
          polarity,
          targetPrevYear: targetPrev,
          actualPrevYear: actualPrev,
          targetCurrentYear: targetCurrent,
          quarters,
          activeQuarter: evalQ,
          activeExpected,
          activeActual,
          activeGap,
          yoyChange,
          status,
          statusReason,
          pattern,
          isTargetReached,
          isImproved,
          isDeclined,
          needsValidation: status === 'belum_dinilai' || targetCurrent === null,
          sumCol: sub.sumCol,
          meanCol: sub.meanCol,
          targetCol: sub.targetCol,
          numeratorCol: sub.numeratorCol,
          denominatorCol: sub.denominatorCol,
          sumNumerator: activeSumNum,
          sumDenominator: activeSumDen,
          calculationMode: calcMode,
        });
      }
    }

    return this.compileEvaluationResult(evaluatedRows, options.activeQuarter);
  }

  /**
   * Mengumpulkan ringkasan KPI eksekutif, tabel prioritas percepatan, dan pengelompokan kategori.
   */
  private static compileEvaluationResult(
    evaluatedRows: EvaluatedStuntingRow[],
    q?: 1 | 2 | 3 | 4,
    customAvailableQuarters?: (1 | 2 | 3 | 4)[],
  ): StuntingEvaluationResult {
    let onTrackCount = 0;
    let perluPerhatianCount = 0;
    let perluPercepatanCount = 0;
    let belumDinilaiCount = 0;
    let targetReachedCount = 0;
    let improvedCount = 0;
    let declinedCount = 0;

    const patternCounts = {
      meningkat_on_track: 0,
      meningkat_belum_on_track: 0,
      menurun_on_track: 0,
      menurun_perlu_percepatan: 0,
      target_tercapai: 0,
    };

    for (const r of evaluatedRows) {
      if (r.status === 'on_track') onTrackCount++;
      else if (r.status === 'perlu_percepatan') perluPercepatanCount++;
      else if (r.status === 'belum_dinilai') belumDinilaiCount++;

      if (r.isTargetReached) targetReachedCount++;
      if (r.isImproved) improvedCount++;
      if (r.isDeclined) declinedCount++;

      if (r.pattern !== 'belum_dapat_dinilai') {
        patternCounts[r.pattern]++;
      }
    }

    const summary: StuntingKpiSummary = {
      totalIndicators: evaluatedRows.length,
      onTrackCount,
      perluPerhatianCount,
      perluPercepatanCount,
      belumDinilaiCount,
      targetReachedCount,
      improvedCount,
      declinedCount,
      patternCounts,
    };

    // Priority lists:
    // Acceleration List: indikator dengan gap negatif (diurutkan dari gap paling minus/terburuk ke yang mendekati nol)
    const accelerationList = evaluatedRows
      .filter((r) => r.status === 'perlu_percepatan' || (r.activeGap !== null && r.activeGap < 0))
      .sort((a, b) => {
        const gapA = a.activeGap ?? 0;
        const gapB = b.activeGap ?? 0;
        return gapA - gapB;
      });

    // Top Performance List: sudah capai target ATAU gap tertinggi
    const topPerformanceList = evaluatedRows
      .filter((r) => r.isTargetReached || r.status === 'on_track')
      .sort((a, b) => {
        if (a.isTargetReached && !b.isTargetReached) return -1;
        if (!a.isTargetReached && b.isTargetReached) return 1;
        const gapA = a.activeGap ?? 0;
        const gapB = b.activeGap ?? 0;
        return gapB - gapA;
      });

    // Grouping by category
    const categoryMap = new Map<string, { canonical: StuntingLifecycleCategory; rows: EvaluatedStuntingRow[] }>();
    for (const r of evaluatedRows) {
      if (!categoryMap.has(r.category)) {
        categoryMap.set(r.category, { canonical: r.canonicalCategory, rows: [] });
      }
      categoryMap.get(r.category)!.rows.push(r);
    }

    const groupedRows = Array.from(categoryMap.entries()).map(([categoryName, data]) => ({
      categoryName,
      canonicalCategory: data.canonical,
      rows: data.rows,
    }));

    // Detect quarters that have data across all evaluated rows
    const availableQuarters: (1 | 2 | 3 | 4)[] = customAvailableQuarters ?? (() => {
      const qSet = new Set<1 | 2 | 3 | 4>();
      for (const r of evaluatedRows) {
        for (const qNum of [1, 2, 3, 4] as const) {
          if (r.quarters[qNum]?.hasData || r.quarters[qNum]?.actualAchievement !== null) {
            qSet.add(qNum);
          }
        }
      }
      return qSet.size > 0 ? (Array.from(qSet).sort((a, b) => a - b) as (1 | 2 | 3 | 4)[]) : [q ?? 1];
    })();

    const effectiveActiveQuarter: 1 | 2 | 3 | 4 =
      q ?? (availableQuarters.length > 0 ? availableQuarters[availableQuarters.length - 1] : 1);

    return {
      rows: evaluatedRows,
      groupedRows,
      summary,
      accelerationList,
      topPerformanceList,
      activeQuarter: effectiveActiveQuarter,
      availableQuarters,
    };
  }

  /**
   * Mengevaluasi dataset indikator stunting secara per-wilayah (per baris Kabupaten/Kota).
   * Menghasilkan rapor kinerja (scorecard) independen untuk setiap wilayah.
   */
  static evaluateRegionalScorecards(
    categories: StuntingCategoryConfig[],
    validJoinedRows: Record<string, unknown>[],
    primaryKeyCol: string,
    options: RegionalEvaluationOptions = {},
  ): EvaluatedRegionalScorecard[] {
    const q = options.activeQuarter || 1;
    const scorecards: EvaluatedRegionalScorecard[] = [];

    for (let i = 0; i < validJoinedRows.length; i++) {
      const row = validJoinedRows[i];
      const regionId = String(row['__id'] ?? row[primaryKeyCol] ?? `region-${i}`);
      const rawName = row[primaryKeyCol];
      const regionName = rawName !== undefined && rawName !== null ? String(rawName).trim() : `Wilayah ${i + 1}`;

      // Evaluasi baris tunggal wilayah ini dengan konfigurasi target yang seragam
      const evalResult = this.evaluateAggregatedDataset(categories, [row], {
        ...options,
        activeQuarter: q,
        calculationDataSource: 'all_rows',
      });

      scorecards.push({
        regionId,
        regionName,
        summary: evalResult.summary,
        rows: evalResult.rows,
        activeQuarter: q,
      });
    }

    // Pengurutan (Sorting)
    const sortBy = options.sortBy || 'need_acceleration';
    const sortDirection = options.sortDirection || 'desc';

    scorecards.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'need_acceleration') {
        // Prioritaskan wilayah dengan perluPercepatanCount tertinggi
        cmp = a.summary.perluPercepatanCount - b.summary.perluPercepatanCount;
        if (cmp === 0) {
          // Fallback: onTrackCount terendah
          cmp = b.summary.onTrackCount - a.summary.onTrackCount;
        }
      } else if (sortBy === 'on_track') {
        cmp = a.summary.onTrackCount - b.summary.onTrackCount;
      } else if (sortBy === 'name') {
        cmp = a.regionName.localeCompare(b.regionName, 'id', { sensitivity: 'base' });
        return sortDirection === 'desc' ? -cmp : cmp;
      } else if (sortBy === 'percentage' && options.sortIndicatorId) {
        const rowA = a.rows.find((r) => r.id === options.sortIndicatorId);
        const rowB = b.rows.find((r) => r.id === options.sortIndicatorId);
        const valA = rowA?.activeActual ?? -9999;
        const valB = rowB?.activeActual ?? -9999;
        cmp = valA - valB;
      }

      return sortDirection === 'desc' ? -cmp : cmp;
    });

    return scorecards;
  }
}
