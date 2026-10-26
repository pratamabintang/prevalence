import { IndicatorEvaluator } from '../evaluation/indicator-evaluator';

export interface DivergingBarItem {
  key: string;
  label: string;
  actualValue: number;
  targetValue: number;
  targetOperator: string; // '>=' | '<='
  performanceGap: number; // positive = achieved (green), negative = deficit (red)
  rawGap: number; // actualValue - targetValue
  isAchieved: boolean;
  statusText: string;
  color: string;
  barX: number;
  barWidth: number;
  isPositive: boolean;
  rowIndex: number;
  y: number;
}

export interface DivergingBarSpec {
  seriesList: { key: string; label: string; color?: string }[];
  rows: Record<string, unknown>[];
  categoryColumn: string;
  indicatorTargets?: Record<string, number | null>;
  indicatorTargetOperators?: Record<string, string>;
  defaultTarget?: number | null;
  defaultOperator?: string;
  width?: number;
  rowHeight?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  sortMode?: 'deficit-first' | 'achieved-first' | 'default';
  filterMode?: 'all' | 'deficit-only' | 'achieved-only';
}

export interface DivergingGridTick {
  value: number;
  x: number;
  label: string;
}

export interface DivergingBarResult {
  items: DivergingBarItem[];
  achievedCount: number;
  deficitCount: number;
  totalTargeted: number;
  overallAchievementRate: number; // 0 - 100%
  topPerformer: DivergingBarItem | null;
  mostCriticalDeficit: DivergingBarItem | null;
  maxGapAbs: number;
  zeroX: number;
  plotX: number;
  plotWidth: number;
  viewBoxWidth: number;
  viewBoxHeight: number;
  gridTicks: DivergingGridTick[];
}

/**
 * DivergingBarEngine: Modul komputasi untuk Gap-to-Target Analysis (Diverging Bar Chart).
 * Mengukur deviasi kinerja terhadap target:
 * - Garis tengah 0 merepresentasikan titik tepat pada target.
 * - Sisi Kanan (Hijau): Kinerja melampaui target (untuk >=) atau di bawah batas toleransi (untuk <=).
 * - Sisi Kiri (Merah): Kinerja defisit / belum mencapai target.
 */
export class DivergingBarEngine {
  static readonly COLOR_ACHIEVED = '#16a34a'; // Emerald / green
  static readonly COLOR_DEFICIT = '#dc2626'; // Rose / red
  static readonly COLOR_EXACT = '#eab308'; // Amber / yellow

