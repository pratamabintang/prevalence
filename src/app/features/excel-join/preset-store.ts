import {
  ColumnConfig,
  ColumnTargetConfig,
} from '../../core/evaluation/indicator-evaluator';
import { ExcelResilientMatcher } from '../../core/excel/excel-resilient-matcher';
import { GenericPresetStore } from '../../core/storage/preset-store';
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

const excelJoinStoreEngine = new GenericPresetStore<JoinConfigurationPreset>({
  storageKey: 'dinkes_excel_join_config_last',
  defaultFileNamePrefix: 'konfigurasi_join_excel',
  generateFileName: () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    return `konfigurasi_join_excel_${timestamp}.json`;
  },
  validator: (data: unknown) => {
    const parsed = data as JoinConfigurationPreset;
    if (!parsed || !Array.isArray(parsed.sheets)) {
      throw new Error('Format konfigurasi tidak valid.');
    }
    return parsed;
  },
});

/**
 * PresetStore: Modul untuk persistensi konfigurasi join (localStorage & unduh file .json)
 * serta algoritma pencocokan fuzzy (resilient matching) terhadap variasi template Excel.
 */
export class PresetStore {
  /**
   * Menyimpan preset ke localStorage dan mengunduhnya sebagai file .json.
   */
  static savePreset(preset: JoinConfigurationPreset, triggerDownload = true): void {
    excelJoinStoreEngine.savePreset(preset, triggerDownload);
  }

  /**
   * Parse teks JSON menjadi JoinConfigurationPreset.
   */
  static parsePresetJson(text: string): JoinConfigurationPreset {
    return excelJoinStoreEngine.parsePresetJson(text);
  }

  /**
   * Melakukan pemetaan 1-ke-1 antara sheet pada workbook dan daftar preset sheets.
   */
  static matchSheets(
    availableSheetNames: string[],
    presetSheets: SheetConfigPreset[],
  ): Map<string, SheetConfigPreset> {
    return ExcelResilientMatcher.matchSheets(availableSheetNames, presetSheets);
  }

  /**
   * Pencocokan nama header preset dengan kolom yang ada.
   */
  static findMatchingHeader(presetVar: string, columns: ColumnInfo[]): string | undefined {
    return ExcelResilientMatcher.findMatchingHeader(presetVar, columns);
  }

  /**
   * Pencocokan join key dari preset terhadap kolom beririsan (commonJoinColumns).
   */
  static findMatchingJoinKey(presetJoinBy: string, commonCols: string[]): string | undefined {
    return ExcelResilientMatcher.findMatchingJoinKey(presetJoinBy, commonCols);
  }
}
