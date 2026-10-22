import { IndicatorEvaluator } from '../evaluation/indicator-evaluator';

export type QuadrantThresholdMode = 'median' | 'mean' | 'mode' | 'custom';

export interface QuadrantDistrictItem {
  category: string;
  xVal: number;
  yVal: number;
  normX: number; // 0 to 1 for SVG plotting
  normY: number; // 0 to 1 for SVG plotting
  quadrant: 1 | 2 | 3 | 4;
  quadrantTitle: string;
  quadrantBadgeClass: string;
  color: string;
  interpretation: string;
}

export interface QuadrantSummary {
  id: 1 | 2 | 3 | 4;
  title: string;
  subtitle: string;
  color: string;
  badgeClass: string;
  count: number;
  percentage: number;
  districts: string[];
}

export interface PriorityQuadrantResult {
  metricXKey: string;
  metricXLabel: string;
  metricYKey: string;
  metricYLabel: string;
  thresholdX: number;
  thresholdY: number;
  thresholdMode: QuadrantThresholdMode;
  districts: QuadrantDistrictItem[];
  quadrantSummaries: {
    q1: QuadrantSummary;
    q2: QuadrantSummary;
    q3: QuadrantSummary;
    q4: QuadrantSummary;
  };
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  meanX: number;
  meanY: number;
  medianX: number;
  medianY: number;
  modeX: number;
  modeY: number;
}

export interface ClassifyQuadrantsOptions {
  rows: Record<string, unknown>[];
  categoryColumn: string;
  seriesList: { key: string; label: string; color?: string }[];
  metricX?: string; // key or 'composite_hulu'
  metricY?: string; // key or 'composite_hilir'
  thresholdMode?: QuadrantThresholdMode;
  customThresholdX?: number;
  customThresholdY?: number;
}

export class PriorityQuadrantEngine {
  // Kata kunci untuk filter otomatis indikator hulu vs hilir
  private static readonly HULU_KEYWORDS = ['rematri', 'anemia', 'bumil', 'anc', 'ttd', 'skrining'];
  private static readonly HILIR_KEYWORDS = [
    'balita',
    'd/s',
    'tumbang',
    'asi',
    'mpasi',
    'gizi',
    'kurang',
    'tidak naik',
    'gibur',
    'idl',
    'baduta',
  ];

  /**
   * Filter daftar indikator hulu (Pencegahan Remaja Putri & Ibu Hamil)
   */
  static getHuluSeries(
    seriesList: { key: string; label: string; color?: string }[],
  ): { key: string; label: string; color?: string }[] {
    return seriesList.filter((s) => {
      const lower = (s.label + ' ' + s.key).toLowerCase();
      return this.HULU_KEYWORDS.some((kw) => lower.includes(kw));
    });
  }

  /**
   * Filter daftar indikator hilir (Penanganan Balita, Gizi & Imunisasi)
   */
  static getHilirSeries(
    seriesList: { key: string; label: string; color?: string }[],
  ): { key: string; label: string; color?: string }[] {
    return seriesList.filter((s) => {
      const lower = (s.label + ' ' + s.key).toLowerCase();
      // Pastikan bukan bagian dari hulu (misal TTD Bumil tidak masuk ke hilir)
      const isHulu = this.HULU_KEYWORDS.some((kw) => lower.includes(kw));
      const isHilir = this.HILIR_KEYWORDS.some((kw) => lower.includes(kw));
      return isHilir && !isHulu;
    });
  }

  /**
   * Menghitung nilai komposit skor Hulu dan Hilir untuk seluruh daerah
   */
  static computeCompositeScores(
    rows: Record<string, unknown>[],
    categoryColumn: string,
    seriesList: { key: string; label: string; color?: string }[],
  ): { category: string; huluScore: number; hilirScore: number }[] {
    const huluSeries = this.getHuluSeries(seriesList);
    const hilirSeries = this.getHilirSeries(seriesList);

    return rows.map((r) => {
      const category = String(r[categoryColumn] || '').trim();

      // Hulu
      let huluSum = 0;
      let huluCount = 0;
      for (const s of huluSeries) {
        const val = IndicatorEvaluator.parseSmartNumber(r[s.key]);
        if (val !== null) {
          huluSum += val;
          huluCount++;
        }
      }
      const huluScore = huluCount > 0 ? Math.round((huluSum / huluCount) * 100) / 100 : 0;

      // Hilir
      let hilirSum = 0;
      let hilirCount = 0;
      for (const s of hilirSeries) {
        const val = IndicatorEvaluator.parseSmartNumber(r[s.key]);
        if (val !== null) {
          hilirSum += val;
          hilirCount++;
        }
      }
      const hilirScore = hilirCount > 0 ? Math.round((hilirSum / hilirCount) * 100) / 100 : 0;

      return { category, huluScore, hilirScore };
    });
  }

