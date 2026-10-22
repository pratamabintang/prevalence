import { ExcelResilientMatcher } from '../../core/excel/excel-resilient-matcher';
import {
  AnyStuntingPreset,
  ConfigurationWorkspace,
  StuntingColumnMappingPreset,
  StuntingConfigurationPreset,
  StuntingJoinSheetPreset,
  StuntingPipelinePreset,
} from '../../core/storage/configuration-workspace';
import { ColumnInfo } from '../../shared/excel';

export type {
  AnyStuntingPreset,
  StuntingColumnMappingPreset,
  StuntingConfigurationPreset,
  StuntingJoinSheetPreset,
  StuntingPipelinePreset,
};

/**
 * StuntingPresetStore: Fasad kompatibilitas ke belakang untuk persistensi konfigurasi pemantauan stunting
 * dan pencocokan fuzzy (resilient matching). Mendelegasikan ke ConfigurationWorkspace dan ExcelResilientMatcher.
 */
export class StuntingPresetStore {
  static hasSavedPreset(): boolean {
    return ConfigurationWorkspace.stunting.hasSavedPreset();
  }

  static loadLastPreset(): AnyStuntingPreset | null {
    return ConfigurationWorkspace.stunting.loadLastPreset();
  }

  static savePreset(preset: AnyStuntingPreset, triggerDownload = true): void {
    ConfigurationWorkspace.stunting.savePreset(preset, triggerDownload);
  }

  static parsePresetJson(text: string): AnyStuntingPreset {
    return ConfigurationWorkspace.stunting.parsePresetJson(text);
  }

  static findMatchingSheet(presetSheetName: string, availableSheets: string[]): string | undefined {
    return ExcelResilientMatcher.findMatchingSheet(presetSheetName, availableSheets);
  }

  static findMatchingHeader(presetHeader: string, columns: ColumnInfo[]): string | undefined {
    return ExcelResilientMatcher.findMatchingHeader(presetHeader, columns);
  }
}
