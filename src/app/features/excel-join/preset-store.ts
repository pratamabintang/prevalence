import {
  ColumnConfig,
  ColumnTargetConfig,
} from '../../core/evaluation/indicator-evaluator';
import { ColumnInfo } from '../../shared/excel';

export interface SheetConfigPreset {
  sheetName: string;
  headerStartRow?: number;
  headerEndRow?: number;
  dataStartRow?: number;
  joinColumn?: string;
  variables: string[];
}

export interface JoinConfigurationPreset {
  version: '1.0';
  name?: string;
  savedAt: string;
  outputHeaderFormat?: 'full' | 'concat';
  includeSheetPrefix?: boolean;
  joinBy: string;
  stripKabupaten?: boolean;
  sheets: SheetConfigPreset[];
  enableTarget?: boolean;
  enableCapaian?: boolean;
  enableJumlah?: boolean;
  enableAverage?: boolean;
  columnTargets?: Record<string, ColumnTargetConfig>;
  columnConfigs?: Record<string, ColumnConfig>;
  sumColumns?: Record<string, boolean>;
  avgColumns?: Record<string, boolean>;
  customColumnNames?: Record<string, string>;
  columnOrder?: string[];
}

export interface PresetReconcileSummary {
  matchedSheetCount: number;
  matchedVarCount: number;
  totalPresetVarCount: number;
  unmatchedSheets: string[];
  unmatchedVariables: { sheet: string; var: string }[];
  matchedJoinBy?: string;
}

/**
 * PresetStore: Modul untuk persistensi konfigurasi join (localStorage & unduh file .json)
 * serta algoritma pencocokan fuzzy (resilient matching) terhadap variasi template Excel.
 */
export class PresetStore {
  private static readonly STORAGE_KEY = 'dinkes_excel_join_config_last';

  /**
   * Memeriksa apakah terdapat konfigurasi tersimpan di browser.
   */
  static hasSavedPreset(): boolean {
    return typeof window !== 'undefined' && !!localStorage.getItem(this.STORAGE_KEY);
  }

