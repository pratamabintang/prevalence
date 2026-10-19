export type TargetOperator = '<=' | '>=' | '>' | '<' | '==';
export type ColumnDataType = 'auto' | 'number' | 'percentage' | 'string';

export interface ColumnTargetConfig {
  enabled: boolean;
  operator: TargetOperator;
  value: number | null;
}

export interface ColumnConfig {
  dataType: ColumnDataType;
  anomalyEnabled: boolean;
  minAnomaly: number | null;
  maxAnomaly: number | null;
}

export interface CapaianSummary {
  min: number | null;
  max: number | null;
}

/**
 * IndicatorEvaluator: Modul evaluasi indikator kesehatan, parsing angka numerik cerdas,
 * penghitungan target, skor capaian, dan agregasi statistik.
 */
export class IndicatorEvaluator {
  /**
   * Smart Number Parsing: Menangani desimal koma Indonesia ("15,0" -> 15),
   * desimal titik ("15.0" -> 15), persentase ("15%"), ribuan ("1.500" / "1,500,000").
   */
  static parseSmartNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }

    let str = String(value).trim();
    if (str === '' || str === '-') {
      return null;
    }

    // Buang simbol persen
    str = str.replace(/%/g, '').trim();

    // 1. Terdapat titik DAN koma
    if (str.includes('.') && str.includes(',')) {
      if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
        // Format Indonesia/Eropa: "1.234,56" -> titik ribuan, koma desimal
        str = str.replace(/\./g, '').replace(',', '.');
      } else {
        // Format US: "1,234.56" -> koma ribuan, titik desimal
        str = str.replace(/,/g, '');
      }
    } else if (str.includes(',')) {
      // 2. Hanya terdapat koma
      const commaCount = (str.match(/,/g) || []).length;
      if (commaCount === 1) {
        // Desimal Indonesia: "15,0" -> "15.0"
        str = str.replace(',', '.');
      } else {
        // Ribuan banyak koma: "1,000,000"
        str = str.replace(/,/g, '');
      }
    } else if (str.includes('.')) {
      // 3. Hanya terdapat titik
      const dotCount = (str.match(/\./g) || []).length;
      if (dotCount > 1) {
        // Ribuan Indonesia: "1.500.000"
        str = str.replace(/\./g, '');
      }
    }

    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  /**
   * Evaluasi apakah nilai data memenuhi target yang ditentukan.
   */
  static isTargetAchieved(rowValue: unknown, target: ColumnTargetConfig): boolean {
    if (!target.enabled || target.value === null) {
      return false;
    }

    const num = this.parseSmartNumber(rowValue);
    if (num === null) {
      return false;
    }

    switch (target.operator) {
      case '<=':
        return num <= target.value;
      case '>=':
        return num >= target.value;
      case '>':
        return num > target.value;
      case '<':
        return num < target.value;
      case '==':
        return num === target.value;
      default:
        return false;
    }
  }

  /**
   * Menghitung jumlah target yang tercapai pada suatu baris data.
   */
  static calculateRowCapaian(
    row: Record<string, unknown>,
    columns: string[],
    targets: Record<string, ColumnTargetConfig>,
    configs: Record<string, ColumnConfig>,
  ): number {
    let achieved = 0;

    for (const col of columns) {
      if (configs[col]?.dataType === 'string') {
        continue;
      }
      const target = targets[col];
      if (target && target.enabled && target.value !== null) {
        if (this.isTargetAchieved(row[col], target)) {
          achieved++;
        }
      }
    }

    return achieved;
  }

  /**
   * Menghitung nilai capaian minimum dan maksimum di seluruh baris data.
   */
  static calculateCapaianStats(
    rows: Record<string, unknown>[],
    columns: string[],
    targets: Record<string, ColumnTargetConfig>,
    configs: Record<string, ColumnConfig>,
    enableTarget: boolean,
    enableCapaian: boolean,
  ): CapaianSummary {
    if (!enableTarget || !enableCapaian || rows.length === 0) {
      return { min: null, max: null };
    }

    const values = rows.map((r) =>
      this.calculateRowCapaian(r, columns, targets, configs),
    );
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { min, max };
  }

  /**
   * Menghitung total (sum) dari suatu kolom numerik.
   */
  static calculateColumnSum(
    rows: Record<string, unknown>[],
    colKey: string,
  ): number | null {
    let sum = 0;
    let hasAnyNumber = false;

    for (const row of rows) {
      const num = this.parseSmartNumber(row[colKey]);
      if (num !== null) {
        sum += num;
        hasAnyNumber = true;
      }
    }

    return hasAnyNumber ? sum : null;
  }

  /**
   * Memformat angka hasil penjumlahan ke format lokal Indonesia.
   */
  static formatSumValue(sum: number | null): string {
    if (sum === null) {
      return '-';
    }
    if (Number.isInteger(sum)) {
      return sum.toLocaleString('id-ID');
    }
    return Number(sum.toFixed(2)).toLocaleString('id-ID');
  }

  /**
   * Menghitung nilai rata-rata (average) dari suatu kolom numerik.
   */
  static calculateColumnAverage(
    rows: Record<string, unknown>[],
    colKey: string,
  ): number | null {
    let sum = 0;
    let count = 0;

    for (const row of rows) {
      const num = this.parseSmartNumber(row[colKey]);
      if (num !== null) {
        sum += num;
        count++;
      }
    }

    return count > 0 ? sum / count : null;
  }

  /**
   * Memformat angka hasil rata-rata ke format lokal Indonesia (2 desimal jika bukan integer).
   */
  static formatAverageValue(avg: number | null): string {
    if (avg === null) {
      return '-';
    }
    if (Number.isInteger(avg)) {
      return avg.toLocaleString('id-ID');
    }
    return Number(avg.toFixed(2)).toLocaleString('id-ID');
  }

  /**
   * Memformat nilai sel sesuai tipe data kolom (angka / persen / string).
   */
  static formatCellValue(val: unknown, config?: ColumnConfig): string {
    if (val === null || val === undefined || String(val).trim() === '') {
      return '-';
    }

    if (config?.dataType === 'percentage') {
      const num = this.parseSmartNumber(val);
      if (num !== null) {
        return `${num}%`;
      }
    }

    if (config?.dataType === 'number') {
      const num = this.parseSmartNumber(val);
      if (num !== null) {
        return String(num);
      }
    }

    return String(val);
  }

  /**
   * Menentukan CSS class formatting (anomali merah, target hijau/kuning).
   */
  static getCellFormatClass(
    val: unknown,
    config?: ColumnConfig,
    target?: ColumnTargetConfig,
    enableTarget = false,
  ): string {
    if (config?.dataType === 'string') {
      return '';
    }

    const num = this.parseSmartNumber(val);
    if (num === null) {
      return '';
    }

    // 1. Batas anomali merah
    if (config?.anomalyEnabled) {
      const min = config.minAnomaly ?? 0;
      const max = config.maxAnomaly ?? 100;
      if (num < min || num > max) {
        return 'bg-red-100 text-red-900 font-semibold border-red-300';
      }
    }

    // 2. Evaluasi target jika aktif
    if (enableTarget && target && target.enabled && target.value !== null) {
      if (this.isTargetAchieved(val, target)) {
        return 'bg-emerald-100 text-emerald-900 font-semibold border-emerald-300';
      } else {
        return 'bg-amber-100 text-amber-900 font-semibold border-amber-300';
      }
    }

    return '';
  }

  /**
   * Menentukan CSS class formatting capaian (biru nilai tertinggi, merah nilai terendah).
   */
  static getCapaianFormatClass(capaianValue: number, stats: CapaianSummary): string {
    if (stats.min === null || stats.max === null || stats.min === stats.max) {
      return '';
    }

    if (capaianValue === stats.max) {
      return 'bg-blue-100 text-blue-900 font-semibold border-blue-300';
    }
    if (capaianValue === stats.min) {
      return 'bg-red-100 text-red-900 font-semibold border-red-300';
    }

    return '';
  }
}
