import { Injectable, computed, signal } from '@angular/core';
import {
  StuntingDashboardDataset,
  StuntingIndicatorDef,
  StuntingObservation,
  BoxPlotMetric,
  TwoWayFERow,
  FirstDifferenceRow,
  MoransIRow,
  GWRRow,
  PCAVarianceRow,
  VIFRow,
} from './stunting-dashboard.types';
import dashboardDataRaw from './stunting-dashboard-data.json';
import { parseStuntingWorkbook, ParseResult } from './stunting-excel-parser';
import {
  CENTRAL_JAVA_DISTRICTS,
  NEIGHBOR_PROVINCES,
  JAVA_OVERVIEW_PROVINCES,
  MAIN_MAP_VIEWBOX,
  JAVA_MAP_VIEWBOX,
  DistrictMapFeature,
  NeighborProvince,
  JavaOverviewProvince,
} from './stunting-map-data';

export interface TrendPoint {
  period: string;
  value: number;
  deltaFromPrev: number | null;
  pointPercentText: string;
}

export interface TransitionDelta {
  interval: string;
  fromPeriod: string;
  toPeriod: string;
  delta: number;
  label: string;
}

export interface HeatmapRow {
  wilayah: string;
  values: { period: string; value: number }[];
  min: number;
  max: number;
  deltaOverall: number;
}

export interface ScatterPoint {
  wilayah: string;
  period: string;
  xValue: number;
  yValue: number;
}

@Injectable({
  providedIn: 'root',
})
export class StuntingDashboardStore {
  readonly activeDataset = signal<StuntingDashboardDataset>(dashboardDataRaw as StuntingDashboardDataset);
  readonly isCustomData = signal<boolean>(false);
  readonly uploadedFileName = signal<string | null>(null);

  get dataset(): StuntingDashboardDataset {
    return this.activeDataset();
  }

  // Map geometry metadata
  readonly districtBoundaries = CENTRAL_JAVA_DISTRICTS;
  readonly neighborProvinces = NEIGHBOR_PROVINCES;
  readonly javaOverviewProvinces = JAVA_OVERVIEW_PROVINCES;
  readonly mainMapViewBox = MAIN_MAP_VIEWBOX;
  readonly javaMapViewBox = JAVA_MAP_VIEWBOX;

  // State signals
  readonly selectedWilayah = signal<string>('MEDIAN');
  readonly selectedIndicatorKey = signal<string>('x1_ttd_rematri');
  readonly selectedScatterPeriod = signal<string>('ALL');
  readonly selectedSpatialPeriod = signal<string>(
    dashboardDataRaw.metadata.periods[dashboardDataRaw.metadata.periods.length - 1],
  );
  readonly heatmapSearch = signal<string>('');
  readonly selectedBoxplotMetric = signal<'all' | 'median' | 'min' | 'max' | 'range'>('all');
  readonly showAdvancedStats = signal<boolean>(false);

  // Core metadata computed
  readonly metadata = computed(() => this.dataset.metadata);
  readonly summaryCards = computed(() => this.dataset.summary_cards);
  readonly periods = computed(() => this.dataset.metadata.periods);
  readonly indicators = computed(() => this.dataset.metadata.indicators);

  readonly wilayahList = computed(() => {
    const list = Array.from(new Set(this.dataset.observations.map((o) => o.kabupaten_kota)));
    return list.sort((a, b) => a.localeCompare(b));
  });

  readonly selectedIndicator = computed<StuntingIndicatorDef>(() => {
    const key = this.selectedIndicatorKey();
    return (
      this.indicators().find((i) => i.key === key) || this.indicators()[0]
    );
  });

