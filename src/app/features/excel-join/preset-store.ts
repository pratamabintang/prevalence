import { ExcelResilientMatcher } from '../../core/excel/excel-resilient-matcher';
import {
  ConfigurationWorkspace,
  JoinConfigurationPreset,
  SheetConfigPreset,
} from '../../core/storage/configuration-workspace';
import { ColumnInfo } from '../../shared/excel';

export type { JoinConfigurationPreset, SheetConfigPreset };

/**
 * PresetStore: Fasad kompatibilitas ke belakang untuk persistensi konfigurasi join
 * dan pencocokan fuzzy (resilient matching). Mendelegasikan ke ConfigurationWorkspace dan ExcelResilientMatcher.
 */
export class PresetStore {
  /**
   * Menyimpan preset ke localStorage dan mengunduhnya sebagai file .json.
   */
  static savePreset(preset: JoinConfigurationPreset, triggerDownload = true): void {
    ConfigurationWorkspace.excelJoin.savePreset(preset, triggerDownload);
  }

  /**
   * Parse teks JSON menjadi JoinConfigurationPreset.
   */
  static parsePresetJson(text: string): JoinConfigurationPreset {
    return ConfigurationWorkspace.excelJoin.parsePresetJson(text);
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
