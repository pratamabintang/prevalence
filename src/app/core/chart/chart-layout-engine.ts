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
  targetVal?: number | null;
  targetX?: number | null;
  isAchieved?: boolean | null;
}

export interface ChartCategoryGroup {
  categoryName: string;
  colIndex: number;
  rowIdx: number;
  plotX: number;
  plotWidth: number;
  y: number;
  height: number;
  bars: ChartBarItem[];
}

export interface ChartColumnLayout {
  colIndex: number;
  plotX: number;
  plotWidth: number;
  ticks: ChartGridTick[];
  targetLineX?: number | null;
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
  columns?: number;
  categoryColors?: Record<string, string>;
  categoryTargets?: Record<string, number | null>;
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
  targetLines?: number[];
  columns: number;
  columnLayouts: ChartColumnLayout[];
  dividerX?: number | null;
  hasCategoryTargets?: boolean;
}

/**
 * ChartLayoutEngine: Modul murni (pure) untuk menghitung koordinat layout matematika
 * pada Grouped Horizontal Bar Chart (mendukung 1 kolom atau 2 kolom daerah berdampingan).
 */
export class ChartLayoutEngine {
  static computeLayout(spec: ChartLayoutSpec): ChartLayoutResult {
    const numColumns = spec.columns === 2 ? 2 : 1;
    const seriesCount = Math.max(1, spec.series.length);
    const calculatedRowHeight = spec.rowHeight || Math.max(54, seriesCount * 20 + 20);

    const categoryCount = spec.categories.length;
    const rowCount = numColumns === 2 ? Math.max(1, Math.ceil(categoryCount / 2)) : categoryCount;

    // 1. Ekstraksi semua nilai numerik untuk menentukan skala maksimum bersama
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

    if (spec.categoryTargets) {
      for (const tgt of Object.values(spec.categoryTargets)) {
        if (tgt !== undefined && tgt !== null && tgt > maxVal) {
          maxVal = tgt;
        }
      }
    }

    if (maxVal <= 0) {
      maxVal = 100;
    } else {
      // Pembulatan ke kelipatan terdekat agar skala terlihat profesional
      maxVal = this.computeNiceMax(maxVal);
    }

    const tickCount = 5;

    // 2. Geometri Kolom (1 Kolom Penuh atau 2 Kolom Berdampingan)
    const hasCategoryTargets = Boolean(
      spec.categoryTargets && Object.keys(spec.categoryTargets).length > 0,
    );
    let viewBoxWidth = spec.width || (numColumns === 2 ? 1280 : 850);
    const margin =
      spec.margin ||
      (numColumns === 2
        ? { top: 75, right: 20, bottom: 58, left: 20 }
        : { top: 40, right: 90, bottom: 40, left: 190 });

    const plotHeight = Math.max(60, rowCount * calculatedRowHeight);
    const viewBoxHeight = margin.top + margin.bottom + plotHeight;

    const columnLayouts: ChartColumnLayout[] = [];
    let dividerX: number | null = null;
    let mainPlotX = margin.left;
    let mainPlotWidth = 100;

    if (numColumns === 2) {
      const availableWidth = Math.max(400, viewBoxWidth - margin.left - margin.right);
      const labelWidth = 175;
      const valuePadding = 60;
      const columnGap = 24;

      // 2 * (labelWidth + colPlotWidth + valuePadding) + columnGap <= availableWidth
      const fixedHorizontal = 2 * (labelWidth + valuePadding) + columnGap;
      const colPlotWidth = Math.max(100, Math.floor((availableWidth - fixedHorizontal) / 2));
      mainPlotWidth = colPlotWidth;

      // Kolom 0 (Kiri)
      const col0LabelX = margin.left;
      const col0PlotX = col0LabelX + labelWidth;
      const col0EndX = col0PlotX + colPlotWidth;
      const col0TotalEnd = col0EndX + valuePadding;
      mainPlotX = col0PlotX;

      dividerX = col0TotalEnd + Math.floor(columnGap / 2);

      // Kolom 1 (Kanan)
      const col1LabelX = col0TotalEnd + columnGap;
      const col1PlotX = col1LabelX + labelWidth;

      // Ticks Kolom 0
      const col0Ticks: ChartGridTick[] = [];
      for (let i = 0; i <= tickCount; i++) {
        const val = (maxVal / tickCount) * i;
        const x = col0PlotX + (colPlotWidth / tickCount) * i;
        const roundedVal = Math.round(val * 10) / 10;
        col0Ticks.push({
          value: roundedVal,
          x,
          label: roundedVal.toLocaleString('id-ID'),
        });
      }

      // Ticks Kolom 1
      const col1Ticks: ChartGridTick[] = [];
      for (let i = 0; i <= tickCount; i++) {
        const val = (maxVal / tickCount) * i;
        const x = col1PlotX + (colPlotWidth / tickCount) * i;
        const roundedVal = Math.round(val * 10) / 10;
        col1Ticks.push({
          value: roundedVal,
          x,
          label: roundedVal.toLocaleString('id-ID'),
        });
      }

      let col0TargetX: number | null = null;
      let col1TargetX: number | null = null;
      if (!hasCategoryTargets && spec.targetValue !== undefined && spec.targetValue !== null) {
        const clampedVal = Math.max(0, spec.targetValue);
        col0TargetX = col0PlotX + (clampedVal / maxVal) * colPlotWidth;
        col1TargetX = col1PlotX + (clampedVal / maxVal) * colPlotWidth;
      }

      columnLayouts.push(
        {
          colIndex: 0,
          plotX: col0PlotX,
          plotWidth: colPlotWidth,
          ticks: col0Ticks,
          targetLineX: col0TargetX,
        },
        {
          colIndex: 1,
          plotX: col1PlotX,
          plotWidth: colPlotWidth,
          ticks: col1Ticks,
          targetLineX: col1TargetX,
        },
      );
    } else {
      // 1 Kolom Penuh
      mainPlotWidth = Math.max(100, viewBoxWidth - margin.left - margin.right);
      mainPlotX = margin.left;

      const singleTicks: ChartGridTick[] = [];
      for (let i = 0; i <= tickCount; i++) {
        const val = (maxVal / tickCount) * i;
        const x = margin.left + (mainPlotWidth / tickCount) * i;
        const roundedVal = Math.round(val * 10) / 10;
        singleTicks.push({
          value: roundedVal,
          x,
          label: roundedVal.toLocaleString('id-ID'),
        });
      }

      let targetX: number | null = null;
      if (!hasCategoryTargets && spec.targetValue !== undefined && spec.targetValue !== null) {
        const clampedVal = Math.max(0, spec.targetValue);
        targetX = margin.left + (clampedVal / maxVal) * mainPlotWidth;
      }

      columnLayouts.push({
        colIndex: 0,
        plotX: margin.left,
        plotWidth: mainPlotWidth,
        ticks: singleTicks,
        targetLineX: targetX,
      });
    }

    // 3. Gabungan Ticks dan Target Lines
    const allTicks: ChartGridTick[] = [];
    for (const c of columnLayouts) {
      allTicks.push(...c.ticks);
    }

    const targetLines: number[] = [];
    for (const c of columnLayouts) {
      if (c.targetLineX !== null && c.targetLineX !== undefined) {
        targetLines.push(c.targetLineX);
      }
    }
    const targetLineX = columnLayouts[0]?.targetLineX ?? null;

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

      const colIdx = numColumns === 2 ? cIdx % 2 : 0;
      const rowIdx = numColumns === 2 ? Math.floor(cIdx / 2) : cIdx;
      const groupY = margin.top + rowIdx * calculatedRowHeight;

      const colLayout = columnLayouts[colIdx];
      const groupPlotX = colLayout.plotX;
      const groupPlotWidth = colLayout.plotWidth;

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
            barWidth = Math.max(0, (parsed / maxVal) * groupPlotWidth);
          }
        }

        let targetVal: number | null = null;
        let targetX: number | null = null;
        let isAchieved: boolean | null = null;

        if (spec.categoryTargets) {
          if (spec.categoryTargets[catName] !== undefined) {
            targetVal = spec.categoryTargets[catName];
          } else {
            const lowerCat = catName.trim().toLowerCase();
            const matchedKey = Object.keys(spec.categoryTargets).find(
              (k) => k.trim().toLowerCase() === lowerCat,
            );
            if (matchedKey && spec.categoryTargets[matchedKey] !== undefined) {
              targetVal = spec.categoryTargets[matchedKey];
            }
          }
          if (targetVal !== null && targetVal !== undefined && targetVal < 0) {
            targetVal = null;
          }
        } else if (spec.targetValue !== undefined && spec.targetValue !== null && spec.targetValue >= 0) {
          targetVal = spec.targetValue;
        }

        if (targetVal !== null && targetVal !== undefined) {
          const clampedVal = Math.max(0, targetVal);
          targetX = groupPlotX + (clampedVal / maxVal) * groupPlotWidth;
          if (numericVal !== null) {
            isAchieved = numericVal >= targetVal;
          }
        }

        bars.push({
          seriesKey: s.key,
          seriesLabel: s.label,
          color: spec.categoryColors?.[catName] || s.color,
          rawVal: raw,
          numericVal,
          displayLabel,
          isZero,
          isMissing,
          x: groupPlotX,
          y: barY,
          width: barWidth,
          height: barHeight,
          targetVal,
          targetX,
          isAchieved,
        });
      }

      categoryGroups.push({
        categoryName: catName,
        colIndex: colIdx,
        rowIdx,
        plotX: groupPlotX,
        plotWidth: groupPlotWidth,
        y: groupY,
        height: calculatedRowHeight,
        bars,
      });
    }

    return {
      viewBoxWidth,
      viewBoxHeight,
      plotX: mainPlotX,
      plotY: margin.top,
      plotWidth: mainPlotWidth,
      plotHeight,
      minValue: 0,
      maxValue: maxVal,
      ticks: allTicks,
      categoryGroups,
      targetLineX,
      targetLines,
      columns: numColumns,
      columnLayouts,
      dividerX,
      hasCategoryTargets,
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
