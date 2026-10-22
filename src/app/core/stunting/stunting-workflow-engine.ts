import { Injectable, computed, signal, Signal } from '@angular/core';
import {
  IndicatorPolarity,
  StuntingCategoryConfig,
  StuntingEvaluationEngine,
  StuntingEvaluationResult,
  StuntingQuarterInputConfig,
  StuntingSubCategoryConfig,
} from './stunting-evaluation-engine';
import { ExcelJoinEngine, JoinedDatasetResult, JoinExecutionSpec } from '../excel/excel-join-engine';
import { ExcelEngine } from '../../shared/excel';
import { RegionNormalizer } from '../domain/region-normalizer';
import { IndicatorEvaluator } from '../evaluation/indicator-evaluator';

export interface JoinedRowPreviewItem {
  id: string;
  key: string;
  data: Record<string, unknown>;
  isExcluded: boolean;
  excludeReason?: string;
}

export interface StepTransitionCheck {
  allowed: boolean;
  reason?: string;
}

@Injectable({
  providedIn: 'root',
})
export class StuntingWorkflowEngine {
  // ============================================================
  // STEPPER LIFECYCLE & INVARIANTS
  // ============================================================
  readonly activeStep = signal<1 | 2 | 3>(1);

  readonly canProceedToStep2 = computed<boolean>(() => this.validJoinedRows().length > 0);

  readonly canProceedToStep3 = computed<boolean>(
    () =>
      this.validJoinedRows().length > 0 &&
      this.categories().some((c) => c.subCategories.length > 0),
  );

  // ============================================================
  // STEP 1: INGESTION & DATASET STATE
  // ============================================================
  readonly joinedRows = signal<Record<string, unknown>[]>([]);
  readonly joinedColumns = signal<string[]>([]);
  readonly primaryKeyCol = signal<string>('Kabupaten/Kota');
  readonly stripKabupaten = signal<boolean>(true);
  readonly excludedRowKeywords = signal<string>('TOTAL, JUMLAH, RATA, AVERAGE, TARGET');
  readonly manualExcludedKeys = signal<Set<string>>(new Set());
  readonly excludedRowIds = signal<Set<string>>(new Set());

  readonly calculationDataSource = signal<'summary_row' | 'all_rows'>('all_rows');
  readonly summaryRowId = signal<string>('');
  readonly targetRowId = signal<string>('');
  readonly totalRowId = signal<string>('');
  readonly summaryRowData = signal<Record<string, unknown> | null>(null);
  readonly targetRowData = signal<Record<string, unknown> | null>(null);
  readonly totalRowData = signal<Record<string, unknown> | null>(null);

  readonly isHasilJoinFormat = computed<boolean>(() => {
    const cols = this.joinedColumns();
    const rows = this.joinedRows();
    const pKey = this.primaryKeyCol();
    if (cols.length === 0 || rows.length === 0) return false;

    const percentCols = cols.filter((c) => c.includes('%'));
    const hasWilayahCol = /kabupaten|kota|wilayah|puskesmas/i.test(pKey);
    const hasTargetRow = rows.some((r) => /target/i.test(String(r[pKey] ?? '')));
    const hasAvgOrSumRow = rows.some((r) => /rata|jumlah|total/i.test(String(r[pKey] ?? '')));

    return (
      (percentCols.length >= 2 && (hasWilayahCol || hasTargetRow || hasAvgOrSumRow)) ||
      (hasTargetRow && hasAvgOrSumRow)
    );
  });

  readonly availableSummaryRows = computed(() => {
    const pKey = this.primaryKeyCol();
    return this.joinedRows().map((r, idx) => ({
      id: String(r['__id'] ?? `row-${idx}`),
      label: String(r[pKey] ?? '').trim() || `[Baris ${idx + 1}]`,
      data: r,
    }));
  });

  readonly availableTargetRows = computed(() => {
    const pKey = this.primaryKeyCol();
    return this.joinedRows().map((r, idx) => ({
      id: String(r['__id'] ?? `row-${idx}`),
      label: String(r[pKey] ?? '').trim() || `[Baris ${idx + 1}]`,
      data: r,
    }));
  });

  readonly validJoinedRows = computed<Record<string, unknown>[]>(() => {
    if (this.calculationDataSource() === 'summary_row' && this.summaryRowData()) {
      return [this.summaryRowData()!];
    }
    const rows = this.joinedRows();
    const exIds = this.excludedRowIds();
    return rows.filter((r) => !exIds.has(String(r['__id'])));
  });

  readonly activeRegionRows = computed<Record<string, unknown>[]>(() => {
    const rows = this.joinedRows();
    const exIds = this.excludedRowIds();
    return rows.filter((r) => !exIds.has(String(r['__id'])));
  });

  readonly previewRows = computed<JoinedRowPreviewItem[]>(() => {
    const rows = this.joinedRows();
    const pKey = this.primaryKeyCol();
    const exIds = this.excludedRowIds();
    const keywords = this.excludedRowKeywords()
      .split(',')
      .map((k) => k.trim().toUpperCase())
      .filter((k) => k.length > 0);

    return rows.map((r, idx) => {
      const id = String(r['__id'] ?? `row-${idx}`);
      const keyVal = String(r[pKey] ?? '').trim();
      const isExcluded = exIds.has(id);

      let reason = '';
      if (isExcluded) {
        if (!keyVal) {
          reason = 'Baris kosong / tanpa nama wilayah';
        } else {
          const upperKey = keyVal.toUpperCase();
          for (const kw of keywords) {
            if (upperKey.includes(kw)) {
              reason = `Baris akumulasi (${kw})`;
              break;
            }
          }
          if (!reason) {
            reason = 'Dinonaktifkan manual';
          }
        }
      }

      return {
        id,
        key: keyVal || `[Baris ${idx + 1} - Tanpa Nama]`,
        data: r,
        isExcluded,
        excludeReason: reason,
      };
    });
  });

