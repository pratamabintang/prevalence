import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  StuntingDashboardStore,
  TrendPoint,
  TransitionDelta,
  HeatmapRow,
  ScatterPoint,
} from '../../core/stunting-dashboard/stunting-dashboard-store';
import {
  STUNTING_EXCEL_CONSTRAINTS,
  PYTHON_TEMPLATE_SCRIPT,
} from '../../core/stunting-dashboard/stunting-excel-parser';
import {
  DistrictMapFeature,
  NeighborProvince,
  JavaOverviewProvince,
} from '../../core/stunting-dashboard/stunting-map-data';

export interface ChartHover {
  title: string;
  subtitle?: string;
  value: string;
  detail?: string;
  x: number;
  y: number;
}

import {
  UiAlertComponent,
  UiButtonComponent,
  UiCardComponent,
  UiPageHeaderComponent,
} from '../../shared/ui';

@Component({
  selector: 'app-stunting-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DecimalPipe,
    UiPageHeaderComponent,
    UiButtonComponent,
    UiCardComponent,
    UiAlertComponent,
  ],
  templateUrl: './stunting-dashboard.component.html',
})
export class StuntingDashboardComponent {
  readonly store = inject(StuntingDashboardStore);
  readonly Math = Math;

  // Custom data upload state
  readonly isCustomData = this.store.isCustomData;
  readonly uploadedFileName = this.store.uploadedFileName;
  readonly uploading = signal<boolean>(false);
  readonly uploadError = signal<string[] | null>(null);
  readonly uploadSuccessMessage = signal<string | null>(null);
  readonly showConstraintModal = signal<boolean>(false);
  readonly copyFeedback = signal<string | null>(null);
  readonly constraintsText = STUNTING_EXCEL_CONSTRAINTS;
  readonly pythonScriptText = PYTHON_TEMPLATE_SCRIPT;

  // Map state
  readonly mainMapViewBox = this.store.mainMapViewBox;
  readonly javaMapViewBox = this.store.javaMapViewBox;
  readonly neighborProvinces = this.store.neighborProvinces;
  readonly javaOverviewProvinces = this.store.javaOverviewProvinces;
  readonly spatialMapFeatures = this.store.spatialMapFeatures;
  readonly mapDisplayMode = signal<'choropleth' | 'centroids'>('choropleth');
  readonly hoveredDistrict = signal<(DistrictMapFeature & { stunting: number | null }) | null>(null);

  // Background bundle lines toggle
  readonly showBackgroundLines = signal<boolean>(false);

  // Hover states for tooltips
  readonly hoveredPoint = signal<ChartHover | null>(null);

  // Computed properties from store
  readonly metadata = this.store.metadata;
  readonly summaryCards = this.store.summaryCards;
  readonly periods = this.store.periods;
  readonly firstPeriod = computed(() => this.periods()[0] ?? '');
  readonly latestPeriod = computed(() => this.periods()[this.periods().length - 1] ?? '');
  readonly indicators = this.store.indicators;
  readonly wilayahList = this.store.wilayahList;
  readonly selectedWilayah = this.store.selectedWilayah;
  readonly selectedIndicator = this.store.selectedIndicator;
  readonly selectedIndicatorKey = this.store.selectedIndicatorKey;
  readonly selectedScatterPeriod = this.store.selectedScatterPeriod;
  readonly selectedSpatialPeriod = this.store.selectedSpatialPeriod;
  readonly heatmapSearch = this.store.heatmapSearch;
  readonly selectedBoxplotMetric = this.store.selectedBoxplotMetric;
  readonly showAdvancedStats = this.store.showAdvancedStats;

  readonly trendLineData = this.store.trendLineData;
  readonly quarterlyTransitions = this.store.quarterlyTransitions;
  readonly heatmapRows = this.store.heatmapRows;
  readonly heatmapMinMax = this.store.heatmapMinMax;
  readonly boxplotData = this.store.boxplotData;
  readonly spatialCentroids = this.store.spatialCentroids;
  readonly indicatorTrendData = this.store.indicatorTrendData;
  readonly scatterData = this.store.scatterData;
  readonly models = this.store.models;

