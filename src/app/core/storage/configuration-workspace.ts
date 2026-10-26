import {
  ColumnConfig,
  ColumnTargetConfig,
} from '../evaluation/indicator-evaluator';
import {
  IndicatorPolarity,
  StuntingCategoryConfig,
} from '../stunting/stunting-evaluation-engine';
import {
  FileDownloadAdapter,
  GenericPresetStore,
  StorageAdapter,
} from './preset-store';
import { BackendStorageService, StorageConfigType } from './backend-storage.service';

// ==========================================
// 1. Join Configuration Preset Interfaces
// ==========================================

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

// ==========================================
// 2. Stunting Configuration Preset Interfaces
// ==========================================

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

// ==========================================
// 3. Chart Configuration Preset Interfaces
// ==========================================

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
  viewMode?: 'overview' | 'by-region' | 'by-indicator' | 'by-map' | 'by-correlation' | 'by-quadrant' | 'by-trends';
  activeMapIndicator?: string;
  regionColumns?: 1 | 2;
  regionGridColumns?: 1 | 2 | 3;
  regionSortMode?: 'default' | 'desc' | 'asc';
  indicatorTargets?: Record<string, number | null>;
  indicatorTargetOperators?: Record<string, string>;
  targetOperator?: string;
}

// ==========================================
// 4. Configuration Workspace Module
// ==========================================

export interface ConfigurationWorkspaceOptions {
  storage?: StorageAdapter;
  downloader?: FileDownloadAdapter;
  backendStorage?: BackendStorageService;
}

/**
 * ConfigurationWorkspace: Modul terpadu untuk persistensi, deserialisasi, dan validasi skema
 * konfigurasi preset Dinkes (Join Excel, Pemantauan Stunting, Visualisasi Grafik)
 * dengan sinkronisasi server SQLite dan fallback lokal.
 */
export class ConfigurationWorkspace {
  readonly excelJoin: GenericPresetStore<JoinConfigurationPreset>;
  readonly stunting: GenericPresetStore<AnyStuntingPreset>;
  readonly chart: GenericPresetStore<ChartConfigurationPreset>;
  private readonly backendStorage?: BackendStorageService;

  constructor(options?: ConfigurationWorkspaceOptions) {
    this.backendStorage = options?.backendStorage;
    this.excelJoin = new GenericPresetStore<JoinConfigurationPreset>({
      storageKey: 'dinkes_excel_join_config_last',
      defaultFileNamePrefix: 'konfigurasi_join_excel',
      storage: options?.storage,
      downloader: options?.downloader,
      generateFileName: () => {
        const timestamp = new Date().toISOString().slice(0, 10);
        return `konfigurasi_join_excel_${timestamp}.json`;
      },
      validator: (data: unknown) => {
        const parsed = data as JoinConfigurationPreset;
        if (!parsed || !Array.isArray(parsed.sheets)) {
          throw new Error('Format konfigurasi join tidak valid (daftar sheets tidak ditemukan).');
        }
        return parsed;
      },
    });

    this.stunting = new GenericPresetStore<AnyStuntingPreset>({
      storageKey: 'dinkes_stunting_config_last',
      defaultFileNamePrefix: 'konfigurasi_stunting',
      storage: options?.storage,
      downloader: options?.downloader,
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

    this.chart = new GenericPresetStore<ChartConfigurationPreset>({
      storageKey: 'dinkes_chart_visualizer_config_last',
      defaultFileNamePrefix: 'konfigurasi_grafik',
      storage: options?.storage,
      downloader: options?.downloader,
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
  }

  private getStoreByType(type: StorageConfigType): GenericPresetStore<any> {
    switch (type) {
      case 'join':
        return this.excelJoin;
      case 'stunting':
        return this.stunting;
      case 'chart':
        return this.chart;
    }
  }

  /**
   * Memuat konfigurasi preset dari server SQLite (utama) dan menyimpannya ke cache lokal.
   * Jika server tidak terjangkau atau belum memiliki konfigurasi, beralih anggun (fallback) ke preset lokal.
   */
  async syncFromServer<T = unknown>(type: StorageConfigType): Promise<T | null> {
    const store = this.getStoreByType(type);
    if (this.backendStorage?.isConfigured()) {
      const res = await this.backendStorage.getConfig(type);
      if (res.success && res.hasConfig && res.config) {
        try {
          store.savePreset(res.config, false);
          return res.config as T;
        } catch {
          // Abaikan jika skema dari server tidak valid, jatuh ke lokal
        }
      }
    }
    return store.loadLastPreset() as T | null;
  }

  /**
   * Menyimpan konfigurasi preset ke lokal sekaligus menyinkronkan ke server SQLite jika aktif.
   */
  async saveToServer<T>(type: StorageConfigType, preset: T, downloadAsFile = false): Promise<boolean> {
    const store = this.getStoreByType(type);
    store.savePreset(preset, downloadAsFile);

    if (this.backendStorage?.isConfigured()) {
      const res = await this.backendStorage.saveConfig(type, preset);
      return res.success;
    }
    return false;
  }

  // ==========================================
  // Static Singletons for Global Access
  // ==========================================

  private static defaultInstance = new ConfigurationWorkspace();

  static get excelJoin(): GenericPresetStore<JoinConfigurationPreset> {
    return this.defaultInstance.excelJoin;
  }

  static get stunting(): GenericPresetStore<AnyStuntingPreset> {
    return this.defaultInstance.stunting;
  }

  static get chart(): GenericPresetStore<ChartConfigurationPreset> {
    return this.defaultInstance.chart;
  }
}