  // ============================================================
  // STEP 2: CATEGORY & INDICATOR BUILDER STATE
  // ============================================================
  readonly categories = signal<StuntingCategoryConfig[]>([]);

  readonly totalIndicatorsCount = computed<number>(() =>
    this.categories().reduce((sum, c) => sum + c.subCategories.length, 0),
  );

  // ============================================================
  // STEP 3: EVALUATION & SCORECARD STATE
  // ============================================================
  readonly manualActiveQuarter = signal<1 | 2 | 3 | 4 | null>(null);
  readonly toleranceThreshold = signal<number>(-5.0);
  readonly quarterWeight = signal<number | null>(null);

  readonly evaluationResult = computed<StuntingEvaluationResult | null>(() => {
    const cats = this.categories();
    const rows = this.validJoinedRows();

    const hasSubCategories = cats.some((c) => c.subCategories.length > 0);
    if (!hasSubCategories || rows.length === 0) {
      return null;
    }

    return StuntingEvaluationEngine.evaluateAggregatedDataset(cats, rows, {
      activeQuarter: this.manualActiveQuarter() ?? undefined,
      toleranceThresholdPercent: this.toleranceThreshold(),
      quarterWeight: this.quarterWeight() ?? undefined,
      calculationDataSource: this.calculationDataSource(),
    });
  });

  readonly availableQuarters = computed<(1 | 2 | 3 | 4)[]>(() => {
    const res = this.evaluationResult();
    if (!res || !res.availableQuarters || res.availableQuarters.length === 0) {
      return [1];
    }
    return res.availableQuarters;
  });

  readonly activeQuarter = computed<1 | 2 | 3 | 4>(() => {
    const manual = this.manualActiveQuarter();
    if (manual) return manual;
    const res = this.evaluationResult();
    return res?.activeQuarter ?? 1;
  });

  readonly onTrackCount = computed<number>(
    () => this.evaluationResult()?.rows.filter((r) => r.status === 'on_track').length ?? 0,
  );

  readonly perluPercepatanCount = computed<number>(
    () =>
      this.evaluationResult()?.rows.filter((r) => r.status === 'perlu_percepatan').length ?? 0,
  );

  readonly perluPerhatianCount = computed<number>(() => 0);

  constructor() {
    this.loadStandardCategories();
  }

  // ============================================================
  // INVARIANT CHECKING & STEP TRANSITIONS
  // ============================================================
  canTransitionTo(targetStep: 1 | 2 | 3): StepTransitionCheck {
    if (targetStep === 1) {
      return { allowed: true };
    }

    if (targetStep === 2) {
      if (this.validJoinedRows().length === 0) {
        return {
          allowed: false,
          reason: 'Data gabungan valid belum tersedia. Silakan unggah dan gabungkan lembar kerja terlebih dahulu.',
        };
      }
      return { allowed: true };
    }

    if (targetStep === 3) {
      if (this.validJoinedRows().length === 0) {
        return {
          allowed: false,
          reason: 'Data gabungan valid belum tersedia.',
        };
      }
      if (!this.categories().some((c) => c.subCategories.length > 0)) {
        return {
          allowed: false,
          reason: 'Minimal harus ada 1 sub-kategori indikator untuk melakukan evaluasi pemantauan.',
        };
      }
      return { allowed: true };
    }

    return { allowed: false, reason: 'Langkah target tidak dikenal.' };
  }

  transitionTo(targetStep: 1 | 2 | 3): boolean {
    const check = this.canTransitionTo(targetStep);
    if (!check.allowed) {
      return false;
    }
    this.activeStep.set(targetStep);
    return true;
  }

  // ============================================================
  // STEP 1 METHODS: DATASET & EXCLUSION LOGIC
  // ============================================================
  setJoinedDataset(spec: {
    rows: Record<string, unknown>[];
    columns: string[];
    keyCol?: string;
    summaryRow?: Record<string, unknown> | null;
    targetRow?: Record<string, unknown> | null;
    totalRow?: Record<string, unknown> | null;
  }): void {
    const keyCol = spec.keyCol || this.primaryKeyCol() || 'Kabupaten/Kota';
    this.primaryKeyCol.set(keyCol);

    // Ensure all rows have __id
    const processedRows: Record<string, unknown>[] = spec.rows.map((r, idx) => ({
      ...r,
      __id: r['__id'] ? String(r['__id']) : `row-${idx}`,
    }));

    this.joinedRows.set(processedRows);
    this.joinedColumns.set(spec.columns);

    this.applyKeywordAndPatternExclusions(processedRows);

    // Detect summary, target, and total rows
    let detectedSummary = spec.summaryRow ?? null;
    let detectedTarget = spec.targetRow ?? null;
    let detectedTotal = spec.totalRow ?? null;

    if (!detectedSummary || !detectedTarget || !detectedTotal) {
      for (const r of processedRows) {
        const keyStr = String(r[keyCol] ?? '').trim().toUpperCase();
        if (keyStr.includes('TARGET')) {
          if (!detectedTarget) detectedTarget = r;
        } else if (
          keyStr.includes('RATA') ||
          keyStr.includes('AVERAGE') ||
          keyStr.includes('JAWA TENGAH') ||
          keyStr.includes('PROVINSI') ||
          keyStr.startsWith('PROV')
        ) {
          if (!detectedSummary) detectedSummary = r;
        } else if (keyStr.includes('TOTAL') || keyStr.includes('JUMLAH')) {
          if (!detectedTotal) detectedTotal = r;
        }
      }
    }

    if (!detectedSummary && detectedTotal) {
      detectedSummary = detectedTotal;
    }

    if (detectedSummary) {
      const sId = String(detectedSummary['__id']);
      this.summaryRowId.set(sId);
      this.summaryRowData.set(detectedSummary);
      this.excludedRowIds.update((s) => new Set(s).add(sId));

      const keyStr = String(detectedSummary[keyCol] ?? '').trim().toUpperCase();
      if (
        keyStr.includes('JAWA TENGAH') ||
        keyStr.includes('PROVINSI') ||
        keyStr.includes('RATA') ||
        keyStr.includes('AVERAGE') ||
        this.isHasilJoinFormat()
      ) {
        this.calculationDataSource.set('summary_row');
      }
    } else {
      this.summaryRowId.set('');
      this.summaryRowData.set(null);
    }

    if (detectedTarget) {
      const tId = String(detectedTarget['__id']);
      this.targetRowId.set(tId);
      this.targetRowData.set(detectedTarget);
      this.excludedRowIds.update((s) => new Set(s).add(tId));
    } else {
      this.targetRowId.set('');
      this.targetRowData.set(null);
    }

    if (detectedTotal) {
      const totId = String(detectedTotal['__id']);
      this.totalRowId.set(totId);
      this.totalRowData.set(detectedTotal);
      this.excludedRowIds.update((s) => new Set(s).add(totId));
    } else {
      this.totalRowId.set('');
      this.totalRowData.set(null);
    }
  }