  // Background lines for all 35 districts in Section C
  readonly backgroundTrajectories = computed(() => {
    const periods = this.periods();
    const obs = this.store.dataset.observations;
    const byWil = new Map<string, number[]>();
    for (const o of obs) {
      if (!byWil.has(o.kabupaten_kota)) byWil.set(o.kabupaten_kota, []);
      byWil.get(o.kabupaten_kota)!.push(o.y_stunting);
    }
    const trajectories: { wilayah: string; points: { x: number; y: number }[] }[] = [];
    for (const [w, vals] of byWil.entries()) {
      const pts = vals.map((val, idx) => ({
        x: this.trendX(idx),
        y: this.trendY(val),
      }));
      trajectories.push({ wilayah: w, points: pts });
    }
    return trajectories;
  });

  // SVG coordinate helpers for Section C (Line Chart)
  get chartWidth(): number {
    return Math.max(650, this.periods().length * 110);
  }
  readonly chartHeight = 240;
  readonly padding = { top: 25, right: 30, bottom: 35, left: 45 };

  trendX(index: number): number {
    const usableW = this.chartWidth - this.padding.left - this.padding.right;
    const step = usableW / (this.periods().length - 1 || 1);
    return this.padding.left + index * step;
  }

  trendY(val: number): number {
    const minY = 0;
    const maxY = 20; // 0% to 20% scale
    const usableH = this.chartHeight - this.padding.top - this.padding.bottom;
    const ratio = (val - minY) / (maxY - minY);
    return this.chartHeight - this.padding.bottom - ratio * usableH;
  }

  // SVG coordinate helpers for Section D (Bar Chart)
  get barChartWidth(): number {
    return Math.max(550, this.quarterlyTransitions().length * 120);
  }
  readonly barChartHeight = 200;
  readonly barPadding = { top: 20, right: 25, bottom: 40, left: 45 };

  readonly barMinMax = computed(() => {
    const trans = this.quarterlyTransitions();
    if (trans.length === 0) return { min: -1.5, max: 1.5 };
    const deltas = trans.map((t) => t.delta);
    const maxVal = Math.max(...deltas, 0);
    const minVal = Math.min(...deltas, 0);
    const limit = Math.max(1.5, Math.abs(maxVal) * 1.2, Math.abs(minVal) * 1.2);
    return { min: -limit, max: limit };
  });

  barY(val: number): number {
    const { min: minD, max: maxD } = this.barMinMax();
    const usableH = this.barChartHeight - this.barPadding.top - this.barPadding.bottom;
    const ratio = (val - minD) / (maxD - minD || 1);
    return this.barChartHeight - this.barPadding.bottom - ratio * usableH;
  }

  barZeroY(): number {
    return this.barY(0);
  }

  // Heatmap & Map color calculation
  getHeatmapBg(val: number): string {
    const { min, max } = this.heatmapMinMax();
    const ratio = Math.max(0, Math.min(1, (val - min) / (max - min || 1)));
    const lightness = Math.round(95 - ratio * 55);
    return `hsl(215, 30%, ${lightness}%)`;
  }

  getHeatmapTextClass(val: number): string {
    const { min, max } = this.heatmapMinMax();
    const ratio = (val - min) / (max - min || 1);
    return ratio > 0.55 ? 'text-white font-semibold' : 'text-slate-800 font-medium';
  }

  getDistrictFill(val: number | null): string {
    if (val === null || isNaN(val)) return '#e2e8f0';
    return this.getHeatmapBg(val);
  }

  getDifferenceFromMedian(val: number | null): { diff: number; text: string } | null {
    if (val === null || isNaN(val)) return null;
    const period = this.selectedSpatialPeriod();
    const median = this.store.dataset.period_stats[period]?.y_stunting.median ?? 0;
    const diff = Number((val - median).toFixed(2));
    if (diff > 0) {
      return { diff, text: `+${diff.toFixed(2)} pp di atas median (${median}%)` };
    } else if (diff < 0) {
      return { diff, text: `${diff.toFixed(2)} pp di bawah median (${median}%)` };
    }
    return { diff: 0, text: `Sama dengan median (${median}%)` };
  }

