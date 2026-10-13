import { ColumnInfo } from '../../shared/excel';
import {
  IndicatorPolarity,
  StuntingCategoryConfig,
} from '../../core/stunting/stunting-evaluation-engine';

export interface StuntingColumnMappingPreset {
  categoryCol: string;
  indicatorCol: string;
  targetPrevCol: string;
  actualPrevCol: string;
  targetCurrentCol: string;
  tw1ActualCol: string;
  tw1TargetCol: string;
  tw2ActualCol: string;
  tw2TargetCol: string;
  tw3ActualCol: string;
  tw3TargetCol: string;
  tw4ActualCol: string;
  tw4TargetCol: string;
}

export interface StuntingConfigurationPreset {
  version: '1.0';
  name?: string;
  savedAt: string;
  sheetName: string;
  headerStartRow: number;
  headerEndRow: number;
  dataStartRow: number;
  mapping: StuntingColumnMappingPreset;
  activeQuarter: 1 | 2 | 3 | 4;
  toleranceThreshold: number;
  polarities?: Record<string, IndicatorPolarity>;
}

export interface StuntingJoinSheetPreset {
  sheetName: string;
  keyColumn: string;
  headerStartRow?: number;
  headerEndRow?: number;
  dataStartRow?: number;
}

export interface StuntingPipelinePreset {
  version: '2.0';
  name?: string;
  savedAt: string;
  primarySheet: string;
  primaryKeyColumn: string;
  primaryHeaderStartRow?: number;
  primaryHeaderEndRow?: number;
  primaryDataStartRow?: number;
  secondarySheets: StuntingJoinSheetPreset[];
  excludedRowKeywords?: string[];
  manualExcludedKeys?: string[];
  categories: StuntingCategoryConfig[];
  activeQuarter: 1 | 2 | 3 | 4;
  toleranceThreshold: number;
}

export type AnyStuntingPreset = StuntingPipelinePreset | StuntingConfigurationPreset;

export class StuntingPresetStore {
  private static readonly STORAGE_KEY = 'dinkes_stunting_config_last';

  static hasSavedPreset(): boolean {
    return typeof window !== 'undefined' && !!localStorage.getItem(this.STORAGE_KEY);
  }

  static loadLastPreset(): AnyStuntingPreset | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as AnyStuntingPreset;
    } catch {
      return null;
    }
  }

  static savePreset(preset: AnyStuntingPreset, triggerDownload = true): void {
    const jsonString = JSON.stringify(preset, null, 2);

    try {
      localStorage.setItem(this.STORAGE_KEY, jsonString);
    } catch (e) {
      console.warn('Gagal menyimpan preset stunting ke localStorage:', e);
    }

    if (triggerDownload && typeof document !== 'undefined') {
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 10);
      const nameTag = preset.version === '2.0' ? 'pipeline' : (preset.sheetName || 'stunting').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.href = url;
      link.download = `konfigurasi_stunting_${nameTag}_${timestamp}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
  }

  static parsePresetJson(text: string): AnyStuntingPreset {
    const parsed = JSON.parse(text) as any;
    if (!parsed) {
      throw new Error('Format berkas konfigurasi tidak valid.');
    }
    if (parsed.version === '2.0' && Array.isArray(parsed.categories)) {
      return parsed as StuntingPipelinePreset;
    }
    if (parsed.sheetName || parsed.mapping) {
      return parsed as StuntingConfigurationPreset;
    }
    throw new Error('Format berkas konfigurasi stunting tidak valid. Pastikan berkas berasal dari ekspor pemantauan stunting.');
  }

  static findMatchingSheet(presetSheetName: string, availableSheets: string[]): string | undefined {
    if (!presetSheetName) return undefined;
    const exact = availableSheets.find((s) => s === presetSheetName);
    if (exact) return exact;

    const normPreset = this.normalizeKey(presetSheetName);
    const norm = availableSheets.find((s) => this.normalizeKey(s) === normPreset);
    if (norm) return norm;

    const loose = availableSheets.find((s) => {
      const normS = this.normalizeKey(s);
      return normS.includes(normPreset) || normPreset.includes(normS);
    });
    return loose;
  }

  static findMatchingHeader(presetHeader: string, columns: ColumnInfo[]): string | undefined {
    if (!presetHeader) return undefined;
    const exact = columns.find((c) => c.header === presetHeader);
    if (exact) return exact.header;

    const normPreset = this.normalizeKey(presetHeader);
    const norm = columns.find((c) => this.normalizeKey(c.header) === normPreset);
    if (norm) return norm.header;

    const leaf = columns.find(
      (c) => c.leafHeader && this.normalizeKey(c.leafHeader) === normPreset,
    );
    if (leaf) return leaf.header;

    const cleanPreset = normPreset.replace(/[^a-z0-9]/g, '');
    const cleanMatch = columns.find((c) => {
      const cleanH = this.normalizeKey(c.header).replace(/[^a-z0-9]/g, '');
      const cleanLeaf = c.leafHeader ? this.normalizeKey(c.leafHeader).replace(/[^a-z0-9]/g, '') : '';
      return (
        cleanH === cleanPreset ||
        cleanLeaf === cleanPreset ||
        (cleanPreset.length > 3 && (cleanH.includes(cleanPreset) || cleanPreset.includes(cleanH)))
      );
    });
    return cleanMatch ? cleanMatch.header : undefined;
  }

  private static normalizeKey(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '_');
  }
}
