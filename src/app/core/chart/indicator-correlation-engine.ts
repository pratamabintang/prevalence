import { IndicatorEvaluator } from '../evaluation/indicator-evaluator';

export type CorrelationStrength =
  | 'very_strong_positive'
  | 'strong_positive'
  | 'moderate_positive'
  | 'weak'
  | 'moderate_negative'
  | 'strong_negative'
  | 'very_strong_negative';

export interface CorrelationCell {
  key1: string;
  label1: string;
  key2: string;
  label2: string;
  r: number;
  r2: number;
  sampleCount: number;
  strength: CorrelationStrength;
  label: string;
  color: string;
  textColor: string;
}

export interface CorrelationMatrixResult {
  series: { key: string; label: string; color?: string }[];
  matrix: CorrelationCell[][];
  topPositive: CorrelationCell[];
  topNegative: CorrelationCell[];
}

export interface ScatterPoint {
  category: string;
  x: number;
  y: number;
  normX: number; // 0 to 1
  normY: number; // 0 to 1
}

export interface ScatterRegressionResult {
  seriesX: { key: string; label: string; color?: string };
  seriesY: { key: string; label: string; color?: string };
  points: ScatterPoint[];
  slope: number;
  intercept: number;
  r: number;
  r2: number;
  formula: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  meanX: number;
  meanY: number;
  strengthLabel: string;
}

export class IndicatorCorrelationEngine {
  /**
   * Menghitung koefisien korelasi Pearson r dan r-squared
   */
  static calculatePearson(
    x: number[],
    y: number[],
  ): { r: number; r2: number; count: number } {
    if (x.length !== y.length || x.length < 2) {
      return { r: 0, r2: 0, count: Math.min(x.length, y.length) };
    }

    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let num = 0;
    let denX = 0;
    let denY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }

    if (denX === 0 || denY === 0) {
      return { r: 0, r2: 0, count: n };
    }

    const r = Math.round((num / Math.sqrt(denX * denY)) * 1000) / 1000;
    const r2 = Math.round(r * r * 1000) / 1000;

