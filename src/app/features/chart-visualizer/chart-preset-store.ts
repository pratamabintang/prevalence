import { ExcelResilientMatcher } from '../../core/excel/excel-resilient-matcher';
import {
  ChartConfigurationPreset,
  ConfigurationWorkspace,
} from '../../core/storage/configuration-workspace';
import { ColumnInfo } from '../../shared/excel';

export type { ChartConfigurationPreset };

/**
 * ChartPresetStore: Fasad kompatibilitas ke belakang untuk persistensi konfigurasi grafik
 * dan pencocokan fuzzy (resilient matching). Mendelegasikan ke ConfigurationWorkspace dan ExcelResilientMatcher.
 */
export class ChartPresetStore {
  static hasSavedPreset(): boolean {
    return ConfigurationWorkspace.chart.hasSavedPreset();
  }

  static loadLastPreset(): ChartConfigurationPreset | null {
    return ConfigurationWorkspace.chart.loadLastPreset();
  }

  static savePreset(preset: ChartConfigurationPreset, triggerDownload = true): void {
    ConfigurationWorkspace.chart.savePreset(preset, triggerDownload);
  }

  static parsePresetJson(text: string): ChartConfigurationPreset {
    return ConfigurationWorkspace.chart.parsePresetJson(text);
  }

  static findMatchingSheet(presetSheetName: string, availableSheets: string[]): string | undefined {
    return ExcelResilientMatcher.findMatchingSheet(presetSheetName, availableSheets);
  }

  static findMatchingHeader(presetHeader: string, columns: ColumnInfo[]): string | undefined {
    return ExcelResilientMatcher.findMatchingHeader(presetHeader, columns);
  }
}