  /**
   * Membaca preset terakhir dari localStorage browser.
   */
  static loadLastPreset(): JoinConfigurationPreset | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as JoinConfigurationPreset;
    } catch {
      return null;
    }
  }

  /**
   * Menyimpan preset ke localStorage dan mengunduhnya sebagai file .json.
   */
  static savePreset(preset: JoinConfigurationPreset, triggerDownload = true): void {
    const jsonString = JSON.stringify(preset, null, 2);

    try {
      localStorage.setItem(this.STORAGE_KEY, jsonString);
    } catch (e) {
      console.warn('Gagal menyimpan ke localStorage:', e);
    }

    if (triggerDownload && typeof document !== 'undefined') {
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `konfigurasi_join_excel_${timestamp}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Parse teks JSON menjadi JoinConfigurationPreset.
   */
  static parsePresetJson(text: string): JoinConfigurationPreset {
    const parsed = JSON.parse(text) as JoinConfigurationPreset;
    if (!parsed || !Array.isArray(parsed.sheets)) {
      throw new Error('Format konfigurasi tidak valid.');
    }
    return parsed;
  }

  /**
   * Melakukan pemetaan 1-ke-1 antara sheet pada workbook dan daftar preset sheets.
   * Menggunakan pendekatan multi-pass berprioritas:
   * Pass 1: Pencocokan nama persis (case-insensitive & trimmed)
   * Pass 2: Pencocokan nama normalisasi (mengabaikan spasi berlebih / underscore)
   * Pass 3: Pencocokan alphanumeric bersih (tanpa simbol)
   * Pass 4: Pencocokan batas kata tanpa kata kunci konflik (misal grafik, masalah)
   * Menjamin setiap preset sheet memetakan paling banyak SATU sheet workbook,
   * dan mencegah sheet tidak relevan (seperti "MASALAH GIZI" atau "grafik bumil") merebut preset.
   */
  static matchSheets(
    availableSheetNames: string[],
    presetSheets: SheetConfigPreset[],
  ): Map<string, SheetConfigPreset> {
    const result = new Map<string, SheetConfigPreset>();
    const claimedPresetIndices = new Set<number>();
    const claimedAvailable = new Set<string>();

    // Pass 1: Exact match (case-insensitive & trimmed)
    for (let i = 0; i < presetSheets.length; i++) {
      const ps = presetSheets[i];
      const psTrim = ps.sheetName.trim().toLowerCase();
      const exact = availableSheetNames.find(
        (name) => !claimedAvailable.has(name) && name.trim().toLowerCase() === psTrim,
      );
      if (exact) {
        result.set(exact, ps);
        claimedPresetIndices.add(i);
        claimedAvailable.add(exact);
      }
    }

    // Pass 2: Normalized match (whitespace & underscore collapsed)
    for (let i = 0; i < presetSheets.length; i++) {
      if (claimedPresetIndices.has(i)) continue;
      const ps = presetSheets[i];
      const psNorm = this.normalizeKey(ps.sheetName);
      const match = availableSheetNames.find(
        (name) => !claimedAvailable.has(name) && this.normalizeKey(name) === psNorm,
      );
      if (match) {
        result.set(match, ps);
        claimedPresetIndices.add(i);
        claimedAvailable.add(match);
      }
    }

    // Pass 3: Clean alphanumeric match (alphanumeric only)
    for (let i = 0; i < presetSheets.length; i++) {
      if (claimedPresetIndices.has(i)) continue;
      const ps = presetSheets[i];
      const psClean = this.normalizeKey(ps.sheetName).replace(/[^a-z0-9]/g, '');
      if (!psClean) continue;
      const match = availableSheetNames.find(
        (name) =>
          !claimedAvailable.has(name) &&
          this.normalizeKey(name).replace(/[^a-z0-9]/g, '') === psClean,
      );
      if (match) {
        result.set(match, ps);
        claimedPresetIndices.add(i);
        claimedAvailable.add(match);
      }
    }

    // Pass 4: Boundary-aware match for minor naming variations,
    // menghindari kata kunci konflik (grafik, chart, rekap, masalah)
    const conflictPrefixes = ['grafik', 'chart', 'rekap', 'masalah'];
    for (let i = 0; i < presetSheets.length; i++) {
      if (claimedPresetIndices.has(i)) continue;
      const ps = presetSheets[i];
      const psNorm = this.normalizeKey(ps.sheetName);
      const match = availableSheetNames.find((name) => {
        if (claimedAvailable.has(name)) return false;
        const nameNorm = this.normalizeKey(name);
        const hasConflict = conflictPrefixes.some(
          (p) => nameNorm.includes(p) && !psNorm.includes(p),
        );
        if (hasConflict) return false;

        const regex = new RegExp(`(^|[_\\s])${psNorm}([_\\s]|$)`, 'i');
        return regex.test(nameNorm);
      });
      if (match) {
        result.set(match, ps);
        claimedPresetIndices.add(i);
        claimedAvailable.add(match);
      }
    }

    return result;
  }

  /**
   * Pencocokan sheet preset dengan sheet yang tersedia di workbook.
   */
  static findMatchingSheetPreset(
    currentSheetName: string,
    presets: SheetConfigPreset[],
  ): SheetConfigPreset | undefined {
    const map = this.matchSheets([currentSheetName], presets);
    return map.get(currentSheetName);
  }

  /**
   * Memeriksa apakah dua nama sheet cocok secara wajar.
   */
  static isSheetMatch(nameA: string, nameB: string): boolean {
    if (nameA === nameB) return true;
    const normA = this.normalizeKey(nameA);
    const normB = this.normalizeKey(nameB);
    if (normA === normB) return true;
    const cleanA = normA.replace(/[^a-z0-9]/g, '');
    const cleanB = normB.replace(/[^a-z0-9]/g, '');
    return cleanA.length > 0 && cleanA === cleanB;
  }

  /**
   * Pencocokan nama header preset dengan kolom yang ada (exact -> normalized -> leaf sub-header -> duplicate tolerance -> token similarity).
   */
  static findMatchingHeader(presetVar: string, columns: ColumnInfo[]): string | undefined {
    // 1. Exact match
    const exact = columns.find((c) => c.header === presetVar);
    if (exact) return exact.header;

    // 2. Normalized match
    const normPreset = this.normalizeKey(presetVar);
    const norm = columns.find((c) => this.normalizeKey(c.header) === normPreset);
    if (norm) return norm.header;

    // 3. Leaf sub-header match
    const leaf = columns.find(
      (c) => c.leafHeader && this.normalizeKey(c.leafHeader) === normPreset,
    );
    if (leaf) return leaf.header;

    // 4. Clean alphanumeric exact match
    const cleanPreset = normPreset.replace(/[^a-z0-9]/g, '');
    const cleanExact = columns.find((c) => {
      const cleanH = this.normalizeKey(c.header).replace(/[^a-z0-9]/g, '');
      const cleanLeaf = c.leafHeader ? this.normalizeKey(c.leafHeader).replace(/[^a-z0-9]/g, '') : '';
      return cleanH === cleanPreset || cleanLeaf === cleanPreset;
    });
    if (cleanExact) return cleanExact.header;

    // 5. Toleransi nomor duplikasi: misal preset memiliki "Base Name - % (4)",
    // sedangkan di sheet karena penyesuaian batas kolom tersedia "Base Name - % (3)"
    const matchSuffix = presetVar.match(/^(.*?)\s*\((\d+)\)$/);
    if (matchSuffix) {
      const baseName = matchSuffix[1].trim();
      const normBase = this.normalizeKey(baseName);
      const cleanBase = normBase.replace(/[^a-z0-9]/g, '');

      const sameBaseCols = columns.filter((c) => {
        const colBase = c.header.replace(/\s*\(\d+\)$/, '').trim();
        const normColBase = this.normalizeKey(colBase);
        return normColBase === normBase || normColBase.replace(/[^a-z0-9]/g, '') === cleanBase;
      });

      if (sameBaseCols.length > 0) {
        const targetIdx = parseInt(matchSuffix[2], 10);
        let closestCol = sameBaseCols[0];
        let minDiff = Infinity;
        for (const c of sameBaseCols) {
          const m = c.header.match(/\((\d+)\)$/);
          const idx = m ? parseInt(m[1], 10) : 1;
          const diff = Math.abs(idx - targetIdx);
          if (diff < minDiff) {
            minDiff = diff;
            closestCol = c;
          }
        }
        return closestCol.header;
      }
    }

    // 6. Substring match
    const looseMatch = columns.find((c) => {
      const cleanH = this.normalizeKey(c.header).replace(/[^a-z0-9]/g, '');
      const cleanLeaf = c.leafHeader ? this.normalizeKey(c.leafHeader).replace(/[^a-z0-9]/g, '') : '';
      return (
        cleanPreset.length > 4 && (cleanH.includes(cleanPreset) || cleanPreset.includes(cleanH))
      );
    });
    if (looseMatch) return looseMatch.header;

    // 7. Token-based similarity: jika sebagian besar kata penting cocok
    const presetTokens = normPreset.split(/[\s_]+/).filter((t) => t.length > 2);
    if (presetTokens.length > 0) {
      let bestScore = 0;
      let bestMatch: ColumnInfo | null = null;
      for (const col of columns) {
        const colNorm = this.normalizeKey(col.header);
        const matchTokens = presetTokens.filter((token) => colNorm.includes(token));
        const score = matchTokens.length / presetTokens.length;
        if (score > 0.7 && score > bestScore) {
          bestScore = score;
          bestMatch = col;
        }
      }
      if (bestMatch) {
        return bestMatch.header;
      }
    }

    return undefined;
  }

  /**
   * Pencocokan join key dari preset terhadap kolom beririsan (commonJoinColumns).
   */
  static findMatchingJoinKey(presetJoinBy: string, commonCols: string[]): string | undefined {
    if (!presetJoinBy) return undefined;
    const exact = commonCols.find((c) => c === presetJoinBy);
    if (exact) return exact;

    const norm = commonCols.find((c) => this.normalizeKey(c) === this.normalizeKey(presetJoinBy));
    if (norm) return norm;

    const loose = commonCols.find((c) => {
      const cNorm = this.normalizeKey(c);
      const pNorm = this.normalizeKey(presetJoinBy);
      return cNorm.includes(pNorm) || pNorm.includes(cNorm);
    });
    return loose;
  }

  private static normalizeKey(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '_');
  }
}
