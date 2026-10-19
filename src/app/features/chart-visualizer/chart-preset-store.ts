import { ExcelResilientMatcher } from '../../core/excel/excel-resilient-matcher';
import { GenericPresetStore } from '../../core/storage/preset-store';
import { ColumnInfo } from '../../shared/excel';

export interface ChartConfigurationPreset {
  version: '1.0';
  name?: string;
  savedAt: string;
  sheetName: string;
  headerStartRow: number;
  headerEndRow: number;
  dataStartRow: number;
  categoryColumn: string;
  seriesKeys: string[];
  targetValue: number | null;
  chartTitle?: string;
  chartSubtitle?: string;
  hiddenRows?: string[];
  deletedRows?: string[];
  viewMode?: 'by-region' | 'by-indicator';
  indicatorTargets?: Record<string, number | null>;
}

const chartStoreEngine = new GenericPresetStore<ChartConfigurationPreset>({
  storageKey: 'dinkes_chart_visualizer_config_last',
  defaultFileNamePrefix: 'konfigurasi_grafik',
  generateFileName: (preset) => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const safeSheet = (preset.sheetName || 'grafik').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `konfigurasi_grafik_${safeSheet}_${timestamp}.json`;
  },
  validator: (data: unknown) => {
    const parsed = data as ChartConfigurationPreset;
    if (!parsed || !parsed.sheetName || !Array.isArray(parsed.seriesKeys)) {
      throw new Error(
        'Format berkas konfigurasi grafik tidak valid. Pastikan berkas berasal dari ekspor preset grafik.',
      );
    }
    return parsed;
  },
});

/**
 * ChartPresetStore: Persistensi konfigurasi grafik visualisasi (localStorage & unduh file .json)
 * dengan delegasi ke GenericPresetStore dan ExcelResilientMatcher.
 */
export class ChartPresetStore {
  static hasSavedPreset(): boolean {
    return chartStoreEngine.hasSavedPreset();
  }

  static loadLastPreset(): ChartConfigurationPreset | null {
    return chartStoreEngine.loadLastPreset();
  }

  static savePreset(preset: ChartConfigurationPreset, triggerDownload = true): void {
    chartStoreEngine.savePreset(preset, triggerDownload);
  }

  static parsePresetJson(text: string): ChartConfigurationPreset {
    return chartStoreEngine.parsePresetJson(text);
  }

  static findMatchingSheet(presetSheetName: string, availableSheets: string[]): string | undefined {
    return ExcelResilientMatcher.findMatchingSheet(presetSheetName, availableSheets);
  }

  static findMatchingHeader(presetHeader: string, columns: ColumnInfo[]): string | undefined {
    return ExcelResilientMatcher.findMatchingHeader(presetHeader, columns);
  }
}