  executeWorkbookJoin(spec: JoinExecutionSpec): JoinedDatasetResult {
    const keyCol = spec.joinBy || 'Kabupaten/Kota';
    let resultRows: Record<string, unknown>[];
    let resultCols: string[];

    if (!spec.workbook || !spec.selectedSheets || spec.selectedSheets.length === 0) {
      resultRows = [];
      resultCols = [];
    } else if (spec.selectedSheets.length >= 2) {
      const joinRes = ExcelJoinEngine.executeJoin(spec);
      resultRows = joinRes.rows;
      resultCols = joinRes.columns;
    } else {
      const sh = spec.selectedSheets[0];
      const ws = spec.workbook.Sheets[sh.name];
      resultRows = ws ? ExcelEngine.readSheetRows(ws, sh.columns, sh.dataStartRow) : [];
      resultCols = sh.columns.map((c) => c.header);
    }

    // Build row records with __id
    const rowsWithId: Record<string, unknown>[] = resultRows.map((r, idx) => ({
      ...r,
      __id: r['__id'] ? String(r['__id']) : `row-${idx}`,
    }));

    // Find summary / target / total
    let summaryRow: Record<string, unknown> | null = null;
    let targetRow: Record<string, unknown> | null = null;
    let totalRow: Record<string, unknown> | null = null;

    for (const r of rowsWithId) {
      const keyStr = String(r[keyCol] ?? '').trim().toUpperCase();
      if (keyStr.includes('TARGET')) {
        if (!targetRow) targetRow = r;
      } else if (
        keyStr.includes('RATA') ||
        keyStr.includes('AVERAGE') ||
        keyStr.includes('JAWA TENGAH') ||
        keyStr.includes('PROVINSI') ||
        keyStr.startsWith('PROV')
      ) {
        if (!summaryRow) summaryRow = r;
      } else if (keyStr.includes('TOTAL') || keyStr.includes('JUMLAH')) {
        if (!totalRow) totalRow = r;
      }
    }

    if (!summaryRow && totalRow) {
      summaryRow = totalRow;
    }

    this.setJoinedDataset({
      rows: rowsWithId,
      columns: resultCols,
      keyCol,
      summaryRow,
      targetRow,
      totalRow,
    });

    return {
      rows: rowsWithId,
      columns: resultCols,
      keyCol,
      summaryRow,
      targetRow,
      totalRow,
    };
  }

  applyKeywordAndPatternExclusions(rowsToFilter?: Record<string, unknown>[]): void {
    const rows = rowsToFilter || this.joinedRows();
    const pKey = this.primaryKeyCol();
    const keywords = this.excludedRowKeywords()
      .split(',')
      .map((k) => k.trim().toUpperCase())
      .filter((k) => k.length > 0);

    const manual = this.manualExcludedKeys();
    const newExIds = new Set<string>();

    rows.forEach((r, idx) => {
      const id = String(r['__id'] ?? `row-${idx}`);
      const keyVal = String(r[pKey] ?? '').trim();

      // Check if blank or whitespace only
      if (!keyVal) {
        newExIds.add(id);
        return;
      }

      // Check manual exclusion keys
      if (manual.has(keyVal.toUpperCase())) {
        newExIds.add(id);
        return;
      }

      // Check keyword patterns in primary key column
      const upper = keyVal.toUpperCase();
      let isMatch = false;
      for (const kw of keywords) {
        if (upper.includes(kw)) {
          isMatch = true;
          break;
        }
      }

      // Check keyword patterns in any column of the row
      if (!isMatch) {
        for (const [col, val] of Object.entries(r)) {
          if (col === '__id') continue;
          const strVal = String(val ?? '')
            .trim()
            .toUpperCase();
          for (const kw of keywords) {
            if (strVal === kw || strVal.startsWith(kw + ' ') || strVal.endsWith(' ' + kw)) {
              isMatch = true;
              break;
            }
          }
          if (isMatch) break;
        }
      }

      if (isMatch) {
        newExIds.add(id);
      }
    });

    // Preserve summary/target/total exclusions
    if (this.summaryRowId()) newExIds.add(this.summaryRowId());
    if (this.targetRowId()) newExIds.add(this.targetRowId());
    if (this.totalRowId()) newExIds.add(this.totalRowId());

    this.excludedRowIds.set(newExIds);
  }

