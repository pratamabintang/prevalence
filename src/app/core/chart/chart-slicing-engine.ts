import { IndicatorEvaluator } from '../evaluation/indicator-evaluator';
import {
  ChartDataRow,
  ChartLayoutEngine,
  ChartLayoutResult,
  ChartSeriesConfig,
} from './chart-layout-engine';

export interface IndicatorStats {
  total: number;
  totalTargeted?: number;
  validCount: number;
  missingCount: number;
  zeroCount: number;
  achievedCount: number;
  avgValue: number | null;
  highest: { label?: string; name?: string; value: number } | null;
  lowest: { label?: string; name?: string; value: number } | null;
  targetValue?: number | null;
}

export interface RegionStats extends IndicatorStats {
  totalTargeted: number;
  highest: { label: string; value: number } | null;
  lowest: { label: string; value: number } | null;
}

export interface RegionChartGroup {
  regionName: string;
  layout: ChartLayoutResult;
  stats: RegionStats;
}

export interface IndicatorChartGroup {
  series: ChartSeriesConfig;
  layout: ChartLayoutResult;
  stats: IndicatorStats;
}

export interface RegionSlicingSpec {
  categories: string[];
  series: ChartSeriesConfig[];
  rows: ChartDataRow[];
  categoryColumn: string;
  sortMode?: 'desc' | 'asc' | 'default';
  targetValue?: number | null;
  targetOperator?: string;
  indicatorTargets?: Record<string, number | null>;
  indicatorTargetOperators?: Record<string, string>;
  width?: number;
  rowHeight?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  gapWidth?: number;
}

export interface IndicatorSlicingSpec {
  categories: string[];
  series: ChartSeriesConfig[];
  rows: ChartDataRow[];
  categoryColumn: string;
  sortMode?: 'desc' | 'asc' | 'default';
  targetValue?: number | null;
  targetOperator?: string;
  indicatorTargets?: Record<string, number | null>;
  indicatorTargetOperators?: Record<string, string>;
  width?: number;
  rowHeight?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  gapWidth?: number;
}

/**
 * ChartSlicingEngine: Modul domain presentasi untuk pemotongan multi-dimensi dataset Dinkes.
 * Mengelompokkan grafik per-wilayah dan per-indikator, mengkalkulasi ringkasan statistik,
 * dan mengurutkan kategori secara deterministik.
 */
export class ChartSlicingEngine {
  /**
   * Menghasilkan kelompok grafik per-wilayah (transposisi seri indikator ke baris vertikal).
   */
  static computeRegionGroups(spec: RegionSlicingSpec): RegionChartGroup[] {
    const rawCats = spec.categories;
    const series = spec.series;
    const rows = spec.rows;
    const catCol = spec.categoryColumn;
    const sortMode = spec.sortMode ?? 'default';
    const target = spec.targetValue ?? null;
    const indicatorTargets = spec.indicatorTargets ?? {};
    const indicatorTargetOperators = spec.indicatorTargetOperators ?? {};

    const rowMap = new Map<string, ChartDataRow>();
    for (const r of rows) {
      const key = String(r[catCol] ?? '')
        .trim()
        .toLowerCase();
      if (key) {
        rowMap.set(key, r);
      }
    }

    const statsMap = new Map<string, RegionStats>();

    for (const catName of rawCats) {
      const r = rowMap.get(catName.trim().toLowerCase());

      let validCount = 0;
      let missingCount = 0;
      let zeroCount = 0;
      let achievedCount = 0;
      let totalTargeted = 0;
      let sum = 0;
      let highest: { label: string; value: number } | null = null;
      let lowest: { label: string; value: number } | null = null;

      for (const s of series) {
        const raw = r ? r[s.key] : null;
        const num = IndicatorEvaluator.parseSmartNumber(raw);
        const indTarget = indicatorTargets[s.key] !== undefined ? indicatorTargets[s.key] : null;
        const targetOp =
          indicatorTargetOperators[s.key] ||
          indicatorTargetOperators[s.label] ||
          spec.targetOperator ||
          '>=';

        if (indTarget !== null) {
          totalTargeted++;
        }

        if (num === null) {
          missingCount++;
        } else {
          validCount++;
          sum += num;
          if (num === 0) zeroCount++;
          const isAchieved =
            indTarget !== null && (targetOp === '<=' ? num <= indTarget : num >= indTarget);
          if (isAchieved) achievedCount++;

          if (highest === null || num > highest.value) {
            highest = { label: s.label, value: num };
          }
          if (lowest === null || num < lowest.value) {
            lowest = { label: s.label, value: num };
          }
        }
      }

      const avgValue = validCount > 0 ? Math.round((sum / validCount) * 10) / 10 : null;

      statsMap.set(catName, {
        total: series.length,
        totalTargeted,
        validCount,
        missingCount,
        zeroCount,
        achievedCount,
        avgValue,
        highest,
        lowest,
        targetValue: target,
      });
    }

    let cats = [...rawCats];

    if (sortMode === 'desc' || sortMode === 'asc') {
      cats.sort((a, b) => {
        const valA = statsMap.get(a)?.avgValue ?? null;
        const valB = statsMap.get(b)?.avgValue ?? null;
        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;
        return sortMode === 'desc' ? valB - valA : valA - valB;
      });
    }

    const width = spec.width ?? 780;
    const rowHeight = spec.rowHeight ?? 22;
    const margin = spec.margin ?? { top: 60, right: 65, bottom: 58, left: 130 };
    const gapWidth = spec.gapWidth ?? 5;

    return cats.map((catName) => {
      const r = rowMap.get(catName.trim().toLowerCase());
      const stats = statsMap.get(catName)!;

      const indicatorRows = series.map((s) => ({
        __indicator: s.label,
        __value: r ? r[s.key] : null,
      }));

      const categoryColors: Record<string, string> = {};
      const categoryTargets: Record<string, number | null> = {};
      const categoryTargetOperators: Record<string, string> = {};
      for (const s of series) {
        categoryColors[s.label] = s.color;
        categoryTargets[s.label] =
          indicatorTargets[s.key] !== undefined ? indicatorTargets[s.key] : null;
        categoryTargetOperators[s.label] =
          indicatorTargetOperators[s.key] ||
          indicatorTargetOperators[s.label] ||
          spec.targetOperator ||
          '>=';
      }

      const layout = ChartLayoutEngine.computeLayout({
        categoryColumn: '__indicator',
        categories: series.map((s) => s.label),
        series: [{ key: '__value', label: 'Capaian', color: '#525AFF' }],
        rows: indicatorRows,
        categoryColors,
        categoryTargets,
        categoryTargetOperators,
        width,
        rowHeight,
        margin,
        gapWidth,
      });

      return {
        regionName: catName,
        layout,
        stats,
      };
    });
  }

