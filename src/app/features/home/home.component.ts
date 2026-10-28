import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CENTRAL_JAVA_DISTRICTS,
  DistrictMapFeature,
  MAIN_MAP_VIEWBOX,
  NEIGHBOR_PROVINCES,
} from '../../core/stunting-dashboard/stunting-map-data';
import {
  DistrictHeatmapEngine,
  DistrictHeatmapItem,
  DistrictHeatmapResult,
} from '../../core/chart/district-heatmap-engine';
import {
  ChartBarItem,
  ChartDataRow,
  ChartSeriesConfig,
} from '../../core/chart/chart-layout-engine';
import {
  ChartSlicingEngine,
  IndicatorChartGroup,
} from '../../core/chart/chart-slicing-engine';
import { IndicatorStuntingKnowledge } from '../../core/chart/indicator-stunting-knowledge';
import { HealthDataExchange } from '../../core/domain/health-data-exchange';
import { StuntingWorkflowEngine } from '../../core/stunting/stunting-workflow-engine';
import { PeriodPartitionWorkspace } from '../../core/storage/period-partition-workspace';
import {
  DISTRICT_PREV_YEAR_OUTCOMES,
  GIZI_METRIC_BOXES,
  HomeIndicatorOption,
  HomeMetricBox,
  INTERVENSI_METRIC_BOXES,
  INTERVENTION_OUTCOMES_DATA,
  InterventionOutcomeItem,
  NUTRITION_PROBLEM_INDICATORS,
  NUTRITION_PROBLEMS_DATA,
  OutcomeQuarterData,
  SPECIFIC_INTERVENTION_INDICATORS,
  SPECIFIC_INTERVENTIONS_DATA,
} from './home-data';

export interface LoadedQuarterDinkesData {
  regionRows: Record<string, unknown>[];
  summaryRow: Record<string, unknown> | null;
  totalRow: Record<string, unknown> | null;
  targetRow?: Record<string, unknown> | null;
}

const OUTCOME_INDICATOR_COLUMN_MAP: Record<
  string,
  { pCol: string; cCol?: string; target: number }
> = {
  '1': { pCol: '% Skrining Anemia', cCol: 'Rematri Skrining Anemia', target: 77 },
  '2': { pCol: '% Konsumsi TTD', cCol: 'Rematri Konsumsi TTD', target: 67 },
  '3': { pCol: '% ANC 6x', cCol: 'Ibu Hamil ANC 6x', target: 60 },
  '4': { pCol: '% TTD/MMS', cCol: 'Ibu Hamil Konsumsi TTD/MMS', target: 39 },
  '5': { pCol: '% Bumil PMT', cCol: 'Ibu Hamil KEK Konsumsi MT', target: 85 },
  '6a': { pCol: '% D/S', cCol: 'Balita dipantau Pertumbuhan (D/S)', target: 90 },
  '6b': { pCol: '% Tumbang', cCol: 'Jumlah Balita dipantau Tumbang', target: 55 },
  '7': { pCol: '% ASI', cCol: 'ASI Eksklusif', target: 76 },
  '8': { pCol: '% MPASI', cCol: 'MPASI', target: 76 },
  '9a': { pCol: '% BB Tidak Naik (T) dapat MT', cCol: 'Jumlah BB Tidak Naik (T) dapat MT', target: 70 },
  '9b': { pCol: '% BB Kurang dapat MT', cCol: 'Jumlah BB Kurang dapat MT', target: 70 },
  '9c': { pCol: '% Gizi Kurang dapat MT', cCol: 'Jumlah Gizi Kurang dapat MT', target: 70 },
  '9d': { pCol: '% Talak Gibur', cCol: 'Jumlah Kasus Gizi Buruk Mendapat Tata Laksana', target: 92 },
  '10': { pCol: '% IDL', cCol: 'Baduta IDL', target: 56.25 },
  '11': { pCol: '', target: 100 },
};