  toggleRowExclusion(rowId: string): void {
    const row = this.joinedRows().find((r) => String(r['__id']) === rowId);
    const rawKey = row
      ? String(row[this.primaryKeyCol()] ?? '')
          .trim()
          .toLowerCase()
      : '';

    this.excludedRowIds.update((set) => {
      const next = new Set(set);
      if (next.has(rowId)) {
        // Re-activate row
        next.delete(rowId);
        if (rawKey) {
          this.manualExcludedKeys.update((mSet) => {
            const mNext = new Set(mSet);
            mNext.delete(rawKey);
            return mNext;
          });
        }
      } else {
        // Deactivate row
        next.add(rowId);
        if (rawKey) {
          this.manualExcludedKeys.update((mSet) => {
            const mNext = new Set(mSet);
            mNext.add(rawKey);
            return mNext;
          });
        }
      }
      return next;
    });
  }

  setRowExclusion(rowId: string, exclude: boolean): void {
    this.excludedRowIds.update((set) => {
      const next = new Set(set);
      if (exclude) {
        next.add(rowId);
      } else {
        next.delete(rowId);
      }
      return next;
    });
  }

  setCalculationDataSource(source: 'summary_row' | 'all_rows'): void {
    this.calculationDataSource.set(source);
  }

  setSummaryRowId(id: string): void {
    this.summaryRowId.set(id);
    const row = this.joinedRows().find((r) => String(r['__id']) === id);
    this.summaryRowData.set(row || null);
    if (id) {
      this.excludedRowIds.update((s) => new Set(s).add(id));
    }
  }

  setTargetRowId(id: string): void {
    this.targetRowId.set(id);
    const row = this.joinedRows().find((r) => String(r['__id']) === id);
    this.targetRowData.set(row || null);
    if (id) {
      this.excludedRowIds.update((s) => new Set(s).add(id));
    }
  }

  setTotalRowId(id: string): void {
    this.totalRowId.set(id);
    const row = this.joinedRows().find((r) => String(r['__id']) === id);
    this.totalRowData.set(row || null);
    if (id) {
      this.excludedRowIds.update((s) => new Set(s).add(id));
    }
  }

  // ============================================================
  // STEP 2 METHODS: CATEGORY & INDICATOR BUILDER
  // ============================================================
  loadStandardCategories(): void {
    this.categories.set([
      {
        id: 'cat-1',
        name: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
        subCategories: [],
      },
      {
        id: 'cat-2',
        name: 'Intervensi untuk balita (setelah kelahiran)',
        subCategories: [],
      },
      {
        id: 'cat-3',
        name: 'Intervensi lintas siklus hidup',
        subCategories: [],
      },
    ]);
  }

  addCategory(name = ''): void {
    const id = `cat-${Date.now()}`;
    const newCatName = name.trim() || `Kategori Intervensi ${this.categories().length + 1}`;
    this.categories.update((cats) => [...cats, { id, name: newCatName, subCategories: [] }]);
  }

  removeCategory(catId: string): void {
    this.categories.update((cats) => cats.filter((c) => c.id !== catId));
  }

  updateCategoryName(catId: string, name: string): void {
    this.categories.update((cats) =>
      cats.map((c) => (c.id === catId ? { ...c, name: name.trim() } : c)),
    );
  }

