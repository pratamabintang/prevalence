import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PeriodPartitionWorkspace } from './period-partition-workspace';
import { GasPeriodItem, GasStorageService } from './gas-storage.service';
import { BackendStorageService } from './backend-storage.service';

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

  describe('BackendStorageService Integration & Graceful Fallback', () => {
    it('harus memprioritaskan BackendStorageService saat terkonfigurasi dan beralih ke GasStorageService saat backend gagal', async () => {
      const mockBackend: Partial<BackendStorageService> = {
        isConfigured: vi.fn().mockReturnValue(true),
        listPeriods: vi.fn().mockResolvedValue({
          success: true,
          periods: [
            {
              year: 2026,
              quarter: 'TW1',
              hasRaw: true,
              hasResult: true,
              hasConfig: true,
            },
          ],
        }),
        loadPeriod: vi.fn().mockResolvedValue({
          success: true,
          hasData: true,
          year: 2026,
          quarter: 'TW1',
          resultExcelBuffer: new ArrayBuffer(32),
        }),
        savePeriod: vi.fn().mockResolvedValue({
          success: true,
          message: 'Saved to SQLite',
        }),
      };

      const hybridWorkspace = new PeriodPartitionWorkspace(
        mockGasStorage as GasStorageService,
        mockBackend as BackendStorageService,
      );

      const periods = await hybridWorkspace.refreshPeriods();
      expect(mockBackend.listPeriods).toHaveBeenCalled();
      expect(mockGasStorage.listPeriods).not.toHaveBeenCalled();
      expect(periods).toHaveLength(1);
      expect(periods[0].hasConfig).toBe(true);

      const loaded = await hybridWorkspace.loadSingleQuarter(2026, 'TW1', { prefer: 'result' });
      expect(mockBackend.loadPeriod).toHaveBeenCalledWith(2026, 'TW1');
      expect(loaded).not.toBeNull();

      // Simulasikan backend offline -> fallback ke GasStorageService
      (mockBackend.listPeriods as any).mockResolvedValue({ success: false, periods: [] });
      const fallbackPeriods = await hybridWorkspace.refreshPeriods();
      expect(mockGasStorage.listPeriods).toHaveBeenCalled();
      expect(fallbackPeriods).toEqual(samplePeriods);
    });

    it('harus mendukung isStorageConfigured, loadRawPeriod, dan resolusi config berkas lokal via BackendStorageService ketika GAS dinonaktifkan', async () => {
      (mockGasStorage.isConfigured as any).mockReturnValue(false);
      const rawBuf = new ArrayBuffer(24);
      const resBuf = new ArrayBuffer(36);
      const mockPreset = { version: '1.0', name: 'Preset Server TW1', joinBy: 'Wilayah', sheets: [] };

      const mockBackend: Partial<BackendStorageService> = {
        isConfigured: vi.fn().mockReturnValue(true),
        listPeriods: vi.fn().mockResolvedValue({
          success: true,
          periods: [
            {
              year: 2026,
              quarter: 'TW1',
              hasRaw: true,
              hasResult: true,
              hasConfig: true,
              rawFileName: 'server-raw-tw1.xlsx',
              resultFileName: 'server-res-tw1.xlsx',
            },
          ],
        }),
        loadPeriod: vi.fn().mockResolvedValue({
          success: true,
          hasData: true,
          year: 2026,
          quarter: 'TW1',
          hasRaw: true,
          hasResult: true,
          rawExcelBuffer: rawBuf,
          resultExcelBuffer: resBuf,
          config: mockPreset,
        }),
      };

      const backendOnlyWorkspace = new PeriodPartitionWorkspace(
        mockGasStorage as GasStorageService,
        mockBackend as BackendStorageService,
      );

      expect(backendOnlyWorkspace.isStorageConfigured()).toBe(true);

      await backendOnlyWorkspace.refreshPeriods();

      // 1. Uji loadRawPeriod mengambil langsung dari backendStorage tanpa menyentuh gasStorage
      const rawPeriodRes = await backendOnlyWorkspace.loadRawPeriod(2026, 'TW1');
      expect(rawPeriodRes.success).toBe(true);
      expect(rawPeriodRes.hasData).toBe(true);
      expect(rawPeriodRes.rawExcelBuffer).toBe(rawBuf);
      expect(rawPeriodRes.resultExcelBuffer).toBe(resBuf);
      expect(rawPeriodRes.resultExcelAvailable).toBe(true);
      expect(rawPeriodRes.config).toEqual(mockPreset);
      expect(mockGasStorage.loadPeriod).not.toHaveBeenCalled();

      // 2. Uji loadMultiQuarters dengan berkas lokal tetap mengambil config dari backendStorage tanpa menyentuh gasStorage
      const localFile = {
        name: 'override-tw1.xlsx',
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
      } as unknown as File;

      const multiRes = await backendOnlyWorkspace.loadMultiQuarters(
        2026,
        ['TW1'],
        { TW1: localFile },
      );
      expect(multiRes.loadedQuarters).toHaveLength(1);
      expect(multiRes.loadedQuarters[0].source).toBe('local');
      expect(mockBackend.loadPeriod).toHaveBeenCalledWith(2026, 'TW1');
      expect(mockGasStorage.loadPeriod).not.toHaveBeenCalled();
    });

    it('harus memuat template konfigurasi join dari BackendStorageService terlebih dahulu via loadTemplateConfig', async () => {
      (mockGasStorage.isConfigured as any).mockReturnValue(false);
      mockGasStorage.loadTemplateConfig = vi.fn();

      const serverJoinPreset = {
        version: '1.0',
        name: 'Template Server SQLite',
        joinBy: 'Kabupaten/Kota',
        sheets: [],
      };

      const mockBackend: Partial<BackendStorageService> = {
        isConfigured: vi.fn().mockReturnValue(true),
        getConfig: vi.fn().mockResolvedValue({
          success: true,
          hasConfig: true,
          config: serverJoinPreset,
          updatedAt: '2026-10-23T08:00:00Z',
        }),
      };

      const backendWorkspace = new PeriodPartitionWorkspace(
        mockGasStorage as GasStorageService,
        mockBackend as BackendStorageService,
      );

      const res = await backendWorkspace.loadTemplateConfig();
      expect(res.success).toBe(true);
      expect(res.hasConfig).toBe(true);
      expect(res.config).toEqual(serverJoinPreset);
      expect(mockBackend.getConfig).toHaveBeenCalledWith('join');
      expect(mockGasStorage.loadTemplateConfig).not.toHaveBeenCalled();
    });
  });

  describe('Angular DI Integration', () => {
    it('harus dapat diinjeksi via Angular DI / TestBed', async () => {
      const { TestBed } = await import('@angular/core/testing');
      TestBed.configureTestingModule({
        providers: [
          PeriodPartitionWorkspace,
          { provide: GasStorageService, useValue: mockGasStorage },
          {
            provide: BackendStorageService,
            useValue: { isConfigured: () => false },
          },
        ],
      });

      const injected = TestBed.inject(PeriodPartitionWorkspace);
      expect(injected).toBeInstanceOf(PeriodPartitionWorkspace);
      expect(injected.availableYears().length).toBeGreaterThan(0);
    });
  });
});