export type HomeCategory =
  | 'intervensi-heatmap'
  | 'gizi-heatmap'
  | 'intervensi-outcomes';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class HomeComponent implements OnInit {
  private readonly healthDataExchange = inject(HealthDataExchange);
  private readonly workflowEngine = inject(StuntingWorkflowEngine, { optional: true });
  private readonly periodPartitionWorkspace = inject(PeriodPartitionWorkspace, { optional: true });
  readonly Math = Math;

  // Active Category controlled by the bottom oval navigation buttons
  readonly activeCategory = signal<HomeCategory>('intervensi-heatmap');

  // Sub-display modes for heatmap categories: 'map' | 'table'
  readonly intervensiViewMode = signal<'map' | 'table'>('map');
  readonly giziViewMode = signal<'map' | 'table'>('map');

  // SVG Map Geometry
  readonly centralJavaDistricts = CENTRAL_JAVA_DISTRICTS;
  readonly neighborProvinces = NEIGHBOR_PROVINCES;
  readonly mapViewBox = MAIN_MAP_VIEWBOX;

  // Selected & Hovered District for Map Inspector & Rankings
  readonly hoveredDistrictId = signal<string | null>(null);
  readonly selectedDistrictId = signal<string | null>(null);
  readonly hoveredMapDistrict = signal<DistrictHeatmapItem | null>(null);
  readonly selectedMapDistrict = signal<DistrictHeatmapItem | null>(null);
  readonly showMapRankings = signal<boolean>(false);
  readonly mapRankingsFilter = signal<'all' | 'top5' | 'bottom5'>('all');

  // -------------------------------------------------------------
  // CATEGORY 1: HEATMAP INTERVENSI SPESIFIK
  // -------------------------------------------------------------
  // Overview Information Boxes for Ratio 1 Column
  readonly intervensiBoxes = computed<HomeMetricBox[]>(() => {
    const loadedMap = this.loadedQuarterDatasets();
    const availableQNums = ([4, 3, 2, 1] as const).filter((q) => loadedMap[q]);
    if (availableQNums.length === 0) {
      return INTERVENSI_METRIC_BOXES;
    }
    const latestQ = availableQNums[0];
    return this.buildIntervensiBoxes(loadedMap[latestQ]);
  });
  readonly intervensiBoxFilter = signal<string>('all');

  readonly filteredIntervensiBoxes = computed<HomeMetricBox[]>(() => {
    const filter = this.intervensiBoxFilter();
    const boxes = this.intervensiBoxes();
    if (filter === 'all') return boxes;
    return boxes.filter((b) => b.category === filter);
  });

  readonly intervensiIndicators = SPECIFIC_INTERVENTION_INDICATORS;
  readonly activeIntervensiIndicatorKey = signal<string>('% Konsumsi TTD');
  readonly intervensiTableSearch = signal<string>('');

  readonly activeIntervensiIndicator = computed<HomeIndicatorOption>(() => {
    const key = this.activeIntervensiIndicatorKey();
    return (
      this.intervensiIndicators.find((i) => i.key === key) ||
      this.intervensiIndicators[0]
    );
  });

  // Base rows for Specific Interventions (fallbacks to preloaded data, or uses transferred data if available)
  readonly intervensiRows = signal<Record<string, unknown>[]>(
    SPECIFIC_INTERVENTIONS_DATA,
  );

  getResolvedIntervensiTarget(indicatorKey: string, fallbackTarget: number): number {
    // 1. Check latest loaded quarter targetRow
    const loadedMap = this.loadedQuarterDatasets();
    const availableQNums = ([4, 3, 2, 1] as const).filter((q) => loadedMap[q]);
    if (availableQNums.length > 0) {
      const latestQ = availableQNums[0];
      const targetRow = loadedMap[latestQ]?.targetRow;
      if (targetRow) {
        const val = this.extractValueFromRow(targetRow, indicatorKey);
        if (val !== null && val > 0) return val;
      }
    }

    // 2. Check HealthDataExchange chartData indicatorTargets or global targetValue
    const transferred = this.healthDataExchange.chartData();
    if (transferred) {
      if (transferred.indicatorTargets && transferred.indicatorTargets[indicatorKey] !== undefined) {
        const t = transferred.indicatorTargets[indicatorKey];
        if (t !== null && t !== undefined && t > 0) return t;
      }
      if (transferred.targetValue && transferred.targetValue > 0) {
        return transferred.targetValue;
      }
    }

    // 3. Check OUTCOME_INDICATOR_COLUMN_MAP for standard Dinkes current-year targets
    for (const mapping of Object.values(OUTCOME_INDICATOR_COLUMN_MAP)) {
      if (mapping.pCol === indicatorKey && mapping.target) {
        return mapping.target;
      }
    }

    // 4. Fallback
    return fallbackTarget;
  }

  readonly intervensiHeatmapResult = computed<DistrictHeatmapResult | null>(() => {
    const indicator = this.activeIntervensiIndicator();
    const rows = this.intervensiRows();
    if (!indicator || rows.length === 0) return null;

    const dynamicTarget = this.getResolvedIntervensiTarget(indicator.key, indicator.target);

    return DistrictHeatmapEngine.computeHeatmap({
      districts: this.centralJavaDistricts,
      rows,
      categoryColumn: 'Kabupaten/Kota',
      series: {
        key: indicator.key,
        label: indicator.label,
        color: '#525AFF',
      },
      targetValue: dynamicTarget,
      targetOperator: indicator.operator,
      paletteId: 'red-yellow-green',
    });
  });

  readonly intervensiInspectorItem = computed<DistrictHeatmapItem | null>(() => {
    const res = this.intervensiHeatmapResult();
    if (!res || res.items.length === 0) return null;
    const targetId =
      this.hoveredMapDistrict()?.district.id ||
      this.selectedMapDistrict()?.district.id ||
      this.hoveredDistrictId() ||
      this.selectedDistrictId() ||
      res.items[0]?.district.id;
    return res.items.find((it) => it.district.id === targetId) || res.items[0];
  });

  readonly intervensiClinicalKnowledge = computed(() => {
    const ind = this.activeIntervensiIndicator();
    if (!ind) return null;
    return IndicatorStuntingKnowledge.getExplanation(ind.label);
  });

  // Filtered Table Rows for Specific Interventions
  readonly filteredIntervensiTableRows = computed(() => {
    const q = this.intervensiTableSearch().toLowerCase().trim();
    const rows = this.intervensiRows();
    if (!q) return rows;
    return rows.filter((r) =>
      String(r['Kabupaten/Kota'] || '')
        .toLowerCase()
        .includes(q),
    );
  });

  // -------------------------------------------------------------
  // PER INDIKATOR BAR CHARTS (VISUALISASI MODULE REPLACEMENT)
  // -------------------------------------------------------------
  readonly intervensiSortMode = signal<'desc' | 'asc' | 'default'>('desc');

  readonly intervensiCategories = computed(() => {
    const rows = this.intervensiRows();
    return rows
      .map((r) => String(r['Kabupaten/Kota'] || '').trim())
      .filter(Boolean);
  });

  readonly intervensiChartSeries = computed<ChartSeriesConfig[]>(() => {
    const colors = [
      '#525AFF',
      '#0EA5E9',
      '#10B981',
      '#8B5CF6',
      '#F59E0B',
      '#EC4899',
      '#06B6D4',
      '#14B8A6',
      '#84CC16',
      '#F97316',
      '#EF4444',
      '#6366F1',
      '#D946EF',
      '#3B82F6',
    ];
    return this.intervensiIndicators.map((ind, i) => ({
      key: ind.key,
      label: ind.label,
      color: colors[i % colors.length],
    }));
  });

  readonly intervensiIndicatorGroups = computed<IndicatorChartGroup[]>(() => {
    const series = this.intervensiChartSeries();
    const rows = this.intervensiRows() as ChartDataRow[];
    const categories = this.intervensiCategories();
    const sortMode = this.intervensiSortMode();

    const indicatorTargets: Record<string, number | null> = {};
    const indicatorTargetOperators: Record<string, string> = {};
    for (const ind of this.intervensiIndicators) {
      indicatorTargets[ind.key] = this.getResolvedIntervensiTarget(ind.key, ind.target);
      indicatorTargetOperators[ind.key] = ind.operator;
    }

    return ChartSlicingEngine.computeIndicatorGroups({
      categories,
      series,
      rows,
      categoryColumn: 'Kabupaten/Kota',
      sortMode,
      indicatorTargets,
      indicatorTargetOperators,
      width: 780,
      rowHeight: 22,
      gapWidth: 5,
    });
  });

  readonly filteredIntervensiIndicatorGroups = computed<IndicatorChartGroup[]>(() => {
    const all = this.intervensiIndicatorGroups();
    const key = this.activeIntervensiIndicatorKey();
    if (key === 'all') return all;
    const filtered = all.filter((g) => g.series.key === key);
    return filtered.length > 0 ? filtered : all;
  });

  // Tooltip & Export State for Bar Charts
  readonly hoveredBar = signal<{
    categoryName: string;
    seriesLabel: string;
    color: string;
    displayLabel: string;
    numericVal: number | null;
    isZero: boolean;
    isMissing: boolean;
    status: 'achieved' | 'unachieved' | 'none';
    diff: number | null;
    targetValue: number | null;
  } | null>(null);

  readonly tooltipPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  // -------------------------------------------------------------
  // CATEGORY 2: HEATMAP MASALAH GIZI
  // -------------------------------------------------------------
  // Overview Information Boxes for Ratio 1 Column
  readonly giziBoxes = signal<HomeMetricBox[]>(GIZI_METRIC_BOXES);
  readonly giziBoxFilter = signal<string>('all');

  readonly filteredGiziBoxes = computed<HomeMetricBox[]>(() => {
    const filter = this.giziBoxFilter();
    const boxes = this.giziBoxes();
    if (filter === 'all') return boxes;
    return boxes.filter((b) => b.category === filter);
  });

  readonly giziIndicators = NUTRITION_PROBLEM_INDICATORS;
  readonly activeGiziIndicatorKey = signal<string>('Stunting - %');
  readonly giziTableSearch = signal<string>('');

  readonly activeGiziIndicator = computed<HomeIndicatorOption>(() => {
    const key = this.activeGiziIndicatorKey();
    return (
      this.giziIndicators.find((i) => i.key === key) || this.giziIndicators[0]
    );
  });

  readonly giziRows = signal<Record<string, unknown>[]>(NUTRITION_PROBLEMS_DATA);

  readonly giziHeatmapResult = computed<DistrictHeatmapResult | null>(() => {
    const indicator = this.activeGiziIndicator();
    const rows = this.giziRows();
    if (!indicator || rows.length === 0) return null;

    return DistrictHeatmapEngine.computeHeatmap({
      districts: this.centralJavaDistricts,
      rows,
      categoryColumn: 'Kabupaten/Kota',
      series: {
        key: indicator.key,
        label: indicator.label,
        color: '#E11D48',
      },
      targetValue: indicator.target,
      targetOperator: '<=',
      paletteId: 'red-yellow-green',
    });
  });

  readonly giziInspectorItem = computed<DistrictHeatmapItem | null>(() => {
    const res = this.giziHeatmapResult();
    if (!res || res.items.length === 0) return null;
    const targetId =
      this.hoveredMapDistrict()?.district.id ||
      this.selectedMapDistrict()?.district.id ||
      this.hoveredDistrictId() ||
      this.selectedDistrictId() ||
      res.items[0]?.district.id;
    return res.items.find((it) => it.district.id === targetId) || res.items[0];
  });

  readonly filteredGiziTableRows = computed(() => {
    const q = this.giziTableSearch().toLowerCase().trim();
    const rows = this.giziRows();
    if (!q) return rows;
    return rows.filter((r) =>
      String(r['Kabupaten/Kota'] || '')
        .toLowerCase()
        .includes(q),
    );
  });

  // -------------------------------------------------------------
  // PER INDIKATOR BAR CHARTS (GIZI REPLACEMENT)
  // -------------------------------------------------------------
  readonly giziSortMode = signal<'desc' | 'asc' | 'default'>('desc');

  readonly giziCategories = computed(() => {
    const rows = this.giziRows();
    return rows
      .map((r) => String(r['Kabupaten/Kota'] || '').trim())
      .filter(Boolean);
  });

  readonly giziChartSeries = computed<ChartSeriesConfig[]>(() => {
    const colors = [
      '#E11D48',
      '#F43F5E',
      '#EA580C',
      '#D97706',
      '#DC2626',
      '#B91C1C',
      '#991B1B',
      '#C026D3',
      '#BE185D',
    ];
    return this.giziIndicators.map((ind, i) => ({
      key: ind.key,
      label: ind.label,
      color: colors[i % colors.length],
    }));
  });

  readonly giziIndicatorGroups = computed<IndicatorChartGroup[]>(() => {
    const series = this.giziChartSeries();
    const rows = this.giziRows() as ChartDataRow[];
    const categories = this.giziCategories();
    const sortMode = this.giziSortMode();

    const indicatorTargets: Record<string, number | null> = {};
    const indicatorTargetOperators: Record<string, string> = {};
    for (const ind of this.giziIndicators) {
      indicatorTargets[ind.key] = ind.target;
      indicatorTargetOperators[ind.key] = ind.operator || '<=';
    }

    return ChartSlicingEngine.computeIndicatorGroups({
      categories,
      series,
      rows,
      categoryColumn: 'Kabupaten/Kota',
      sortMode,
      targetOperator: '<=',
      indicatorTargets,
      indicatorTargetOperators,
      width: 780,
      rowHeight: 22,
      gapWidth: 5,
    });
  });

  readonly filteredGiziIndicatorGroups = computed<IndicatorChartGroup[]>(() => {
    const all = this.giziIndicatorGroups();
    const key = this.activeGiziIndicatorKey();
    if (key === 'all') return all;
    const filtered = all.filter((g) => g.series.key === key);
    return filtered.length > 0 ? filtered : all;
  });

  // -------------------------------------------------------------
  // CATEGORY 3: CAPAIAN & HASIL INTERVENSI SPESIFIK
  // -------------------------------------------------------------
  private enrichOutcomesWithQuarters(items: InterventionOutcomeItem[]): InterventionOutcomeItem[] {
    return items.map((item) => {
      const q1Actual = item.capaianTW1;
      const q2Actual = item.capaianTW2;
      const q2Count = item.jumlahSasaranTW2;
      const q1Count =
        q2Count && q2Actual && q1Actual
          ? Math.round((q2Count * q1Actual) / q2Actual)
          : null;

      const quarters: Record<number, OutcomeQuarterData> = {
        1: {
          sumNumerator: q1Count,
          actualAchievement: q1Actual,
          hasData: q1Actual !== null && q1Actual !== undefined,
        },
        2: {
          sumNumerator: q2Count,
          actualAchievement: q2Actual,
          hasData: q2Actual !== null && q2Actual !== undefined,
        },
        3: {
          sumNumerator: null,
          actualAchievement: null,
          hasData: false,
        },
        4: {
          sumNumerator: null,
          actualAchievement: null,
          hasData: false,
        },
      };

      return {
        ...item,
        quarters,
      };
    });
  }

  readonly outcomesData = signal<InterventionOutcomeItem[]>(
    this.enrichOutcomesWithQuarters(INTERVENTION_OUTCOMES_DATA),
  );
  readonly loadedQuarterDatasets = signal<Record<number, LoadedQuarterDinkesData>>({});
  readonly loadedPrevYearDataset = signal<LoadedQuarterDinkesData | null>(null);
  readonly selectedOutcomeScope = signal<'province' | string>('province');
  readonly outcomeTableDisplayMode = signal<'single' | 'all'>('single');
  readonly collapsedOutcomeCategories = signal<Record<string, boolean>>({});

  readonly outcomeQuarterViewMode = signal<'all_available' | 'single_quarter'>('all_available');
  readonly selectedOutcomeQuarter = signal<1 | 2 | 3 | 4>(2);
  readonly customAvailableQuarters = signal<(1 | 2 | 3 | 4)[] | null>(null);

  readonly availableOutcomeQuarters = computed<(1 | 2 | 3 | 4)[]>(() => {
    if (this.customAvailableQuarters() && this.customAvailableQuarters()!.length > 0) {
      return this.customAvailableQuarters()!;
    }
    const engineQuarters = this.workflowEngine?.availableQuarters();
    if (engineQuarters && engineQuarters.length > 1) {
      return engineQuarters;
    }
    return [1, 2];
  });

  readonly displayedOutcomeQuarters = computed<(1 | 2 | 3 | 4)[]>(() => {
    if (this.outcomeQuarterViewMode() === 'single_quarter') {
      return [this.selectedOutcomeQuarter()];
    }
    return this.availableOutcomeQuarters();
  });

  setOutcomeQuarterViewMode(mode: 'all_available' | 'single_quarter'): void {
    this.outcomeQuarterViewMode.set(mode);
  }

  setSelectedOutcomeQuarter(quarter: 1 | 2 | 3 | 4): void {
    this.selectedOutcomeQuarter.set(quarter);
  }

  readonly outcomeCategoryFilter = signal<
    'all' | 'sebelum-kelahiran' | 'setelah-kelahiran' | 'lintas-siklus'
  >('all');
  readonly outcomeStatusFilter = signal<'all' | 'On track' | 'Perlu percepatan'>(
    'all',
  );
  readonly outcomeSearch = signal<string>('');

  readonly selectedOutcomeScopeLabel = computed<string>(() => {
    const scope = this.selectedOutcomeScope();
    if (scope === 'province') {
      return 'PROVINSI JAWA TENGAH (Agregat)';
    }
    return scope;
  });

  getScopePrevYearOutcome(scope: 'province' | string, indNo: string): number | null {
    if (scope === 'province') {
      const prevData = this.loadedPrevYearDataset();
      const cfg = OUTCOME_INDICATOR_COLUMN_MAP[indNo];
      if (prevData && cfg?.pCol) {
        const p = this.extractValueFromRow(prevData.summaryRow, cfg.pCol);
        if (p !== null) return Math.round(p * 100) / 100;
      }
      const defaultProv = INTERVENTION_OUTCOMES_DATA.find((it) => it.no === indNo);
      return defaultProv?.realisasi2025 ?? null;
    }

    const scopeUpper = scope.trim().toUpperCase();
    const cleanScope = scopeUpper.replace(/^(KABUPATEN|KOTA|KAB\.)\s+/i, '').trim();

    // 1. Check loadedPrevYearDataset region rows if available
    const prevData = this.loadedPrevYearDataset();
    const cfg = OUTCOME_INDICATOR_COLUMN_MAP[indNo];
    if (prevData && prevData.regionRows && prevData.regionRows.length > 0 && cfg?.pCol) {
      const row = prevData.regionRows.find((r) => {
        const name = String(r['Kabupaten/Kota'] || r['Kab/Kota'] || r['Wilayah'] || '')
          .trim()
          .toUpperCase();
        if (name === scopeUpper) return true;
        const cleanName = name.replace(/^(KABUPATEN|KOTA|KAB\.)\s+/i, '').trim();
        return cleanName === cleanScope;
      });
      if (row) {
        const p = this.extractValueFromRow(row, cfg.pCol);
        if (p !== null) return Math.round(p * 100) / 100;
      }
    }

    // 2. Check DISTRICT_PREV_YEAR_OUTCOMES
    const matchKey = Object.keys(DISTRICT_PREV_YEAR_OUTCOMES).find((k) => {
      if (k === scopeUpper) return true;
      const cleanK = k.replace(/^(KABUPATEN|KOTA|KAB\.)\s+/i, '').trim();
      return cleanK === cleanScope;
    });

    if (matchKey && DISTRICT_PREV_YEAR_OUTCOMES[matchKey]?.[indNo] !== undefined) {
      return DISTRICT_PREV_YEAR_OUTCOMES[matchKey][indNo];
    }

    // 3. Fallback to provincial default if not found
    const defaultProv = INTERVENTION_OUTCOMES_DATA.find((it) => it.no === indNo);
    return defaultProv?.realisasi2025 ?? null;
  }

  getScopePrevYearTarget(indNo: string): string {
    const prevData = this.loadedPrevYearDataset();
    const cfg = OUTCOME_INDICATOR_COLUMN_MAP[indNo];
    if (prevData && cfg?.pCol && prevData.targetRow) {
      const t = this.extractValueFromRow(prevData.targetRow, cfg.pCol);
      if (t !== null) return `${t}%`;
    }
    const defaultProv = INTERVENTION_OUTCOMES_DATA.find((it) => it.no === indNo);
    return defaultProv?.target2025 ?? '70%';
  }

  private buildDistrictOutcomes(row: Record<string, unknown>): InterventionOutcomeItem[] {
    const distName = String(row['Kabupaten/Kota'] || row['Kab/Kota'] || row['Wilayah'] || '').trim();
    const getNum = (key: string): number | null => {
      const val = row[key];
      if (val === null || val === undefined || val === '') return null;
      const n = Number(val);
      return isNaN(n) ? null : n;
    };

    const getPercent = (key: string): number | null => {
      const val = row[key];
      if (val === null || val === undefined || val === '') return null;
      const n = Number(val);
      return isNaN(n) ? null : n;
    };

    const calcTW1 = (valTW2: number | null, provTW1: number, provTW2: number) => {
      if (valTW2 === null || isNaN(valTW2)) return null;
      const ratio = provTW2 > 0 ? provTW1 / provTW2 : 1;
      return Math.round(valTW2 * ratio * 100) / 100;
    };

    const calcCountTW1 = (countTW2: number | null, valTW2: number | null, valTW1: number | null) => {
      if (countTW2 === null || valTW2 === null || valTW1 === null || valTW2 === 0) return null;
      return Math.round(countTW2 * (valTW1 / valTW2));
    };

    const makeQuarterData = (
      c2: number | null,
      p2: number | null,
      provTW1: number,
      provTW2: number
    ): Record<number, OutcomeQuarterData> => {
      const p1 = calcTW1(p2, provTW1, provTW2);
      const c1 = calcCountTW1(c2, p2, p1);
      return {
        1: { sumNumerator: c1, actualAchievement: p1, hasData: p1 !== null },
        2: { sumNumerator: c2, actualAchievement: p2, hasData: p2 !== null },
        3: { sumNumerator: null, actualAchievement: null, hasData: false },
        4: { sumNumerator: null, actualAchievement: null, hasData: false },
      };
    };

    const p1 = getPercent('% Skrining Anemia');
    const c1 = getNum('Rematri Skrining Anemia');
    const p2 = getPercent('% Konsumsi TTD');
    const c2 = getNum('Rematri  Konsumsi TTD');
    const p3 = getPercent('% ANC 6x');
    const c3 = getNum('Ibu Hamil ANC 6x');
    const p4 = getPercent('% TTD/MMS');
    const c4 = getNum('Ibu Hamil Konsumsi TTD/MMS');
    const p5 = getPercent('% Bumil PMT');
    const c5 = getNum('Ibu Hamil KEK Konsumsi MT');
    const p6a = getPercent('% D/S');
    const c6a = getNum('Balita dipantau Pertumbuhan (D/S)');
    const p6b = getPercent('% Tumbang');
    const c6b = getNum('Jumlah Balita dipantau Tumbang');
    const p7 = getPercent('% ASI');
    const c7 = getNum('ASI Eksklusif');
    const p8 = getPercent('% MPASI');
    const c8 = getNum('MPASI');
    const p9a = getPercent('% BB Tidak Naik (T) dapat MT');
    const c9a = getNum('Jumlah BB Tidak Naik (T) dapat MT');
    const p9b = getPercent('% BB Kurang dapat MT');
    const c9b = getNum('Jumlah BB Kurang dapat MT');
    const p9c = getPercent('% Gizi Kurang dapat MT');
    const c9c = getNum('Jumlah  Gizi Kurang dapat MT');
    const p9d = getPercent('% Talak Gibur');
    const c9d = getNum('Jumlah Kasus Gizi Buruk Mendapat Tata Laksana');
    const p10 = getPercent('% IDL');
    const c10 = getNum('Baduta IDL');

    const tw1_1 = calcTW1(p1, 84.09, 93.76);
    const tw1_2 = calcTW1(p2, 76.06, 93.64);
    const tw1_3 = calcTW1(p3, 28, 39.64);
    const tw1_4 = calcTW1(p4, 7.27, 10.9);
    const tw1_5 = calcTW1(p5, 0.5, 26.44);
    const tw1_6a = calcTW1(p6a, 96.08, 96.13);
    const tw1_6b = calcTW1(p6b, 8.83, 11.73);
    const tw1_7 = calcTW1(p7, 88.47, 89.77);
    const tw1_8 = calcTW1(p8, 95.53, 95.31);
    const tw1_9a = calcTW1(p9a, 0.54, 3.37);
    const tw1_9b = calcTW1(p9b, 0.44, 6.32);
    const tw1_9c = calcTW1(p9c, 0.54, 8.27);
    const tw1_9d = calcTW1(p9d, 21.81, 38.51);
    const tw1_10 = calcTW1(p10, 12.02, 45.67);

    return [
      {
        no: '1',
        categoryKey: 'sebelum-kelahiran',
        categoryLabel: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
        indicator: 'Remaja putri mendapat skrining anemia',
        target2025: this.getScopePrevYearTarget('1'),
        realisasi2025: this.getScopePrevYearOutcome(distName, '1'),
        target2026: '77%',
        jumlahSasaranTW2: c1,
        capaianTW1: tw1_1,
        capaianTW2: p1,
        status: p1 !== null && p1 >= 77 ? 'On track' : 'Perlu percepatan',
        quarters: makeQuarterData(c1, p1, 84.09, 93.76),
      },
      {
        no: '2',
        categoryKey: 'sebelum-kelahiran',
        categoryLabel: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
        indicator: 'Remaja putri mengonsumsi TTD (tablet tambah darah)',
        target2025: this.getScopePrevYearTarget('2'),
        realisasi2025: this.getScopePrevYearOutcome(distName, '2'),
        target2026: '67%',
        jumlahSasaranTW2: c2,
        capaianTW1: tw1_2,
        capaianTW2: p2,
        status: p2 !== null && p2 >= 67 ? 'On track' : 'Perlu percepatan',
        quarters: makeQuarterData(c2, p2, 76.06, 93.64),
      },
      {
        no: '3',
        categoryKey: 'sebelum-kelahiran',
        categoryLabel: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
        indicator: 'Ibu hamil ANC minimal 6x*',
        target2025: this.getScopePrevYearTarget('3'),
        realisasi2025: this.getScopePrevYearOutcome(distName, '3'),
        target2026: '60%',
        jumlahSasaranTW2: c3,
        capaianTW1: tw1_3,
        capaianTW2: p3,
        status: p3 !== null && p3 >= 60 ? 'On track' : 'Perlu percepatan',
        quarters: makeQuarterData(c3, p3, 28, 39.64),
      },
      {
        no: '4',
        categoryKey: 'sebelum-kelahiran',
        categoryLabel: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
        indicator: 'Ibu hamil mengonsumsi suplementasi gizi (TTD/MMS) minimal 180 tablet selama kehamilan**',
        target2025: this.getScopePrevYearTarget('4'),
        realisasi2025: this.getScopePrevYearOutcome(distName, '4'),
        target2026: '39%',
        jumlahSasaranTW2: c4,
        capaianTW1: tw1_4,
        capaianTW2: p4,
        status: p4 !== null && p4 >= 39 ? 'On track' : 'Perlu percepatan',
        quarters: makeQuarterData(c4, p4, 7.27, 10.9),
      },
      {
        no: '5',
        categoryKey: 'sebelum-kelahiran',
        categoryLabel: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
        indicator: 'Ibu hamil KEK mendapat tambahan asupan gizi',
        target2025: this.getScopePrevYearTarget('5'),
        realisasi2025: this.getScopePrevYearOutcome(distName, '5'),
        target2026: '85%',
        jumlahSasaranTW2: c5,
        capaianTW1: tw1_5,
        capaianTW2: p5,
        status: p5 !== null && p5 >= 85 ? 'On track' : 'Perlu percepatan',
        quarters: makeQuarterData(c5, p5, 0.5, 26.44),
      },
      {
        no: '6a',
        categoryKey: 'setelah-kelahiran',
        categoryLabel: 'Intervensi untuk balita (setelah kelahiran)',
        indicator: 'Pemantauan pertumbuhan balita',
        target2025: this.getScopePrevYearTarget('6a'),
        realisasi2025: this.getScopePrevYearOutcome(distName, '6a'),
        target2026: '90%',
        jumlahSasaranTW2: c6a,
        capaianTW1: tw1_6a,
        capaianTW2: p6a,
        status: p6a !== null && p6a >= 90 ? 'On track' : 'Perlu percepatan',
        quarters: makeQuarterData(c6a, p6a, 96.08, 96.13),
      },
      {
        no: '6b',
        categoryKey: 'setelah-kelahiran',
        categoryLabel: 'Intervensi untuk balita (setelah kelahiran)',
        indicator: 'Pemantauan pertumbuhan dan perkembangan balita',
        target2025: this.getScopePrevYearTarget('6b'),
        realisasi2025: this.getScopePrevYearOutcome(distName, '6b'),
        target2026: '55%',
        jumlahSasaranTW2: c6b,
        capaianTW1: tw1_6b,
        capaianTW2: p6b,
        status: p6b !== null && p6b >= 55 ? 'On track' : 'Perlu percepatan',
        quarters: makeQuarterData(c6b, p6b, 8.83, 11.73),
      },
      {
        no: '7',
        categoryKey: 'setelah-kelahiran',
        categoryLabel: 'Intervensi untuk balita (setelah kelahiran)',
        indicator: 'Bayi usia kurang dari 6 bulan mendapat ASI eksklusif',
        target2025: this.getScopePrevYearTarget('7'),
        realisasi2025: this.getScopePrevYearOutcome(distName, '7'),
        target2026: '76%',
        jumlahSasaranTW2: c7,
        capaianTW1: tw1_7,
        capaianTW2: p7,
        status: p7 !== null && p7 >= 76 ? 'On track' : 'Perlu percepatan',
        quarters: makeQuarterData(c7, p7, 88.47, 89.77),
      },
      {
        no: '8',
        categoryKey: 'setelah-kelahiran',
        categoryLabel: 'Intervensi untuk balita (setelah kelahiran)',
        indicator: 'Anak 6-23 bulan mendapat MP-ASI',
        target2025: this.getScopePrevYearTarget('8'),
        realisasi2025: this.getScopePrevYearOutcome(distName, '8'),
        target2026: '76%',
        jumlahSasaranTW2: c8,
        capaianTW1: tw1_8,
        capaianTW2: p8,
        status: p8 !== null && p8 >= 76 ? 'On track' : 'Perlu percepatan',
        quarters: makeQuarterData(c8, p8, 95.53, 95.31),
      },
      {
        no: '9a',
        categoryKey: 'setelah-kelahiran',
        categoryLabel: 'Intervensi untuk balita (setelah kelahiran)',
        indicator: 'Balita berat badan tidak naik (T) mendapat tambahan asupan gizi',
        target2025: this.getScopePrevYearTarget('9a'),
        realisasi2025: this.getScopePrevYearOutcome(distName, '9a'),
        target2026: '70%',
        jumlahSasaranTW2: c9a,
        capaianTW1: tw1_9a,
        capaianTW2: p9a,
        status: p9a !== null && p9a >= 70 ? 'On track' : 'Perlu percepatan',
        quarters: makeQuarterData(c9a, p9a, 0.54, 3.37),
      },
      {
        no: '9b',
        categoryKey: 'setelah-kelahiran',
        categoryLabel: 'Intervensi untuk balita (setelah kelahiran)',
        indicator: 'Balita berat badan kurang mendapat tambahan asupan gizi',
        target2025: this.getScopePrevYearTarget('9b'),
        realisasi2025: this.getScopePrevYearOutcome(distName, '9b'),
        target2026: '70%',
        jumlahSasaranTW2: c9b,
        capaianTW1: tw1_9b,
        capaianTW2: p9b,
        status: p9b !== null && p9b >= 70 ? 'On track' : 'Perlu percepatan',
        quarters: makeQuarterData(c9b, p9b, 0.44, 6.32),
      },
      {
        no: '9c',
        categoryKey: 'setelah-kelahiran',
        categoryLabel: 'Intervensi untuk balita (setelah kelahiran)',
        indicator: 'Balita gizi kurang mendapat tambahan asupan gizi',
        target2025: this.getScopePrevYearTarget('9c'),
        realisasi2025: this.getScopePrevYearOutcome(distName, '9c'),
        target2026: '70%',
        jumlahSasaranTW2: c9c,
        capaianTW1: tw1_9c,
        capaianTW2: p9c,
        status: p9c !== null && p9c >= 70 ? 'On track' : 'Perlu percepatan',
        quarters: makeQuarterData(c9c, p9c, 0.54, 8.27),
      },
      {
        no: '9d',
        categoryKey: 'setelah-kelahiran',
        categoryLabel: 'Intervensi untuk balita (setelah kelahiran)',
        indicator: 'Balita gizi buruk mendapat pelayanan tata laksana gizi buruk',
        target2025: this.getScopePrevYearTarget('9d'),
        realisasi2025: this.getScopePrevYearOutcome(distName, '9d'),
        target2026: '92%',
        jumlahSasaranTW2: c9d,
        capaianTW1: tw1_9d,
        capaianTW2: p9d,
        status: p9d !== null && p9d >= 92 ? 'On track' : 'Perlu percepatan',
        quarters: makeQuarterData(c9d, p9d, 21.81, 38.51),
      },
      {
        no: '10',
        categoryKey: 'setelah-kelahiran',
        categoryLabel: 'Intervensi untuk balita (setelah kelahiran)',
        indicator: 'Baduta memperoleh imunisasi lengkap',
        target2025: this.getScopePrevYearTarget('10'),
        realisasi2025: this.getScopePrevYearOutcome(distName, '10'),
        target2026: '56.25%',
        jumlahSasaranTW2: c10,
        capaianTW1: tw1_10,
        capaianTW2: p10,
        status: p10 !== null && p10 >= 56.25 ? 'On track' : 'Perlu percepatan',
        quarters: makeQuarterData(c10, p10, 12.02, 45.67),
      },
      {
        no: '11',
        categoryKey: 'lintas-siklus',
        categoryLabel: 'Intervensi lintas siklus hidup',
        indicator: 'Kab/Kota yang telah terverifikasi 100% Kepala Keluarga stop Buang Air Besar Sembarangan (BABS)***',
        target2025: this.getScopePrevYearTarget('11'),
        realisasi2025: this.getScopePrevYearOutcome(distName, '11'),
        target2026: '100%',
        jumlahSasaranTW2: null,
        capaianTW1: 100,
        capaianTW2: 100,
        status: 'On track',
        quarters: {
          1: { sumNumerator: null, actualAchievement: 100, hasData: true },
          2: { sumNumerator: null, actualAchievement: 100, hasData: true },
          3: { sumNumerator: null, actualAchievement: null, hasData: false },
          4: { sumNumerator: null, actualAchievement: null, hasData: false },
        },
      },
    ];
  }

  readonly activeScopeOutcomes = computed<InterventionOutcomeItem[]>(() => {
    return this.buildScopeOutcomes(this.selectedOutcomeScope());
  });

  private extractValueFromRow(
    row: Record<string, unknown> | null | undefined,
    colMatch: string,
  ): number | null {
    if (!row || !colMatch) return null;
    const targetNorm = colMatch.toLowerCase().replace(/\s+/g, ' ').trim();
    for (const [key, val] of Object.entries(row)) {
      const keyNorm = key.toLowerCase().replace(/\s+/g, ' ').trim();
      if (keyNorm === targetNorm) {
        if (val === null || val === undefined || val === '' || val === '-') return null;
        const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '.'));
        return isNaN(n) ? null : n;
      }
    }
    return null;
  }

  buildScopeOutcomes(scope: 'province' | string): InterventionOutcomeItem[] {
    const baseItems = this.outcomesData();
    const loaded = this.loadedQuarterDatasets();
    const hasLoadedData = Object.keys(loaded).length > 0;

    if (!hasLoadedData) {
      if (scope === 'province') {
        return baseItems.map((base) => ({
          ...base,
          target2025: this.getScopePrevYearTarget(base.no),
          realisasi2025: this.getScopePrevYearOutcome('province', base.no) ?? base.realisasi2025,
        }));
      }
      const scopeNorm = scope
        .trim()
        .toUpperCase()
        .replace(/^(KABUPATEN|KOTA|KAB\.)\s+/i, '')
        .trim();
      const districtRow = this.intervensiRows().find((r) => {
        const name = String(r['Kabupaten/Kota'] || '')
          .trim()
          .toUpperCase()
          .replace(/^(KABUPATEN|KOTA|KAB\.)\s+/i, '')
          .trim();
        return name === scopeNorm;
      });
      if (!districtRow) return baseItems;
      return this.buildDistrictOutcomes(districtRow);
    }

    return baseItems.map((base) => {
      const cfg = OUTCOME_INDICATOR_COLUMN_MAP[base.no];
      const quartersObj: Record<number, OutcomeQuarterData> = {};
      const scopePrevActual = this.getScopePrevYearOutcome(scope, base.no);
      const scopePrevTarget = this.getScopePrevYearTarget(base.no);

      for (const q of [1, 2, 3, 4] as const) {
        const qData = loaded[q];
        if (qData) {
          if (base.no === '11') {
            quartersObj[q] = { sumNumerator: null, actualAchievement: 100, hasData: true };
          } else if (scope === 'province') {
            const pCol = cfg?.pCol;
            let p = pCol ? this.extractValueFromRow(qData.summaryRow, pCol) : null;
            if (p === null && pCol && qData.regionRows.length > 0) {
              const vals = qData.regionRows
                .map((r) => this.extractValueFromRow(r, pCol))
                .filter((v): v is number => v !== null);
              if (vals.length > 0) {
                p = vals.reduce((a, b) => a + b, 0) / vals.length;
              }
            }

            const cCol = cfg?.cCol;
            let c = cCol ? this.extractValueFromRow(qData.totalRow, cCol) : null;
            if (c === null && cCol && qData.regionRows.length > 0) {
              const vals = qData.regionRows
                .map((r) => this.extractValueFromRow(r, cCol))
                .filter((v): v is number => v !== null);
              if (vals.length > 0) {
                c = vals.reduce((a, b) => a + b, 0);
              }
            }

            quartersObj[q] = {
              sumNumerator: c !== null ? Math.round(c) : null,
              actualAchievement: p !== null ? Math.round(p * 100) / 100 : null,
              hasData: p !== null,
            };
          } else {
            // Specific district
            const scopeNorm = scope
              .trim()
              .toUpperCase()
              .replace(/^(KABUPATEN|KOTA|KAB\.)\s+/i, '')
              .trim();
            const distRow = qData.regionRows.find((r) => {
              const name = String(r['Kabupaten/Kota'] || r['Kab/Kota'] || r['Wilayah'] || '')
                .trim()
                .toUpperCase()
                .replace(/^(KABUPATEN|KOTA|KAB\.)\s+/i, '')
                .trim();
              return name === scopeNorm;
            });

            const p = cfg ? this.extractValueFromRow(distRow, cfg.pCol) : null;
            const c = cfg?.cCol ? this.extractValueFromRow(distRow, cfg.cCol) : null;

            quartersObj[q] = {
              sumNumerator: c !== null ? Math.round(c) : null,
              actualAchievement: p !== null ? Math.round(p * 100) / 100 : null,
              hasData: p !== null,
            };
          }
        } else {
          // No loaded server data for this quarter, check fallback
          if (scope === 'province') {
            const baseQ = base.quarters?.[q];
            quartersObj[q] = baseQ
              ? { ...baseQ }
              : { sumNumerator: null, actualAchievement: null, hasData: false };
          } else {
            const districtRow = this.intervensiRows().find(
              (r) =>
                String(r['Kabupaten/Kota'] || '').trim().toUpperCase() ===
                scope.trim().toUpperCase(),
            );
            if (districtRow) {
              const distFallback = this.buildDistrictOutcomes(districtRow).find(
                (d) => d.no === base.no,
              );
              quartersObj[q] = distFallback?.quarters?.[q] ?? {
                sumNumerator: null,
                actualAchievement: null,
                hasData: false,
              };
            } else {
              quartersObj[q] = {
                sumNumerator: null,
                actualAchievement: null,
                hasData: false,
              };
            }
          }
        }
      }

      // Determine latest available achievement for status evaluation
      const availableQNums = ([4, 3, 2, 1] as const).filter((q) => quartersObj[q]?.hasData);
      const latestQ = availableQNums.length > 0 ? availableQNums[0] : null;
      const latestAch = latestQ ? quartersObj[latestQ]?.actualAchievement : null;
      const targetVal = cfg ? cfg.target : parseFloat(base.target2026);

      let status = base.status;
      if (latestAch !== null && !isNaN(targetVal)) {
        status = latestAch >= targetVal ? 'On track' : 'Perlu percepatan';
      }

      return {
        ...base,
        target2025: scopePrevTarget,
        realisasi2025: scopePrevActual ?? base.realisasi2025,
        capaianTW1: quartersObj[1]?.actualAchievement ?? base.capaianTW1,
        capaianTW2: quartersObj[2]?.actualAchievement ?? base.capaianTW2,
        jumlahSasaranTW2: quartersObj[2]?.sumNumerator ?? base.jumlahSasaranTW2,
        status,
        quarters: quartersObj,
      };
    });
  }

  readonly outcomeKpiSummary = computed(() => {
    const data = this.activeScopeOutcomes();
    const total = data.length;
    const onTrack = data.filter((d) => d.status === 'On track').length;
    const needAccel = data.filter((d) => d.status === 'Perlu percepatan').length;

    // Hitung rata-rata capaian numerik
    const validScores = data
      .map((d) => {
        const q = this.selectedOutcomeQuarter();
        return d.quarters?.[q]?.actualAchievement ?? d.capaianTW2 ?? d.capaianTW1;
      })
      .filter((v): v is number => typeof v === 'number');
    const avgScore =
      validScores.length > 0
        ? validScores.reduce((acc, v) => acc + v, 0) / validScores.length
        : 0;

    const prevScores = data
      .map((d) => d.realisasi2025)
      .filter((v): v is number => typeof v === 'number');
    const avgPrevScore =
      prevScores.length > 0
        ? prevScores.reduce((acc, v) => acc + v, 0) / prevScores.length
        : 0;

    const avgYoYChange = Math.round((avgScore - avgPrevScore) * 100) / 100;

    return {
      total,
      onTrack,
      onTrackPercent: total > 0 ? (onTrack / total) * 100 : 0,
      needAccel,
      needAccelPercent: total > 0 ? (needAccel / total) * 100 : 0,
      avgScore,
      avgPrevScore,
      avgYoYChange,
    };
  });

  readonly filteredOutcomes = computed<InterventionOutcomeItem[]>(() => {
    let list = this.activeScopeOutcomes();
    const cat = this.outcomeCategoryFilter();
    const status = this.outcomeStatusFilter();
    const q = this.outcomeSearch().toLowerCase().trim();

    if (cat !== 'all') {
      list = list.filter((item) => item.categoryKey === cat);
    }
    if (status !== 'all') {
      list = list.filter((item) => item.status === status);
    }
    if (q) {
      list = list.filter((item) =>
        item.indicator.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q),
      );
    }
    return list;
  });

  readonly filteredGroupedOutcomes = computed<
    {
      categoryKey: 'sebelum-kelahiran' | 'setelah-kelahiran' | 'lintas-siklus';
      categoryName: string;
      rows: InterventionOutcomeItem[];
    }[]
  >(() => {
    const items = this.filteredOutcomes();
    const categoryDefs: {
      key: 'sebelum-kelahiran' | 'setelah-kelahiran' | 'lintas-siklus';
      label: string;
    }[] = [
      {
        key: 'sebelum-kelahiran',
        label: 'Sebelum Kelahiran (Remaja Putri & Ibu Hamil)',
      },
      {
        key: 'setelah-kelahiran',
        label: 'Setelah Kelahiran (Balita)',
      },
      {
        key: 'lintas-siklus',
        label: 'Lintas Siklus Hidup (Sanitasi & Lingkungan)',
      },
    ];

    return categoryDefs
      .map((cat) => ({
        categoryKey: cat.key,
        categoryName: cat.label,
        rows: items.filter((it) => it.categoryKey === cat.key),
      }))
      .filter((g) => g.rows.length > 0);
  });

  readonly allDisplayOutcomeTables = computed<
    {
      id: string;
      name: string;
      isProvince: boolean;
      scorecard: InterventionOutcomeItem[];
      groupedRows: {
        categoryKey: 'sebelum-kelahiran' | 'setelah-kelahiran' | 'lintas-siklus';
        categoryName: string;
        rows: InterventionOutcomeItem[];
      }[];
      onTrackCount: number;
      needAccelCount: number;
    }[]
  >(() => {
    const cat = this.outcomeCategoryFilter();
    const status = this.outcomeStatusFilter();
    const q = this.outcomeSearch().toLowerCase().trim();

    const filterList = (items: InterventionOutcomeItem[]) => {
      let list = items;
      if (cat !== 'all') list = list.filter((item) => item.categoryKey === cat);
      if (status !== 'all') list = list.filter((item) => item.status === status);
      if (q) {
        list = list.filter(
          (item) =>
            item.indicator.toLowerCase().includes(q) ||
            item.categoryLabel.toLowerCase().includes(q),
        );
      }
      return list;
    };

    const groupList = (items: InterventionOutcomeItem[]) => {
      const categoryDefs: {
        key: 'sebelum-kelahiran' | 'setelah-kelahiran' | 'lintas-siklus';
        label: string;
      }[] = [
        {
          key: 'sebelum-kelahiran',
          label: 'Sebelum Kelahiran (Remaja Putri & Ibu Hamil)',
        },
        {
          key: 'setelah-kelahiran',
          label: 'Setelah Kelahiran (Balita)',
        },
        {
          key: 'lintas-siklus',
          label: 'Lintas Siklus Hidup (Sanitasi & Lingkungan)',
        },
      ];
      return categoryDefs
        .map((c) => ({
          categoryKey: c.key,
          categoryName: c.label,
          rows: items.filter((it) => it.categoryKey === c.key),
        }))
        .filter((g) => g.rows.length > 0);
    };

    // 1. Province Table
    const provRows = this.buildScopeOutcomes('province');
    const provFiltered = filterList(provRows);
    const provTable = {
      id: 'table-province',
      name: 'PROVINSI JAWA TENGAH (Agregat)',
      isProvince: true,
      scorecard: provRows,
      groupedRows: groupList(provFiltered),
      onTrackCount: provRows.filter((r) => r.status === 'On track').length,
      needAccelCount: provRows.filter((r) => r.status === 'Perlu percepatan')
        .length,
    };

    // 2. 35 Regency/City Tables
    const districtTables = this.intervensiRows().map((row) => {
      const name = String(row['Kabupaten/Kota'] || '').trim();
      const rows = this.buildScopeOutcomes(name);
      const filtered = filterList(rows);
      return {
        id: 'table-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name,
        isProvince: false,
        scorecard: rows,
        groupedRows: groupList(filtered),
        onTrackCount: rows.filter((r) => r.status === 'On track').length,
        needAccelCount: rows.filter((r) => r.status === 'Perlu percepatan')
          .length,
      };
    });

    return [provTable, ...districtTables];
  });

  setSelectedOutcomeScope(scope: 'province' | string): void {
    this.selectedOutcomeScope.set(scope);
  }

  setOutcomeTableDisplayMode(mode: 'single' | 'all'): void {
    this.outcomeTableDisplayMode.set(mode);
  }

  toggleOutcomeCategory(categoryName: string): void {
    this.collapsedOutcomeCategories.update((prev) => ({
      ...prev,
      [categoryName]: !prev[categoryName],
    }));
  }

  scrollToOutcomeTable(tableId: string): void {
    if (typeof document !== 'undefined') {
      const el = document.getElementById(tableId);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  selectDistrictFromRanking(districtName: string): void {
    this.selectedOutcomeScope.set(districtName);
    this.outcomeTableDisplayMode.set('single');
    this.scrollToOutcomeTable('outcomes-main-table');
  }

  // Kabupaten / Kota performance ranking based on specific interventions Capaian score
  readonly districtCapaianRankings = computed(() => {
    const rows = this.intervensiRows();
    return rows
      .map((r) => {
        const name = String(r['Kabupaten/Kota'] || '');
        const score = Number(r['Capaian']) || 0;
        return { name, score };
      })
      .sort((a, b) => b.score - a.score);
  });

  async ngOnInit(): Promise<void> {
    // Sync with StuntingWorkflowEngine if TW4 dataset was already loaded in memory
    const enginePrevTw4 = this.workflowEngine?.previousYearTw4Dataset();
    if (enginePrevTw4 && !this.loadedPrevYearDataset()) {
      this.loadedPrevYearDataset.set({
        regionRows: enginePrevTw4.regionRows || [],
        summaryRow: enginePrevTw4.summaryRow || null,
        totalRow: enginePrevTw4.totalRow || null,
        targetRow: enginePrevTw4.targetRow || null,
      });
    }

    // If user has loaded data via HealthDataExchange, check if it can enhance our views
    const transferred = this.healthDataExchange.chartData();
    if (transferred && transferred.rows && transferred.rows.length >= 30) {
      const cols = transferred.columns || [];
      const isIntervensi = cols.some((c: string) =>
        c.includes('TTD') || c.includes('ANC') || c.includes('D/S'),
      );
      if (isIntervensi) {
        this.intervensiRows.set(transferred.rows);
      }
    }

    // Auto-load available periods for current year and previous year if storage is configured
    if (this.periodPartitionWorkspace?.isStorageConfigured()) {
      try {
        await this.periodPartitionWorkspace.refreshPeriods();
        const currentYear = new Date().getFullYear();
        const availableSlots = (['TW1', 'TW2', 'TW3', 'TW4'] as const).filter((slot) =>
          this.periodPartitionWorkspace?.isQuarterAvailable(currentYear, slot),
        );
        if (availableSlots.length > 0) {
          const slotMap: Record<string, 1 | 2 | 3 | 4> = { TW1: 1, TW2: 2, TW3: 3, TW4: 4 };
          const quarterNums = availableSlots.map((s) => slotMap[s]);
          this.customAvailableQuarters.set(quarterNums);
          const latestQuarter = quarterNums[quarterNums.length - 1];
          this.selectedOutcomeQuarter.set(latestQuarter);

          // Load data for all available quarters on the server
          const loadedMap: Record<number, LoadedQuarterDinkesData> = {};
          for (const slot of availableSlots) {
            const qNum = slotMap[slot];
            try {
              const qDataset = await this.periodPartitionWorkspace.loadSingleQuarter(
                currentYear,
                slot,
                { prefer: 'result' },
              );
              if (qDataset?.dataset) {
                loadedMap[qNum] = {
                  regionRows: qDataset.dataset.regionRows || [],
                  summaryRow: qDataset.dataset.summaryRow || null,
                  totalRow: qDataset.dataset.totalRow || null,
                  targetRow: qDataset.dataset.targetRow || null,
                };
              }
            } catch (loadErr) {
              console.warn(`Gagal memuat dataset kuartal ${slot}:`, loadErr);
            }
          }
          if (Object.keys(loadedMap).length > 0) {
            this.loadedQuarterDatasets.set(loadedMap);
            if (loadedMap[latestQuarter]?.regionRows?.length >= 30) {
              this.intervensiRows.set(loadedMap[latestQuarter].regionRows);
            }
          }
        }

        // Auto-load available period for previous year (TW4)
        const prevYear = currentYear - 1;
        const prevSlots = (['TW4', 'TW3', 'TW2', 'TW1'] as const).filter((slot) =>
          this.periodPartitionWorkspace?.isQuarterAvailable(prevYear, slot),
        );
        if (prevSlots.length > 0) {
          const targetSlot = prevSlots[0];
          try {
            const prevDataset = await this.periodPartitionWorkspace.loadSingleQuarter(
              prevYear,
              targetSlot,
              { prefer: 'result' },
            );
            if (prevDataset?.dataset) {
              const pDataset = prevDataset.dataset;
              this.loadedPrevYearDataset.set({
                regionRows: pDataset.regionRows || [],
                summaryRow: pDataset.summaryRow || null,
                totalRow: pDataset.totalRow || null,
                targetRow: pDataset.targetRow || null,
              });
              if (this.workflowEngine) {
                this.workflowEngine.applyPreviousYearTw4Data(pDataset);
              }
            }
          } catch (prevErr) {
            console.warn(`Gagal memuat dataset tahun sebelumnya (${prevYear} ${targetSlot}):`, prevErr);
          }
        }
      } catch (err) {
        console.warn('Gagal memuat periode data tahun berjalan:', err);
      }
    }
  }

  buildIntervensiBoxes(dataset?: LoadedQuarterDinkesData): HomeMetricBox[] {
    if (!dataset || !dataset.summaryRow || !dataset.totalRow) {
      return INTERVENSI_METRIC_BOXES;
    }

    const cDS = this.extractValueFromRow(dataset.totalRow, 'Balita dipantau Pertumbuhan (D/S)');
    const pDS = this.extractValueFromRow(dataset.summaryRow, '% D/S');
    const cTTD =
      this.extractValueFromRow(dataset.totalRow, 'Rematri  Konsumsi TTD') ??
      this.extractValueFromRow(dataset.totalRow, 'Rematri Konsumsi TTD');
    const pTTD = this.extractValueFromRow(dataset.summaryRow, '% Konsumsi TTD');
    const cANC = this.extractValueFromRow(dataset.totalRow, 'Ibu Hamil ANC 6x');
    const pANC = this.extractValueFromRow(dataset.summaryRow, '% ANC 6x');
    const cMMS = this.extractValueFromRow(dataset.totalRow, 'Ibu Hamil Konsumsi TTD/MMS');
    const pMMS = this.extractValueFromRow(dataset.summaryRow, '% TTD/MMS');
    const pASI = this.extractValueFromRow(dataset.summaryRow, '% ASI');
    const cASI = this.extractValueFromRow(dataset.totalRow, 'ASI Eksklusif');
    const pBumilPMT = this.extractValueFromRow(dataset.summaryRow, '% Bumil PMT');
    const cBumilPMT = this.extractValueFromRow(dataset.totalRow, 'Ibu Hamil KEK Konsumsi MT');
    const pIDL = this.extractValueFromRow(dataset.summaryRow, '% IDL');
    const cIDL = this.extractValueFromRow(dataset.totalRow, 'Baduta IDL');
    const pBBMT = this.extractValueFromRow(dataset.summaryRow, '% BB Tidak Naik (T) dapat MT');
    const cBBMT = this.extractValueFromRow(dataset.totalRow, 'Jumlah BB Tidak Naik (T) dapat MT');

    const totalDistricts = dataset.regionRows.length >= 30 ? dataset.regionRows.length : 35;

    const formatCompact = (val: number | null): string => {
      if (val === null) return '-';
      if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
      if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
      return val.toLocaleString('id-ID');
    };

    const formatPct = (val: number | null): string => {
      if (val === null) return '-';
      return `${(Math.round(val * 100) / 100).toFixed(2)}%`;
    };

    return [
      {
        id: 'kab-kota',
        label: 'Kabupaten & Kota Terdata',
        value: String(totalDistricts),
        subValue: `${totalDistricts} Kab/Kota di Jawa Tengah`,
        category: 'wilayah',
        badge: 'Lengkap',
        badgeType: 'success',
        icon: '🏛️',
      },
      {
        id: 'cakupan-ds',
        label: 'Cakupan Penimbangan (D/S)',
        value: formatPct(pDS),
        subValue: `${cDS ? cDS.toLocaleString('id-ID') : '-'} Balita (Target ≥ 85%)`,
        category: 'wilayah',
        badge: pDS && pDS >= 85 ? 'Target Tercapai' : 'Perlu Perhatian',
        badgeType: pDS && pDS >= 85 ? 'success' : 'warning',
        icon: '⚖️',
      },
      {
        id: 'sasaran-balita',
        label: 'Balita Ditimbang (D/S)',
        value: formatCompact(cDS),
        subValue: `${cDS ? cDS.toLocaleString('id-ID') : '-'} Balita Dipantau Posyandu`,
        category: 'sasaran',
        badge: 'Sasaran Utama',
        badgeType: 'info',
        icon: '👶',
      },
      {
        id: 'sasaran-rematri',
        label: 'Remaja Putri Konsumsi TTD',
        value: formatCompact(cTTD),
        subValue: `${cTTD ? cTTD.toLocaleString('id-ID') : '-'} Rematri (Cakupan ${formatPct(pTTD)})`,
        category: 'sasaran',
        badge: pTTD && pTTD >= 67 ? 'Target Tercapai' : 'Perlu Akselerasi',
        badgeType: pTTD && pTTD >= 67 ? 'success' : 'warning',
        icon: '👩‍🦰',
      },
      {
        id: 'sasaran-bumil',
        label: 'Sasaran Ibu Hamil',
        value: formatCompact(cMMS ?? cANC),
        subValue: `TTD: ${formatPct(pMMS)} (${cMMS ? cMMS.toLocaleString('id-ID') : '-'}) | ANC 6x: ${formatPct(pANC)}`,
        category: 'sasaran',
        badge: 'Perlu Akselerasi',
        badgeType: 'warning',
        icon: '🤰',
      },
      {
        id: 'stunting-prevalensi',
        label: 'Prevalensi Stunting Jateng',
        value: '9.81%',
        subValue: '141,184 Balita (Target RPJMN ≤ 14.0%)',
        category: 'capaian',
        badge: 'Di Bawah Batas',
        badgeType: 'success',
        icon: '📉',
      },
      {
        id: 'bb-tidak-naik',
        label: 'Balita BB Tidak Naik (T) PMT',
        value: formatPct(pBBMT),
        subValue: `${cBBMT ? cBBMT.toLocaleString('id-ID') : '-'} MT / 626.6K Kasus (Target ≥ 70%)`,
        category: 'capaian',
        badge: 'Risiko Kunci',
        badgeType: 'rose',
        icon: '⚠️',
      },
      {
        id: 'asi-eksklusif',
        label: 'ASI Eksklusif (<6 Bln)',
        value: formatPct(pASI),
        subValue: `${cASI ? cASI.toLocaleString('id-ID') : '-'} Bayi (Target Standar ≥ 76%)`,
        category: 'capaian',
        badge: pASI && pASI >= 76 ? 'Proteksi Kuat' : 'Perlu Peningkatan',
        badgeType: pASI && pASI >= 76 ? 'success' : 'warning',
        icon: '🍼',
      },
      {
        id: 'bumil-kek-pmt',
        label: 'Bumil KEK Tambahan Gizi',
        value: formatPct(pBumilPMT),
        subValue: `${cBumilPMT ? cBumilPMT.toLocaleString('id-ID') : '-'} Terlayani (55.1K Bumil Risiko KEK)`,
        category: 'capaian',
        badge: pBumilPMT && pBumilPMT >= 85 ? 'Tercapai' : 'Gap Akselerasi',
        badgeType: pBumilPMT && pBumilPMT >= 85 ? 'success' : 'warning',
        icon: '🥣',
      },
      {
        id: 'imunisasi-idl',
        label: 'Imunisasi Lengkap Baduta',
        value: formatPct(pIDL),
        subValue: `${cIDL ? cIDL.toLocaleString('id-ID') : '-'} Baduta (Target Standar ≥ 97%)`,
        category: 'capaian',
        badge: pIDL && pIDL >= 97 ? 'Tercapai' : 'Perlu Akselerasi',
        badgeType: pIDL && pIDL >= 97 ? 'success' : 'warning',
        icon: '💉',
      },
    ];
  }

  isOverTarget(val: unknown, threshold: number): boolean {
    const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
    return !isNaN(num) && num > threshold;
  }

  readonly mapRankingsDisplayItems = computed<DistrictHeatmapItem[]>(() => {
    const mapData =
      this.activeCategory() === 'gizi-heatmap'
        ? this.giziHeatmapResult()
        : this.intervensiHeatmapResult();
    if (!mapData || !mapData.rankedItems) return [];
    const filter = this.mapRankingsFilter();
    const items = mapData.rankedItems;
    if (filter === 'top5') {
      return items.slice(0, 5);
    }
    if (filter === 'bottom5') {
      return items.slice(-5).reverse();
    }
    return items;
  });

  // Navigation action for bottom oval buttons
  setActiveCategory(category: HomeCategory): void {
    this.activeCategory.set(category);
    this.hoveredDistrictId.set(null);
    this.selectedDistrictId.set(null);
    this.hoveredMapDistrict.set(null);
    this.selectedMapDistrict.set(null);
    this.showMapRankings.set(false);
  }

  setIntervensiIndicator(key: string): void {
    this.activeIntervensiIndicatorKey.set(key);
    const selected = this.selectedMapDistrict();
    if (selected) {
      const updated = this.intervensiHeatmapResult()?.items.find(
        (i) => i.district.id === selected.district.id,
      );
      if (updated) {
        this.selectedMapDistrict.set(updated);
      }
    }
  }

  setGiziIndicator(key: string): void {
    this.activeGiziIndicatorKey.set(key);
    const selected = this.selectedMapDistrict();
    if (selected) {
      const updated = this.giziHeatmapResult()?.items.find(
        (i) => i.district.id === selected.district.id,
      );
      if (updated) {
        this.selectedMapDistrict.set(updated);
      }
    }
  }

  onDistrictHover(districtId: string | null): void {
    this.hoveredDistrictId.set(districtId);
    if (!districtId) {
      this.hoveredMapDistrict.set(null);
    } else {
      const activeRes =
        this.activeCategory() === 'gizi-heatmap'
          ? this.giziHeatmapResult()
          : this.intervensiHeatmapResult();
      const match = activeRes?.items.find((it) => it.district.id === districtId) || null;
      this.hoveredMapDistrict.set(match);
    }
  }

  onDistrictClick(districtId: string): void {
    this.selectedDistrictId.set(districtId);
    const activeRes =
      this.activeCategory() === 'gizi-heatmap'
        ? this.giziHeatmapResult()
        : this.intervensiHeatmapResult();
    const match = activeRes?.items.find((it) => it.district.id === districtId) || null;
    this.selectedMapDistrict.set(match);
  }

  selectMapDistrict(item: DistrictHeatmapItem | null): void {
    this.selectedMapDistrict.set(item);
    this.selectedDistrictId.set(item ? item.district.id : null);
  }

  hoverMapDistrict(item: DistrictHeatmapItem | null): void {
    this.hoveredMapDistrict.set(item);
    this.hoveredDistrictId.set(item ? item.district.id : null);
  }

  closeMapDistrictInspector(): void {
    this.selectedMapDistrict.set(null);
    this.selectedDistrictId.set(null);
  }

  toggleMapRankings(): void {
    this.showMapRankings.update((v) => !v);
  }

  closeMapRankings(): void {
    this.showMapRankings.set(false);
  }

  setMapRankingsFilter(filter: 'all' | 'top5' | 'bottom5'): void {
    this.mapRankingsFilter.set(filter);
  }

  @HostListener('document:keydown.escape')
  onEscapePressed(): void {
    if (this.selectedMapDistrict()) {
      this.closeMapDistrictInspector();
    } else if (this.showMapRankings()) {
      this.closeMapRankings();
    }
  }

  setIntervensiViewMode(mode: 'map' | 'table'): void {
    if (mode === 'map' && this.activeIntervensiIndicatorKey() === 'all') {
      this.activeIntervensiIndicatorKey.set(this.intervensiIndicators[0].key);
    }
    this.intervensiViewMode.set(mode);
  }

  setGiziViewMode(mode: 'map' | 'table'): void {
    if (mode === 'map' && this.activeGiziIndicatorKey() === 'all') {
      this.activeGiziIndicatorKey.set(this.giziIndicators[0].key);
    }
    this.giziViewMode.set(mode);
  }

  onBarHover(
    event: MouseEvent,
    bar: ChartBarItem,
    categoryName: string,
    targetOverride?: number | null,
  ): void {
    let status: 'achieved' | 'unachieved' | 'none' = 'none';
    let diff: number | null = null;
    const target =
      targetOverride !== undefined && targetOverride !== null
        ? targetOverride
        : null;
    const ind =
      this.activeCategory() === 'gizi-heatmap'
        ? this.giziIndicators.find(
            (i) => i.key === bar.seriesKey || i.label === bar.seriesLabel,
          )
        : this.intervensiIndicators.find(
            (i) => i.key === bar.seriesKey || i.label === bar.seriesLabel,
          );
    const targetOp =
      ind?.operator ||
      (this.activeCategory() === 'gizi-heatmap' ? '<=' : '>=');

    if (target !== null && bar.numericVal !== null) {
      diff = Math.round((bar.numericVal - target) * 10) / 10;
      status =
        targetOp === '<='
          ? bar.numericVal <= target
            ? 'achieved'
            : 'unachieved'
          : bar.numericVal >= target
            ? 'achieved'
            : 'unachieved';
    }

    this.hoveredBar.set({
      categoryName,
      seriesLabel: bar.seriesLabel,
      color: bar.color,
      displayLabel: bar.displayLabel,
      numericVal: bar.numericVal,
      isZero: bar.isZero,
      isMissing: bar.isMissing,
      status,
      diff,
      targetValue: target,
    });
    this.tooltipPos.set({ x: event.clientX + 14, y: event.clientY + 14 });
  }

  onBarMouseMove(event: MouseEvent): void {
    if (this.hoveredBar()) {
      this.tooltipPos.set({ x: event.clientX + 14, y: event.clientY + 14 });
    }
  }

  onBarLeave(): void {
    this.hoveredBar.set(null);
  }

  slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-');
  }

  exportSvg(svgId: string, title: string): void {
    const svg = document.getElementById(svgId) as SVGSVGElement | null;
    if (!svg) return;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute(
      'style',
      'background-color: #ffffff; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
    );

    const serializer = new XMLSerializer();
    const svgString =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      serializer.serializeToString(clone);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.slugify(title) || 'grafik-indikator'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  exportPng(svgId: string, title: string): void {
    const svg = document.getElementById(svgId) as SVGSVGElement | null;
    if (!svg) return;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute(
      'style',
      'background-color: #ffffff; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
    );

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const viewBoxStr = svg.getAttribute('viewBox') || '';
    const parts = viewBoxStr.split(' ').map(Number);
    const width = parts.length === 4 && parts[2] > 0 ? parts[2] : 780;
    const height = parts.length === 4 && parts[3] > 0 ? parts[3] : 600;
    const scale = 2;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(scale, scale);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `${this.slugify(title) || 'grafik-indikator'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  formatNumber(val: number | null | undefined, decimals = 1): string {
    if (val === null || val === undefined || isNaN(val)) return '-';
    return val.toLocaleString('id-ID', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
}