  addSubCategory(catId: string, sub?: Partial<StuntingSubCategoryConfig>): void {
    const pKey = this.primaryKeyCol();
    const metricCols = this.joinedColumns().filter((c) => c !== pKey);
    const subId = sub?.id || `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const cat = this.categories().find((c) => c.id === catId);
    const existingCount = cat ? cat.subCategories.length : 0;
    const numCol = sub?.numeratorCol ?? (metricCols.length > 1 ? metricCols[1] : metricCols[0] || '');
    const prevCol = sub?.sumCol ?? (metricCols.length > 1 ? metricCols[0] : '');
    const summaryRow = this.summaryRowData();
    const targetRow = this.targetRowData();

    let rawTarget = targetRow && numCol ? targetRow[numCol] : null;
    const cleanedTarget = StuntingEvaluationEngine.cleanTargetValue(rawTarget);
    const isSummarySource = this.calculationDataSource() === 'summary_row';
    const directVal =
      sub?.actualValue !== undefined
        ? sub.actualValue
        : isSummarySource && summaryRow && numCol
          ? IndicatorEvaluator.parseSmartNumber(summaryRow[numCol])
          : null;
    const countVal =
      sub?.countValue !== undefined
        ? sub.countValue
        : isSummarySource && prevCol && summaryRow
          ? IndicatorEvaluator.parseSmartNumber(summaryRow[prevCol])
          : null;

    const actQ = this.activeQuarter();
    const newSub: StuntingSubCategoryConfig = {
      id: subId,
      no: sub?.no ?? String(existingCount + 1),
      name: sub?.name || numCol || 'Indikator Baru',
      sumCol: prevCol || undefined,
      meanCol: numCol || undefined,
      numeratorCol: numCol,
      dataCol: numCol,
      actualValue: directVal,
      countValue: countVal,
      calculationMode: sub?.calculationMode ?? 'percentage',
      targetCurrentYear:
        sub?.targetCurrentYear !== undefined
          ? sub.targetCurrentYear
          : cleanedTarget.value !== null
            ? cleanedTarget.value
            : null,
      prevYearMode: sub?.prevYearMode ?? 'manual',
      actualPrevYear: sub?.actualPrevYear ?? null,
      targetPrevYear: sub?.targetPrevYear ?? null,
      polarity:
        sub?.polarity ??
        (cleanedTarget.polarity !== 'positive' ? cleanedTarget.polarity : 'positive'),
      quarterColumns: sub?.quarterColumns ?? {
        [actQ]: {
          sumCol: prevCol || undefined,
          meanCol: numCol || undefined,
          numeratorCol: numCol || undefined,
          actualValue: directVal,
          countValue: countVal,
        },
      },
    };

    this.categories.update((cats) =>
      cats.map((c) => (c.id === catId ? { ...c, subCategories: [...c.subCategories, newSub] } : c)),
    );
  }

  removeSubCategory(catId: string, subId: string): void {
    this.categories.update((cats) =>
      cats.map((c) =>
        c.id === catId
          ? { ...c, subCategories: c.subCategories.filter((s) => s.id !== subId) }
          : c,
      ),
    );
  }

  updateSubCategory(
    catId: string,
    subId: string,
    updates: Partial<StuntingSubCategoryConfig>,
  ): void {
    this.categories.update((cats) =>
      cats.map((c) => {
        if (c.id !== catId) return c;
        return {
          ...c,
          subCategories: c.subCategories.map((s) => (s.id === subId ? { ...s, ...updates } : s)),
        };
      }),
    );
  }

  autoPopulateIndicators(): number {
    const cols = this.joinedColumns();
    const summaryRow = this.summaryRowData();
    const targetRow = this.targetRowData();
    const totalRow = this.totalRowData();
    const countSource = totalRow || summaryRow;

    const cat1Subs: StuntingSubCategoryConfig[] = [];
    const cat2Subs: StuntingSubCategoryConfig[] = [];
    const cat3Subs: StuntingSubCategoryConfig[] = [];

    const matchedMeanCols = new Set<string>();
    const matchedSumCols = new Set<string>();

    const normalizeStr = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

    const quarterSlots: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
    const detectedQuartersInCols = quarterSlots.filter((q) =>
      cols.some((c) => {
        const norm = normalizeStr(c);
        return (
          norm.includes(`(tw${q})`) ||
          norm.includes(`(tw ${q})`) ||
          norm.includes(`tw${q}`) ||
          norm.includes(`tw ${q}`)
        );
      }),
    );
    const hasQuarterSuffixes = detectedQuartersInCols.length > 0;

    // 1. First pass: Match Dinkes Standard Indicators
    for (const std of StuntingEvaluationEngine.DINKES_STANDARD_INDICATORS) {
      const quarterColumns: Record<1 | 2 | 3 | 4, StuntingQuarterInputConfig> = {} as any;
      let foundTarget: number | null = null;
      let detectedPolarity: IndicatorPolarity | undefined;
      let latestSumCol: string | undefined;
      let latestMeanCol: string | undefined;
      let latestDirectVal: number | null = null;
      let latestCountVal: number | null = null;

      if (hasQuarterSuffixes) {
        for (const q of quarterSlots) {
          let qMeanCol: string | undefined;
          let qSumCol: string | undefined;

          for (const kw of std.meanKeywords) {
            const normKw = normalizeStr(kw);
            const exactMatch = cols.find((c) => {
              const norm = normalizeStr(c);
              return norm === `${normKw} (tw${q})` || norm === `${normKw} (tw ${q})`;
            });
            if (exactMatch) {
              qMeanCol = exactMatch;
              break;
            }
            const containsMatch = cols.find((c) => {
              const norm = normalizeStr(c);
              return (
                norm.includes(normKw) &&
                (norm.includes(`(tw${q})`) ||
                  norm.includes(`(tw ${q})`) ||
                  norm.includes(`tw${q}`) ||
                  norm.includes(`tw ${q}`))
              );
            });
            if (containsMatch) {
              qMeanCol = containsMatch;
              break;
            }
          }

          for (const kw of std.sumKeywords) {
            const normKw = normalizeStr(kw);
            const exactMatch = cols.find((c) => {
              const norm = normalizeStr(c);
              return norm === `${normKw} (tw${q})` || norm === `${normKw} (tw ${q})`;
            });
            if (exactMatch) {
              qSumCol = exactMatch;
              break;
            }
            const containsMatch = cols.find((c) => {
              const norm = normalizeStr(c);
              return (
                norm.includes(normKw) &&
                (norm.includes(`(tw${q})`) ||
                  norm.includes(`(tw ${q})`) ||
                  norm.includes(`tw${q}`) ||
                  norm.includes(`tw ${q}`))
              );
            });
            if (containsMatch) {
              qSumCol = containsMatch;
              break;
            }
          }

          if (qMeanCol || qSumCol) {
            const effMean = qMeanCol || qSumCol!;
            if (qMeanCol) matchedMeanCols.add(qMeanCol);
            if (qSumCol) matchedSumCols.add(qSumCol);

            const directVal = summaryRow
              ? IndicatorEvaluator.parseSmartNumber(summaryRow[effMean])
              : null;
            const countVal =
              qSumCol && countSource
                ? IndicatorEvaluator.parseSmartNumber(countSource[qSumCol])
                : null;

            if (foundTarget === null && targetRow) {
              const rawTarget = targetRow[effMean] ?? (qSumCol ? targetRow[qSumCol] : null);
              if (
                rawTarget !== null &&
                rawTarget !== undefined &&
                String(rawTarget).trim() !== '' &&
                String(rawTarget).trim() !== '-'
              ) {
                const cleaned = StuntingEvaluationEngine.cleanTargetValue(rawTarget);
                if (cleaned.value !== null) {
                  foundTarget = cleaned.value;
                  detectedPolarity = cleaned.polarity;
                }
              }
            }

            quarterColumns[q] = {
              meanCol: qMeanCol,
              sumCol: qSumCol,
              numeratorCol: effMean,
              actualValue: directVal,
              countValue: countVal,
            };

            latestMeanCol = qMeanCol;
            latestSumCol = qSumCol;
            latestDirectVal = directVal;
            latestCountVal = countVal;
          }
        }
      }

      if (!hasQuarterSuffixes || Object.keys(quarterColumns).length === 0) {
        for (const kw of std.sumKeywords) {
          const normKw = normalizeStr(kw);
          const found =
            cols.find((c) => normalizeStr(c) === normKw) ||
            cols.find((c) => normalizeStr(c).includes(normKw));
          if (found) {
            latestSumCol = found;
            break;
          }
        }

        for (const kw of std.meanKeywords) {
          const normKw = normalizeStr(kw);
          const found =
            cols.find((c) => normalizeStr(c) === normKw) ||
            cols.find((c) => normalizeStr(c).includes(normKw));
          if (found) {
            latestMeanCol = found;
            break;
          }
        }

        if (latestSumCol || latestMeanCol) {
          const effMean = latestMeanCol || latestSumCol!;
          if (latestMeanCol) matchedMeanCols.add(latestMeanCol);
          if (latestSumCol) matchedSumCols.add(latestSumCol);

          latestDirectVal = summaryRow
            ? IndicatorEvaluator.parseSmartNumber(summaryRow[effMean])
            : null;
          latestCountVal =
            latestSumCol && countSource
              ? IndicatorEvaluator.parseSmartNumber(countSource[latestSumCol])
              : null;

          if (targetRow) {
            const rawTarget = targetRow[effMean] ?? (latestSumCol ? targetRow[latestSumCol] : null);
            if (
              rawTarget !== null &&
              rawTarget !== undefined &&
              String(rawTarget).trim() !== '' &&
              String(rawTarget).trim() !== '-'
            ) {
              const cleaned = StuntingEvaluationEngine.cleanTargetValue(rawTarget);
              if (cleaned.value !== null) {
                foundTarget = cleaned.value;
                detectedPolarity = cleaned.polarity;
              }
            }
          }

          const actQ = this.activeQuarter();
          quarterColumns[actQ] = {
            meanCol: latestMeanCol,
            sumCol: latestSumCol,
            numeratorCol: effMean,
            actualValue: latestDirectVal,
            countValue: latestCountVal,
          };
        }
      }

      if (Object.keys(quarterColumns).length > 0) {
        const effMean = latestMeanCol || latestSumCol || '';
        const defaultTgt =
          typeof std.defaultTargetCurrent === 'number' ? std.defaultTargetCurrent : null;
        const targetVal = foundTarget !== null ? foundTarget : defaultTgt;

        const subConfig: StuntingSubCategoryConfig = {
          id: `sub-std-${std.no}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          no: std.no,
          name: std.name,
          sumCol: latestSumCol,
          meanCol: latestMeanCol,
          numeratorCol: effMean,
          dataCol: effMean,
          actualValue: latestDirectVal,
          countValue: latestCountVal,
          quarterColumns,
          calculationMode: 'percentage',
          targetCurrentYear: targetVal,
          prevYearMode: 'manual',
          actualPrevYear: std.defaultActualPrev ?? null,
          targetPrevYear: std.defaultTargetPrev ?? null,
          polarity:
            detectedPolarity && detectedPolarity !== 'positive' ? detectedPolarity : std.polarity,
        };

