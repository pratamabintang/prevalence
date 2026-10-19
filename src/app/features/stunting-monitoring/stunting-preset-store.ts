import { ExcelResilientMatcher } from '../../core/excel/excel-resilient-matcher';
import { GenericPresetStore } from '../../core/storage/preset-store';
import {
  IndicatorPolarity,
  StuntingCategoryConfig,
} from '../../core/stunting/stunting-evaluation-engine';
import { ColumnInfo } from '../../shared/excel';

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

const stuntingStoreEngine = new GenericPresetStore<AnyStuntingPreset>({
  storageKey: 'dinkes_stunting_config_last',
  defaultFileNamePrefix: 'konfigurasi_stunting',
  generateFileName: (preset) => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const nameTag =
      preset.version === '2.0'
        ? 'pipeline'
        : (preset.sheetName || 'stunting').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `konfigurasi_stunting_${nameTag}_${timestamp}.json`;
  },
  validator: (data: unknown) => {
    const parsed = data as any;
    if (!parsed) {
      throw new Error('Format berkas konfigurasi tidak valid.');
    }
    if (parsed.version === '2.0' && Array.isArray(parsed.categories)) {
      return parsed as StuntingPipelinePreset;
    }
    if (parsed.sheetName || parsed.mapping) {
      return parsed as StuntingConfigurationPreset;
    }
    throw new Error(
      'Format berkas konfigurasi stunting tidak valid. Pastikan berkas berasal dari ekspor pemantauan stunting.',
    );
  },
});

export class StuntingPresetStore {
  static hasSavedPreset(): boolean {
    return stuntingStoreEngine.hasSavedPreset();
  }

  static loadLastPreset(): AnyStuntingPreset | null {
    return stuntingStoreEngine.loadLastPreset();
  }

  static savePreset(preset: AnyStuntingPreset, triggerDownload = true): void {
    stuntingStoreEngine.savePreset(preset, triggerDownload);
  }

  static parsePresetJson(text: string): AnyStuntingPreset {
    return stuntingStoreEngine.parsePresetJson(text);
  }

  static findMatchingSheet(presetSheetName: string, availableSheets: string[]): string | undefined {
    return ExcelResilientMatcher.findMatchingSheet(presetSheetName, availableSheets);
  }

  static findMatchingHeader(presetHeader: string, columns: ColumnInfo[]): string | undefined {
    return ExcelResilientMatcher.findMatchingHeader(presetHeader, columns);
  }
}
