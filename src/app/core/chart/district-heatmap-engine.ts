import { RegionNormalizer } from '../domain/region-normalizer';
import { IndicatorEvaluator } from '../evaluation/indicator-evaluator';
import { ChartSeriesConfig, ChartDataRow } from './chart-layout-engine';
import { DistrictMapFeature } from '../stunting-dashboard/stunting-map-data';

export interface DistrictHeatmapItem {
  district: DistrictMapFeature;
  matchedRow: ChartDataRow | null;
  rawCategory: string | null;
  displayName: string;
  value: number | null;
  formattedValue: string;
  ratio: number | null;
  ratioPercent: number | null;
  fillColor: string;
  strokeColor: string;
  textColor: string;
  rank: number | null;
  status: 'achieved' | 'unachieved' | 'missing' | 'none';
  diffFromAvg: number | null;
  diffFromTarget: number | null;
}

export interface HeatmapColorStop {
  percentage: number;
  color: string;
  label: string;
  value: number | null;
}

export interface HeatmapIndicatorStats {
  totalDistricts: number;
  matchedCount: number;
  validCount: number;
  missingCount: number;
  zeroCount: number;
  achievedCount: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  targetValue: number | null;
  highest: { name: string; value: number } | null;
  lowest: { name: string; value: number } | null;
}

export interface DistrictHeatmapResult {
  series: ChartSeriesConfig;
  items: DistrictHeatmapItem[];
  rankedItems: DistrictHeatmapItem[];
  stats: HeatmapIndicatorStats;
  colorStops: HeatmapColorStop[];
  gradientCss: string;
  targetPositionPercent: number | null;
}

export interface HeatmapColorPalette {
  id: string;
  name: string;
  startRgb: [number, number, number];
  endRgb: [number, number, number];
  startHex: string;
  endHex: string;
}

export const HEATMAP_PALETTES: HeatmapColorPalette[] = [
  {
    id: 'yellow-red',
    name: 'Kuning ke Merah (Yellow-Red)',
    startRgb: [254, 240, 138], // #fef08a
    endRgb: [185, 28, 28],     // #b91c1c
    startHex: '#fef08a',
    endHex: '#b91c1c',
  },
  {
    id: 'teal-rose',
    name: 'Teal ke Rose (Teal-Rose)',
    startRgb: [153, 246, 228], // #99f6e4
    endRgb: [190, 18, 60],     // #be123c
    startHex: '#99f6e4',
    endHex: '#be123c',
  },
  {
    id: 'sky-indigo',
    name: 'Biru Muda ke Indigo (Sky-Indigo)',
    startRgb: [186, 230, 253], // #bae6fd
    endRgb: [67, 56, 202],     // #4338ca
    startHex: '#bae6fd',
    endHex: '#4338ca',
  },
  {
    id: 'emerald-amber',
    name: 'Hijau ke Amber (Emerald-Amber)',
    startRgb: [187, 247, 208], // #bbf7d0
    endRgb: [194, 65, 12],     // #c2410c
    startHex: '#bbf7d0',
    endHex: '#c2410c',
  },
];

export interface ComputeDistrictHeatmapOptions {
  districts: DistrictMapFeature[];
  rows: ChartDataRow[];
  categoryColumn: string;
  series: ChartSeriesConfig;
  targetValue: number | null;
  /**
   * Base hue for sequential HSL gradient (e.g. 225 for indigo/blue, 160 for emerald, etc.)
   * Default is 228 (brand blue/indigo #525AFF).
   */
  baseHue?: number;
  paletteId?: string;
}

/**
 * DistrictHeatmapEngine: Engine komputasi spasial untuk visualisasi heatmap indikator kesehatan
 * per kabupaten/kota di Jawa Tengah.
 *
 * Menggabungkan polygon distrik SVG dengan baris data melalui RegionNormalizer,
 * menghitung gradien warna HSL yang adaptif, peringkat wilayah, selisih terhadap target/rata-rata,
 * dan statistik agregat.
 */
export class DistrictHeatmapEngine {
  static readonly DEFAULT_BASE_HUE = 228;
  static readonly MISSING_FILL = '#f1f5f9';
  static readonly MISSING_STROKE = '#cbd5e1';
  static readonly DEFAULT_STROKE = '#64748b';