        if (std.canonicalCategory === 'sebelum_kelahiran') {
          cat1Subs.push(subConfig);
        } else if (std.canonicalCategory === 'setelah_kelahiran') {
          cat2Subs.push(subConfig);
        } else {
          cat3Subs.push(subConfig);
        }
      }
    }

    // 2. Second pass: Other percentage or coverage columns
    const processedBaseCols = new Set<string>();
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const lowerCol = col.toLowerCase();

      if (matchedMeanCols.has(col) || matchedSumCols.has(col)) {
        continue;
      }

      if (!col.includes('%') && !lowerCol.includes('persen') && !lowerCol.includes('cakupan')) {
        continue;
      }

      const baseCol = col.replace(/\s*\(tw[1-4]\)\s*$/i, '').trim();
      const normBase = normalizeStr(baseCol);
      if (processedBaseCols.has(normBase)) {
        continue;
      }
      processedBaseCols.add(normBase);

      const quarterColumns: Record<1 | 2 | 3 | 4, StuntingQuarterInputConfig> = {} as any;
      let lastMeanCol: string = col;
      let lastSumCol: string | undefined;
      let lastDirectVal: number | null = null;
      let lastCountVal: number | null = null;
      let foundTarget: number | null = null;
      let polarity: IndicatorPolarity = 'positive';
      if (
        normBase.includes('anemia') ||
        normBase.includes('kek') ||
        normBase.includes('gibur') ||
        normBase.includes('kurang')
      ) {
        polarity = 'negative';
      }

      if (hasQuarterSuffixes) {
        for (const q of quarterSlots) {
          const qCol = cols.find((c) => {
            const n = normalizeStr(c);
            return (
              n.includes(normBase) &&
              (n.includes(`(tw${q})`) ||
                n.includes(`(tw ${q})`) ||
                n.includes(`tw${q}`) ||
                n.includes(`tw ${q}`))
            );
          });
          if (qCol) {
            matchedMeanCols.add(qCol);
            const qColIdx = cols.indexOf(qCol);
            const prevCol =
              qColIdx > 0 && !matchedMeanCols.has(cols[qColIdx - 1])
                ? cols[qColIdx - 1]
                : undefined;
            if (prevCol) matchedSumCols.add(prevCol);

            const directVal = summaryRow
              ? IndicatorEvaluator.parseSmartNumber(summaryRow[qCol])
              : null;
            const countVal =
              prevCol && countSource
                ? IndicatorEvaluator.parseSmartNumber(countSource[prevCol])
                : null;

            if (foundTarget === null && targetRow) {
              const rawTgt = targetRow[qCol] ?? (prevCol ? targetRow[prevCol] : null);
              if (
                rawTgt !== null &&
                rawTgt !== undefined &&
                String(rawTgt).trim() !== '' &&
                String(rawTgt).trim() !== '-'
              ) {
                const cleaned = StuntingEvaluationEngine.cleanTargetValue(rawTgt);
                if (cleaned.value !== null) {
                  foundTarget = cleaned.value;
                  if (cleaned.polarity !== 'positive') polarity = cleaned.polarity;
                }
              }
            }

            quarterColumns[q] = {
              meanCol: qCol,
              sumCol: prevCol,
              numeratorCol: qCol,
              actualValue: directVal,
              countValue: countVal,
            };
            lastMeanCol = qCol;
            lastSumCol = prevCol;
            lastDirectVal = directVal;
            lastCountVal = countVal;
          }
        }
      }

      if (!hasQuarterSuffixes || Object.keys(quarterColumns).length === 0) {
        const prevCol = i > 0 && !matchedMeanCols.has(cols[i - 1]) ? cols[i - 1] : undefined;
        matchedMeanCols.add(col);
        if (prevCol) matchedSumCols.add(prevCol);

        const directVal = summaryRow ? IndicatorEvaluator.parseSmartNumber(summaryRow[col]) : null;
        const countVal =
          prevCol && countSource ? IndicatorEvaluator.parseSmartNumber(countSource[prevCol]) : null;

        if (targetRow) {
          const rawTgt = targetRow[col] ?? (prevCol ? targetRow[prevCol] : null);
          if (
            rawTgt !== null &&
            rawTgt !== undefined &&
            String(rawTgt).trim() !== '' &&
            String(rawTgt).trim() !== '-'
          ) {
            const cleaned = StuntingEvaluationEngine.cleanTargetValue(rawTgt);
            if (cleaned.value !== null) {
              foundTarget = cleaned.value;
              if (cleaned.polarity !== 'positive') polarity = cleaned.polarity;
            }
          }
        }

        const actQ = this.activeQuarter();
        quarterColumns[actQ] = {
          meanCol: col,
          sumCol: prevCol,
          numeratorCol: col,
          actualValue: directVal,
          countValue: countVal,
        };
        lastMeanCol = col;
        lastSumCol = prevCol;
        lastDirectVal = directVal;
        lastCountVal = countVal;
      }

      if (Object.keys(quarterColumns).length > 0) {
        const subId = `sub-auto-${i}-${Date.now()}`;
        const subConfig: StuntingSubCategoryConfig = {
          id: subId,
          no: String(cat1Subs.length + cat2Subs.length + cat3Subs.length + 1),
          name: baseCol || lastMeanCol,
          sumCol: lastSumCol,
          meanCol: lastMeanCol,
          numeratorCol: lastMeanCol,
          dataCol: lastMeanCol,
          actualValue: lastDirectVal,
          countValue: lastCountVal,
          quarterColumns,
          calculationMode: 'percentage',
          targetCurrentYear: foundTarget,
          prevYearMode: 'manual',
          actualPrevYear: null,
          targetPrevYear: null,
          polarity,
        };

        const countColLower = lastSumCol ? lastSumCol.toLowerCase() : '';
        const isCat1 =
          normBase.includes('rematri') ||
          normBase.includes('remaja') ||
          normBase.includes('bumil') ||
          normBase.includes('hamil') ||
          normBase.includes('anc') ||
          normBase.includes('ttd') ||
          normBase.includes('kek') ||
          countColLower.includes('rematri') ||
          countColLower.includes('bumil') ||
          countColLower.includes('hamil');

        const isCat2 =
          normBase.includes('balita') ||
          normBase.includes('baduta') ||
          normBase.includes('bayi') ||
          normBase.includes('d/s') ||
          normBase.includes('tumbang') ||
          normBase.includes('pertumbuhan') ||
          normBase.includes('perkembangan') ||
          normBase.includes('asi') ||
          normBase.includes('mpasi') ||
          normBase.includes('gizi') ||
          normBase.includes('bb') ||
          normBase.includes('gibur') ||
          normBase.includes('idl') ||
          normBase.includes('mt') ||
          countColLower.includes('balita') ||
          countColLower.includes('baduta');

        if (isCat1) {
          cat1Subs.push(subConfig);
        } else if (isCat2) {
          cat2Subs.push(subConfig);
        } else {
          cat3Subs.push(subConfig);
        }
      }
    }

    // 3. Fallback: If no columns mapped, scaffold official structure
    if (cat1Subs.length === 0 && cat2Subs.length === 0 && cat3Subs.length === 0) {
      for (const std of StuntingEvaluationEngine.DINKES_STANDARD_INDICATORS) {
        const defaultTgt =
          typeof std.defaultTargetCurrent === 'number' ? std.defaultTargetCurrent : null;
        const subConfig: StuntingSubCategoryConfig = {
          id: `sub-std-${std.no}-${Date.now()}`,
          no: std.no,
          name: std.name,
          numeratorCol: '',
          dataCol: '',
          actualValue: null,
          countValue: null,
          calculationMode: 'percentage',
          targetCurrentYear: defaultTgt,
          prevYearMode: 'manual',
          actualPrevYear: std.defaultActualPrev ?? null,
          targetPrevYear: std.defaultTargetPrev ?? null,
          polarity: std.polarity,
        };
        if (std.canonicalCategory === 'sebelum_kelahiran') {
          cat1Subs.push(subConfig);
        } else if (std.canonicalCategory === 'setelah_kelahiran') {
          cat2Subs.push(subConfig);
        } else {
          cat3Subs.push(subConfig);
        }
      }
    }

    const totalPopulated = cat1Subs.length + cat2Subs.length + cat3Subs.length;

    this.categories.set([
      {
        id: 'cat-1',
        name: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
        subCategories: cat1Subs,
      },
      {
        id: 'cat-2',
        name: 'Intervensi untuk balita (setelah kelahiran)',
        subCategories: cat2Subs,
      },
      {
        id: 'cat-3',
        name: 'Intervensi lintas siklus hidup',
        subCategories: cat3Subs,
      },
    ]);

    return totalPopulated;
  }

  calculateQuarterActual(
    sub: StuntingSubCategoryConfig,
    quarter: 1 | 2 | 3 | 4,
    rows: Record<string, unknown>[],
  ): { sumNum: number | null; sumDen: number | null; actualPercentage: number | null } {
    const qConfig = sub.quarterColumns?.[quarter];
    const numCol = qConfig?.numeratorCol || sub.numeratorCol;
    const meanCol = qConfig?.meanCol || sub.meanCol;
    const sumCol = qConfig?.sumCol || sub.sumCol;

    const directActualVal =
      qConfig?.actualValue !== undefined
        ? qConfig.actualValue
        : quarter === this.activeQuarter()
          ? sub.actualValue
          : undefined;
    const directCountVal =
      qConfig?.countValue !== undefined
        ? qConfig.countValue
        : quarter === this.activeQuarter()
          ? sub.countValue
          : undefined;

    if (!sumCol && !meanCol && !numCol && directActualVal === null && directCountVal === null) {
      return { sumNum: null, sumDen: null, actualPercentage: null };
    }

    const denCol = qConfig?.denominatorCol || sub.denominatorCol;

    let sumNum: number | null = null;
    let sumDen: number | null = null;
    let actualPercentage: number | null = null;

    const isSummaryMode = this.calculationDataSource() === 'summary_row' || rows.length <= 1;
    if (isSummaryMode && directActualVal !== undefined && directActualVal !== null) {
      actualPercentage = directActualVal;
      sumNum = directCountVal ?? null;
    } else {
      const targetSumCol = denCol
        ? numCol || sumCol
        : sumCol || (sub.calculationMode === 'absolute' ? meanCol || numCol : undefined);
      if (targetSumCol && rows.length > 0) {
        if (rows.length === 1) {
          sumNum = IndicatorEvaluator.parseSmartNumber(rows[0][targetSumCol]);
        } else {
          sumNum = StuntingEvaluationEngine.sumColumnValues(rows, targetSumCol);
        }
      }
      if (sumNum === null && directCountVal !== undefined && directCountVal !== null) {
        sumNum = directCountVal;
      }

      if (denCol && rows.length > 0) {
        sumDen = StuntingEvaluationEngine.sumColumnValues(rows, denCol);
        if (sumDen && sumDen > 0 && sumNum !== null) {
          actualPercentage = Math.round((sumNum / sumDen) * 10000) / 100;
        }
      }

      if (actualPercentage === null) {
        const targetMeanCol = meanCol || (!denCol ? numCol : undefined);
        if (rows.length === 1 && targetMeanCol) {
          const directVal = IndicatorEvaluator.parseSmartNumber(rows[0][targetMeanCol]);
          actualPercentage = directVal;
          if (sumNum === null) {
            sumNum =
              directCountVal ??
              (typeof directVal === 'number' && directVal > 100 ? directVal : null);
          }
        } else if (rows.length > 0) {
          if (targetMeanCol && sub.calculationMode !== 'absolute') {
            actualPercentage = StuntingEvaluationEngine.averageColumnValues(rows, targetMeanCol);
          } else if (targetSumCol && sub.calculationMode === 'absolute') {
            actualPercentage = sumNum;
          }
        }
      }
    }

    return { sumNum, sumDen, actualPercentage };
  }

  // ============================================================
  // STEP 3 SETTERS
  // ============================================================
  setManualActiveQuarter(quarter: 1 | 2 | 3 | 4 | null): void {
    this.manualActiveQuarter.set(quarter);
  }

  setToleranceThreshold(val: number): void {
    this.toleranceThreshold.set(val);
  }

  setQuarterWeight(val: number | null): void {
    this.quarterWeight.set(val);
  }

  reset(): void {
    this.activeStep.set(1);
    this.joinedRows.set([]);
    this.joinedColumns.set([]);
    this.excludedRowIds.set(new Set());
    this.manualExcludedKeys.set(new Set());
    this.summaryRowId.set('');
    this.targetRowId.set('');
    this.totalRowId.set('');
    this.summaryRowData.set(null);
    this.targetRowData.set(null);
    this.totalRowData.set(null);
    this.calculationDataSource.set('all_rows');
    this.manualActiveQuarter.set(null);
    this.toleranceThreshold.set(-5.0);
    this.quarterWeight.set(null);
    this.loadStandardCategories();
  }
}