  // Section G: Spatial Centroid Coordinate Transformation
  spatialX(lon: number): number {
    const minLon = 108.7;
    const maxLon = 111.7;
    const mapW = 620;
    return ((lon - minLon) / (maxLon - minLon)) * mapW + 30;
  }

  spatialY(lat: number): number {
    const minLat = -8.1;
    const maxLat = -6.5;
    const mapH = 320;
    return mapH - ((lat - minLat) / (maxLat - minLat)) * mapH + 20;
  }

  // Section H: Indicator Chart helpers
  indX(index: number): number {
    return this.trendX(index);
  }

  indY(val: number): number {
    const minY = 0;
    const maxY = 110;
    const usableH = this.chartHeight - this.padding.top - this.padding.bottom;
    const ratio = Math.max(0, Math.min(1, (val - minY) / (maxY - minY)));
    return this.chartHeight - this.padding.bottom - ratio * usableH;
  }

  // Section I: Scatter plot helpers
  readonly scatterWidth = 580;
  readonly scatterHeight = 300;
  readonly scPadding = { top: 20, right: 30, bottom: 45, left: 50 };

  scX(xVal: number): number {
    const minX = 0;
    const maxX = 110;
    const usableW = this.scatterWidth - this.scPadding.left - this.scPadding.right;
    const ratio = Math.max(0, Math.min(1, (xVal - minX) / (maxX - minX)));
    return this.scPadding.left + ratio * usableW;
  }

  scY(yVal: number): number {
    const minY = 0;
    const maxY = 20;
    const usableH = this.scatterHeight - this.scPadding.top - this.scPadding.bottom;
    const ratio = Math.max(0, Math.min(1, (yVal - minY) / (maxY - minY)));
    return this.scatterHeight - this.scPadding.bottom - ratio * usableH;
  }

  // Event handlers
  onWilayahChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.store.setWilayah(target.value);
  }

  onIndicatorChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.store.setIndicator(target.value);
  }

  onScatterPeriodChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.store.setScatterPeriod(target.value);
  }

  onSpatialPeriodChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.store.setSpatialPeriod(target.value);
  }

  onHeatmapSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.store.setHeatmapSearch(target.value);
  }

  toggleAdvancedStats() {
    this.store.toggleAdvancedStats();
  }

  setHover(hover: ChartHover | null) {
    this.hoveredPoint.set(hover);
  }

  // File Upload Handlers
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    this.uploading.set(true);
    this.uploadError.set(null);
    this.uploadSuccessMessage.set(null);

    try {
      const buffer = await file.arrayBuffer();
      const result = this.store.loadCustomWorkbook(buffer, file.name);

      if (result.success) {
        this.uploadSuccessMessage.set(
          `Berkas "${file.name}" berhasil divalidasi dan dimuat! Menampilkan ${result.observationsCount} observasi (${result.dataset?.summary_cards.wilayah_count} wilayah × ${result.periodCount} periode). Seluruh visualisasi telah diperbarui otomatis.`
        );
      } else {
        this.uploadError.set(result.errors ?? ['Terjadi kesalahan saat memvalidasi berkas.']);
      }
    } catch (err) {
      this.uploadError.set([`Gagal membaca berkas: ${err instanceof Error ? err.message : String(err)}`]);
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  onResetDefaultData(): void {
    this.store.resetToDefaultData();
    this.uploadSuccessMessage.set(null);
    this.uploadError.set(null);
  }

  copyPythonScript(): void {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(this.pythonScriptText).then(() => {
        this.copyFeedback.set('Skrip Python berhasil disalin ke clipboard!');
        setTimeout(() => this.copyFeedback.set(null), 3000);
      });
    }
  }

  downloadPythonScript(): void {
    const blob = new Blob([this.pythonScriptText], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'validasi_excel_stunting.py';
    a.click();
    URL.revokeObjectURL(url);
  }
}
