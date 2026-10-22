import { beforeEach, describe, expect, it } from 'vitest';
import {
  ConfigurationWorkspace,
  JoinConfigurationPreset,
  StuntingPipelinePreset,
  ChartConfigurationPreset,
} from './configuration-workspace';
import {
  InMemoryFileDownloadAdapter,
  InMemoryStorageAdapter,
} from './preset-store';

describe('ConfigurationWorkspace', () => {
  let mockStorage: InMemoryStorageAdapter;
  let mockDownloader: InMemoryFileDownloadAdapter;
  let workspace: ConfigurationWorkspace;

  beforeEach(() => {
    mockStorage = new InMemoryStorageAdapter();
    mockDownloader = new InMemoryFileDownloadAdapter();
    workspace = new ConfigurationWorkspace({
      storage: mockStorage,
      downloader: mockDownloader,
    });
  });

  describe('Excel Join Presets', () => {
    const validJoinPreset: JoinConfigurationPreset = {
      version: '1.0',
      savedAt: '2026-10-22T08:00:00.000Z',
      joinBy: 'Kabupaten/Kota',
      sheets: [
        {
          sheetName: 'Gizi Balita',
          variables: ['Stunting %', 'Wasting %'],
        },
      ],
    };

    it('should save, check, and load Excel Join presets', () => {
      expect(workspace.excelJoin.hasSavedPreset()).toBe(false);

      workspace.excelJoin.savePreset(validJoinPreset, true);

      expect(workspace.excelJoin.hasSavedPreset()).toBe(true);
      expect(mockDownloader.downloads).toHaveLength(1);
      expect(mockDownloader.lastDownload?.fileName).toContain('konfigurasi_join_excel_');

      const loaded = workspace.excelJoin.loadLastPreset();
      expect(loaded).toEqual(validJoinPreset);

      workspace.excelJoin.clearPreset();
      expect(workspace.excelJoin.hasSavedPreset()).toBe(false);
      expect(workspace.excelJoin.loadLastPreset()).toBeNull();
    });

    it('should validate and parse valid JSON text, rejecting invalid schemas', () => {
      const json = JSON.stringify(validJoinPreset);
      const parsed = workspace.excelJoin.parsePresetJson(json);
      expect(parsed).toEqual(validJoinPreset);

      expect(() => workspace.excelJoin.parsePresetJson('{ invalid json')).toThrow();
      expect(() => workspace.excelJoin.parsePresetJson(JSON.stringify({ notAValidPreset: true }))).toThrow();
    });
  });

  describe('Stunting Monitoring Presets', () => {
    const validPipelinePreset: StuntingPipelinePreset = {
      version: '2.0',
      name: 'Stunting Standar TW3',
      savedAt: '2026-10-22T08:00:00.000Z',
      primarySheet: 'Gizi',
      primaryKeyColumn: 'Kabupaten/Kota',
      secondarySheets: [],
      categories: [
        {
          id: 'kat-1',
          name: 'Intervensi Spesifik',
          subCategories: [],
        },
      ],
      activeQuarter: 3,
      toleranceThreshold: 5,
    };

    it('should save and load Stunting pipeline presets (v2.0)', () => {
      workspace.stunting.savePreset(validPipelinePreset, true);

      expect(workspace.stunting.hasSavedPreset()).toBe(true);
      expect(mockDownloader.lastDownload?.fileName).toContain('konfigurasi_stunting_pipeline_');

      const loaded = workspace.stunting.loadLastPreset();
      expect(loaded).toEqual(validPipelinePreset);
    });

    it('should parse legacy v1.0 stunting presets and reject malformed schemas', () => {
      const legacyPreset = {
        version: '1.0',
        savedAt: '2026-10-22T08:00:00.000Z',
        sheetName: 'Rekap Gizi',
        headerStartRow: 2,
        headerEndRow: 3,
        dataStartRow: 4,
        mapping: { categoryCol: 'A', indicatorCol: 'B' },
        activeQuarter: 1,
        toleranceThreshold: 5,
      };

      const parsed = workspace.stunting.parsePresetJson(JSON.stringify(legacyPreset));
      expect(parsed.version).toBe('1.0');

      expect(() => workspace.stunting.parsePresetJson(JSON.stringify({ empty: true }))).toThrow();
    });
  });

  describe('Chart Visualizer Presets', () => {
    const validChartPreset: ChartConfigurationPreset = {
      version: '1.0',
      name: 'Grafik Capaian',
      savedAt: '2026-10-22T08:00:00.000Z',
      sheetName: 'Hasil Join',
      headerStartRow: 1,
      headerEndRow: 1,
      dataStartRow: 2,
      categoryColumn: 'Wilayah',
      seriesKeys: ['Capaian', 'Target'],
      targetValue: 80,
    };

    it('should save, load, and validate Chart Visualizer presets', () => {
      workspace.chart.savePreset(validChartPreset, true);

      expect(workspace.chart.hasSavedPreset()).toBe(true);
      expect(mockDownloader.lastDownload?.fileName).toContain('konfigurasi_grafik_Hasil_Join_');

      const loaded = workspace.chart.loadLastPreset();
      expect(loaded).toEqual(validChartPreset);

      expect(() => workspace.chart.parsePresetJson(JSON.stringify({ sheetName: 'Sheet1' }))).toThrow();
    });
  });

  describe('Static Singleton Instance', () => {
    it('should expose static singleton instances for easy global access', () => {
      expect(ConfigurationWorkspace.excelJoin).toBeDefined();
      expect(ConfigurationWorkspace.stunting).toBeDefined();
      expect(ConfigurationWorkspace.chart).toBeDefined();
    });
  });
});