  // Section C: Trend Prevalensi Stunting
  readonly trendLineData = computed<{
    wilayahName: string;
    points: TrendPoint[];
    overallDelta: number;
    interpretationText: string;
  }>(() => {
    const wilayah = this.selectedWilayah();
    const periods = this.periods();

    let values: number[] = [];

    if (wilayah === 'MEDIAN') {
      values = periods.map((p) => this.dataset.period_stats[p].y_stunting.median);
    } else {
      const records = this.dataset.observations.filter((o) => o.kabupaten_kota === wilayah);
      const valMap = new Map(records.map((r) => [r.triwulan, r.y_stunting]));
      values = periods.map((p) => valMap.get(p) ?? 0);
    }

    const points: TrendPoint[] = values.map((val, idx) => {
      const delta = idx === 0 ? null : Number((val - values[idx - 1]).toFixed(2));
      let pointText = '';
      if (delta !== null) {
        if (delta > 0) {
          pointText = `Naik ${delta.toFixed(2)} poin persentase`;
        } else if (delta < 0) {
          pointText = `Turun ${Math.abs(delta).toFixed(2)} poin persentase`;
        } else {
          pointText = `Stabil (0,00 poin persentase)`;
        }
      }
      return {
        period: periods[idx],
        value: val,
        deltaFromPrev: delta,
        pointPercentText: pointText,
      };
    });

    const overallDelta = Number((values[values.length - 1] - values[0]).toFixed(2));
    const firstVal = values[0].toFixed(2).replace('.', ',');
    const lastVal = values[values.length - 1].toFixed(2).replace('.', ',');
    const absDelta = Math.abs(overallDelta).toFixed(2).replace('.', ',');

    let interpretation = '';
    const wilayahLabel =
      wilayah === 'MEDIAN'
        ? 'Median antar kabupaten/kota di Jawa Tengah'
        : wilayah;

    if (overallDelta > 0) {
      interpretation = `Prevalensi stunting pada ${wilayahLabel} meningkat dari ${firstVal}% pada ${periods[0]} menjadi ${lastVal}% pada ${periods[periods.length - 1]}, atau naik ${absDelta} poin persentase.`;
    } else if (overallDelta < 0) {
      interpretation = `Prevalensi stunting pada ${wilayahLabel} menurun dari ${firstVal}% pada ${periods[0]} menjadi ${lastVal}% pada ${periods[periods.length - 1]}, atau turun ${absDelta} poin persentase.`;
    } else {
      interpretation = `Prevalensi stunting pada ${wilayahLabel} tercatat sama antara ${periods[0]} dan ${periods[periods.length - 1]} (${firstVal}%), dengan perubahan bersih 0,00 poin persentase.`;
    }

    return {
      wilayahName: wilayah === 'MEDIAN' ? 'Median Antarwilayah' : wilayah,
      points,
      overallDelta,
      interpretationText: interpretation,
    };
  });