  /**
   * Ekstraksi hue dari hex color string (misal '#525AFF' atau '#10B981')
   */
  static extractHueFromHex(hex: string): number {
    if (!hex || typeof hex !== 'string') return this.DEFAULT_BASE_HUE;
    const cleanHex = hex.replace('#', '').trim();
    if (cleanHex.length !== 6 && cleanHex.length !== 3) return this.DEFAULT_BASE_HUE;

    const r =
      parseInt(cleanHex.length === 3 ? cleanHex[0] + cleanHex[0] : cleanHex.slice(0, 2), 16) / 255;
    const g =
      parseInt(cleanHex.length === 3 ? cleanHex[1] + cleanHex[1] : cleanHex.slice(2, 4), 16) / 255;
    const b =
      parseInt(cleanHex.length === 3 ? cleanHex[2] + cleanHex[2] : cleanHex.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;

    if (max === min) {
      return this.DEFAULT_BASE_HUE;
    }

    const d = max - min;
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
    return Math.round(h * 360);
  }

  /**
   * Menghitung gradasi kontinu 2 warna berbasis interpolasi linear RGB dengan kontras teks otomatis
   */
  static interpolateRgb(
    ratio: number,
    startRgb: [number, number, number] = HEATMAP_PALETTES[0].startRgb,
    endRgb: [number, number, number] = HEATMAP_PALETTES[0].endRgb,
  ): { fill: string; text: string } {
    const clamped = Math.max(0, Math.min(1, ratio));
    const r = Math.round(startRgb[0] + clamped * (endRgb[0] - startRgb[0]));
    const g = Math.round(startRgb[1] + clamped * (endRgb[1] - startRgb[1]));
    const b = Math.round(startRgb[2] + clamped * (endRgb[2] - startRgb[2]));

    const fill = `rgb(${r}, ${g}, ${b})`;
    // Perceived luminance (YIQ formula) untuk kontras teks optimal
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    const text = yiq < 135 ? '#ffffff' : '#0f172a';

    return { fill, text };
  }

  /**
   * Menghitung warna gradasi kontinu berdasarkan rasio nilai (0.0 = min, 1.0 = max)
   * Menggunakan gradien 2 warna (bukan monokrom)
   */
  static getColorForRatio(
    ratio: number,
    startRgbOrHue?: number | [number, number, number],
    endRgb?: [number, number, number],
  ): { fill: string; text: string } {
    if (Array.isArray(startRgbOrHue) && Array.isArray(endRgb)) {
      return this.interpolateRgb(ratio, startRgbOrHue, endRgb);
    }
    return this.interpolateRgb(ratio, HEATMAP_PALETTES[0].startRgb, HEATMAP_PALETTES[0].endRgb);
  }

  /**
   * Komputasi data spasial heatmap untuk satu indikator
   */
  static computeHeatmap(options: ComputeDistrictHeatmapOptions): DistrictHeatmapResult {
    const { districts, rows, categoryColumn, series, targetValue } = options;
    const palette =
      HEATMAP_PALETTES.find((p) => p.id === options.paletteId) ?? HEATMAP_PALETTES[0];
    const hue =
      options.baseHue ??
      (series.color ? this.extractHueFromHex(series.color) : this.DEFAULT_BASE_HUE);

    // 1. Indeks baris data berdasarkan key join normalisasi
    const rowMap = new Map<string, { rawCat: string; row: ChartDataRow }>();

    for (const r of rows) {
      const rawCat = String(r[categoryColumn] ?? '').trim();
      if (!rawCat) continue;
      const normKey = RegionNormalizer.normalizeJoinKey(rawCat, true);
      if (normKey) {
        rowMap.set(normKey, { rawCat, row: r });
      }
    }

    // 2. Ekstraksi nilai untuk setiap distrik
    type ExtractedEntry = {
      district: DistrictMapFeature;
      matchedRow: ChartDataRow | null;
      rawCat: string | null;
      val: number | null;
    };

    const extracted: ExtractedEntry[] = [];
    let validCount = 0;
    let missingCount = 0;
    let zeroCount = 0;
    let achievedCount = 0;
    let sum = 0;
    let min: number | null = null;
    let max: number | null = null;
    let highest: { name: string; value: number } | null = null;
    let lowest: { name: string; value: number } | null = null;

    for (const dist of districts) {
      // Normalisasi nama distrik peta
      const distNormKey = RegionNormalizer.normalizeJoinKey(dist.kabupatenKota, true);
      const match = rowMap.get(distNormKey);

      let val: number | null = null;
      let matchedRow: ChartDataRow | null = null;
      let rawCat: string | null = null;

      if (match) {
        matchedRow = match.row;
        rawCat = match.rawCat;
        val = IndicatorEvaluator.parseSmartNumber(match.row[series.key]);
      }

      if (val !== null) {
        validCount++;
        sum += val;
        if (val === 0) zeroCount++;

        if (min === null || val < min) min = val;
        if (max === null || val > max) max = val;

        const districtLabel =
          dist.isKota && !dist.displayName.toLowerCase().startsWith('kota')
            ? `Kota ${dist.displayName}`
            : dist.displayName;

        if (highest === null || val > highest.value) {
          highest = { name: districtLabel, value: val };
        }
        if (lowest === null || val < lowest.value) {
          lowest = { name: districtLabel, value: val };
        }

        if (targetValue !== null && val >= targetValue) {
          achievedCount++;
        }
      } else {
        missingCount++;
      }

      extracted.push({
        district: dist,
        matchedRow,
        rawCat,
        val,
      });
    }

    const avg = validCount > 0 ? Math.round((sum / validCount) * 10) / 10 : null;

    // 3. Menghitung peringkat (Rank): urutan 1 = nilai tertinggi
    const validEntries = extracted.filter((e) => e.val !== null) as (ExtractedEntry & {
      val: number;
    })[];
    validEntries.sort((a, b) => b.val - a.val);

    const rankMap = new Map<string, number>();
    validEntries.forEach((entry, idx) => {
      rankMap.set(entry.district.id, idx + 1);
    });

    // 4. Hitung warna dan status per distrik
    const valueSpan = max !== null && min !== null && max !== min ? max - min : 1;

    const items: DistrictHeatmapItem[] = extracted.map((entry) => {
      const { district, matchedRow, rawCat, val } = entry;
      const displayName =
        district.isKota && !district.displayName.toLowerCase().startsWith('kota')
          ? `Kota ${district.displayName}`
          : district.displayName;

      if (val === null) {
        return {
          district,
          matchedRow,
          rawCategory: rawCat,
          displayName,
          value: null,
          formattedValue: '-',
          ratio: null,
          ratioPercent: null,
          fillColor: this.MISSING_FILL,
          strokeColor: this.MISSING_STROKE,
          textColor: '#94a3b8',
          rank: null,
          status: 'missing',
          diffFromAvg: null,
          diffFromTarget: null,
        };
      }

      const rawRatio = (val - (min ?? 0)) / valueSpan;
      const clampedRatio = Math.max(0, Math.min(1, rawRatio));
      const ratioPercent = Math.round(clampedRatio * 100);
      const { fill, text } = this.getColorForRatio(clampedRatio, palette.startRgb, palette.endRgb);

      let status: 'achieved' | 'unachieved' | 'none' = 'none';
      let diffFromTarget: number | null = null;
      if (targetValue !== null) {
        diffFromTarget = Math.round((val - targetValue) * 10) / 10;
        status = val >= targetValue ? 'achieved' : 'unachieved';
      }

      const diffFromAvg = avg !== null ? Math.round((val - avg) * 10) / 10 : null;
      const rank = rankMap.get(district.id) ?? null;

      // Format display value: jika bulat tampilkan tanpa desimal, jika desimal 1 angka di belakang koma
      const formattedValue = Number.isInteger(val) ? String(val) : val.toFixed(1);

      return {
        district,
        matchedRow,
        rawCategory: rawCat,
        displayName,
        value: val,
        formattedValue,
        ratio: clampedRatio,
        ratioPercent,
        fillColor: fill,
        strokeColor: this.DEFAULT_STROKE,
        textColor: text,
        rank,
        status,
        diffFromAvg,
        diffFromTarget,
      };
    });

    // 5. Generate Legend Color Stops & Continuous Gradient CSS
    const colorStops: HeatmapColorStop[] = [];
    if (min !== null && max !== null) {
      const stopsCount = 5;
      for (let i = 0; i < stopsCount; i++) {
        const ratio = i / (stopsCount - 1);
        const { fill } = this.getColorForRatio(ratio, palette.startRgb, palette.endRgb);
        const stopVal = Math.round((min + ratio * valueSpan) * 10) / 10;
        const percentage = Math.round(ratio * 100);

        let label = `${stopVal}`;
        if (i === 0) label = `Min (${stopVal})`;
        else if (i === stopsCount - 1) label = `Maks (${stopVal})`;

        colorStops.push({
          percentage,
          color: fill,
          label,
          value: stopVal,
        });
      }
    }

    // CSS Linear Gradient kontinu 2 warna untuk bilah warna pada peta
    const gradientCss = `linear-gradient(to right, rgb(${palette.startRgb.join(',')}), rgb(${palette.endRgb.join(',')}))`;

    let targetPositionPercent: number | null = null;
    if (targetValue !== null && min !== null && max !== null && max !== min) {
      const tRatio = (targetValue - min) / valueSpan;
      targetPositionPercent = Math.max(0, Math.min(100, Math.round(tRatio * 100)));
    }

    const rankedItems = items
      .filter((i) => i.rank !== null)
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

    return {
      series,
      items,
      rankedItems,
      stats: {
        totalDistricts: districts.length,
        matchedCount: extracted.filter((e) => e.matchedRow !== null).length,
        validCount,
        missingCount,
        zeroCount,
        achievedCount,
        min,
        max,
        avg,
        targetValue,
        highest,
        lowest,
      },
      colorStops,
      gradientCss,
      targetPositionPercent,
    };
  }
}
