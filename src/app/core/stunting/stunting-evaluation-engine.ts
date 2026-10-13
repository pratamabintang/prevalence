import { IndicatorEvaluator } from '../evaluation/indicator-evaluator';

export type StuntingLifecycleCategory =
  | 'sebelum_kelahiran' // Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)
  | 'setelah_kelahiran' // Intervensi untuk balita (setelah kelahiran)
  | 'lainnya'; // Intervensi lainnya

export type StuntingPerformanceStatus =
  | 'on_track' // On Track
  | 'perlu_perhatian' // Perlu Perhatian
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
  numeratorCol?: string;
  denominatorCol?: string;
  sumNumerator?: number | null;
  sumDenominator?: number | null;
  calculationMode?: 'percentage' | 'absolute';
}

export interface StuntingQuarterInputConfig {
  numeratorCol?: string;
  denominatorCol?: string;
}

export interface StuntingSubCategoryConfig {
  id: string;
  name?: string;
  numeratorCol: string;
  denominatorCol?: string;
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
    1: 0.25,
    2: 0.5,
    3: 0.75,
    4: 1.0,
  };

  /**
   * Menghitung capaian yang diharapkan (Expected Achievement) per triwulan.
   * Mengutamakan target khusus triwulan jika ada; jika tidak, menggunakan distribusi proporsional waktu.
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

    // 2. Capaian di bawah expected:
    const isTrendingDown = yoyChange !== null && (polarity === 'negative' ? yoyChange > 0 : yoyChange < 0);

    // Jika gap < toleranceThreshold ATAU tren YoY menurun saat gap negatif -> Perlu Percepatan
    if (gap < toleranceThreshold || isTrendingDown) {
      const reasonParts: string[] = [];
      if (gap < toleranceThreshold) {
        reasonParts.push(`Capaian tertinggal cukup jauh dari target periode (Gap: ${gap})`);
      }
      if (isTrendingDown) {
        reasonParts.push(`tren capaian mengalami penurunan dibandingkan periode sebelumnya (${yoyChange})`);
      }
      return {
        status: 'perlu_percepatan',
        reason: reasonParts.join(' serta ') || `Capaian di bawah target periode (Gap: ${gap})`,
      };
    }

    // Jika masih dalam batas toleransi (dan tren tidak menurun) -> Perlu Perhatian
    return {
      status: 'perlu_perhatian',
      reason: `Capaian sedikit di bawah target periode (Gap: ${gap}), namun masih dalam batas toleransi`,
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
        const indicatorName = (sub.name || sub.numeratorCol || `Indikator ${itemNo}`).trim();

        // Targets
        const targetCurrent = IndicatorEvaluator.parseSmartNumber(sub.targetCurrentYear);
        const targetPrev = IndicatorEvaluator.parseSmartNumber(sub.targetPrevYear);

        // Previous Year Actual Calculation
        let actualPrev: number | null = null;
        if (sub.prevYearMode === 'columns' && sub.prevNumeratorCol) {
          const prevSumNum = this.sumColumnValues(joinedRows, sub.prevNumeratorCol);
          const prevSumDen = sub.prevDenominatorCol ? this.sumColumnValues(joinedRows, sub.prevDenominatorCol) : null;
          if (prevSumNum !== null) {
            if (calcMode === 'absolute' || prevSumDen === null || prevSumDen === 0) {
              actualPrev = prevSumNum;
            } else {
              actualPrev = Math.round((prevSumNum / prevSumDen) * 10000) / 100;
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

        for (const k of [1, 2, 3, 4] as const) {
          // Resolve numerator column: check quarterColumns first, fallback to sub.numeratorCol
          let numCol = sub.quarterColumns?.[k]?.numeratorCol;
          if (!numCol && (!sub.quarterColumns || Object.keys(sub.quarterColumns).length === 0) && k === q) {
            numCol = sub.numeratorCol;
          }

          const denCol = sub.quarterColumns?.[k]?.denominatorCol || sub.denominatorCol;
          const qWeight = options.quarterWeight && k === q ? options.quarterWeight : this.DEFAULT_WEIGHTS[k];
          const exp = this.calculateExpectedAchievement(targetCurrent, k, null, qWeight);

          if (numCol) {
            const sumNum = this.sumColumnValues(joinedRows, numCol);
            const sumDen = denCol ? this.sumColumnValues(joinedRows, denCol) : null;
            let act: number | null = null;
            if (sumNum !== null) {
              if (calcMode === 'absolute' || sumDen === null || sumDen === 0) {
                act = sumNum;
              } else {
                act = Math.round((sumNum / sumDen) * 10000) / 100;
              }
            }
            const gap = this.calculateGap(act, exp, polarity);
            quarters[k] = {
              quarter: k,
              numeratorCol: numCol,
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

        evaluatedRows.push({
          id: sub.id || `stunting-agg-${itemNo}`,
          category: cat.name,
          canonicalCategory: canonical,
          no: itemNo++,
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
      else if (r.status === 'perlu_perhatian') perluPerhatianCount++;
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
}
