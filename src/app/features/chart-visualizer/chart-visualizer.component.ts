import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { HealthDataExchange } from '../../core/domain/health-data-exchange';
import {
  ChartBarItem,
  ChartDataRow,
  ChartSeriesConfig,
} from '../../core/chart/chart-layout-engine';
import {
  CENTRAL_JAVA_DISTRICTS,
  MAIN_MAP_VIEWBOX,
  NEIGHBOR_PROVINCES,
  DistrictMapFeature,
  NeighborProvince,
} from '../../core/stunting-dashboard/stunting-map-data';
import {
  DistrictHeatmapEngine,
  DistrictHeatmapItem,
  DistrictHeatmapResult,
  HEATMAP_PALETTES,
  HeatmapColorPalette,
} from '../../core/chart/district-heatmap-engine';
import {
  IndicatorCorrelationEngine,
  CorrelationMatrixResult,
  CorrelationCell,
  ScatterRegressionResult,
  ScatterPoint,
} from '../../core/chart/indicator-correlation-engine';
import {
  PriorityQuadrantEngine,
  PriorityQuadrantResult,
  QuadrantDistrictItem,
  QuadrantThresholdMode,
} from '../../core/chart/priority-quadrant-engine';
import {
  IndicatorStuntingKnowledge,
  IndicatorStuntingExplanation,
} from '../../core/chart/indicator-stunting-knowledge';
import { IndicatorEvaluator } from '../../core/evaluation/indicator-evaluator';
import {
  ChartSlicingEngine,
  IndicatorChartGroup,
  IndicatorStats,
  RegionChartGroup,
  RegionStats,
} from '../../core/chart/chart-slicing-engine';
import {
  ColumnInfo,
  ExcelEngine,
  ExcelWorkbook,
  ExcelWorkbookAdapter,
  ExcelWorkSheet,
  TabularSheetSpec,
} from '../../shared/excel';
import { ExcelResilientMatcher } from '../../core/excel/excel-resilient-matcher';
import {
  ChartConfigurationPreset,
  ConfigurationWorkspace,
} from '../../core/storage/configuration-workspace';
import {
  BackendStorageService,
  BackendTrendPoint,
} from '../../core/storage/backend-storage.service';

import { UiAlertComponent, UiButtonComponent, UiPageHeaderComponent } from '../../shared/ui';

export type { IndicatorChartGroup, IndicatorStats, RegionChartGroup, RegionStats };

@Component({
  selector: 'app-chart-visualizer',
  standalone: true,
  imports: [CommonModule, FormsModule, UiPageHeaderComponent, UiButtonComponent, UiAlertComponent],
  templateUrl: './chart-visualizer.component.html',
})
export class ChartVisualizerComponent {
  readonly Math = Math;
  private healthDataExchange = inject(HealthDataExchange);
  readonly backendStorage = inject(BackendStorageService);

  // Fitur Toolbar Actions (Konfigurasi Terakhir, Muat JSON, Simpan JSON) via Environment
  enableToolbarActions = signal<boolean>(
    Boolean(
      (environment as { enableChartToolbarActions?: boolean; enableChartConfigActions?: boolean })
        .enableChartToolbarActions ??
      (environment as { enableChartToolbarActions?: boolean; enableChartConfigActions?: boolean })
        .enableChartConfigActions ??
      false,
    ),
  );

  // Kontrol Tampilan Tombol Pengaturan via Environment
  enableSettingsButton = signal<boolean>(
    Boolean(
      (
        environment as {
          enableChartSettings?: boolean;
          enableChartSettingsButton?: boolean;
          enableChartToolbarActions?: boolean;
        }
      ).enableChartSettings ??
      (
        environment as {
          enableChartSettings?: boolean;
          enableChartSettingsButton?: boolean;
          enableChartToolbarActions?: boolean;
        }
      ).enableChartSettingsButton ??
      (
        environment as {
          enableChartSettings?: boolean;
          enableChartSettingsButton?: boolean;
          enableChartToolbarActions?: boolean;
        }
      ).enableChartToolbarActions ??
      false,
    ),
  );

  // Status & Panel
  dataSource = signal<'join' | 'upload' | 'empty'>('empty');
  notificationMessage = signal<string | null>(null);

  notificationMessageType = computed<'info' | 'success' | 'warning' | 'error'>(() => {
    const msg = this.notificationMessage()?.toLowerCase() || '';
    if (msg.includes('berhasil')) return 'success';
    if (msg.includes('gagal') || msg.includes('tidak didukung')) return 'error';
    return 'info';
  });

  showSettingsPanel = signal(false);
  showIndicatorPanel = signal(false);
  showSettings = signal(false);

  toggleSettings(): void {
    this.showSettings.update((v) => !v);
  }

  // Fitur Simpan & Muat Konfigurasi Preset
  pendingPreset: ChartConfigurationPreset | null = null;
  hasSavedConfig = signal<boolean>(ConfigurationWorkspace.chart.hasSavedPreset());
  activePresetName = signal<string>('');
  configNotification = signal<{
    type: 'success' | 'warning' | 'info';
    message: string;
    details?: string[];
  } | null>(null);

  // ============================================================
  // WORKBOOK & INLINE STEP CONFIGURATION (FLOW FITUR JOIN)
  // ============================================================
  file = signal<File | null>(null);
  workbook: ExcelWorkbook | null = null;
  sheetNames = signal<string[]>([]);
  selectedSheet = signal<string>('');
  isProcessing = signal(false);

  // Step 2: Konfigurasi Baris Header & Data (Multi-tier header support)
  headerStartRow = signal<number>(1);
  headerEndRow = signal<number>(1);
  dataStartRow = signal<number>(2);

  // Kolom sheet aktif
  sheetColumns = signal<ColumnInfo[]>([]);

  // Step 3: Kolom Kategori (Sumbu Y) & Kolom Seri (Batang)
  categoryColumn = signal<string>('');
  selectedSeriesKeys = signal<string[]>([]);
  columnSearchQuery = signal<string>('');

  // Metadata & Konfigurasi Judul
  chartTitle = signal('Visualisasi Capaian Indikator Kesehatan');
  chartSubtitle = signal('');

  // Kolom Data untuk Layout
  allColumns = signal<string[]>([]);

  // Seleksi & Manajemen Baris (Label Sumbu Y)
  availableCategories = signal<string[]>([]);
  selectedCategories = signal<string[]>([]);
  categorySearchQuery = signal('');

  // Seri Indikator Aktif (Warna & Geometri Batang)
  seriesList = signal<ChartSeriesConfig[]>([]);
  dataRows = signal<ChartDataRow[]>([]);
  originalDataRows = signal<ChartDataRow[]>([]);
  targetValue = signal<number | null>(null);

  // Mode Tampilan: 'by-region' | 'by-indicator' | 'by-map' | 'by-correlation' | 'by-quadrant' | 'by-trends'
  viewMode = signal<'by-region' | 'by-indicator' | 'by-map' | 'by-correlation' | 'by-quadrant' | 'by-trends'>('by-region');

  // ============================================================
  // MODE 6: TREN LINTAS PERIODE (SERVER SQLITE ANALYTICS)
  // ============================================================
  trendAvailableIndicators = signal<string[]>([]);
  selectedTrendIndicator = signal<string>('');
  selectedTrendDistrictCode = signal<string>('');
  trendSeries = signal<BackendTrendPoint[]>([]);
  isLoadingTrends = signal<boolean>(false);
  trendError = signal<string | null>(null);

  trendChartBars = computed(() => {
    const pts = this.trendSeries();
    if (pts.length === 0) return [];
    const vals = pts.map((p) => p.avgValue ?? 0);
    const maxVal = Math.max(...vals, 1);
    return pts.map((p) => {
      const val = p.avgValue ?? 0;
      const heightPct = Math.max(8, Math.min(100, Math.round((val / maxVal) * 100)));
      return {
        ...p,
        label: `${p.year} ${p.quarter}`,
        heightPct,
      };
    });
  });

  async loadTrendPanelData(): Promise<void> {
    this.isLoadingTrends.set(true);
    this.trendError.set(null);
    try {
      const serverIndicators = await this.backendStorage.getAvailableIndicators();
      const localSeriesKeys = this.seriesList().map((s) => s.key);
      const merged = Array.from(new Set([...serverIndicators, ...localSeriesKeys]));
      this.trendAvailableIndicators.set(merged);

      let activeInd = this.selectedTrendIndicator();
      if (!activeInd || !merged.includes(activeInd)) {
        activeInd = merged[0] || '';
        this.selectedTrendIndicator.set(activeInd);
      }

      if (activeInd) {
        await this.fetchIndicatorTrend(activeInd, this.selectedTrendDistrictCode());
      } else {
        this.trendSeries.set([]);
      }
    } catch (err: unknown) {
      this.trendError.set(
        err instanceof Error ? err.message : 'Gagal memuat daftar indikator tren dari server.',
      );
    } finally {
      this.isLoadingTrends.set(false);
    }
  }

  async fetchIndicatorTrend(indicatorKey?: string, districtCode?: string): Promise<void> {
    const ind = (indicatorKey ?? this.selectedTrendIndicator()).trim();
    const dist = (districtCode ?? this.selectedTrendDistrictCode()).trim();
    if (!ind) {
      this.trendSeries.set([]);
      return;
    }

    this.isLoadingTrends.set(true);
    this.trendError.set(null);
    try {
      const res = await this.backendStorage.getIndicatorTrends(ind, dist || undefined);
      if (!res.success) {
        this.trendError.set(res.error || 'Gagal mengambil data tren dari server SQLite.');
        this.trendSeries.set([]);
        return;
      }
      this.trendSeries.set(res.series);
    } finally {
      this.isLoadingTrends.set(false);
    }
  }