  // Section D: Perubahan Antartriwulan
  readonly quarterlyTransitions = computed<TransitionDelta[]>(() => {
    const trend = this.trendLineData();
    const pts = trend.points;
    const transitions: TransitionDelta[] = [];

    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const delta = Number((curr.value - prev.value).toFixed(2));
      let label = '';
      if (delta > 0) {
        label = `+${delta.toFixed(2)} pp`;
      } else if (delta < 0) {
        label = `${delta.toFixed(2)} pp`;
      } else {
        label = `0,00 pp`;
      }
      transitions.push({
        interval: `${prev.period} → ${curr.period}`,
        fromPeriod: prev.period,
        toPeriod: curr.period,
        delta,
        label,
      });
    }

    return transitions;
  });

  // Section E: Heatmap
  readonly heatmapRows = computed<HeatmapRow[]>(() => {
    const query = this.heatmapSearch().trim().toLowerCase();
    const periods = this.periods();
    const byWilayah = new Map<string, { period: string; value: number }[]>();

    for (const obs of this.dataset.observations) {
      if (!byWilayah.has(obs.kabupaten_kota)) {
        byWilayah.set(obs.kabupaten_kota, []);
      }
      byWilayah.get(obs.kabupaten_kota)!.push({
        period: obs.triwulan,
        value: obs.y_stunting,
      });
    }

    const rows: HeatmapRow[] = [];
    for (const [wil, vals] of byWilayah.entries()) {
      if (query && !wil.toLowerCase().includes(query)) {
        continue;
      }
      // Ensure periods ordered
      const orderedVals = periods.map(
        (p) => vals.find((v) => v.period === p) || { period: p, value: 0 },
      );
      const numVals = orderedVals.map((v) => v.value);
      const min = Math.min(...numVals);
      const max = Math.max(...numVals);
      const deltaOverall = Number((numVals[numVals.length - 1] - numVals[0]).toFixed(2));

      rows.push({
        wilayah: wil,
        values: orderedVals,
        min,
        max,
        deltaOverall,
      });
    }

    return rows.sort((a, b) => a.wilayah.localeCompare(b.wilayah));
  });

  readonly heatmapMinMax = computed<{ min: number; max: number }>(() => {
    const yVals = this.dataset.observations.map((o) => o.y_stunting);
    return {
      min: Math.min(...yVals),
      max: Math.max(...yVals),
    };
  });

  // Section F: Boxplot per triwulan
  readonly boxplotData = computed(() => {
    const periods = this.periods();
    return periods.map((p) => {
      const stats = this.dataset.period_stats[p].y_stunting;
      const allVals = this.dataset.observations
        .filter((o) => o.triwulan === p)
        .map((o) => o.y_stunting)
        .sort((a, b) => a - b);

      return {
        period: p,
        stats,
        allValues: allVals,
      };
    });
  });

  // Section G: Spatial coordinates
  readonly spatialCentroids = computed(() => {
    const selectedPeriod = this.selectedSpatialPeriod();
    const coords = this.dataset.coordinates;
    const obsMap = new Map(
      this.dataset.observations
        .filter((o) => o.triwulan === selectedPeriod)
        .map((o) => [o.kabupaten_kota, o.y_stunting]),
    );

    return coords.map((c) => ({
      kabupaten_kota: c.kabupaten_kota,
      lon: c.lon,
      lat: c.lat,
      stunting: obsMap.get(c.kabupaten_kota) ?? null,
      period: selectedPeriod,
    }));
  });

  // Section G: Spatial Map Polygons & Boundaries
  readonly spatialMapFeatures = computed(() => {
    const selectedPeriod = this.selectedSpatialPeriod();
    const obsMap = new Map(
      this.dataset.observations
        .filter((o) => o.triwulan === selectedPeriod)
        .map((o) => [o.kabupaten_kota, o.y_stunting]),
    );

    return CENTRAL_JAVA_DISTRICTS.map((feat) => {
      const val = obsMap.get(feat.kabupatenKota) ?? null;
      return {
        ...feat,
        stunting: val,
        period: selectedPeriod,
      };
    });
  });

  // Section H: Capaian 9 Indikator Intervensi
  readonly indicatorTrendData = computed<{
    indicator: StuntingIndicatorDef;
    wilayahName: string;
    points: { period: string; value: number }[];
    deltaOverall: number;
    intervalDeltas: { interval: string; delta: number }[];
  }>(() => {
    const ind = this.selectedIndicator();
    const indKey = ind.key;
    const wilayah = this.selectedWilayah();
    const periods = this.periods();

    let values: number[] = [];
    if (wilayah === 'MEDIAN') {
      values = periods.map(
        (p) => this.dataset.period_stats[p].indicators[indKey]?.median ?? 0,
      );
    } else {
      const records = this.dataset.observations.filter((o) => o.kabupaten_kota === wilayah);
      const valMap = new Map(records.map((r) => [r.triwulan, Number(r[indKey]) || 0]));
      values = periods.map((p) => valMap.get(p) ?? 0);
    }

    const points = values.map((val, idx) => ({
      period: periods[idx],
      value: val,
    }));

    const deltaOverall = Number((values[values.length - 1] - values[0]).toFixed(2));
    const intervalDeltas: { interval: string; delta: number }[] = [];
    for (let i = 1; i < values.length; i++) {
      intervalDeltas.push({
        interval: `${periods[i - 1]} → ${periods[i]}`,
        delta: Number((values[i] - values[i - 1]).toFixed(2)),
      });
    }

    return {
      indicator: ind,
      wilayahName: wilayah === 'MEDIAN' ? 'Median Antarwilayah' : wilayah,
      points,
      deltaOverall,
      intervalDeltas,
    };
  });

  // Section I: Scatter plot hubungan intervensi vs stunting
  readonly scatterData = computed<{
    indicator: StuntingIndicatorDef;
    points: ScatterPoint[];
    rPearson: number;
    trendline: { slope: number; intercept: number; minX: number; maxX: number };
  }>(() => {
    const ind = this.selectedIndicator();
    const period = this.selectedScatterPeriod();
    const indKey = ind.key;

    let obsList = this.dataset.observations;
    if (period !== 'ALL') {
      obsList = obsList.filter((o) => o.triwulan === period);
    }

    const points: ScatterPoint[] = obsList.map((o) => ({
      wilayah: o.kabupaten_kota,
      period: o.triwulan,
      xValue: Number(o[indKey]) || 0,
      yValue: o.y_stunting,
    }));

    // Linear regression calculation
    const n = points.length;
    let rPearson = 0;
    let slope = 0;
    let intercept = 0;
    let minX = 0;
    let maxX = 100;

    if (n > 1) {
      const xArr = points.map((p) => p.xValue);
      const yArr = points.map((p) => p.yValue);
      minX = Math.min(...xArr);
      maxX = Math.max(...xArr);

      const meanX = xArr.reduce((a, b) => a + b, 0) / n;
      const meanY = yArr.reduce((a, b) => a + b, 0) / n;

      let num = 0;
      let denX = 0;
      let denY = 0;

      for (let i = 0; i < n; i++) {
        const dx = xArr[i] - meanX;
        const dy = yArr[i] - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
      }

      if (denX > 0 && denY > 0) {
        rPearson = Number((num / Math.sqrt(denX * denY)).toFixed(3));
        slope = Number((num / denX).toFixed(4));
        intercept = Number((meanY - slope * meanX).toFixed(4));
      }
    }

    return {
      indicator: ind,
      points,
      rPearson,
      trendline: { slope, intercept, minX, maxX },
    };
  });

  // Section J: Models
  readonly models = computed(() => this.dataset.models);

  // Setters
  setWilayah(wilayah: string) {
    this.selectedWilayah.set(wilayah);
  }

  setIndicator(key: string) {
    this.selectedIndicatorKey.set(key);
  }

  setScatterPeriod(period: string) {
    this.selectedScatterPeriod.set(period);
  }

  setSpatialPeriod(period: string) {
    this.selectedSpatialPeriod.set(period);
  }

  setHeatmapSearch(query: string) {
    this.heatmapSearch.set(query);
  }

  setBoxplotMetric(metric: 'all' | 'median' | 'min' | 'max' | 'range') {
    this.selectedBoxplotMetric.set(metric);
  }

  toggleAdvancedStats() {
    this.showAdvancedStats.update((v) => !v);
  }

  loadCustomWorkbook(buffer: ArrayBuffer | Uint8Array, filename: string): ParseResult {
    const result = parseStuntingWorkbook(buffer, this.activeDataset(), filename);
    if (result.success && result.dataset) {
      this.activeDataset.set(result.dataset);
      this.isCustomData.set(true);
      this.uploadedFileName.set(filename);
      const periods = result.dataset.metadata.periods;
      if (!periods.includes(this.selectedSpatialPeriod())) {
        this.selectedSpatialPeriod.set(periods[periods.length - 1]);
      }
      if (this.selectedScatterPeriod() !== 'ALL' && !periods.includes(this.selectedScatterPeriod())) {
        this.selectedScatterPeriod.set('ALL');
      }
    }
    return result;
  }

  resetToDefaultData(): void {
    this.activeDataset.set(dashboardDataRaw as StuntingDashboardDataset);
    this.isCustomData.set(false);
    this.uploadedFileName.set(null);
    const defPeriods = dashboardDataRaw.metadata.periods;
    this.selectedSpatialPeriod.set(defPeriods[defPeriods.length - 1]);
    this.selectedScatterPeriod.set('ALL');
    this.selectedWilayah.set('MEDIAN');
  }
}