  /**
   * Menghasilkan kelompok grafik per-indikator (setiap seri indikator disajikan dalam grafik terpisah).
   */
  static computeIndicatorGroups(spec: IndicatorSlicingSpec): IndicatorChartGroup[] {
    const series = spec.series;
    const catCol = spec.categoryColumn;
    const rawCats = spec.categories;
    const rows = spec.rows;
    const sortMode = spec.sortMode ?? 'default';
    const indicatorTargets = spec.indicatorTargets ?? {};
    const indicatorTargetOperators = spec.indicatorTargetOperators ?? {};

    const rowMap = new Map<string, ChartDataRow>();
    for (const r of rows) {
      const key = String(r[catCol] ?? '')
        .trim()
        .toLowerCase();
      if (key) {
        rowMap.set(key, r);
      }
    }

    const width = spec.width ?? 780;
    const rowHeight = spec.rowHeight ?? 22;
    const margin = spec.margin ?? { top: 60, right: 65, bottom: 58, left: 130 };
    const gapWidth = spec.gapWidth ?? 5;

    return series.map((s) => {
      let cats = [...rawCats];
      const target = indicatorTargets[s.key] !== undefined ? indicatorTargets[s.key] : null;
      const targetOp =
        indicatorTargetOperators[s.key] ||
        indicatorTargetOperators[s.label] ||
        spec.targetOperator ||
        '>=';

      if (sortMode === 'desc' || sortMode === 'asc') {
        cats.sort((a, b) => {
          const rowA = rowMap.get(a.trim().toLowerCase());
          const rowB = rowMap.get(b.trim().toLowerCase());
          const valA = rowA ? IndicatorEvaluator.parseSmartNumber(rowA[s.key]) : null;
          const valB = rowB ? IndicatorEvaluator.parseSmartNumber(rowB[s.key]) : null;

          if (valA === null && valB === null) return 0;
          if (valA === null) return 1;
          if (valB === null) return -1;

          return sortMode === 'desc' ? valB - valA : valA - valB;
        });
      }

      let validCount = 0;
      let missingCount = 0;
      let zeroCount = 0;
      let achievedCount = 0;
      let sum = 0;
      let highest: { name: string; value: number } | null = null;
      let lowest: { name: string; value: number } | null = null;

      for (const cat of rawCats) {
        const r = rowMap.get(cat.trim().toLowerCase());
        const raw = r ? r[s.key] : null;
        const num = IndicatorEvaluator.parseSmartNumber(raw);

        if (num === null) {
          missingCount++;
        } else {
          validCount++;
          sum += num;
          if (num === 0) zeroCount++;
          const isAchieved =
            target !== null && (targetOp === '<=' ? num <= target : num >= target);
          if (isAchieved) achievedCount++;

          if (highest === null || num > highest.value) {
            highest = { name: cat, value: num };
          }
          if (lowest === null || num < lowest.value) {
            lowest = { name: cat, value: num };
          }
        }
      }

      const avgValue = validCount > 0 ? Math.round((sum / validCount) * 10) / 10 : null;

      const layout = ChartLayoutEngine.computeLayout({
        categoryColumn: catCol,
        categories: cats,
        series: [s],
        rows,
        targetValue: target,
        targetOperator: targetOp,
        width,
        rowHeight,
        margin,
        gapWidth,
      });

      return {
        series: s,
        layout,
        stats: {
          total: rawCats.length,
          validCount,
          missingCount,
          zeroCount,
          achievedCount,
          avgValue,
          highest,
          lowest,
          targetValue: target,
        },
      };
    });
  }
}