  onTrendIndicatorChange(indicatorKey: string): void {
    this.selectedTrendIndicator.set(indicatorKey);
    void this.fetchIndicatorTrend(indicatorKey, this.selectedTrendDistrictCode());
  }

  onTrendDistrictChange(districtCode: string): void {
    this.selectedTrendDistrictCode.set(districtCode);
    void this.fetchIndicatorTrend(this.selectedTrendIndicator(), districtCode);
  }

  // ============================================================
  // MODE PETA HEATMAP (SPASIAL JAWA TENGAH)
  // ============================================================
  readonly mainMapViewBox = MAIN_MAP_VIEWBOX;
  readonly neighborProvinces: NeighborProvince[] = NEIGHBOR_PROVINCES;
  readonly centralJavaDistricts: DistrictMapFeature[] = CENTRAL_JAVA_DISTRICTS;

  activeMapIndicator = signal<string>('');
  hoveredMapDistrict = signal<DistrictHeatmapItem | null>(null);

  activeMapSeries = computed<ChartSeriesConfig | null>(() => {
    const list = this.seriesList();
    if (list.length === 0) return null;
    const currentKey = this.activeMapIndicator();
    if (currentKey) {
      const match = list.find((s) => s.key === currentKey);
      if (match) return match;
    }
    return list[0];
  });

  setActiveMapIndicator(key: string): void {
    this.activeMapIndicator.set(key);
  }

  readonly heatmapPalettes = HEATMAP_PALETTES;
  selectedHeatmapPaletteId = signal<string>('red-yellow-green');

  mapHeatmapResult = computed<DistrictHeatmapResult | null>(() => {
    const s = this.activeMapSeries();
    if (!s) return null;
    const catCol = this.categoryColumn();
    const rows = this.dataRows();
    const target = this.getIndicatorTarget(s.key);
    const targetOperator = this.getIndicatorOperator(s.key);

    return DistrictHeatmapEngine.computeHeatmap({
      districts: this.centralJavaDistricts,
      rows,
      categoryColumn: catCol,
      series: s,
      targetValue: target,
      targetOperator,
      paletteId: this.selectedHeatmapPaletteId(),
    });
  });

  indicatorExplanation = computed<IndicatorStuntingExplanation | null>(() => {
    const s = this.activeMapSeries();
    if (!s) return null;
    return IndicatorStuntingKnowledge.getExplanation(s.label || s.key);
  });

  // Tata Letak Kolom Grafik pada Mode Per Wilayah (1, 2, atau 3 grafik per baris)
  regionGridColumns = signal<1 | 2 | 3>(2);

  // Pengurutan Wilayah pada Mode Per Wilayah ('default' | 'desc' | 'asc')
  regionSortMode = signal<'default' | 'desc' | 'asc'>('default');

  // Tata Letak Kolom Grafik pada Mode Per Indikator (1, 2, atau 3 grafik per baris)
  indicatorGridColumns = signal<1 | 2 | 3>(2);

  // Pengurutan Wilayah pada Mode Per Indikator
  indicatorSortMode = signal<'default' | 'desc' | 'asc'>('default');

  // Filter Tab Indikator pada Mode Per Indikator ('all' atau key seri tertentu)
  selectedIndicatorFilter = signal<string>('all');

  // ============================================================
  // MODE 4: MATRIKS KORELASI INDIKATOR (CORRELOGRAM & SCATTER)
  // ============================================================
  selectedCorrelationCell = signal<CorrelationCell | null>(null);
  hoveredScatterPoint = signal<ScatterPoint | null>(null);

  correlationMatrixResult = computed<CorrelationMatrixResult | null>(() => {
    const rows = this.dataRows();
    const series = this.seriesList();
    if (rows.length === 0 || series.length === 0) return null;
    return IndicatorCorrelationEngine.calculateCorrelationMatrix(rows, series);
  });

  selectedScatterRegression = computed<ScatterRegressionResult | null>(() => {
    const rows = this.dataRows();
    const catCol = this.categoryColumn();
    const cell = this.selectedCorrelationCell();
    const series = this.seriesList();
    if (rows.length === 0 || series.length < 2) return null;

    let s1 = series[0];
    let s2 = series[1];
    if (cell) {
      const match1 = series.find((s) => s.key === cell.key1);
      const match2 = series.find((s) => s.key === cell.key2);
      if (match1 && match2) {
        s1 = match1;
        s2 = match2;
      }
    }

    return IndicatorCorrelationEngine.calculateScatterRegression(rows, catCol, s1, s2);
  });

  selectCorrelationPair(key1: string, key2: string): void {
    const mat = this.correlationMatrixResult();
    if (!mat) return;
    for (const row of mat.matrix) {
      for (const cell of row) {
        if (
          (cell.key1 === key1 && cell.key2 === key2) ||
          (cell.key1 === key2 && cell.key2 === key1)
        ) {
          this.selectedCorrelationCell.set(cell);
          return;
        }
      }
    }
  }

  setHoveredScatterPoint(pt: ScatterPoint | null): void {
    this.hoveredScatterPoint.set(pt);
  }

  // ============================================================
  // MODE 5: KUADRAN PRIORITAS (4-QUADRANT POLICY MATRIX)
  // ============================================================
  quadrantMetricX = signal<string>('composite_hulu');
  quadrantMetricY = signal<string>('composite_hilir');
  quadrantThresholdMode = signal<QuadrantThresholdMode>('median');
  quadrantCustomThreshX = signal<number>(50);
  quadrantCustomThreshY = signal<number>(50);
  hoveredQuadrantDistrict = signal<QuadrantDistrictItem | null>(null);
  selectedQuadrantFilter = signal<1 | 2 | 3 | 4 | 'all'>('all');

  priorityQuadrantResult = computed<PriorityQuadrantResult | null>(() => {
    const rows = this.dataRows();
    const series = this.seriesList();
    const catCol = this.categoryColumn();
    if (rows.length === 0 || series.length === 0) return null;

    return PriorityQuadrantEngine.classifyQuadrants({
      rows,
      categoryColumn: catCol,
      seriesList: series,
      metricX: this.quadrantMetricX(),
      metricY: this.quadrantMetricY(),
      thresholdMode: this.quadrantThresholdMode(),
      customThresholdX: this.quadrantCustomThreshX(),
      customThresholdY: this.quadrantCustomThreshY(),
    });
  });

  filteredQuadrantDistricts = computed<QuadrantDistrictItem[]>(() => {
    const res = this.priorityQuadrantResult();
    if (!res) return [];
    const filter = this.selectedQuadrantFilter();
    if (filter === 'all') return res.districts;
    return res.districts.filter((d) => d.quadrant === filter);
  });

  quadrantCrosshairs = computed(() => {
    const res = this.priorityQuadrantResult();
    if (!res) return { xPercent: 50, yPercent: 50 };
    const spanX = res.maxX > res.minX ? res.maxX - res.minX : 1;
    const spanY = res.maxY > res.minY ? res.maxY - res.minY : 1;
    const xPct = Math.max(5, Math.min(95, ((res.thresholdX - res.minX) / spanX) * 100));
    const yPct = Math.max(5, Math.min(95, ((res.thresholdY - res.minY) / spanY) * 100));
    return { xPercent: xPct, yPercent: yPct };
  });

  quadrantSvgLayout = computed(() => {
    const cross = this.quadrantCrosshairs();
    const xCross = Math.round((60 + (cross.xPercent / 100) * 600) * 10) / 10;
    const yCross = Math.round((40 + (1 - cross.yPercent / 100) * 380) * 10) / 10;
    return {
      xCross,
      yCross,
      q2Width: Math.max(0, xCross - 60),
      q2Height: Math.max(0, yCross - 40),
      q1Width: Math.max(0, 660 - xCross),
      q1Height: Math.max(0, yCross - 40),
      q4Width: Math.max(0, xCross - 60),
      q4Height: Math.max(0, 420 - yCross),
      q3Width: Math.max(0, 660 - xCross),
      q3Height: Math.max(0, 420 - yCross),
    };
  });

  scatterSvgLayout = computed(() => {
    const reg = this.selectedScatterRegression();
    if (!reg) return null;
    const y1 = reg.slope * reg.minX + reg.intercept;
    const y2 = reg.slope * reg.maxX + reg.intercept;
    const spanY = reg.maxY > reg.minY ? reg.maxY - reg.minY : 1;
    const normY1 = Math.max(0, Math.min(1, (y1 - reg.minY) / spanY));
    const normY2 = Math.max(0, Math.min(1, (y2 - reg.minY) / spanY));
    return {
      x1: 60,
      y1: Math.round((30 + (1 - normY1) * 330) * 10) / 10,
      x2: 670,
      y2: Math.round((30 + (1 - normY2) * 330) * 10) / 10,
    };
  });

  setQuadrantThresholdMode(mode: QuadrantThresholdMode): void {
    this.quadrantThresholdMode.set(mode);
  }

  setQuadrantFilter(filter: 1 | 2 | 3 | 4 | 'all'): void {
    this.selectedQuadrantFilter.set(filter);
  }

  setHoveredQuadrantDistrict(d: QuadrantDistrictItem | null): void {
    this.hoveredQuadrantDistrict.set(d);
  }