  static computeDivergingBars(spec: DivergingBarSpec): DivergingBarResult {
    const width = spec.width ?? 840;
    const rowHeight = spec.rowHeight ?? 42;
    const margin = spec.margin ?? { top: 40, right: 90, bottom: 40, left: 260 };
    const sortMode = spec.sortMode ?? 'deficit-first';
    const filterMode = spec.filterMode ?? 'all';

    const plotX = margin.left;
    const plotWidth = Math.max(100, width - margin.left - margin.right);
    const zeroX = plotX + plotWidth / 2;
    const halfPlot = plotWidth / 2;

    const targets = spec.indicatorTargets ?? {};
    const operators = spec.indicatorTargetOperators ?? {};
    const defaultTgt = spec.defaultTarget !== undefined && spec.defaultTarget !== null ? spec.defaultTarget : 50;
    const defaultOp = spec.defaultOperator || '>=';

    // 1. Ekstraksi nilai rata-rata provinsi untuk tiap indikator
    const rawItems: {
      key: string;
      label: string;
      actualValue: number;
      targetValue: number;
      targetOperator: string;
      performanceGap: number;
      rawGap: number;
      isAchieved: boolean;
      statusText: string;
      color: string;
    }[] = [];

    for (const s of spec.seriesList) {
      let sum = 0;
      let count = 0;

      for (const r of spec.rows) {
        const num = IndicatorEvaluator.parseSmartNumber(r[s.key]);
        if (num !== null) {
          sum += num;
          count++;
        }
      }

      const actualValue = count > 0 ? Math.round((sum / count) * 100) / 100 : 0;

      // Temukan target indikator
      let targetValue = defaultTgt;
      if (targets[s.key] !== undefined && targets[s.key] !== null) {
        targetValue = targets[s.key]!;
      } else if (targets[s.label] !== undefined && targets[s.label] !== null) {
        targetValue = targets[s.label]!;
      } else {
        const lowerKey = s.key.trim().toLowerCase();
        const matched = Object.keys(targets).find((k) => k.trim().toLowerCase() === lowerKey);
        if (matched && targets[matched] !== undefined && targets[matched] !== null) {
          targetValue = targets[matched]!;
        }
      }

      // Temukan operator indikator
      let targetOperator = defaultOp;
      if (operators[s.key]) {
        targetOperator = operators[s.key];
      } else if (operators[s.label]) {
        targetOperator = operators[s.label];
      } else {
        const lowerKey = s.key.trim().toLowerCase();
        const matched = Object.keys(operators).find((k) => k.trim().toLowerCase() === lowerKey);
        if (matched && operators[matched]) {
          targetOperator = operators[matched];
        }
      }

      const rawGap = Math.round((actualValue - targetValue) * 100) / 100;
      let performanceGap: number;
      let isAchieved: boolean;
      let statusText: string;
      let color: string;

      if (targetOperator === '<=') {
        // Lower is better (Masalah Gizi)
        // Jika actual <= target -> gap positif (kinerja baik)
        // Jika actual > target -> gap negatif (melebihi batas toleransi)
        performanceGap = Math.round((targetValue - actualValue) * 100) / 100;
        isAchieved = actualValue <= targetValue;

        if (performanceGap > 0) {
          color = DivergingBarEngine.COLOR_ACHIEVED;
          statusText = `${Math.abs(performanceGap)}% di bawah batas maksimal (Aman)`;
        } else if (performanceGap < 0) {
          color = DivergingBarEngine.COLOR_DEFICIT;
          statusText = `${Math.abs(performanceGap)}% melebihi batas target (Defisit)`;
        } else {
          color = DivergingBarEngine.COLOR_EXACT;
          statusText = `Tepat pada batas target (${targetValue}%)`;
        }
      } else {
        // Higher is better (Intervensi Spesifik / Cakupan)
        performanceGap = rawGap;
        isAchieved = actualValue >= targetValue;

        if (performanceGap > 0) {
          color = DivergingBarEngine.COLOR_ACHIEVED;
          statusText = `+${performanceGap}% melampaui target (Tercapai)`;
        } else if (performanceGap < 0) {
          color = DivergingBarEngine.COLOR_DEFICIT;
          statusText = `${performanceGap}% di bawah target (Defisit)`;
        } else {
          color = DivergingBarEngine.COLOR_EXACT;
          statusText = `Tepat pada target (${targetValue}%)`;
        }
      }

      rawItems.push({
        key: s.key,
        label: s.label,
        actualValue,
        targetValue,
        targetOperator,
        performanceGap,
        rawGap,
        isAchieved,
        statusText,
        color,
      });
    }

    const totalTargeted = rawItems.length;
    const achievedCount = rawItems.filter((i) => i.isAchieved).length;
    const deficitCount = totalTargeted - achievedCount;
    const overallAchievementRate =
      totalTargeted > 0 ? Math.round((achievedCount / totalTargeted) * 1000) / 10 : 0;

    // Cari top performer dan most critical deficit
    let topPerformer: DivergingBarItem | null = null;
    let mostCriticalDeficit: DivergingBarItem | null = null;

    if (rawItems.length > 0) {
      const sortedByGap = [...rawItems].sort((a, b) => b.performanceGap - a.performanceGap);
      const best = sortedByGap[0];
      const worst = sortedByGap[sortedByGap.length - 1];

      if (best.performanceGap > 0) {
        topPerformer = {
          ...best,
          barX: 0,
          barWidth: 0,
          isPositive: true,
          rowIndex: 0,
          y: 0,
        };
      }
      if (worst.performanceGap < 0) {
        mostCriticalDeficit = {
          ...worst,
          barX: 0,
          barWidth: 0,
          isPositive: false,
          rowIndex: 0,
          y: 0,
        };
      }
    }

    // 2. Filter data
    let filtered = [...rawItems];
    if (filterMode === 'deficit-only') {
      filtered = filtered.filter((i) => !i.isAchieved || i.performanceGap < 0);
    } else if (filterMode === 'achieved-only') {
      filtered = filtered.filter((i) => i.isAchieved && i.performanceGap >= 0);
    }

    // 3. Urutkan data
    if (sortMode === 'deficit-first') {
      filtered.sort((a, b) => a.performanceGap - b.performanceGap);
    } else if (sortMode === 'achieved-first') {
      filtered.sort((a, b) => b.performanceGap - a.performanceGap);
    }

    // 4. Hitung skala maksimum simetris
    let maxGapAbs = 10;
    for (const item of rawItems) {
      const absGap = Math.abs(item.performanceGap);
      if (absGap > maxGapAbs) {
        maxGapAbs = absGap;
      }
    }
    // Bulatkan ke kelipatan 5 atau 10 di atasnya untuk ruang napas visual
    maxGapAbs = Math.ceil(maxGapAbs / 5) * 5;

    // 5. Hitung koordinat SVG bar per item
    const items: DivergingBarItem[] = filtered.map((item, idx) => {
      const isPositive = item.performanceGap >= 0;
      const absGap = Math.abs(item.performanceGap);
      const ratio = Math.min(1, absGap / maxGapAbs);
      const barWidth = Math.max(3, ratio * halfPlot);
      const barX = isPositive ? zeroX : zeroX - barWidth;
      const y = margin.top + idx * rowHeight;

      return {
        ...item,
        barX,
        barWidth,
        isPositive,
        rowIndex: idx,
        y,
      };
    });

    const viewBoxHeight = Math.max(220, margin.top + items.length * rowHeight + margin.bottom);

    // 6. Buat grid ticks simetris (-maxGap ke +maxGap)
    const gridTicks: DivergingGridTick[] = [];
    const step = maxGapAbs <= 20 ? 5 : maxGapAbs <= 50 ? 10 : 20;

    for (let v = -maxGapAbs; v <= maxGapAbs; v += step) {
      const tickX = zeroX + (v / maxGapAbs) * halfPlot;
      const prefix = v > 0 ? '+' : '';
      gridTicks.push({
        value: v,
        x: tickX,
        label: `${prefix}${v}%`,
      });
    }

    return {
      items,
      achievedCount,
      deficitCount,
      totalTargeted,
      overallAchievementRate,
      topPerformer,
      mostCriticalDeficit,
      maxGapAbs,
      zeroX,
      plotX,
      plotWidth,
      viewBoxWidth: width,
      viewBoxHeight,
      gridTicks,
    };
  }
}