    return { r, r2, count: n };
  }

  /**
   * Format sel korelasi dengan warna diverging dan deskripsi kekuatan
   */
  static formatCorrelationCell(
    key1: string,
    label1: string,
    key2: string,
    label2: string,
    r: number,
    sampleCount: number,
  ): CorrelationCell {
    const r2 = Math.round(r * r * 1000) / 1000;
    let strength: CorrelationStrength = 'weak';
    let label = 'Lemah / Tidak Signifikan';
    let color = '#f8fafc';
    let textColor = '#334155';

    if (r >= 0.8) {
      strength = 'very_strong_positive';
      label = 'Sangat Kuat Positif (Sinergis Tinggi)';
      color = '#15803d'; // emerald-700
      textColor = '#ffffff';
    } else if (r >= 0.5) {
      strength = 'strong_positive';
      label = 'Kuat Positif (Saling Mendukung)';
      color = '#22c55e'; // emerald-500
      textColor = '#ffffff';
    } else if (r >= 0.3) {
      strength = 'moderate_positive';
      label = 'Sedang Positif';
      color = '#bbf7d0'; // emerald-200
      textColor = '#14532d';
    } else if (r <= -0.8) {
      strength = 'very_strong_negative';
      label = 'Sangat Kuat Negatif (Berlawanan Arah)';
      color = '#991b1b'; // red-800
      textColor = '#ffffff';
    } else if (r <= -0.5) {
      strength = 'strong_negative';
      label = 'Kuat Negatif (Efek Substitusi / Menurunkan Masalah)';
      color = '#ef4444'; // red-500
      textColor = '#ffffff';
    } else if (r <= -0.3) {
      strength = 'moderate_negative';
      label = 'Sedang Negatif';
      color = '#fecaca'; // red-200
      textColor = '#7f1d1d';
    } else {
      strength = 'weak';
      label = 'Lemah (Tidak Ada Hubungan Linear)';
      color = '#f1f5f9'; // slate-100
      textColor = '#64748b';
    }

    return {
      key1,
      label1,
      key2,
      label2,
      r,
      r2,
      sampleCount,
      strength,
      label,
      color,
      textColor,
    };
  }

  /**
   * Menghitung seluruh matriks korelasi berpasangan untuk seluruh indikator
   */
  static calculateCorrelationMatrix(
    rows: Record<string, unknown>[],
    seriesList: { key: string; label: string; color?: string }[],
  ): CorrelationMatrixResult {
    // Ekstrak array angka per key indikator
    const seriesValues = new Map<string, number[]>();
    for (const s of seriesList) {
      const vals: number[] = [];
      for (const r of rows) {
        const val = IndicatorEvaluator.parseSmartNumber(r[s.key]);
        vals.push(val ?? 0);
      }
      seriesValues.set(s.key, vals);
    }

    const n = seriesList.length;
    const matrix: CorrelationCell[][] = [];
    const pairList: CorrelationCell[] = [];

    for (let i = 0; i < n; i++) {
      const s1 = seriesList[i];
      const vals1 = seriesValues.get(s1.key) ?? [];
      const rowCells: CorrelationCell[] = [];

      for (let j = 0; j < n; j++) {
        const s2 = seriesList[j];
        if (i === j) {
          // Self correlation
          rowCells.push(this.formatCorrelationCell(s1.key, s1.label, s2.key, s2.label, 1.0, rows.length));
        } else {
          const vals2 = seriesValues.get(s2.key) ?? [];
          const { r } = this.calculatePearson(vals1, vals2);
          const cell = this.formatCorrelationCell(s1.key, s1.label, s2.key, s2.label, r, rows.length);
          rowCells.push(cell);

          // Masukkan ke pairList hanya sekali (i < j) untuk ranking
          if (i < j) {
            pairList.push(cell);
          }
        }
      }
      matrix.push(rowCells);
    }

    // Urutkan pasangan korelasi positif & negatif tertinggi
    const topPositive = [...pairList]
      .filter((p) => p.r > 0.2)
      .sort((a, b) => b.r - a.r)
      .slice(0, 10);

    const topNegative = [...pairList]
      .filter((p) => p.r < -0.2)
      .sort((a, b) => a.r - b.r)
      .slice(0, 10);

    return {
      series: seriesList,
      matrix,
      topPositive,
      topNegative,
    };
  }

  /**
   * Menghitung regresi linear OLS (Ordinary Least Squares) untuk Scatter Plot 2 indikator
   */
  static calculateScatterRegression(
    rows: Record<string, unknown>[],
    categoryColumn: string,
    seriesX: { key: string; label: string; color?: string },
    seriesY: { key: string; label: string; color?: string },
  ): ScatterRegressionResult {
    type RawPair = { category: string; x: number; y: number };
    const validPairs: RawPair[] = [];

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let sumX = 0;
    let sumY = 0;

    for (const r of rows) {
      const cat = String(r[categoryColumn] || '').trim();
      const xVal = IndicatorEvaluator.parseSmartNumber(r[seriesX.key]);
      const yVal = IndicatorEvaluator.parseSmartNumber(r[seriesY.key]);

      if (xVal !== null && yVal !== null) {
        validPairs.push({ category: cat, x: xVal, y: yVal });
        if (xVal < minX) minX = xVal;
        if (xVal > maxX) maxX = xVal;
        if (yVal < minY) minY = yVal;
        if (yVal > maxY) maxY = yVal;
        sumX += xVal;
        sumY += yVal;
      }
    }

    const n = validPairs.length;
    if (n < 2) {
      return {
        seriesX,
        seriesY,
        points: [],
        slope: 0,
        intercept: 0,
        r: 0,
        r2: 0,
        formula: 'y = 0',
        minX: 0,
        maxX: 100,
        minY: 0,
        maxY: 100,
        meanX: 0,
        meanY: 0,
        strengthLabel: 'Data Tidak Mencukupi',
      };
    }

    const meanX = sumX / n;
    const meanY = sumY / n;

    // Hitung slope (m) dan intercept (c)
    let num = 0;
    let denX = 0;
    let denY = 0;
    for (const p of validPairs) {
      const dx = p.x - meanX;
      const dy = p.y - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }

    const slope = denX !== 0 ? Math.round((num / denX) * 1000) / 1000 : 0;
    const intercept = Math.round((meanY - slope * meanX) * 100) / 100;
    const r = denX && denY ? Math.round((num / Math.sqrt(denX * denY)) * 1000) / 1000 : 0;
    const r2 = Math.round(r * r * 1000) / 1000;

    const spanX = maxX > minX ? maxX - minX : 1;
    const spanY = maxY > minY ? maxY - minY : 1;

    const points: ScatterPoint[] = validPairs.map((p) => ({
      category: p.category,
      x: p.x,
      y: p.y,
      normX: Math.max(0, Math.min(1, (p.x - minX) / spanX)),
      normY: Math.max(0, Math.min(1, (p.y - minY) / spanY)),
    }));

    const sign = intercept >= 0 ? '+' : '-';
    const formula = `y = ${slope}x ${sign} ${Math.abs(intercept)}`;

    const cell = this.formatCorrelationCell(seriesX.key, seriesX.label, seriesY.key, seriesY.label, r, n);

    return {
      seriesX,
      seriesY,
      points,
      slope,
      intercept,
      r,
      r2,
      formula,
      minX: Math.round(minX * 10) / 10,
      maxX: Math.round(maxX * 10) / 10,
      minY: Math.round(minY * 10) / 10,
      maxY: Math.round(maxY * 10) / 10,
      meanX: Math.round(meanX * 10) / 10,
      meanY: Math.round(meanY * 10) / 10,
      strengthLabel: cell.label,
    };
  }
}