  setViewMode(
    mode:
      | 'by-region'
      | 'by-indicator'
      | 'by-map'
      | 'by-correlation'
      | 'by-quadrant'
      | 'by-trends',
  ): void {
    this.viewMode.set(mode);
    if (mode === 'by-trends') {
      void this.loadTrendPanelData();
    }
  }

  setRegionGridColumns(cols: number | 1 | 2 | 3): void {
    const valid = (cols === 1 || cols === 3 ? cols : 2) as 1 | 2 | 3;
    this.regionGridColumns.set(valid);
  }

  setRegionSortMode(mode: string | 'default' | 'desc' | 'asc'): void {
    this.regionSortMode.set(mode === 'desc' || mode === 'asc' ? mode : 'default');
  }

  setIndicatorGridColumns(cols: number | 1 | 2 | 3): void {
    const valid = (cols === 1 || cols === 3 ? cols : 2) as 1 | 2 | 3;
    this.indicatorGridColumns.set(valid);
  }

  indicatorGridClass = computed(() => {
    switch (this.indicatorGridColumns()) {
      case 1:
        return 'grid grid-cols-1 gap-6 max-w-4xl mx-auto';
      case 2:
        return 'grid grid-cols-1 lg:grid-cols-2 gap-6';
      case 3:
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5';
    }
  });

  regionGridClass = computed(() => {
    switch (this.regionGridColumns()) {
      case 1:
        return 'grid grid-cols-1 gap-6 max-w-4xl mx-auto';
      case 2:
        return 'grid grid-cols-1 lg:grid-cols-2 gap-6';
      case 3:
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5';
    }
  });

  setIndicatorSortMode(mode: string | 'default' | 'desc' | 'asc'): void {
    this.indicatorSortMode.set(mode === 'desc' || mode === 'asc' ? mode : 'default');
  }

  setSelectedIndicatorFilter(key: string): void {
    this.selectedIndicatorFilter.set(key);
  }

  // Nilai Target Khusus Per-Indikator
  indicatorTargets = signal<Record<string, number | null>>({});
  indicatorTargetOperators = signal<Record<string, string>>({});
  targetOperator = signal<string>('>=');

  getIndicatorTarget(seriesKey: string): number | null {
    const specific = this.indicatorTargets()[seriesKey];
    if (specific !== undefined) {
      return specific !== null && specific >= 0 ? specific : null;
    }
    const globalTgt = this.targetValue();
    return globalTgt !== null && globalTgt >= 0 ? globalTgt : null;
  }

  getIndicatorOperator(seriesKey: string): string {
    const specific = this.indicatorTargetOperators()[seriesKey];
    if (specific) return specific;
    const lowerKey = seriesKey.trim().toLowerCase();
    for (const [k, op] of Object.entries(this.indicatorTargetOperators())) {
      if (k.trim().toLowerCase() === lowerKey && op) {
        return op;
      }
    }
    return this.targetOperator() || '>=';
  }

  setIndicatorTarget(seriesKey: string, val: number | null): void {
    const sanitized = val !== null && !isNaN(val) && val >= 0 ? val : null;
    this.indicatorTargets.update((curr) => ({
      ...curr,
      [seriesKey]: sanitized,
    }));
  }

  onRegionTargetChange(rawVal: string, inputEl?: HTMLInputElement): void {
    const trimmed = (rawVal ?? '').trim();
    if (trimmed === '') {
      this.targetValue.set(null);
      return;
    }
    const num = Number(trimmed);
    if (isNaN(num) || num < 0) {
      this.targetValue.set(null);
      if (inputEl) {
        inputEl.value = '';
      }
    } else {
      this.targetValue.set(num);
    }
  }

  onIndicatorTargetChange(seriesKey: string, rawVal: string, inputEl?: HTMLInputElement): void {
    const trimmed = (rawVal ?? '').trim();
    if (trimmed === '') {
      this.setIndicatorTarget(seriesKey, null);
      return;
    }
    const num = Number(trimmed);
    if (isNaN(num) || num < 0) {
      this.setIndicatorTarget(seriesKey, null);
      if (inputEl) {
        inputEl.value = '';
      }
    } else {
      this.setIndicatorTarget(seriesKey, num);
    }
  }

  // Popover Pengaturan Target Indikator di Toolbar Per Wilayah
  showTargetPopover = signal<boolean>(false);

  toggleTargetPopover(): void {
    this.showTargetPopover.update((v) => !v);
  }

  closeTargetPopover(): void {
    this.showTargetPopover.set(false);
  }

  configuredTargetCount = computed<number>(() => {
    const targets = this.indicatorTargets();
    let count = 0;
    for (const s of this.filteredChartSeries()) {
      if (targets[s.key] !== undefined && targets[s.key] !== null && targets[s.key]! >= 0) {
        count++;
      }
    }
    return count;
  });

  clearAllIndicatorTargets(): void {
    this.indicatorTargets.set({});
    this.indicatorTargetOperators.set({});
    this.targetOperator.set('>=');
    this.targetValue.set(null);
  }

  applyGlobalTargetToAll(rawVal: string): void {
    const trimmed = (rawVal ?? '').trim();
    if (trimmed === '') return;
    const num = Number(trimmed);
    if (isNaN(num) || num < 0) return;
    const updated: Record<string, number | null> = {};
    for (const s of this.seriesList()) {
      updated[s.key] = num;
    }
    this.indicatorTargets.set(updated);
    this.targetValue.set(num);
  }

  preventNegativeKey(event: KeyboardEvent): void {
    if (event.key === '-' || event.key === 'Subtract') {
      event.preventDefault();
    }
  }

  readonly colorPalette = [
    '#525AFF', // Electric Indigo (Primary)
    '#4AB5B5', // Aqua Teal (Secondary)
    '#6D8BC0', // Slate Periwinkle (Muted)
    '#8FD9FB', // Sky Cyan (Accent)
    '#F59E0B', // Amber
    '#EC4899', // Pink Coral
    '#10B981', // Emerald
    '#6366F1', // Indigo Accent
  ];

  // Tooltip Interaktif
  hoveredBar = signal<{
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

  tooltipPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  constructor() {
    this.loadTransferredData();
  }

  // ============================================================
  // LOAD DATA DARI FITUR JOIN
  // ============================================================

  private loadTransferredData(): void {
    const transferred = this.healthDataExchange.chartData();
    if (!transferred || transferred.rows.length === 0) {
      return;
    }

    this.dataSource.set(transferred.source);
    if (transferred.title) {
      this.chartTitle.set(transferred.title);
      // this.chartSubtitle.set(`Visualisasi data dari hasil join sheet`);
    }

    this.allColumns.set(transferred.columns);
    this.categoryColumn.set(transferred.categoryColumn);
    this.dataRows.set(transferred.rows);
    this.originalDataRows.set(transferred.rows);

    const mappedCols: ColumnInfo[] = transferred.columns.map((col, idx) => ({
      colIndex: idx,
      colLetter: ExcelWorkbookAdapter.encodeCol(idx),
      header: col,
      leafHeader: col,
      layers: [col],
    }));
    this.sheetColumns.set(mappedCols);

    const cats = Array.from(
      new Set(
        transferred.rows
          .map((r) => String(r[transferred.categoryColumn] ?? '').trim())
          .filter(Boolean),
      ),
    );
    this.availableCategories.set(cats);
    this.selectedCategories.set(cats);

    if (transferred.indicatorTargets) {
      this.indicatorTargets.set({ ...transferred.indicatorTargets });
    }

    if (transferred.indicatorTargetOperators) {
      this.indicatorTargetOperators.set({ ...transferred.indicatorTargetOperators });
    }

    if (transferred.targetOperator) {
      this.targetOperator.set(transferred.targetOperator);
    }

    if (transferred.targetValue !== undefined) {
      this.targetValue.set(transferred.targetValue ?? 50);
    } else {
      this.targetValue.set(50);
    }

    if (transferred.defaultViewMode) {
      this.viewMode.set(transferred.defaultViewMode);
    } else if (transferred.source === 'join' && transferred.categoryColumn !== 'Indikator') {
      this.viewMode.set('by-indicator');
    }

    const candidateSeries = transferred.columns.filter(
      (c) =>
        c !== transferred.categoryColumn && !c.startsWith('__') && c !== 'No' && c !== 'Capaian',
    );

    // Filter hanya kolom yang memiliki nilai angka (numerik) valid
    const nonNumericSet = new Set(transferred.nonNumericColumns || []);
    const numericCandidates = candidateSeries.filter(
      (col) =>
        !nonNumericSet.has(col) &&
        transferred.rows.some((r) => IndicatorEvaluator.parseSmartNumber(r[col]) !== null),
    );

    // Identifikasi seluruh kolom persentase yang berupa angka
    const explicitPctSet =
      transferred.percentageColumns && transferred.percentageColumns.length > 0
        ? new Set(transferred.percentageColumns)
        : null;
    const targetKeys = new Set(
      Object.keys(transferred.indicatorTargets || {}).filter(
        (k) =>
          transferred.indicatorTargets?.[k] !== null &&
          transferred.indicatorTargets?.[k] !== undefined,
      ),
    );

    const percentageCandidates = numericCandidates.filter((col) => {
      if (explicitPctSet) {
        return explicitPctSet.has(col);
      }
      return HealthDataExchange.isPercentageColumnName(col);
    });

    // Pilih seluruh kolom persentase berangka secara otomatis (fallback ke seluruh kolom angka bila tidak ada kolom persentase)
    const selectedCols = percentageCandidates.length > 0 ? percentageCandidates : numericCandidates;

    const initialSeries = selectedCols.map((col, idx) => ({
      key: col,
      label: col,
      color: this.colorPalette[idx % this.colorPalette.length],
    }));

    this.seriesList.set(initialSeries);
    this.selectedSeriesKeys.set(initialSeries.map((s) => s.key));

    this.notificationMessage.set(
      `Data hasil Join berhasil dimuat! (${cats.length} baris, ${initialSeries.length} seri)`,
    );
  }

  hasJoinBridgeData = computed<boolean>(() => {
    const transferred = this.healthDataExchange.chartData();
    return Boolean(transferred && transferred.rows && transferred.rows.length > 0);
  });

  restoreJoinData(): void {
    this.clearFile();
    this.loadTransferredData();
    this.resetChartFilters();
    this.showSettings.set(false);
  }

  // ============================================================
  // STEP 1 : FILE UPLOAD & MANAGEMENT
  // ============================================================

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.notificationMessage.set('File harus berformat .xlsx');
      input.value = '';
      return;
    }

