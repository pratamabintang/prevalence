import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PeriodPartitionWorkspace } from './period-partition-workspace';
import { GasPeriodItem, GasStorageService } from './gas-storage.service';

describe('PeriodPartitionWorkspace', () => {
  let mockGasStorage: Partial<GasStorageService>;
  let workspace: PeriodPartitionWorkspace;

  const samplePeriods: GasPeriodItem[] = [
    {
      year: 2026,
      quarter: 'TW1',
      hasRaw: true,
      hasResult: true,
      hasConfig: true,
      rawFileName: 'raw-2026-tw1.xlsx',
      resultFileName: 'result-2026-tw1.xlsx',
    },
    {
      year: 2026,
      quarter: 'TW2',
      hasRaw: false,
      hasResult: true,
      hasConfig: false,
      resultFileName: 'result-2026-tw2.xlsx',
    },
    {
      year: 2025,
      quarter: 'TW4',
      hasRaw: true,
      hasResult: false,
      hasConfig: true,
      rawFileName: 'raw-2025-tw4.xlsx',
    },
  ];

  beforeEach(() => {
    mockGasStorage = {
      isConfigured: vi.fn().mockReturnValue(true),
      listPeriods: vi.fn().mockResolvedValue({
        success: true,
        periods: samplePeriods,
      }),
      loadPeriod: vi.fn(),
      savePeriod: vi.fn(),
    };

    workspace = new PeriodPartitionWorkspace(mockGasStorage as GasStorageService);
  });

  describe('Period Listing & Year Derivation (Slice 1)', () => {
    it('harus memuat daftar slot periode dari GasStorageService dan memperbarui signals', async () => {
      expect(workspace.isLoading()).toBe(false);

      const periods = await workspace.refreshPeriods();

      expect(mockGasStorage.listPeriods).toHaveBeenCalled();
      expect(periods).toEqual(samplePeriods);
      expect(workspace.periodSlots()).toEqual(samplePeriods);
      expect(workspace.isLoading()).toBe(false);
    });

    it('harus menggabungkan tahun dari slot cloud dengan 5 tahun ke belakang dan mengurutkannya menurun', async () => {
      await workspace.refreshPeriods();

      const years = workspace.availableYears();
      const currentYear = new Date().getFullYear();

      expect(years).toContain(2026);
      expect(years).toContain(2025);
      expect(years).toContain(currentYear);
      // Dipastikan terurut menurun (descending)
      for (let i = 0; i < years.length - 1; i++) {
        expect(years[i]).toBeGreaterThanOrEqual(years[i + 1]);
      }
    });

    it('harus memeriksa ketersediaan kuartal dengan benar via isQuarterAvailable', async () => {
      await workspace.refreshPeriods();

      expect(workspace.isQuarterAvailable(2026, 'TW1')).toBe(true);
      expect(workspace.isQuarterAvailable(2026, 'TW2')).toBe(true);
      expect(workspace.isQuarterAvailable(2026, 'TW3')).toBe(false); // tidak ada di sample
      expect(workspace.isQuarterAvailable(2025, 'TW4')).toBe(true);
    });
  });

  describe('Single Quarter Loading & Preference (Slice 2)', () => {
    it('harus memuat single quarter dengan prefer result dan mem-parsing hasilnya', async () => {
      const mockResultBuffer = new ArrayBuffer(64);
      (mockGasStorage.loadPeriod as any).mockResolvedValue({
        success: true,
        hasData: true,
        year: 2026,
        quarter: 'TW1',
        fileName: 'joined-result.xlsx',
        resultExcelBuffer: mockResultBuffer,
        resultExcelAvailable: true,
        isResultExcel: true,
      });

      const res = await workspace.loadSingleQuarter(2026, 'TW1', { prefer: 'result' });

      expect(mockGasStorage.loadPeriod).toHaveBeenCalledWith(2026, 'TW1', {
        preferResult: true,
        customUrl: undefined,
      });
      expect(res).toBeTruthy();
      expect(res?.year).toBe(2026);
      expect(res?.quarter).toBe('TW1');
      expect(res?.source).toBe('cloud');
      expect(res?.resultBuffer).toBe(mockResultBuffer);
      expect(res?.dataset).toBeDefined();
    });

    it('harus jatuh ke rawExcelBuffer jika prefer result tapi result tidak ada', async () => {
      const mockRawBuffer = new ArrayBuffer(32);
      (mockGasStorage.loadPeriod as any).mockResolvedValue({
        success: true,
        hasData: true,
        year: 2026,
        quarter: 'TW1',
        fileName: 'raw-data.xlsx',
        rawExcelBuffer: mockRawBuffer,
        resultExcelAvailable: false,
        isResultExcel: false,
      });

      const res = await workspace.loadSingleQuarter(2026, 'TW1', { prefer: 'result' });

      expect(res).toBeTruthy();
      expect(res?.rawBuffer).toBe(mockRawBuffer);
      expect(res?.dataset).toBeDefined();
    });

    it('harus mengembalikan null jika slot cloud tidak memiliki data', async () => {
      (mockGasStorage.loadPeriod as any).mockResolvedValue({
        success: true,
        hasData: false,
      });

      const res = await workspace.loadSingleQuarter(2026, 'TW3');
      expect(res).toBeNull();
    });
  });

  describe('Multi-Quarter Batch Loading & Local Overrides (Slice 3)', () => {
    it('harus memuat multi-kuartal dengan prioritas lokal mengesampingkan cloud dan mendeteksi slot hilang', async () => {
      // Setup mock file lokal untuk TW1
      const localBuffer = new ArrayBuffer(16);
      const mockLocalFile = {
        name: 'local-tw1.xlsx',
        arrayBuffer: vi.fn().mockResolvedValue(localBuffer),
      } as unknown as File;

      // Setup cloud response untuk TW2
      const cloudBufferTW2 = new ArrayBuffer(24);
      (mockGasStorage.loadPeriod as any).mockImplementation((yr: number, qr: string) => {
        if (qr === 'TW2') {
          return Promise.resolve({
            success: true,
            hasData: true,
            year: yr,
            quarter: qr,
            fileName: 'cloud-tw2.xlsx',
            resultExcelBuffer: cloudBufferTW2,
          });
        }
        return Promise.resolve({ success: true, hasData: false });
      });

      // Minta TW1 (ada lokal), TW2 (ada cloud), TW3 (hilang)
      const res = await workspace.loadMultiQuarters(
        2026,
        ['TW1', 'TW2', 'TW3'],
        { TW1: mockLocalFile },
        { prefer: 'result' },
      );

      expect(mockLocalFile.arrayBuffer).toHaveBeenCalled();
      expect(res.loadedQuarters.length).toBe(2);

      // TW1 harus berasal dari lokal
      const tw1 = res.loadedQuarters.find((q) => q.quarter === 'TW1');
      expect(tw1?.source).toBe('local');
      expect(tw1?.fileName).toBe('local-tw1.xlsx');

      // TW2 harus berasal dari cloud
      const tw2 = res.loadedQuarters.find((q) => q.quarter === 'TW2');
      expect(tw2?.source).toBe('cloud');
      expect(tw2?.fileName).toBe('cloud-tw2.xlsx');

      // TW3 harus teridentifikasi hilang
      expect(res.missingQuarters).toEqual(['TW3']);
      expect(res.primaryDataset).toBeDefined();
    });
  });

  describe('Save Period Partition & Auto-Result (Slice 4)', () => {
    it('harus memanggil gasStorage.savePeriod dengan buffer mentah dan hasil, lalu me-refresh slot periode', async () => {
      const mockRaw = new ArrayBuffer(32);
      const mockResult = new ArrayBuffer(48);
      (mockGasStorage.savePeriod as any).mockResolvedValue({
        success: true,
        message: 'Saved',
      });

      const res = await workspace.savePeriodPartition({
        year: 2026,
        quarter: 'TW1',
        rawExcelBuffer: mockRaw,
        resultExcelBuffer: mockResult,
        config: { test: 123 },
      });

      expect(res.success).toBe(true);
      expect(mockGasStorage.savePeriod).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2026,
          quarter: 'TW1',
          rawExcelBuffer: mockRaw,
          resultExcelBuffer: mockResult,
        }),
        undefined,
      );
      // Dipastikan me-refresh list periode setelah simpan berhasil
      expect(mockGasStorage.listPeriods).toHaveBeenCalled();
    });
  });

  describe('Angular DI Integration', () => {
    it('harus dapat diinjeksi via Angular DI / TestBed', async () => {
      const { TestBed } = await import('@angular/core/testing');
      TestBed.configureTestingModule({
        providers: [
          PeriodPartitionWorkspace,
          { provide: GasStorageService, useValue: mockGasStorage },
        ],
      });

      const injected = TestBed.inject(PeriodPartitionWorkspace);
      expect(injected).toBeInstanceOf(PeriodPartitionWorkspace);
      expect(injected.availableYears().length).toBeGreaterThan(0);
    });
  });
});
