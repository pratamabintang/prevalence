import { IndicatorEvaluator } from '../evaluation/indicator-evaluator';

export interface ChartSeriesConfig {
  key: string;
  label: string;
  color: string;
}

export interface ChartDataRow {
  [key: string]: unknown;
}

export interface ChartBarItem {
  seriesKey: string;
  seriesLabel: string;
  color: string;
  rawVal: unknown;
  numericVal: number | null;
  displayLabel: string;
  isZero: boolean;
  isMissing: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChartCategoryGroup {
  categoryName: string;
  y: number;
  height: number;
  bars: ChartBarItem[];
}

export interface ChartGridTick {
  value: number;
  x: number;
  label: string;
}

export interface ChartLayoutSpec {
  categories: string[];
  series: ChartSeriesConfig[];
  rows: ChartDataRow[];
  categoryColumn: string;
  targetValue?: number | null;
  width?: number;
  rowHeight?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
}

export interface ChartLayoutResult {
  viewBoxWidth: number;
  viewBoxHeight: number;
  plotX: number;
  plotY: number;
  plotWidth: number;
  plotHeight: number;
  minValue: number;
  maxValue: number;
  ticks: ChartGridTick[];
  categoryGroups: ChartCategoryGroup[];
  targetLineX?: number | null;
}

/**
 * ChartLayoutEngine: Modul murni (pure) untuk menghitung koordinat layout matematika
 * pada Grouped Horizontal Bar Chart.
 */
export class ChartLayoutEngine {
  static computeLayout(spec: ChartLayoutSpec): ChartLayoutResult {
    const width = spec.width || 850;
    const margin = spec.margin || { top: 40, right: 90, bottom: 40, left: 190 };
    const seriesCount = Math.max(1, spec.series.length);
    const calculatedRowHeight = spec.rowHeight || Math.max(54, seriesCount * 20 + 20);

    const categoryCount = spec.categories.length;
    const plotWidth = Math.max(100, width - margin.left - margin.right);
    const plotHeight = Math.max(60, categoryCount * calculatedRowHeight);
    const viewBoxHeight = margin.top + margin.bottom + plotHeight;
    const viewBoxWidth = width;

    // 1. Ekstraksi semua nilai numerik untuk menentukan skala maksimum
    let maxVal = 0;
    const rowMap = new Map<string, ChartDataRow>();
    for (const r of spec.rows) {
      const catKey = String(r[spec.categoryColumn] ?? '').trim().toLowerCase();
      if (catKey) {
        rowMap.set(catKey, r);
      }
    }

    for (const catName of spec.categories) {
      const r = rowMap.get(catName.trim().toLowerCase());
      if (r) {
        for (const s of spec.series) {
          const raw = r[s.key];
          const num = IndicatorEvaluator.parseSmartNumber(raw);
          if (num !== null && num > maxVal) {
            maxVal = num;
          }
        }
      }
    }

    if (spec.targetValue !== undefined && spec.targetValue !== null && spec.targetValue > maxVal) {
      maxVal = spec.targetValue;
    }

    if (maxVal <= 0) {
      maxVal = 100;
    } else {
      // Pembulatan ke kelipatan terdekat agar skala terlihat profesional
      maxVal = this.computeNiceMax(maxVal);
    }

    // 2. Generate Ticks pada sumbu X
    const tickCount = 5;
    const ticks: ChartGridTick[] = [];
    for (let i = 0; i <= tickCount; i++) {
      const val = (maxVal / tickCount) * i;
      const x = margin.left + (plotWidth / tickCount) * i;
      const roundedVal = Math.round(val * 10) / 10;
      ticks.push({
        value: roundedVal,
        x,
        label: roundedVal.toLocaleString('id-ID'),
      });
    }

    // 3. Hitung Garis Target
    let targetLineX: number | null = null;
    if (spec.targetValue !== undefined && spec.targetValue !== null) {
      const clampedVal = Math.max(0, spec.targetValue);
      targetLineX = margin.left + (clampedVal / maxVal) * plotWidth;
    }

    // 4. Hitung Geometri Kelompok Batang per Kategori Wilayah
    const barSpacing = 3;
    const groupPadding = 10;
    const availableBarSpace = calculatedRowHeight - groupPadding * 2;
    const barHeight = Math.max(
      8,
      Math.min(22, (availableBarSpace - (seriesCount - 1) * barSpacing) / seriesCount),
    );

    const categoryGroups: ChartCategoryGroup[] = [];

    for (let cIdx = 0; cIdx < spec.categories.length; cIdx++) {
      const catName = spec.categories[cIdx];
      const r = rowMap.get(catName.trim().toLowerCase());
      const groupY = margin.top + cIdx * calculatedRowHeight;

      const bars: ChartBarItem[] = [];

      for (let sIdx = 0; sIdx < spec.series.length; sIdx++) {
        const s = spec.series[sIdx];
        const raw = r ? r[s.key] : null;
        const barY = groupY + groupPadding + sIdx * (barHeight + barSpacing);

        let numericVal: number | null = null;
        let isZero = false;
        let isMissing = false;
        let displayLabel = 'N/A';
        let barWidth = 0;

        if (raw === null || raw === undefined || String(raw).trim() === '' || String(raw).trim() === '-') {
          isMissing = true;
          displayLabel = 'N/A';
        } else {
          const parsed = IndicatorEvaluator.parseSmartNumber(raw);
          if (parsed === null) {
            isMissing = true;
            displayLabel = 'N/A';
          } else if (parsed === 0 || raw === 0 || String(raw).trim() === '0') {
            numericVal = 0;
            isZero = true;
            displayLabel = '0';
          } else {
            numericVal = parsed;
            displayLabel = parsed.toLocaleString('id-ID');
            barWidth = Math.max(0, (parsed / maxVal) * plotWidth);
          }
        }

        bars.push({
          seriesKey: s.key,
          seriesLabel: s.label,
          color: s.color,
          rawVal: raw,
          numericVal,
          displayLabel,
          isZero,
          isMissing,
          x: margin.left,
          y: barY,
          width: barWidth,
          height: barHeight,
        });
      }

      categoryGroups.push({
        categoryName: catName,
        y: groupY,
        height: calculatedRowHeight,
        bars,
      });
    }

    return {
      viewBoxWidth,
      viewBoxHeight,
      plotX: margin.left,
      plotY: margin.top,
      plotWidth,
      plotHeight,
      minValue: 0,
      maxValue: maxVal,
      ticks,
      categoryGroups,
      targetLineX,
    };
  }

  private static computeNiceMax(value: number): number {
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const normalized = value / magnitude;

    let niceFactor = 10;
    if (normalized <= 1.2) niceFactor = 1.2;
    else if (normalized <= 1.5) niceFactor = 1.5;
    else if (normalized <= 2) niceFactor = 2;
    else if (normalized <= 2.5) niceFactor = 2.5;
    else if (normalized <= 5) niceFactor = 5;
    else if (normalized <= 7.5) niceFactor = 7.5;
    else niceFactor = 10;

    return Math.ceil(niceFactor * magnitude);
  }
}