    this.file.set(file);
    this.isProcessing.set(true);

    try {
      const buffer = await file.arrayBuffer();
      const wb = ExcelEngine.readWorkbook(buffer);
      this.workbook = wb;
      this.sheetNames.set(wb.SheetNames);

      this.dataSource.set('upload');
      this.chartTitle.set(`Visualisasi - ${file.name}`);

      if (this.pendingPreset) {
        const p = this.pendingPreset;
        this.pendingPreset = null;
        this.applyConfiguration(p, this.activePresetName() || 'Konfigurasi Terpilih');
      } else if (wb.SheetNames.length > 0) {
        this.selectSheet(wb.SheetNames[0]);
      }
    } catch (err) {
      console.error('File Error:', err);
      this.notificationMessage.set(
        `Gagal membaca file: ${err instanceof Error ? err.message : 'Format tidak didukung.'}`,
      );
    } finally {
      this.isProcessing.set(false);
      input.value = '';
    }
  }

  clearFile(): void {
    this.file.set(null);
    this.workbook = null;
    this.sheetNames.set([]);
    this.selectedSheet.set('');
    this.sheetColumns.set([]);
    this.allColumns.set([]);
    this.categoryColumn.set('');
    this.selectedSeriesKeys.set([]);
    this.dataRows.set([]);
    this.originalDataRows.set([]);
    this.availableCategories.set([]);
    this.selectedCategories.set([]);
    this.seriesList.set([]);
    this.indicatorTargets.set({});
    this.indicatorTargetOperators.set({});
    this.targetOperator.set('>=');
    this.targetValue.set(null);
    this.dataSource.set('empty');
    this.showRegionFilterModal.set(false);
    this.showIndicatorFilterModal.set(false);
    this.resetChartFilters();
    this.showSettings.set(true);
  }

  // ============================================================
  // STEP 2 : PILIH SHEET & KONFIGURASI BARIS HEADER (MULTI-TIER)
  // ============================================================

  selectSheet(sheetName: string): void {
    if (!this.workbook) return;
    const worksheet = this.workbook.Sheets[sheetName];
    if (!worksheet) return;

    this.selectedSheet.set(sheetName);
    this.chartTitle.set(`Visualisasi Capaian Indikator - ${sheetName}`);
    this.chartSubtitle.set(`Sumber: ${this.file()?.name || 'File Excel'}`);

    const struct = ExcelEngine.detectSheetStructure(worksheet);
    this.headerStartRow.set(struct.headerStartRow);
    this.headerEndRow.set(struct.headerEndRow);
    this.dataStartRow.set(struct.dataStartRow);

    this.refreshSheetColumnsAndData(
      worksheet,
      struct.headerStartRow,
      struct.headerEndRow,
      struct.dataStartRow,
    );
  }

  refreshSheetColumnsAndData(
    worksheet: ExcelWorkSheet,
    startRow: number,
    endRow: number,
    dataStart: number,
  ): void {
    const cols = ExcelEngine.extractSheetColumns(worksheet, startRow, endRow);
    this.sheetColumns.set(cols);
    this.allColumns.set(cols.map((c) => c.header));

    // Otomatis tentukan kolom kategori jika belum ada atau sudah berubah
    const colHeaders = cols.map((c) => c.header);
    let cat = this.categoryColumn();
    if (!cat || !colHeaders.includes(cat)) {
      cat =
        cols.find((c) => {
          const lower = c.header.toLowerCase();
          return (
            lower.includes('wilayah') ||
            lower.includes('kabupaten') ||
            lower.includes('kota') ||
            lower.includes('daerah') ||
            lower.includes('nama') ||
            lower.includes('puskesmas')
          );
        })?.header || (cols.length > 0 ? cols[0].header : '');
      this.categoryColumn.set(cat);
    }

    // Rekomendasi seri indikator (hanya kolom angka yang relevan, jangan semua!)
    let selectedSeries = this.selectedSeriesKeys().filter(
      (s) => s !== cat && colHeaders.includes(s),
    );

    if (selectedSeries.length === 0) {
      const allRows = ExcelEngine.readSheetRows(worksheet, cols, dataStart);
      const targetRow = allRows.find((r) =>
        String(r[cat] ?? '')
          .trim()
          .toLowerCase()
          .startsWith('target'),
      );
      const sampleRows = allRows.slice(0, 10);
      const numericCols: string[] = [];

      for (const col of cols) {
        if (
          col.header === cat ||
          col.header.startsWith('__') ||
          col.header === 'No' ||
          col.header === 'Capaian'
        ) {
          continue;
        }
        const hasNumber = sampleRows.some(
          (r) => IndicatorEvaluator.parseSmartNumber(r[col.header]) !== null,
        );
        if (hasNumber) {
          numericCols.push(col.header);
        }
      }

      if (targetRow) {
        const targetCols = numericCols.filter((c) => {
          const raw = targetRow[c];
          if (raw === undefined || raw === null || raw === '-') return false;
          const cleanStr = String(raw)
            .replace(/^[<>=!\s]+/, '')
            .trim();
          return IndicatorEvaluator.parseSmartNumber(cleanStr) !== null;
        });
        selectedSeries = (targetCols.length > 0 ? targetCols : numericCols).slice(0, 4);
      } else {
        selectedSeries = numericCols.slice(0, 4);
      }
    }
    this.selectedSeriesKeys.set(selectedSeries);

    this.rebuildChartData(worksheet, cols, cat, selectedSeries, dataStart);
  }

  rebuildChartData(
    worksheet: ExcelWorkSheet,
    cols: ColumnInfo[],
    catCol: string,
    seriesKeys: string[],
    dataStart: number,
  ): void {
    if (!catCol || seriesKeys.length === 0) {
      this.dataRows.set([]);
      this.availableCategories.set([]);
      this.selectedCategories.set([]);
      this.seriesList.set([]);
      return;
    }

    const rows = ExcelEngine.readSheetRows(worksheet, cols, dataStart);

    // Otomatis deteksi baris TARGET bila ada pada lembar data Excel
    const targetRow = rows.find((r) => {
      const val = String(r[catCol] ?? '')
        .trim()
        .toLowerCase();
      return val.startsWith('target');
    });

    if (targetRow) {
      const detectedTargets: Record<string, number | null> = { ...this.indicatorTargets() };
      for (const col of cols) {
        if (
          col.header === catCol ||
          col.header.startsWith('__') ||
          col.header === 'No' ||
          col.header === 'Capaian'
        ) {
          continue;
        }
        const raw = targetRow[col.header];
        if (raw !== undefined && raw !== null && raw !== '-') {
          const cleanStr = String(raw)
            .replace(/^[<>=!\s]+/, '')
            .trim();
          const num = IndicatorEvaluator.parseSmartNumber(cleanStr);
          if (num !== null) {
            detectedTargets[col.header] = num;
          }
        }
      }
      this.indicatorTargets.set(detectedTargets);
      if (this.targetValue() === null || this.targetValue() === undefined) {
        this.targetValue.set(50);
      }
    }

    const cleanedRows = rows.filter((r) => {
      const val = String(r[catCol] ?? '').trim();
      if (!val) return false;
      const lower = val.toLowerCase();
      return (
        !lower.startsWith('total') &&
        !lower.startsWith('jumlah') &&
        !lower.startsWith('rata-rata') &&
        !lower.startsWith('sub total') &&
        !lower.startsWith('target')
      );
    });

    const cats = Array.from(
      new Set(cleanedRows.map((r) => String(r[catCol] ?? '').trim()).filter(Boolean)),
    );

    const series: ChartSeriesConfig[] = seriesKeys.map((key, idx) => ({
      key,
      label: key,
      color: this.colorPalette[idx % this.colorPalette.length],
    }));

    this.dataRows.set(cleanedRows);
    this.originalDataRows.set(cleanedRows);
    this.availableCategories.set(cats);
    this.selectedCategories.set(cats);
    this.seriesList.set(series);
  }

  onHeaderStartRowChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1) {
      const nextEnd = Math.max(val, this.headerEndRow());
      this.headerStartRow.set(val);
      this.headerEndRow.set(nextEnd);
      const nextDataStart = Math.max(nextEnd + 1, this.dataStartRow());
      this.dataStartRow.set(nextDataStart);

      if (this.workbook && this.selectedSheet()) {
        const ws = this.workbook.Sheets[this.selectedSheet()];
        if (ws) {
          this.refreshSheetColumnsAndData(ws, val, nextEnd, nextDataStart);
        }
      }
    }
  }

  onHeaderEndRowChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1) {
      const nextStart = Math.min(val, this.headerStartRow());
      this.headerStartRow.set(nextStart);
      this.headerEndRow.set(val);
      const nextDataStart = Math.max(val + 1, this.dataStartRow());
      this.dataStartRow.set(nextDataStart);

      if (this.workbook && this.selectedSheet()) {
        const ws = this.workbook.Sheets[this.selectedSheet()];
        if (ws) {
          this.refreshSheetColumnsAndData(ws, nextStart, val, nextDataStart);
        }
      }
    }
  }

  onDataStartRowChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1) {
      this.dataStartRow.set(val);
      if (this.workbook && this.selectedSheet()) {
        const ws = this.workbook.Sheets[this.selectedSheet()];
        if (ws) {
          this.refreshSheetColumnsAndData(ws, this.headerStartRow(), this.headerEndRow(), val);
        }
      }
    }
  }

  // ============================================================
  // STEP 3 : PILIH KOLOM KATEGORI (SUMBU Y) & SERI INDIKATOR (BATANG)
  // ============================================================

  allCandidateSeriesColumns = computed<ColumnInfo[]>(() => {
    const cat = this.categoryColumn();
    let cols = this.sheetColumns();
    if (cols.length === 0 && this.allColumns().length > 0) {
      cols = this.allColumns().map((col, idx) => ({
        colIndex: idx,
        colLetter: ExcelWorkbookAdapter.encodeCol(idx),
        header: col,
        leafHeader: col,
        layers: [col],
      }));
    }
    return cols.filter(
      (c) =>
        c.header !== cat &&
        !c.header.startsWith('__') &&
        c.header !== 'No' &&
        c.header !== 'Capaian',
    );
  });

  candidateSeriesColumns = computed<ColumnInfo[]>(() => {
    const q = this.columnSearchQuery().toLowerCase().trim();
    const all = this.allCandidateSeriesColumns();
    if (!q) return all;
    return all.filter(
      (c) => c.header.toLowerCase().includes(q) || c.leafHeader.toLowerCase().includes(q),
    );
  });

  private syncSeriesList(keys: string[]): void {
    const current = this.seriesList();
    const series: ChartSeriesConfig[] = keys.map((key, idx) => {
      const existing = current.find((s) => s.key === key);
      return (
        existing || {
          key,
          label: key,
          color: this.colorPalette[idx % this.colorPalette.length],
        }
      );
    });
    this.seriesList.set(series);
  }

  onCategoryColumnChange(newCat: string): void {
    this.categoryColumn.set(newCat);
    this.categorySearchQuery.set('');
    const updatedSeries = this.selectedSeriesKeys().filter((c) => c !== newCat);
    this.selectedSeriesKeys.set(updatedSeries);

    if (this.workbook && this.selectedSheet()) {
      const ws = this.workbook.Sheets[this.selectedSheet()];
      if (ws) {
        this.rebuildChartData(ws, this.sheetColumns(), newCat, updatedSeries, this.dataStartRow());
      }
    } else {
      const rows = this.originalDataRows().length > 0 ? this.originalDataRows() : this.dataRows();
      const cats = Array.from(
        new Set(rows.map((r) => String(r[newCat] ?? '').trim()).filter(Boolean)),
      );
      this.availableCategories.set(cats);
      this.selectedCategories.set(cats);
      this.syncSeriesList(updatedSeries);
    }
  }

  toggleSeriesColumn(colHeader: string): void {
    const current = this.selectedSeriesKeys();
    const exists = current.includes(colHeader);

    const updated = exists ? current.filter((c) => c !== colHeader) : [...current, colHeader];
    this.selectedSeriesKeys.set(updated);

    if (this.workbook && this.selectedSheet()) {
      const ws = this.workbook.Sheets[this.selectedSheet()];
      if (ws) {
        this.rebuildChartData(
          ws,
          this.sheetColumns(),
          this.categoryColumn(),
          updated,
          this.dataStartRow(),
        );
      }
    } else {
      this.syncSeriesList(updated);
    }
  }

  selectAllSeriesColumns(): void {
    const candidateHeaders = this.allCandidateSeriesColumns().map((c) => c.header);
    this.selectedSeriesKeys.set(candidateHeaders);
    if (this.workbook && this.selectedSheet()) {
      const ws = this.workbook.Sheets[this.selectedSheet()];
      if (ws) {
        this.rebuildChartData(
          ws,
          this.sheetColumns(),
          this.categoryColumn(),
          candidateHeaders,
          this.dataStartRow(),
        );
      }
    } else {
      this.syncSeriesList(candidateHeaders);
    }
  }

  clearAllSeriesColumns(): void {
    this.selectedSeriesKeys.set([]);
    if (this.workbook && this.selectedSheet()) {
      const ws = this.workbook.Sheets[this.selectedSheet()];
      if (ws) {
        this.rebuildChartData(
          ws,
          this.sheetColumns(),
          this.categoryColumn(),
          [],
          this.dataStartRow(),
        );
      }
    } else {
      this.seriesList.set([]);
    }
  }

  selectNumericSeriesColumns(): void {
    const cat = this.categoryColumn();
    const cols = this.allCandidateSeriesColumns();

    if (this.workbook && this.selectedSheet()) {
      const ws = this.workbook.Sheets[this.selectedSheet()];
      if (!ws) return;

      const allCols = this.sheetColumns();
      const sampleRows = ExcelEngine.readSheetRows(ws, allCols, this.dataStartRow()).slice(0, 15);
      const numericCols = cols
        .filter((c) =>
          sampleRows.some((r) => IndicatorEvaluator.parseSmartNumber(r[c.header]) !== null),
        )
        .map((c) => c.header);

      if (numericCols.length > 0) {
        this.selectedSeriesKeys.set(numericCols);
        this.rebuildChartData(ws, allCols, cat, numericCols, this.dataStartRow());
      }
    } else {
      const sampleRows = (
        this.originalDataRows().length > 0 ? this.originalDataRows() : this.dataRows()
      ).slice(0, 15);
      const numericCols = cols
        .filter((c) =>
          sampleRows.some((r) => IndicatorEvaluator.parseSmartNumber(r[c.header]) !== null),
        )
        .map((c) => c.header);

      if (numericCols.length > 0) {
        this.selectedSeriesKeys.set(numericCols);
        this.syncSeriesList(numericCols);
      }
    }
  }

  // ============================================================
  // STEP 4 : KENDALI GRAFIK, FILTER WILAYAH & SORTING
  // ============================================================

  canRenderChart = computed<boolean>(() => {
    return (
      (this.dataSource() === 'join' &&
        this.seriesList().length > 0 &&
        this.dataRows().length > 0) ||
      (this.dataSource() === 'upload' &&
        !!this.selectedSheet() &&
        !!this.categoryColumn() &&
        this.seriesList().length > 0 &&
        this.dataRows().length > 0)
    );
  });

  hasLoadedData = computed<boolean>(() => {
    return (
      (this.dataSource() === 'join' && this.dataRows().length > 0) ||
      (this.dataSource() === 'upload' &&
        !!this.selectedSheet() &&
        !!this.categoryColumn() &&
        this.dataRows().length > 0)
    );
  });

  filteredAvailableCategories = computed<string[]>(() => {
    const q = this.categorySearchQuery().toLowerCase().trim();
    const all = this.availableCategories();
    if (!q) return all;
    return all.filter((cat) => cat.toLowerCase().includes(q));
  });

  toggleCategory(cat: string): void {
    this.selectedCategories.update((current) =>
      current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat],
    );
  }

  isCategorySelected(cat: string): boolean {
    return this.selectedCategories().includes(cat);
  }

  selectAllCategories(): void {
    this.selectedCategories.set([...this.availableCategories()]);
  }

  clearAllCategories(): void {
    this.selectedCategories.set([]);
  }

  // Baris aktif yang ditampilkan (mengikuti urutan asli dari tabel data)
  visibleCategories = computed<string[]>(() => {
    const selected = this.selectedCategories();
    const available = this.availableCategories();
    return available.filter((cat) => selected.includes(cat));
  });

  // Hapus baris tertentu dari visualisasi
  deleteRow(cat: string): void {
    this.availableCategories.update((list) => list.filter((c) => c !== cat));
    this.selectedCategories.update((list) => list.filter((c) => c !== cat));
    this.dataRows.update((rows) =>
      rows.filter((r) => String(r[this.categoryColumn()] ?? '').trim() !== cat),
    );
    this.notificationMessage.set(`Baris "${cat}" berhasil dihapus dari visualisasi.`);
  }

  // Pulihkan semua baris yang disembunyikan
  restoreAllRows(): void {
    const cats = this.availableCategories();
    this.selectedCategories.set([...cats]);
    this.notificationMessage.set(
      `Seluruh baris (${cats.length} baris) berhasil ditampilkan kembali.`,
    );
  }

  // Mengecek apakah ada baris yang disembunyikan
  hasHiddenRows = computed(() => {
    const availableCount = this.availableCategories().length;
    const activeCount = this.visibleCategories().length;
    return availableCount > 0 && activeCount < availableCount;
  });

  hasHiddenOrDeletedRows = this.hasHiddenRows;

  // ============================================================
  // FILTER GRAFIK VISUALISASI (WILAYAH & INDIKATOR)
  // ============================================================

  // Pencarian teks live untuk wilayah pada grafik
  chartRegionSearch = signal<string>('');

  // Pilihan dropdown satu wilayah tertentu ('all' atau nama wilayah)
  selectedRegionFilter = signal<string>('all');

  // Modal Filter Wilayah (Checkbox)
  showRegionFilterModal = signal<boolean>(false);
  regionModalSearch = signal<string>('');

  filteredModalCategories = computed<string[]>(() => {
    const q = this.regionModalSearch().trim().toLowerCase();
    const all = this.availableCategories();
    if (!q) return all;
    return all.filter((c) => c.toLowerCase().includes(q));
  });

  openRegionFilterModal(): void {
    this.regionModalSearch.set('');
    this.showRegionFilterModal.set(true);
  }

  closeRegionFilterModal(): void {
    this.showRegionFilterModal.set(false);
  }

  // Modal Filter Indikator (Checkbox)
  showIndicatorFilterModal = signal<boolean>(false);
  indicatorModalSearch = signal<string>('');

  filteredModalIndicators = computed<ColumnInfo[]>(() => {
    const q = this.indicatorModalSearch().trim().toLowerCase();
    const all = this.allCandidateSeriesColumns();
    if (!q) return all;
    return all.filter(
      (c) => c.header.toLowerCase().includes(q) || c.leafHeader.toLowerCase().includes(q),
    );
  });

  hasFilteredIndicators = computed<boolean>(() => {
    const total = this.allCandidateSeriesColumns().length;
    const selected = this.selectedSeriesKeys().length;
    return total > 0 && selected < total;
  });

  openIndicatorFilterModal(): void {
    this.indicatorModalSearch.set('');
    this.showIndicatorFilterModal.set(true);
  }

  closeIndicatorFilterModal(): void {
    this.showIndicatorFilterModal.set(false);
  }

  getIndicatorColor(header: string): string {
    const existing = this.seriesList().find((s) => s.key === header);
    if (existing) return existing.color;
    const allCandidates = this.allCandidateSeriesColumns();
    const idx = allCandidates.findIndex((c) => c.header === header);
    return this.colorPalette[(idx >= 0 ? idx : 0) % this.colorPalette.length];
  }

  // Baris wilayah yang lolos filter pencarian dan pilihan wilayah
  filteredChartCategories = computed<string[]>(() => {
    let cats = this.visibleCategories();
    const region = this.selectedRegionFilter();
    if (region !== 'all') {
      cats = cats.filter((c) => c === region);
    }
    const q = this.chartRegionSearch().trim().toLowerCase();
    if (q) {
      cats = cats.filter((c) => c.toLowerCase().includes(q));
    }
    const sortMode = this.regionSortMode();
    if (sortMode === 'desc' || sortMode === 'asc') {
      const rows = this.dataRows();
      const catCol = this.categoryColumn();
      const series = this.seriesList();
      const rowMap = new Map<string, ChartDataRow>();
      for (const r of rows) {
        const key = String(r[catCol] ?? '')
          .trim()
          .toLowerCase();
        if (key) rowMap.set(key, r);
      }
      const avgMap = new Map<string, number | null>();
      for (const cat of cats) {
        const r = rowMap.get(cat.trim().toLowerCase());
        let sum = 0;
        let count = 0;
        for (const s of series) {
          const val = r ? IndicatorEvaluator.parseSmartNumber(r[s.key]) : null;
          if (val !== null) {
            sum += val;
            count++;
          }
        }
        avgMap.set(cat, count > 0 ? sum / count : null);
      }
      cats = [...cats].sort((a, b) => {
        const valA = avgMap.get(a) ?? null;
        const valB = avgMap.get(b) ?? null;
        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;
        return sortMode === 'desc' ? valB - valA : valA - valB;
      });
    }
    return cats;
  });

  // Seri indikator yang lolos filter indikator (untuk mode per wilayah)
  filteredChartSeries = computed<ChartSeriesConfig[]>(() => {
    const all = this.seriesList();
    const filter = this.selectedIndicatorFilter();
    if (filter === 'all') return all;
    const filtered = all.filter((s) => s.key === filter);
    return filtered.length > 0 ? filtered : all;
  });

  // Status apakah ada filter grafik yang sedang aktif
  isChartFilterActive = computed<boolean>(() => {
    return (
      this.selectedRegionFilter() !== 'all' ||
      Boolean(this.chartRegionSearch().trim()) ||
      this.selectedIndicatorFilter() !== 'all' ||
      this.hasHiddenRows() ||
      this.hasFilteredIndicators()
    );
  });

  // Reset semua filter grafik (pencarian, dropdown wilayah, dropdown indikator, baris disembunyikan)
  resetChartFilters(): void {
    this.selectedRegionFilter.set('all');
    this.chartRegionSearch.set('');
    this.selectedIndicatorFilter.set('all');
    this.restoreAllRows();
    this.selectAllSeriesColumns();
  }

  // Toggle filter indikator (fokus pada satu indikator atau kembali ke semua)
  toggleIndicatorFilter(key: string): void {
    if (this.selectedIndicatorFilter() === key) {
      this.selectedIndicatorFilter.set('all');
    } else {
      this.selectedIndicatorFilter.set(key);
    }
  }

  // ============================================================
  // TOOLTIP INTERAKTIF
  // ============================================================

  onBarHover(
    event: MouseEvent,
    bar: ChartBarItem,
    categoryName: string,
    targetOverride?: number | null,
    indicatorLabelOverride?: string,
  ): void {
    let status: 'achieved' | 'unachieved' | 'none' = 'none';
    let diff: number | null = null;
    const target =
      targetOverride !== undefined
        ? targetOverride
        : bar.targetVal !== undefined && bar.targetVal !== null
          ? bar.targetVal
          : this.getIndicatorTarget(bar.seriesKey);

    const targetOp = this.getIndicatorOperator(bar.seriesKey);

    if (target !== null && bar.numericVal !== null) {
      diff = Math.round((bar.numericVal - target) * 10) / 10;
      status = targetOp === '<='
        ? (bar.numericVal <= target ? 'achieved' : 'unachieved')
        : (bar.numericVal >= target ? 'achieved' : 'unachieved');
    }

    const seriesLabel = indicatorLabelOverride || bar.seriesLabel;

    this.hoveredBar.set({
      categoryName,
      seriesLabel,
      color: bar.color,
      displayLabel: bar.displayLabel,
      numericVal: bar.numericVal,
      isZero: bar.isZero,
      isMissing: bar.isMissing,
      status,
      diff,
      targetValue: target,
    });
    this.updateTooltipPosition(event);
  }

  onBarMouseMove(event: MouseEvent): void {
    if (this.hoveredBar()) {
      this.updateTooltipPosition(event);
    }
  }

  onBarLeave(): void {
    this.hoveredBar.set(null);
  }

  private updateTooltipPosition(event: MouseEvent): void {
    this.tooltipPos.set({
      x: event.clientX + 14,
      y: event.clientY + 14,
    });
  }

  closeNotification(): void {
    this.notificationMessage.set(null);
  }

  // ============================================================
  // PRESET CONFIGURATION (JSON & LOCALSTORAGE)
  // ============================================================

  exportConfiguration(): void {
    const sheet = this.selectedSheet() || (this.dataSource() === 'join' ? 'Hasil Join' : '');
    const series =
      this.selectedSeriesKeys().length > 0
        ? this.selectedSeriesKeys()
        : this.seriesList().map((s) => s.key);

    if (!sheet || series.length === 0) {
      this.configNotification.set({
        type: 'warning',
        message:
          'Pilih sheet dan minimal 1 kolom indikator terlebih dahulu sebelum menyimpan konfigurasi.',
      });
      return;
    }

    const catCol = this.categoryColumn();
    const allOrigCats = Array.from(
      new Set(
        this.originalDataRows()
          .map((r) => String(r[catCol] ?? '').trim())
          .filter(Boolean),
      ),
    );
    const availableCats = this.availableCategories();
    const selectedCats = this.selectedCategories();

    const hiddenRows = availableCats.filter((c) => !selectedCats.includes(c));

    const preset: ChartConfigurationPreset = {
      version: '1.0',
      name: this.file() ? `Konfigurasi - ${this.file()!.name}` : `Konfigurasi - ${sheet}`,
      savedAt: new Date().toISOString(),
      sheetName: sheet,
      headerStartRow: this.headerStartRow(),
      headerEndRow: this.headerEndRow(),
      dataStartRow: this.dataStartRow(),
      categoryColumn: catCol,
      seriesKeys: [...series],
      targetValue: this.targetValue(),
      chartTitle: this.chartTitle(),
      chartSubtitle: this.chartSubtitle(),
      hiddenRows,
      viewMode: this.viewMode(),
      activeMapIndicator: this.activeMapIndicator(),
      regionColumns: this.regionGridColumns() === 1 ? 1 : 2,
      regionGridColumns: this.regionGridColumns(),
      regionSortMode: this.regionSortMode(),
      indicatorTargets: { ...this.indicatorTargets() },
      indicatorTargetOperators: { ...this.indicatorTargetOperators() },
      targetOperator: this.targetOperator(),
    };

    ConfigurationWorkspace.chart.savePreset(preset, true);
    this.hasSavedConfig.set(true);
    this.activePresetName.set(preset.name || 'Konfigurasi Tersimpan');

    this.configNotification.set({
      type: 'success',
      message:
        'Konfigurasi grafik berhasil disimpan dan diunduh (.json)! Berkas ini juga tersimpan otomatis di browser ini.',
    });
  }

  onConfigFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const preset = ConfigurationWorkspace.chart.parsePresetJson(text);
        this.applyConfiguration(preset, file.name);
      } catch (err) {
        this.configNotification.set({
          type: 'warning',
          message:
            err instanceof Error ? err.message : 'Format berkas JSON konfigurasi tidak valid.',
        });
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  }

  loadSavedConfigurationFromStorage(): void {
    const preset = ConfigurationWorkspace.chart.loadLastPreset();
    if (!preset) {
      this.configNotification.set({
        type: 'info',
        message: 'Belum ada konfigurasi grafik tersimpan di browser ini.',
      });
      return;
    }
    this.applyConfiguration(preset, preset.name || 'Penyimpanan Lokal');
  }

  closeConfigNotification(): void {
    this.configNotification.set(null);
  }

  applyConfiguration(preset: ChartConfigurationPreset, sourceName: string): void {
    if (!preset || !preset.sheetName || !Array.isArray(preset.seriesKeys)) {
      this.configNotification.set({
        type: 'warning',
        message: 'Format konfigurasi grafik tidak valid.',
      });
      return;
    }

    ConfigurationWorkspace.chart.savePreset(preset, false);
    this.hasSavedConfig.set(true);
    this.activePresetName.set(sourceName);

    if (preset.viewMode) {
      this.viewMode.set(preset.viewMode);
    }
    if (preset.activeMapIndicator) {
      this.activeMapIndicator.set(preset.activeMapIndicator);
    }
    if (preset.regionGridColumns) {
      this.regionGridColumns.set(preset.regionGridColumns);
    } else if (preset.regionColumns) {
      this.regionGridColumns.set(preset.regionColumns);
    }
    if (preset.regionSortMode) {
      this.regionSortMode.set(preset.regionSortMode);
    }

    if (preset.indicatorTargets) {
      this.indicatorTargets.set({ ...preset.indicatorTargets });
    }
    if (preset.indicatorTargetOperators) {
      this.indicatorTargetOperators.set({ ...preset.indicatorTargetOperators });
    }
    if (preset.targetOperator) {
      this.targetOperator.set(preset.targetOperator);
    }

    if (!this.workbook || this.sheetNames().length === 0) {
      if (this.dataSource() === 'join') {
        const allCols = this.allColumns();
        const colInfos: ColumnInfo[] = allCols.map((h, idx) => ({
          colIndex: idx,
          colLetter: ExcelWorkbookAdapter.encodeCol(idx),
          header: h,
          leafHeader: h,
          layers: [h],
        }));
        this.sheetColumns.set(colInfos);
        const matchedCat =
          ExcelResilientMatcher.findMatchingHeader(preset.categoryColumn, colInfos) ||
          this.categoryColumn();
        if (matchedCat) {
          this.categoryColumn.set(matchedCat);
        }

        const matchedSeries: string[] = [];
        const unmatchedSeries: string[] = [];
        for (const s of preset.seriesKeys) {
          const m = ExcelResilientMatcher.findMatchingHeader(s, colInfos);
          if (m) {
            matchedSeries.push(m);
          } else {
            unmatchedSeries.push(s);
          }
        }

        if (matchedSeries.length > 0) {
          this.selectedSeriesKeys.set(matchedSeries);
          const series: ChartSeriesConfig[] = matchedSeries.map((key, idx) => ({
            key,
            label: key,
            color: this.colorPalette[idx % this.colorPalette.length],
          }));
          this.seriesList.set(series);
        }

        if (preset.targetValue !== undefined) {
          this.targetValue.set(preset.targetValue);
        }
        if (preset.chartTitle) {
          this.chartTitle.set(preset.chartTitle);
        }
        if (preset.chartSubtitle) {
          this.chartSubtitle.set(preset.chartSubtitle);
        }
        if (preset.viewMode) {
          this.viewMode.set(preset.viewMode);
        }
        if (preset.activeMapIndicator) {
          this.activeMapIndicator.set(preset.activeMapIndicator);
        }

        const toHide = new Set([...(preset.hiddenRows || []), ...(preset.deletedRows || [])]);
        if (toHide.size > 0) {
          this.selectedCategories.update((curr) => curr.filter((c) => !toHide.has(c)));
        }

        if (unmatchedSeries.length === 0) {
          this.configNotification.set({
            type: 'success',
            message: `Konfigurasi "${sourceName}" berhasil dimuat 100%! Seluruh ${matchedSeries.length} seri indikator cocok sempurna.`,
          });
        } else {
          this.configNotification.set({
            type: 'warning',
            message: `Konfigurasi dimuat: ${matchedSeries.length} dari ${preset.seriesKeys.length} seri indikator cocok.`,
            details: [`Indikator tidak ditemukan: ${unmatchedSeries.join(', ')}`],
          });
        }
        return;
      }

      this.pendingPreset = preset;
      this.configNotification.set({
        type: 'info',
        message: `Konfigurasi "${sourceName}" berhasil dimuat! Silakan unggah file Excel (.xlsx), grafik akan otomatis dibuat.`,
      });
      return;
    }

    const availableSheets = this.sheetNames();
    const matchedSheet = ExcelResilientMatcher.findMatchingSheet(preset.sheetName, availableSheets);

    if (!matchedSheet) {
      this.configNotification.set({
        type: 'warning',
        message: `Sheet "${preset.sheetName}" tidak ditemukan dalam file ini. Sheet tersedia: ${availableSheets.join(', ')}`,
      });
      return;
    }

    this.selectedSheet.set(matchedSheet);
    const hStart = preset.headerStartRow || 1;
    const hEnd = preset.headerEndRow || 1;
    const dStart = preset.dataStartRow || 2;

    this.headerStartRow.set(hStart);
    this.headerEndRow.set(hEnd);
    this.dataStartRow.set(dStart);

    const ws = this.workbook.Sheets[matchedSheet];
    if (!ws) {
      this.configNotification.set({
        type: 'warning',
        message: `Lembar kerja "${matchedSheet}" tidak dapat dibaca.`,
      });
      return;
    }

    const cols = ExcelEngine.extractSheetColumns(ws, hStart, hEnd);
    this.sheetColumns.set(cols);
    this.allColumns.set(cols.map((c) => c.header));

    const matchedCat =
      ExcelResilientMatcher.findMatchingHeader(preset.categoryColumn, cols) ||
      (cols.length > 0 ? cols[0].header : '');
    this.categoryColumn.set(matchedCat);

    const matchedSeries: string[] = [];
    const unmatchedSeries: string[] = [];

    for (const s of preset.seriesKeys) {
      const m = ExcelResilientMatcher.findMatchingHeader(s, cols);
      if (m) {
        matchedSeries.push(m);
      } else {
        unmatchedSeries.push(s);
      }
    }

    this.selectedSeriesKeys.set(matchedSeries);
    this.rebuildChartData(ws, cols, matchedCat, matchedSeries, dStart);

    if (preset.targetValue !== undefined) {
      this.targetValue.set(preset.targetValue);
    }
    if (preset.chartTitle) {
      this.chartTitle.set(preset.chartTitle);
    }
    if (preset.chartSubtitle) {
      this.chartSubtitle.set(preset.chartSubtitle);
    }
    if (preset.viewMode) {
      this.viewMode.set(preset.viewMode);
    }
    if (preset.activeMapIndicator) {
      this.activeMapIndicator.set(preset.activeMapIndicator);
    }
    if (preset.regionGridColumns) {
      this.regionGridColumns.set(preset.regionGridColumns);
    }
    if (preset.regionSortMode) {
      this.regionSortMode.set(preset.regionSortMode);
    }

    const toHide = new Set([...(preset.hiddenRows || []), ...(preset.deletedRows || [])]);
    if (toHide.size > 0) {
      this.selectedCategories.update((curr) => curr.filter((c) => !toHide.has(c)));
    }

    if (unmatchedSeries.length === 0) {
      this.configNotification.set({
        type: 'success',
        message: `Konfigurasi "${sourceName}" berhasil dimuat 100%! Sheet "${matchedSheet}" dan seluruh ${matchedSeries.length} seri indikator cocok sempurna. Data langsung divisualisasikan.`,
      });
    } else {
      this.configNotification.set({
        type: 'warning',
        message: `Konfigurasi dimuat: ${matchedSeries.length} dari ${preset.seriesKeys.length} seri indikator cocok.`,
        details: [`Indikator tidak ditemukan: ${unmatchedSeries.join(', ')}`],
      });
    }
  }

  toggleSettingsPanel(): void {
    const next = !this.showSettingsPanel();
    this.showSettingsPanel.set(next);
    if (next) {
      this.showIndicatorPanel.set(false);
    }
  }

  toggleIndicatorPanel(): void {
    const next = !this.showIndicatorPanel();
    this.showIndicatorPanel.set(next);
    if (next) {
      this.showSettingsPanel.set(false);
    }
  }

  isPercentageColumn(colHeader: string): boolean {
    const transferred = this.healthDataExchange.chartData();
    if (transferred?.percentageColumns && transferred.percentageColumns.includes(colHeader)) {
      return true;
    }
    return HealthDataExchange.isPercentageColumnName(colHeader);
  }

  selectPercentageSeriesColumns(): void {
    const cols = this.allCandidateSeriesColumns();
    const pctCols = cols.filter((c) => this.isPercentageColumn(c.header)).map((c) => c.header);

    const targetCols = pctCols.length > 0 ? pctCols : cols.map((c) => c.header);
    this.selectedSeriesKeys.set(targetCols);

    if (this.workbook && this.selectedSheet()) {
      const ws = this.workbook.Sheets[this.selectedSheet()];
      if (ws) {
        this.rebuildChartData(
          ws,
          this.sheetColumns(),
          this.categoryColumn(),
          targetCols,
          this.dataStartRow(),
        );
      }
    } else {
      this.syncSeriesList(targetCols);
    }
  }

  // ============================================================
  // EKSPOR GAMBAR (SVG & PNG)
  // ============================================================

  exportSvg(svgId = 'chartSvg', customFileName?: string): void {
    const svg =
      (document.getElementById(svgId) as SVGSVGElement | null) ||
      document.querySelector<SVGSVGElement>('#chartSvg') ||
      document.querySelector<SVGSVGElement>('svg.chart-canvas');
    if (!svg) return;

    this.downloadSvgElement(svg, customFileName || this.chartTitle());
  }

  exportPng(svgId = 'chartSvg', customFileName?: string): void {
    const svg =
      (document.getElementById(svgId) as SVGSVGElement | null) ||
      document.querySelector<SVGSVGElement>('#chartSvg') ||
      document.querySelector<SVGSVGElement>('svg.chart-canvas');
    if (!svg) return;

    this.downloadPngFromSvg(svg, customFileName || this.chartTitle());
  }

  private downloadSvgElement(svg: SVGSVGElement, title: string): void {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute(
      'style',
      'background-color: #ffffff; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
    );

    const serializer = new XMLSerializer();
    const svgString =
      '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(clone);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.slugify(title) || 'grafik-dinkes'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private downloadPngFromSvg(svg: SVGSVGElement, title: string): void {
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
      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `${this.slugify(title) || 'grafik-dinkes'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(pngUrl);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  // ============================================================
  // EKSPOR DATA KE EXCEL (.XLSX)
  // Data tabel bersih terfilter untuk membuat grafik bawaan Excel (Alt+F1 / Insert Chart)
  // ============================================================

  buildExcelWorkbook(singleSeriesKey?: string): ExcelWorkbook {
    const catCol = this.categoryColumn();
    let series = this.seriesList();
    if (singleSeriesKey) {
      const found = series.find((s) => s.key === singleSeriesKey);
      if (found) {
        series = [found];
      }
    }
    const cats = this.filteredChartCategories();
    const rows = this.dataRows();

    // Pemetaan Data Berdasarkan Label Baris
    const rowMap = new Map<string, ChartDataRow>();
    for (const r of rows) {
      const key = String(r[catCol] ?? '').trim();
      if (key) {
        rowMap.set(key, r);
      }
    }

    const tabularSheets: TabularSheetSpec[] = [];

    for (let sIdx = 0; sIdx < series.length; sIdx++) {
      const s = series[sIdx];
      const headerRow = [catCol, s.label];
      const aoaData: (string | number | boolean | null | undefined)[][] = [];

      for (const cat of cats) {
        const rowObj = rowMap.get(cat);
        const rawVal = rowObj ? rowObj[s.key] : null;
        const num = IndicatorEvaluator.parseSmartNumber(rawVal);
        aoaData.push([cat, num !== null ? num : '']);
      }

      // Sertakan baris Target di bagian bawah indikator
      const targetVal = this.getIndicatorTarget(s.key);
      const targetDisplay = targetVal !== null ? `>= ${targetVal}` : '-';
      aoaData.push(['Target', targetDisplay]);

      // Lebar kolom otomatis
      const colWidths = headerRow.map((h, idx) => {
        let maxLen = h.length;
        for (const r of aoaData) {
          const valStr = String(r[idx] ?? '');
          if (valStr.length > maxLen) maxLen = valStr.length;
        }
        return Math.max(maxLen + 4, 14);
      });

      const targetRowIdx = aoaData.length; // index in table (accounting for header row at 0)

      tabularSheets.push({
        name: s.label.trim() || `Indikator ${sIdx + 1}`,
        headers: headerRow,
        rows: aoaData,
        colWidths,
        headerStyle: {
          fill: { fgColor: { rgb: '2563EB' } }, // Biru Dinkes
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        },
        highlightRowIndices: [
          {
            index: targetRowIdx,
            style: {
              fill: { fgColor: { rgb: 'EEF2FF' } }, // Soft Indigo / Lavender
              font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '3730A3' } },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: {
                top: { style: 'thin', color: { rgb: 'C7D2FE' } },
                bottom: { style: 'thin', color: { rgb: 'C7D2FE' } },
              },
            },
          },
        ],
      });
    }

    return ExcelWorkbookAdapter.createTabularWorkbook(tabularSheets);
  }

  exportExcel(singleSeriesKey?: string): void {
    let series = this.seriesList();
    if (singleSeriesKey) {
      series = series.filter((s) => s.key === singleSeriesKey);
    }
    const cats = this.filteredChartCategories();

    if (cats.length === 0 || series.length === 0) {
      this.notificationMessage.set(
        'Tidak ada baris atau kolom indikator yang dipilih untuk diekspor.',
      );
      return;
    }

    const wb = this.buildExcelWorkbook(singleSeriesKey);

    if (singleSeriesKey) {
      const targetSeries = series[0];
      const fileName = `${this.slugify(targetSeries.label) || 'data-indikator'}.xlsx`;
      ExcelWorkbookAdapter.writeWorkbook(wb, fileName);
      this.notificationMessage.set(
        `Berkas "${fileName}" untuk indikator "${targetSeries.label}" berhasil diunduh.`,
      );
      return;
    }

    const fileName = `${this.slugify(this.chartTitle()) || 'data-grafik-dinkes'}.xlsx`;
    ExcelWorkbookAdapter.writeWorkbook(wb, fileName);
    this.notificationMessage.set(
      `Berkas "${fileName}" dengan ${series.length} sheet terpisah per indikator berhasil diunduh.`,
    );
  }

  exportRegionExcel(regionName: string): void {
    const catCol = this.categoryColumn();
    const series = this.filteredChartSeries();
    const rows = this.dataRows();
    const r = rows.find(
      (row) =>
        String(row[catCol] ?? '')
          .trim()
          .toLowerCase() === regionName.trim().toLowerCase(),
    );

    const headerRow = ['Indikator', 'Capaian', 'Target'];
    const aoaData: (string | number | boolean | null | undefined)[][] = [];

    for (const s of series) {
      const raw = r ? r[s.key] : null;
      const num = IndicatorEvaluator.parseSmartNumber(raw);
      const target = this.getIndicatorTarget(s.key) ?? this.targetValue();
      aoaData.push([s.label, num !== null ? num : '', target !== null ? `>= ${target}` : '-']);
    }

    const safeSheetName = regionName.replace(/[\\/?*[\]:]/g, '_').slice(0, 31) || 'Wilayah';
    const wb = ExcelWorkbookAdapter.createTabularWorkbook([
      {
        name: safeSheetName,
        headers: headerRow,
        rows: aoaData,
        colWidths: [35, 15, 15],
      },
    ]);
    const fileName = `${this.slugify(regionName) || 'data-wilayah'}.xlsx`;
    ExcelWorkbookAdapter.writeWorkbook(wb, fileName);
    this.notificationMessage.set(`Berkas Excel untuk wilayah "${regionName}" berhasil diunduh.`);
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }

  // ============================================================
  // PER-REGION (PER-WILAYAH) COMPARISON LAYOUTS
  // Menghasilkan kelompok grafik terpisah untuk setiap wilayah yang dipilih
  // ============================================================

  regionLayouts = computed<RegionChartGroup[]>(() => {
    const series = this.filteredChartSeries();
    const indicatorTargets: Record<string, number | null> = {};
    const indicatorTargetOperators: Record<string, string> = {};
    for (const s of series) {
      indicatorTargets[s.key] = this.getIndicatorTarget(s.key);
      indicatorTargetOperators[s.key] = this.getIndicatorOperator(s.key);
    }

    return ChartSlicingEngine.computeRegionGroups({
      categories: this.filteredChartCategories(),
      series,
      rows: this.dataRows(),
      categoryColumn: this.categoryColumn(),
      sortMode: this.regionSortMode(),
      targetValue: this.targetValue(),
      targetOperator: this.targetOperator(),
      indicatorTargets,
      indicatorTargetOperators,
      width: 780,
      rowHeight: 22,
      gapWidth: 5,
    });
  });

  // ============================================================
  // PER-INDICATOR (PER-KOLOM) COMPARISON LAYOUTS
  // Menghasilkan kelompok grafik terpisah untuk setiap indikator yang dipilih
  // ============================================================

  indicatorLayouts = computed<IndicatorChartGroup[]>(() => {
    const series = this.seriesList();
    const indicatorTargets: Record<string, number | null> = {};
    const indicatorTargetOperators: Record<string, string> = {};
    for (const s of series) {
      indicatorTargets[s.key] = this.getIndicatorTarget(s.key);
      indicatorTargetOperators[s.key] = this.getIndicatorOperator(s.key);
    }

    return ChartSlicingEngine.computeIndicatorGroups({
      categories: this.filteredChartCategories(),
      series,
      rows: this.dataRows(),
      categoryColumn: this.categoryColumn(),
      sortMode: this.indicatorSortMode(),
      targetOperator: this.targetOperator(),
      indicatorTargets,
      indicatorTargetOperators,
      width: 780,
      rowHeight: 22,
      gapWidth: 5,
    });
  });

  filteredIndicatorLayouts = computed<IndicatorChartGroup[]>(() => {
    const all = this.indicatorLayouts();
    const filter = this.selectedIndicatorFilter();
    if (filter === 'all') return all;
    const filtered = all.filter((item) => item.series.key === filter);
    return filtered.length > 0 ? filtered : all;
  });
}