  /**
   * Menghitung nilai median dari array angka
   */
  static calculateMedian(values: number[]): number {
    if (values.length === 0) return 50;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
    }
    return Math.round(sorted[mid] * 100) / 100;
  }

  /**
   * Menghitung nilai modus dari array angka.
   * Dihitung berdasarkan frekuensi kemunculan nilai (dibulatkan ke 1 desimal).
   * Jika semua nilai unik, dicari frekuensi berbasis integer terdekat atau rata-rata modus.
   */
  static calculateMode(values: number[]): number {
    if (values.length === 0) return 50;
    if (values.length === 1) return Math.round(values[0] * 10) / 10;

    // 1. Frekuensi berbasis 1 angka di belakang koma
    const freq1 = new Map<number, number>();
    for (const v of values) {
      const rounded = Math.round(v * 10) / 10;
      freq1.set(rounded, (freq1.get(rounded) ?? 0) + 1);
    }

    let maxCount = 0;
    let modeVal = values[0];
    for (const [val, count] of freq1.entries()) {
      if (count > maxCount) {
        maxCount = count;
        modeVal = val;
      }
    }

    if (maxCount > 1) {
      return Math.round(modeVal * 10) / 10;
    }

    // 2. Jika seluruh nilai 1 desimal unik, kelompokkan berbasis bilangan bulat terdekat
    const freqInt = new Map<number, number>();
    for (const v of values) {
      const roundedInt = Math.round(v);
      freqInt.set(roundedInt, (freqInt.get(roundedInt) ?? 0) + 1);
    }

    let maxIntCount = 0;
    let modeIntVal = Math.round(values[0]);
    for (const [val, count] of freqInt.entries()) {
      if (count > maxIntCount) {
        maxIntCount = count;
        modeIntVal = val;
      }
    }

    if (maxIntCount > 1) {
      const matched = values.filter((v) => Math.round(v) === modeIntVal);
      const avg = matched.reduce((a, b) => a + b, 0) / matched.length;
      return Math.round(avg * 10) / 10;
    }

    // 3. Fallback jika semua unik: gunakan median
    return this.calculateMedian(values);
  }

  /**
   * Klasifikasi 4-Kuadran Kebijakan Dinkes untuk seluruh daerah
   */
  static classifyQuadrants(options: ClassifyQuadrantsOptions): PriorityQuadrantResult {
    const {
      rows,
      categoryColumn,
      seriesList,
      metricX = 'composite_hulu',
      metricY = 'composite_hilir',
      thresholdMode = 'median',
      customThresholdX,
      customThresholdY,
    } = options;

    const composites = this.computeCompositeScores(rows, categoryColumn, seriesList);

    // Ambil label sumbu X
    let metricXLabel = 'Intervensi Hulu (Remaja & Bumil)';
    if (metricX !== 'composite_hulu') {
      const sX = seriesList.find((s) => s.key === metricX);
      if (sX) metricXLabel = sX.label;
    }

    // Ambil label sumbu Y
    let metricYLabel = 'Intervensi Hilir (Balita & Gizi)';
    if (metricY !== 'composite_hilir') {
      const sY = seriesList.find((s) => s.key === metricY);
      if (sY) metricYLabel = sY.label;
    }

    // Ekstrak nilai X dan Y per baris
    type PointExtract = { category: string; x: number; y: number };
    const points: PointExtract[] = [];
    const allX: number[] = [];
    const allY: number[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const cat = String(r[categoryColumn] || '').trim();
      let xVal = 0;
      let yVal = 0;

      if (metricX === 'composite_hulu') {
        xVal = composites[i]?.huluScore ?? 0;
      } else {
        xVal = IndicatorEvaluator.parseSmartNumber(r[metricX]) ?? 0;
      }

      if (metricY === 'composite_hilir') {
        yVal = composites[i]?.hilirScore ?? 0;
      } else {
        yVal = IndicatorEvaluator.parseSmartNumber(r[metricY]) ?? 0;
      }

      points.push({ category: cat, x: xVal, y: yVal });
      allX.push(xVal);
      allY.push(yVal);
    }

    const n = points.length || 1;
    const minX = Math.min(...allX, 0);
    const maxX = Math.max(...allX, 100);
    const minY = Math.min(...allY, 0);
    const maxY = Math.max(...allY, 100);

    const meanX = Math.round((allX.reduce((a, b) => a + b, 0) / n) * 10) / 10;
    const meanY = Math.round((allY.reduce((a, b) => a + b, 0) / n) * 10) / 10;
    const medianX = this.calculateMedian(allX);
    const medianY = this.calculateMedian(allY);
    const modeX = this.calculateMode(allX);
    const modeY = this.calculateMode(allY);

    // Tentukan threshold berdasarkan mode
    let thresholdX = medianX;
    let thresholdY = medianY;

    if (thresholdMode === 'mean') {
      thresholdX = meanX;
      thresholdY = meanY;
    } else if (thresholdMode === 'mode') {
      thresholdX = modeX;
      thresholdY = modeY;
    } else if (thresholdMode === 'custom') {
      thresholdX = customThresholdX ?? 50;
      thresholdY = customThresholdY ?? 50;
    } else {
      // default 'median'
      thresholdX = medianX;
      thresholdY = medianY;
    }

    const spanX = maxX > minX ? maxX - minX : 1;
    const spanY = maxY > minY ? maxY - minY : 1;

    // Klasifikasikan masing-masing daerah
    const districts: QuadrantDistrictItem[] = points.map((p) => {
      const normX = Math.max(0, Math.min(1, (p.x - minX) / spanX));
      const normY = Math.max(0, Math.min(1, (p.y - minY) / spanY));

      let quadrant: 1 | 2 | 3 | 4 = 1;
      let quadrantTitle = 'Kuadran I: Mandiri & Kinerja Prima';
      let quadrantBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      let color = '#10B981'; // emerald-500
      let interpretation = 'Capaian Hulu dan Hilir tinggi. Wilayah rujukan percontohan.';

      const isXHigh = p.x >= thresholdX;
      const isYHigh = p.y >= thresholdY;

      if (isXHigh && isYHigh) {
        quadrant = 1;
        quadrantTitle = 'Kuadran I: Mandiri & Kinerja Prima';
        quadrantBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
        color = '#10B981';
        interpretation = 'Capaian Hulu dan Hilir tinggi. Wilayah rujukan percontohan.';
      } else if (!isXHigh && isYHigh) {
        quadrant = 2;
        quadrantTitle = 'Kuadran II: Tantangan Pencegahan Hulu';
        quadrantBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
        color = '#F59E0B';
        interpretation = 'Balita tertangani baik, namun pencegahan remaja/bumil rendah (risiko stunting baru).';
      } else if (isXHigh && !isYHigh) {
        quadrant = 3;
        quadrantTitle = 'Kuadran III: Tantangan Pelayanan Hilir';
        quadrantBadgeClass = 'bg-indigo-50 text-indigo-800 border-indigo-200';
        color = '#6366F1';
        interpretation = 'Intervensi hulu baik, namun posyandu/balita tertinggal (bottleneck faskes balita).';
      } else {
        quadrant = 4;
        quadrantTitle = 'Kuadran IV: Prioritas Intervensi Darurat';
        quadrantBadgeClass = 'bg-rose-50 text-rose-800 border-rose-200';
        color = '#EF4444';
        interpretation = 'Hulu dan Hilir sama-sama di bawah rata-rata. Perlu alokasi anggaran dan pendampingan khusus.';
      }

      return {
        category: p.category,
        xVal: p.x,
        yVal: p.y,
        normX,
        normY,
        quadrant,
        quadrantTitle,
        quadrantBadgeClass,
        color,
        interpretation,
      };
    });

    // Ringkasan per kuadran
    const q1Districts = districts.filter((d) => d.quadrant === 1).map((d) => d.category);
    const q2Districts = districts.filter((d) => d.quadrant === 2).map((d) => d.category);
    const q3Districts = districts.filter((d) => d.quadrant === 3).map((d) => d.category);
    const q4Districts = districts.filter((d) => d.quadrant === 4).map((d) => d.category);

    return {
      metricXKey: metricX,
      metricXLabel,
      metricYKey: metricY,
      metricYLabel,
      thresholdX: Math.round(thresholdX * 10) / 10,
      thresholdY: Math.round(thresholdY * 10) / 10,
      thresholdMode,
      districts,
      quadrantSummaries: {
        q1: {
          id: 1,
          title: 'Kuadran I: Mandiri & Kinerja Prima',
          subtitle: 'Hulu Tinggi, Hilir Tinggi',
          color: '#10B981',
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          count: q1Districts.length,
          percentage: Math.round((q1Districts.length / n) * 100),
          districts: q1Districts,
        },
        q2: {
          id: 2,
          title: 'Kuadran II: Tantangan Pencegahan Hulu',
          subtitle: 'Hulu Rendah, Hilir Tinggi',
          color: '#F59E0B',
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
          count: q2Districts.length,
          percentage: Math.round((q2Districts.length / n) * 100),
          districts: q2Districts,
        },
        q3: {
          id: 3,
          title: 'Kuadran III: Tantangan Pelayanan Hilir',
          subtitle: 'Hulu Tinggi, Hilir Rendah',
          color: '#6366F1',
          badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          count: q3Districts.length,
          percentage: Math.round((q3Districts.length / n) * 100),
          districts: q3Districts,
        },
        q4: {
          id: 4,
          title: 'Kuadran IV: Prioritas Intervensi Darurat',
          subtitle: 'Hulu Rendah, Hilir Rendah',
          color: '#EF4444',
          badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
          count: q4Districts.length,
          percentage: Math.round((q4Districts.length / n) * 100),
          districts: q4Districts,
        },
      },
      minX: Math.round(minX * 10) / 10,
      maxX: Math.round(maxX * 10) / 10,
      minY: Math.round(minY * 10) / 10,
      maxY: Math.round(maxY * 10) / 10,
      meanX,
      meanY,
      medianX,
      medianY,
      modeX,
      modeY,
    };
  }
}
