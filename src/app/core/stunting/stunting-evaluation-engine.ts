import { IndicatorEvaluator } from '../evaluation/indicator-evaluator';
import type { ParsedDinkesDataset } from '../excel/dinkes-spreadsheet-parser';

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
  isRegionalEvaluation?: boolean;
  regionName?: string;
  prevYearTw4Dataset?: ParsedDinkesDataset | null;
}

export interface RegionalEvaluationOptions extends AggregatedEvaluationOptions {
  sortBy?: 'need_acceleration' | 'on_track' | 'name' | 'percentage' | 'quarter' | 'yoy';
  sortDirection?: 'asc' | 'desc';
  sortIndicatorId?: string;
  sortQuarter?: 1 | 2 | 3 | 4;
}

export interface EvaluatedRegionalScorecard {
  regionId: string;
  regionName: string;
  summary: StuntingKpiSummary;
  rows: EvaluatedStuntingRow[];
  activeQuarter: 1 | 2 | 3 | 4;
  evaluationResult: StuntingEvaluationResult;
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


  static readonly DISTRICT_PREV_YEAR_OUTCOMES: Record<string, Record<string, number | null>> = {
  "CILACAP": {
    "1": 94.87,
    "2": 98.78,
    "3": 64.43,
    "4": 14.05,
    "5": 25.45,
    "7": 90.43,
    "8": 95.78,
    "10": 39.26,
    "11": 100,
    "6a": 97.77,
    "6b": 56.24,
    "9a": 1.77,
    "9b": 7.44,
    "9c": 9.58,
    "9d": 25.53
  },
  "BANYUMAS": {
    "1": 100,
    "2": 100,
    "3": 48.38,
    "4": 15.16,
    "5": 16.91,
    "7": 88.12,
    "8": 97.8,
    "10": 42.5,
    "11": 100,
    "6a": 99.51,
    "6b": 11.35,
    "9a": 2.42,
    "9b": 3.12,
    "9c": 7.24,
    "9d": 63.83
  },
  "PURBALINGGA": {
    "1": 99.14,
    "2": 99.94,
    "3": 53.15,
    "4": 11.92,
    "5": 47.59,
    "7": 88.99,
    "8": 88.8,
    "10": 39.98,
    "11": 100,
    "6a": 96.49,
    "6b": 23.86,
    "9a": 3.54,
    "9b": 6.39,
    "9c": 10.1,
    "9d": 24.73
  },
  "BANJARNEGARA": {
    "1": 93.03,
    "2": 96.43,
    "3": 59.61,
    "4": 19.4,
    "5": 32.21,
    "7": 88.05,
    "8": 91.99,
    "10": 45.48,
    "11": 100,
    "6a": 94.76,
    "6b": 8.93,
    "9a": 4.63,
    "9b": 5.97,
    "9c": 10.33,
    "9d": 41.85
  },
  "KEBUMEN": {
    "1": 90.37,
    "2": 92.32,
    "3": 8.74,
    "4": 6.43,
    "5": 16.76,
    "7": 91.65,
    "8": 93.47,
    "10": 34.96,
    "11": 100,
    "6a": 98.24,
    "6b": 2.35,
    "9a": 5.25,
    "9b": 6.95,
    "9c": 5.37,
    "9d": 18.87
  },
  "PURWOREJO": {
    "1": 98.68,
    "2": 87.26,
    "3": 24.86,
    "4": 5.95,
    "5": 18.82,
    "7": 92.89,
    "8": 97.4,
    "10": 36.49,
    "11": 100,
    "6a": 98.31,
    "6b": 10.15,
    "9a": 3.55,
    "9b": 9.41,
    "9c": 7.39,
    "9d": 24.69
  },
  "WONOSOBO": {
    "1": 97.15,
    "2": 99.73,
    "3": 14.81,
    "4": 1.96,
    "5": 19.37,
    "7": 92.13,
    "8": 98.81,
    "10": 40.56,
    "11": 100,
    "6a": 97,
    "6b": 1.77,
    "9a": 2.25,
    "9b": 5.27,
    "9c": 6.08,
    "9d": 20.69
  },
  "MAGELANG": {
    "1": 86.58,
    "2": 87.23,
    "3": 26.97,
    "4": 5.07,
    "5": 25.99,
    "7": 96.72,
    "8": 94.23,
    "10": 44.5,
    "11": 100,
    "6a": 95.68,
    "6b": 3.42,
    "9a": 1.36,
    "9b": 3.67,
    "9c": 3.05,
    "9d": 1.8
  },
  "BOYOLALI": {
    "1": 100.77,
    "2": 99.38,
    "3": 22.35,
    "4": 7.12,
    "5": 22.63,
    "7": 90.13,
    "8": 95.5,
    "10": 41.81,
    "11": 100,
    "6a": 96.98,
    "6b": 2.83,
    "9a": 10.11,
    "9b": 9.87,
    "9c": 13.73,
    "9d": 29.73
  },
  "KLATEN": {
    "1": 98.87,
    "2": 92.23,
    "3": 37.94,
    "4": 10.96,
    "5": 35.36,
    "7": 93.51,
    "8": 89.06,
    "10": 40.59,
    "11": 100,
    "6a": 98.59,
    "6b": 8.47,
    "9a": 1.22,
    "9b": 4.84,
    "9c": 9.18,
    "9d": 31.76
  },
  "SUKOHARJO": {
    "1": 95.52,
    "2": 99.47,
    "3": 7.91,
    "4": 12.45,
    "5": 47.32,
    "7": 91.38,
    "8": 99.51,
    "10": 50.83,
    "11": 100,
    "6a": 99.91,
    "6b": 17.08,
    "9a": 9.23,
    "9b": 5.89,
    "9c": 14.59,
    "9d": 71.83
  },
  "WONOGIRI": {
    "1": 94.53,
    "2": 99.96,
    "3": 8.36,
    "4": 4.74,
    "5": 28.86,
    "7": 78.78,
    "8": 94.58,
    "10": 40.11,
    "11": 100,
    "6a": 99.45,
    "6b": 8.68,
    "9a": 6.04,
    "9b": 4.22,
    "9c": 6.91,
    "9d": 39.07
  },
  "KARANGANYAR": {
    "1": 96.9,
    "2": 97.91,
    "3": 0.24,
    "4": 0.95,
    "5": 26.89,
    "7": 89.7,
    "8": 96.3,
    "10": 44.24,
    "11": 100,
    "6a": 95.63,
    "6b": 1.57,
    "9a": 4.81,
    "9b": 6.84,
    "9c": 6.42,
    "9d": 50
  },
  "SRAGEN": {
    "1": 88.33,
    "2": 85.11,
    "3": 5.19,
    "4": 0.41,
    "5": 16.54,
    "7": 95.05,
    "8": 93.21,
    "10": 49.42,
    "11": 100,
    "6a": 93.45,
    "6b": 1.67,
    "9a": 5.95,
    "9b": 8.2,
    "9c": 8.15,
    "9d": 10.34
  },
  "GROBOGAN": {
    "1": 95.18,
    "2": 65.89,
    "3": 48.69,
    "4": 11,
    "5": 35.83,
    "7": 78.02,
    "8": 92.43,
    "10": 51.03,
    "11": 100,
    "6a": 93.96,
    "6b": 14.94,
    "9a": 0.04,
    "9b": 13.46,
    "9c": 3.88,
    "9d": 20.65
  },
  "BLORA": {
    "1": 99.93,
    "2": 100,
    "3": 76.31,
    "4": 34.28,
    "5": 39.38,
    "7": 86.5,
    "8": 93.82,
    "10": 44.55,
    "11": 100,
    "6a": 99.04,
    "6b": 34.05,
    "9a": 2.2,
    "9b": 6.59,
    "9c": 10.88,
    "9d": 32.18
  },
  "REMBANG": {
    "1": 100,
    "2": 100,
    "3": 63.89,
    "4": 20.29,
    "5": 29.33,
    "7": 91.81,
    "8": 92.05,
    "10": 49.36,
    "11": 100,
    "6a": 90.09,
    "6b": 15.73,
    "9a": 4.93,
    "9b": 4.63,
    "9c": 9.92,
    "9d": 20.83
  },
  "PATI": {
    "1": 77.2,
    "2": 75.87,
    "3": 16.91,
    "4": 12.27,
    "5": 12.07,
    "7": 87.8,
    "8": 95.43,
    "10": 57.11,
    "11": 100,
    "6a": 92.82,
    "6b": 7.64,
    "9a": 1.43,
    "9b": 7.17,
    "9c": 8.29,
    "9d": 25.1
  },
  "KUDUS": {
    "1": 96.88,
    "2": 91.08,
    "3": 18.9,
    "4": 2.55,
    "5": 14.26,
    "7": 77.15,
    "8": 95.21,
    "10": 63.37,
    "11": 100,
    "6a": 98.16,
    "6b": 2.02,
    "9a": 3.78,
    "9b": 8.65,
    "9c": 2.63,
    "9d": 10.59
  },
  "JEPARA": {
    "1": 90.68,
    "2": 90.55,
    "3": 31.97,
    "4": 8.8,
    "5": 34.72,
    "7": 93.52,
    "8": 91,
    "10": 44.77,
    "11": 100,
    "6a": 96.58,
    "6b": 1.19,
    "9a": 5.22,
    "9b": 12.17,
    "9c": 8.3,
    "9d": 4.94
  },
  "DEMAK": {
    "1": 99.08,
    "2": 99.96,
    "3": 30.75,
    "4": 12.93,
    "5": 28.57,
    "7": 94.78,
    "8": 98.68,
    "10": 49.42,
    "11": 100,
    "6a": 99.48,
    "6b": 14.24,
    "9a": 0.01,
    "9b": 0,
    "9c": 16.14,
    "9d": 69.33
  },
  "SEMARANG": {
    "1": 92.23,
    "2": 92.78,
    "3": 54.78,
    "4": 17.06,
    "5": 27.16,
    "7": 86.22,
    "8": 98.15,
    "10": 45.94,
    "11": 100,
    "6a": 97.84,
    "6b": 6.95,
    "9a": 1.87,
    "9b": 7.87,
    "9c": 12.96,
    "9d": 3.7
  },
  "TEMANGGUNG": {
    "1": 95.78,
    "2": 99.91,
    "3": 21.28,
    "4": 5.54,
    "5": 5.79,
    "7": 79.75,
    "8": 95.77,
    "10": 38.93,
    "11": 100,
    "6a": 98.52,
    "6b": 3.06,
    "9a": 0.01,
    "9b": 5.32,
    "9c": 10.99,
    "9d": 4.26
  },
  "KENDAL": {
    "1": 93.84,
    "2": 93.88,
    "3": 46.84,
    "4": 21.71,
    "5": 17.17,
    "7": 85.76,
    "8": 96.15,
    "10": 43.45,
    "11": 100,
    "6a": 97.83,
    "6b": 9.21,
    "9a": 3.62,
    "9b": 6.44,
    "9c": 4.27,
    "9d": 8.3
  },
  "BATANG": {
    "1": 98.8,
    "2": 95.16,
    "3": 58.24,
    "4": 35.35,
    "5": 40.64,
    "7": 90.74,
    "8": 94.56,
    "10": 42.49,
    "11": 100,
    "6a": 95.3,
    "6b": 88.23,
    "9a": 2.18,
    "9b": 7.83,
    "9c": 18.05,
    "9d": 20.66
  },
  "PEKALONGAN": {
    "1": 99.21,
    "2": 92.01,
    "3": 44.15,
    "4": 17,
    "5": 24.86,
    "7": 92.85,
    "8": 94.61,
    "10": 50.64,
    "11": 100,
    "6a": 94.9,
    "6b": 3.89,
    "9a": 0.73,
    "9b": 0.88,
    "9c": 4.06,
    "9d": 82.33
  },
  "PEMALANG": {
    "1": 94.26,
    "2": 99.73,
    "3": 42.07,
    "4": 4.53,
    "5": 19.44,
    "7": 78.62,
    "8": 98.27,
    "10": 39.18,
    "11": 100,
    "6a": 98.29,
    "6b": 3.05,
    "9a": 0.83,
    "9b": 4.17,
    "9c": 2.05,
    "9d": 33.07
  },
  "TEGAL": {
    "1": 97.93,
    "2": 99.76,
    "3": 30.58,
    "4": 5.98,
    "5": 14.9,
    "7": 93.4,
    "8": 94.62,
    "10": 40.84,
    "11": 100,
    "6a": 94.99,
    "6b": 1.26,
    "9a": 3.04,
    "9b": 2.92,
    "9c": 2.97,
    "9d": 59.7
  },
  "BREBES": {
    "1": 97.41,
    "2": 86.93,
    "3": 26.77,
    "4": 5.2,
    "5": 27.09,
    "7": 92.59,
    "8": 84.28,
    "10": 43.49,
    "11": 100,
    "6a": 89.51,
    "6b": 1.54,
    "9a": 2.77,
    "9b": 2.72,
    "9c": 5.03,
    "9d": 17.63
  },
  "KOTA MAGELANG": {
    "1": 98.69,
    "2": 97.46,
    "3": 97.52,
    "4": 35.89,
    "5": 19,
    "7": 77.12,
    "8": 91.27,
    "10": 42.09,
    "11": 100,
    "6a": 97,
    "6b": 8.82,
    "9a": 8.39,
    "9b": 12.43,
    "9c": 19.76,
    "9d": 50
  },
  "KOTA SURAKARTA": {
    "1": 40.9,
    "2": 97.69,
    "3": 13.11,
    "4": 1.08,
    "5": 91.51,
    "7": 91.92,
    "8": 98.29,
    "10": 48.94,
    "11": 100,
    "6a": 98.99,
    "6b": 16.66,
    "9a": 15.74,
    "9b": 15.9,
    "9c": 22.39,
    "9d": 100
  },
  "KOTA SALATIGA": {
    "1": 98.27,
    "2": 99.72,
    "3": 25.98,
    "4": 8.3,
    "5": 0,
    "7": 76.55,
    "8": 99.03,
    "10": 66.66,
    "11": 100,
    "6a": 94.92,
    "6b": 27.27,
    "9a": 9.56,
    "9b": 18.22,
    "9c": 15.1,
    "9d": 83.33
  },
  "KOTA SEMARANG": {
    "1": 94.66,
    "2": 98.83,
    "3": 14.33,
    "4": 6.02,
    "5": 7.72,
    "7": 96.89,
    "8": 98.81,
    "10": 70.67,
    "11": 100,
    "6a": 89.34,
    "6b": 10.38,
    "9a": 12.42,
    "9b": 33.38,
    "9c": 34.61,
    "9d": 102.43
  },
  "KOTA PEKALONGAN": {
    "1": 99.4,
    "2": 99.01,
    "3": 70.98,
    "4": 40.07,
    "5": 44.31,
    "7": 94.45,
    "8": 95.96,
    "10": 45.22,
    "11": 100,
    "6a": 95.06,
    "6b": 73.85,
    "9a": 1.35,
    "9b": 4.31,
    "9c": 4.89,
    "9d": 83.46
  },
  "KOTA TEGAL": {
    "1": 98.39,
    "2": 97.96,
    "3": 10.07,
    "4": 3.55,
    "5": 9.22,
    "7": 92.17,
    "8": 96.68,
    "10": 66.13,
    "11": 100,
    "6a": 98.41,
    "6b": 4.71,
    "9a": 2.88,
    "9b": 1.44,
    "9c": 0.24,
    "9d": 5
  }
};

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
   * Mengekstrak nilai atribut target tahun lalu dan capaian tahun lalu untuk indikator
   * dari berkas dataset triwulan 4 (TW4) tahun sebelumnya jika tersedia.
   * Jika tidak tersedia atau tidak ada data pada TW4, menggunakan nilai default atribut yang saat ini digunakan.
   */
  static extractIndicatorPrevYearValues(
    indicator: {
      no?: string | number | null;
      name?: string | null;
      sumKeywords?: string[];
      meanKeywords?: string[];
      meanCol?: string | null;
      sumCol?: string | null;
      dataCol?: string | null;
      defaultTargetPrev?: number | string | null;
      defaultActualPrev?: number | string | null;
      targetPrevYear?: number | string | null;
      actualPrevYear?: number | string | null;
    },
    tw4Dataset?: ParsedDinkesDataset | null,
    regionName?: string | null,
  ): { targetPrevYear: number | null; actualPrevYear: number | null } {
    const defaultTarget =
      typeof indicator.defaultTargetPrev === 'number'
        ? indicator.defaultTargetPrev
        : indicator.defaultTargetPrev !== null &&
            indicator.defaultTargetPrev !== undefined &&
            indicator.defaultTargetPrev !== '-'
          ? IndicatorEvaluator.parseSmartNumber(indicator.defaultTargetPrev)
          : indicator.targetPrevYear !== null &&
              indicator.targetPrevYear !== undefined &&
              indicator.targetPrevYear !== '-'
            ? IndicatorEvaluator.parseSmartNumber(indicator.targetPrevYear)
            : null;

    const defaultActual =
      typeof indicator.defaultActualPrev === 'number'
        ? indicator.defaultActualPrev
        : indicator.defaultActualPrev !== null &&
            indicator.defaultActualPrev !== undefined &&
            indicator.defaultActualPrev !== '-'
          ? IndicatorEvaluator.parseSmartNumber(indicator.defaultActualPrev)
          : indicator.actualPrevYear !== null &&
              indicator.actualPrevYear !== undefined &&
              indicator.actualPrevYear !== '-'
            ? IndicatorEvaluator.parseSmartNumber(indicator.actualPrevYear)
            : null;

    if (!tw4Dataset || !tw4Dataset.columns || tw4Dataset.columns.length === 0) {
      return { targetPrevYear: defaultTarget, actualPrevYear: defaultActual };
    }

    const normalizeStr = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const cleanQuarterSuffix = (s: string) =>
      s.replace(/\(tw\s*\d\)/gi, '').replace(/tw\s*\d/gi, '').trim();

    // 1. Dapatkan keywords standar jika tersedia
    let meanKeywords = indicator.meanKeywords;
    let sumKeywords = indicator.sumKeywords;

    if ((!meanKeywords || meanKeywords.length === 0) && indicator.no) {
      const std = this.DINKES_STANDARD_INDICATORS.find((s) => String(s.no) === String(indicator.no));
      if (std) {
        meanKeywords = std.meanKeywords;
        sumKeywords = std.sumKeywords;
      }
    }

    let matchedCol: string | undefined;

    // A. Cocokkan dengan meanKeywords
    if (meanKeywords && meanKeywords.length > 0) {
      for (const kw of meanKeywords) {
        const normKw = normalizeStr(kw);
        const found = tw4Dataset.columns.find((c) => {
          const normC = normalizeStr(cleanQuarterSuffix(c));
          return normC === normKw || normC.includes(normKw) || normalizeStr(c).includes(normKw);
        });
        if (found) {
          matchedCol = found;
          break;
        }
      }
    }

    // B. Cocokkan dengan sumKeywords
    if (!matchedCol && sumKeywords && sumKeywords.length > 0) {
      for (const kw of sumKeywords) {
        const normKw = normalizeStr(kw);
        const found = tw4Dataset.columns.find((c) => {
          const normC = normalizeStr(cleanQuarterSuffix(c));
          return normC === normKw || normC.includes(normKw) || normalizeStr(c).includes(normKw);
        });
        if (found) {
          matchedCol = found;
          break;
        }
      }
    }

    // C. Cocokkan dengan meanCol / dataCol
    const candidateCol = indicator.meanCol || indicator.dataCol;
    if (!matchedCol && candidateCol) {
      const normCand = normalizeStr(cleanQuarterSuffix(candidateCol));
      if (normCand) {
        matchedCol = tw4Dataset.columns.find((c) => {
          const normC = normalizeStr(cleanQuarterSuffix(c));
          return normC === normCand || normC.includes(normCand) || normCand.includes(normC);
        });
      }
    }

    // D. Cocokkan dengan nama indikator
    if (!matchedCol && indicator.name) {
      const normName = normalizeStr(cleanQuarterSuffix(indicator.name));
      if (normName) {
        matchedCol = tw4Dataset.columns.find((c) => {
          const normC = normalizeStr(cleanQuarterSuffix(c));
          return normC === normName || normC.includes(normName) || normName.includes(normC);
        });
      }
    }

    if (!matchedCol) {
      return { targetPrevYear: defaultTarget, actualPrevYear: defaultActual };
    }

    // Ekstraksi capaian aktual tahun lalu
    let foundActual: number | null = null;
    if (regionName && regionName !== 'province' && tw4Dataset.regionRows && tw4Dataset.regionRows.length > 0) {
      const regUpper = regionName.trim().toUpperCase();
      const cleanReg = regUpper.replace(/^(KABUPATEN|KOTA|KAB\.)\s+/i, '').trim();
      const regRow = tw4Dataset.regionRows.find((r) => {
        const name = String(r['Kabupaten/Kota'] || r['Kab/Kota'] || r['Wilayah'] || '')
          .trim()
          .toUpperCase();
        if (name === regUpper) return true;
        const cleanName = name.replace(/^(KABUPATEN|KOTA|KAB\.)\s+/i, '').trim();
        return cleanName === cleanReg;
      });
      if (regRow && regRow[matchedCol] !== undefined) {
        foundActual = IndicatorEvaluator.parseSmartNumber(regRow[matchedCol]);
      }
    }
    if (foundActual === null && (!regionName || regionName === 'province')) {
      if (tw4Dataset.summaryRow && tw4Dataset.summaryRow[matchedCol] !== undefined) {
        foundActual = IndicatorEvaluator.parseSmartNumber(tw4Dataset.summaryRow[matchedCol]);
      }
      if (foundActual === null && tw4Dataset.regionRows && tw4Dataset.regionRows.length > 0) {
        foundActual = IndicatorEvaluator.calculateColumnAverage(tw4Dataset.regionRows, matchedCol);
      }
    }
    if (foundActual === null && regionName && regionName !== 'province' && StuntingEvaluationEngine.DISTRICT_PREV_YEAR_OUTCOMES) {
      const regUpper = regionName.trim().toUpperCase();
      const cleanReg = regUpper.replace(/^(KABUPATEN|KOTA|KAB\.)\s+/i, '').trim();
      const matchKey = Object.keys(StuntingEvaluationEngine.DISTRICT_PREV_YEAR_OUTCOMES).find((k) => {
        if (k === regUpper) return true;
        const cleanK = k.replace(/^(KABUPATEN|KOTA|KAB\.)\s+/i, '').trim();
        return cleanK === cleanReg;
      });
      if (matchKey && indicator.no && StuntingEvaluationEngine.DISTRICT_PREV_YEAR_OUTCOMES[matchKey]?.[String(indicator.no)] !== undefined) {
        foundActual = StuntingEvaluationEngine.DISTRICT_PREV_YEAR_OUTCOMES[matchKey][String(indicator.no)];
      }
    }
    if (foundActual !== null) {
      foundActual = Number.isInteger(foundActual) ? foundActual : Math.round(foundActual * 100) / 100;
    }

    // Ekstraksi target tahun lalu
    let foundTarget: number | null = null;
    if (
      tw4Dataset.columnTargets &&
      tw4Dataset.columnTargets[matchedCol]?.enabled &&
      tw4Dataset.columnTargets[matchedCol]?.value !== null
    ) {
      foundTarget = tw4Dataset.columnTargets[matchedCol].value;
    }
    if (foundTarget === null && tw4Dataset.targetRow && tw4Dataset.targetRow[matchedCol] !== undefined) {
      const rawT = tw4Dataset.targetRow[matchedCol];
      if (rawT !== null && rawT !== undefined && String(rawT).trim() !== '' && String(rawT).trim() !== '-') {
        const cleaned = this.cleanTargetValue(rawT);
        if (cleaned.value !== null) {
          foundTarget = cleaned.value;
        }
      }
    }

    return {
      targetPrevYear: foundTarget !== null ? foundTarget : defaultTarget,
      actualPrevYear: foundActual !== null ? foundActual : defaultActual,
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
        } else if (options.isRegionalEvaluation && options.regionName && options.regionName !== 'province') {
          if (options.prevYearTw4Dataset) {
            const regPrev = this.extractIndicatorPrevYearValues(
              {
                no: sub.no,
                name: sub.name,
                meanCol: sub.meanCol,
                sumCol: sub.sumCol,
                dataCol: sub.dataCol,
                targetPrevYear: sub.targetPrevYear,
                actualPrevYear: sub.actualPrevYear,
              },
              options.prevYearTw4Dataset,
              options.regionName,
            );
            actualPrev = regPrev.actualPrevYear;
          }
          if (actualPrev === null && StuntingEvaluationEngine.DISTRICT_PREV_YEAR_OUTCOMES) {
            const regUpper = options.regionName.trim().toUpperCase();
            const cleanReg = regUpper.replace(/^(KABUPATEN|KOTA|KAB\.)\s+/i, '').trim();
            const matchKey = Object.keys(StuntingEvaluationEngine.DISTRICT_PREV_YEAR_OUTCOMES).find((k) => {
              if (k === regUpper) return true;
              const cleanK = k.replace(/^(KABUPATEN|KOTA|KAB\.)\s+/i, '').trim();
              return cleanK === cleanReg;
            });
            if (matchKey && sub.no && StuntingEvaluationEngine.DISTRICT_PREV_YEAR_OUTCOMES[matchKey]?.[String(sub.no)] !== undefined) {
              actualPrev = StuntingEvaluationEngine.DISTRICT_PREV_YEAR_OUTCOMES[matchKey][String(sub.no)];
            }
          }
          if (actualPrev === null && sub.actualPrevYear !== null && sub.actualPrevYear !== undefined && String(sub.actualPrevYear).trim() !== '') {
            actualPrev = IndicatorEvaluator.parseSmartNumber(sub.actualPrevYear);
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

          const isSummaryMode = !options.isRegionalEvaluation && (options.calculationDataSource === 'summary_row' || joinedRows.length <= 1);
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
            if (sumNum === null && !options.isRegionalEvaluation && directCountVal !== undefined && directCountVal !== null) {
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
                  sumNum = (!options.isRegionalEvaluation ? directCountVal : null) ?? (typeof directVal === 'number' && directVal > 100 ? directVal : null);
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
        isRegionalEvaluation: true,
        regionName,
        prevYearTw4Dataset: options.prevYearTw4Dataset,
      });

      scorecards.push({
        regionId,
        regionName,
        summary: evalResult.summary,
        rows: evalResult.rows,
        activeQuarter: q,
        evaluationResult: evalResult,
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
        const valA = a.rows.find((r) => r.id === options.sortIndicatorId)?.activeActual ?? null;
        const valB = b.rows.find((r) => r.id === options.sortIndicatorId)?.activeActual ?? null;
        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;
        cmp = valA - valB;
      } else if (sortBy === 'quarter' && options.sortQuarter && options.sortIndicatorId) {
        const rowA = a.rows.find((r) => r.id === options.sortIndicatorId) ?? a.rows[0];
        const rowB = b.rows.find((r) => r.id === options.sortIndicatorId) ?? b.rows[0];
        const valA = rowA?.quarters[options.sortQuarter]?.actualAchievement ?? null;
        const valB = rowB?.quarters[options.sortQuarter]?.actualAchievement ?? null;
        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;
        cmp = valA - valB;
      } else if (sortBy === 'yoy' && options.sortIndicatorId) {
        const rowA = a.rows.find((r) => r.id === options.sortIndicatorId) ?? a.rows[0];
        const rowB = b.rows.find((r) => r.id === options.sortIndicatorId) ?? b.rows[0];
        const valA = rowA?.yoyChange ?? null;
        const valB = rowB?.yoyChange ?? null;
        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;
        cmp = valA - valB;
      }

      return sortDirection === 'desc' ? -cmp : cmp;
    });

    return scorecards;
  }
}


export const DISTRICT_PREV_YEAR_OUTCOMES = StuntingEvaluationEngine.DISTRICT_PREV_YEAR_OUTCOMES;
