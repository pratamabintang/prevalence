import { describe, expect, it, beforeEach } from 'vitest';
import {
  HealthDataExchange,
  InMemorySessionStorageAdapter,
} from './health-data-exchange';

describe('HealthDataExchange', () => {
  let exchange: HealthDataExchange;
  let memoryStorage: InMemorySessionStorageAdapter;

  beforeEach(() => {
    memoryStorage = new InMemorySessionStorageAdapter();
    exchange = new HealthDataExchange(memoryStorage);
  });

  describe('publishJoinedToChart', () => {
    it('should project joined dataset to chart format with custom column names and target', () => {
      const result = exchange.publishJoinedToChart({
        title: 'Hasil Join Imunisasi',
        columns: ['col_wilayah', 'col_imunisasi'],
        rows: [
          { col_wilayah: 'Cilacap', col_imunisasi: 85 },
          { col_wilayah: 'Banyumas', col_imunisasi: 90 },
        ],
        categoryColumn: 'col_wilayah',
        customColumnNames: {
          col_wilayah: 'Nama Wilayah',
          col_imunisasi: 'Cakupan Imunisasi %',
        },
        columnTargets: {
          col_imunisasi: { enabled: true, value: 80 },
        },
      });

      expect(result.source).toBe('join');
      expect(result.defaultViewMode).toBe('by-indicator');
      expect(result.categoryColumn).toBe('Nama Wilayah');
      expect(result.columns).toEqual(['Nama Wilayah', 'Cakupan Imunisasi %']);
      expect(result.percentageColumns).toEqual(['Cakupan Imunisasi %']);
      expect(result.targetValue).toBe(80);
      expect(result.indicatorTargets?.['Cakupan Imunisasi %']).toBe(80);
      expect(result.indicatorTargets?.['col_imunisasi']).toBe(80);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]['Nama Wilayah']).toBe('Cilacap');
      expect(result.rows[0]['Cakupan Imunisasi %']).toBe(85);

      // Verify reactive signal and storage
      expect(exchange.chartData()).toEqual(result);
      const rawStored = memoryStorage.getItem(HealthDataExchange.CHART_STORAGE_KEY);
      expect(rawStored).toBeTruthy();
      expect(JSON.parse(rawStored!)).toEqual(result);
    });

    it('should fallback target to default 50 when target is not available in Excel Join', () => {
      const result = exchange.publishJoinedToChart({
        title: 'Hasil Join Tanpa Target',
        columns: ['col_wilayah', 'col_balita'],
        rows: [
          { col_wilayah: 'Cilacap', col_balita: 120 },
        ],
        categoryColumn: 'col_wilayah',
      });

      expect(result.targetValue).toBe(50);
      expect(result.indicatorTargets?.['col_balita']).toBe(50);
    });
  });

  describe('publishJoinedToStunting', () => {
    it('should project joined dataset with TOTAL, TARGET, and RATA-RATA summary rows', () => {
      const result = exchange.publishJoinedToStunting({
        title: 'Data Balita Stunting',
        columns: ['Wilayah', 'Balita Stunting'],
        rows: [
          { Wilayah: 'Cilacap', 'Balita Stunting': 100 },
          { Wilayah: 'Banyumas', 'Balita Stunting': 150 },
        ],
        customColumnNames: {
          Wilayah: 'Kabupaten / Kota',
          'Balita Stunting': 'Jumlah Balita Stunting',
        },
        enableJumlah: true,
        sumColumns: { 'Balita Stunting': true },
        columnSums: { 'Balita Stunting': 250 },
        columnTargets: {
          'Balita Stunting': { enabled: true, operator: '<=', value: 120 },
        },
        enableAverage: true,
        avgColumns: { 'Balita Stunting': true },
        columnAverages: { 'Balita Stunting': 125 },
      });

      expect(result.keyColumn).toBe('Kabupaten / Kota');
      expect(result.columns).toEqual(['Kabupaten / Kota', 'Jumlah Balita Stunting']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]['Kabupaten / Kota']).toBe('Cilacap');
      expect(result.rows[0]['Jumlah Balita Stunting']).toBe(100);

      // Verify summary rows
      expect(result.summaryRow).toEqual({
        'Kabupaten / Kota': 'TOTAL',
        'Jumlah Balita Stunting': 250,
      });
      expect(result.targetRow).toEqual({
        'Kabupaten / Kota': 'TARGET',
        'Jumlah Balita Stunting': '<= 120',
      });
      expect(result.averageRow).toEqual({
        'Kabupaten / Kota': 'RATA-RATA',
        'Jumlah Balita Stunting': 125,
      });

      // Verify reactive signal and storage
      expect(exchange.stuntingData()).toEqual(result);
      const rawStored = memoryStorage.getItem(HealthDataExchange.STUNTING_STORAGE_KEY);
      expect(rawStored).toBeTruthy();
      expect(JSON.parse(rawStored!)).toEqual(result);
    });
  });

  describe('publishStuntingEvaluationToChart', () => {
    it('should project stunting evaluation rows to chart format', () => {
      const result = exchange.publishStuntingEvaluationToChart({
        activeQuarter: 2,
        rows: [
          {
            name: 'Remaja TTD',
            targetCurrentYear: 85,
            activeActual: 82.5,
            activeExpected: 42.5,
          },
        ],
      });

      expect(result.title).toBe('Grafik Pemantauan Stunting TW 2');
      expect(result.categoryColumn).toBe('Indikator');
      expect(result.columns).toEqual(['Indikator', 'Target', 'Capaian TW 2', 'Expected TW 2']);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({
        Indikator: 'Remaja TTD',
        Target: 85,
        'Capaian TW 2': 82.5,
        'Expected TW 2': 42.5,
      });

      expect(exchange.chartData()).toEqual(result);
    });
  });

  describe('clearData methods', () => {
    it('should clear chart and stunting data signals and storage', () => {
      exchange.setChartData({
        source: 'upload',
        categoryColumn: 'Cat',
        columns: ['Cat'],
        rows: [],
      });
      exchange.setStuntingData({
        source: 'join',
        keyColumn: 'Key',
        columns: ['Key'],
        rows: [],
      });

      expect(exchange.chartData()).not.toBeNull();
      expect(exchange.stuntingData()).not.toBeNull();

      exchange.clearChartData();
      expect(exchange.chartData()).toBeNull();
      expect(memoryStorage.getItem(HealthDataExchange.CHART_STORAGE_KEY)).toBeNull();

      exchange.clearStuntingData();
      expect(exchange.stuntingData()).toBeNull();
      expect(memoryStorage.getItem(HealthDataExchange.STUNTING_STORAGE_KEY)).toBeNull();
    });
  });
});
