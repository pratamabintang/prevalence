import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BackendStorageService } from './backend-storage.service';

describe('BackendStorageService (Seam 2 Frontend Client)', () => {
  let service: BackendStorageService;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    service = new BackendStorageService();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('harus dapat diinisialisasi dengan status koneksi awal false', () => {
    expect(service).toBeTruthy();
    expect(service.isConnected()).toBe(false);
    expect(service.lastPingTime()).toBeNull();
  });

  it('harus memvalidasi baseUrl dan memotong trailing slashes', () => {
    const url = service.getBaseUrl();
    expect(url).toBe('/api');
    expect(service.isConfigured()).toBe(true);
  });

  describe('pingServer()', () => {
    it('harus mengembalikan success true dan memperbarui isConnected saat status ok', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ok',
          uptime: 12.34,
          walMode: true,
          journalMode: 'wal',
          database: 'connected',
          timestamp: '2026-10-22T06:00:00.000Z',
        }),
      } as unknown as Response);

      const res = await service.pingServer();

      expect(res.success).toBe(true);
      expect(res.status).toBe('ok');
      expect(res.walMode).toBe(true);
      expect(service.isConnected()).toBe(true);
      expect(service.lastPingTime()).toBeTruthy();
    });

    it('harus menangani status HTTP 500 dan menandai isConnected false', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as unknown as Response);

      const res = await service.pingServer();

      expect(res.success).toBe(false);
      expect(res.error).toContain('500');
      expect(service.isConnected()).toBe(false);
    });

    it('harus menangani network error saat backend tidak dapat dijangkau', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      const res = await service.pingServer();

      expect(res.success).toBe(false);
      expect(res.error).toContain('Failed to fetch');
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('getDistricts()', () => {
    it('harus mengembalikan daftar wilayah saat pemanggilan /districts sukses', async () => {
      const mockDistricts = [
        { id: 1, code: '3301', name: 'Kab. Cilacap', type: 'KAB' },
        { id: 30, code: '3371', name: 'Kota Magelang', type: 'KOTA' },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          count: 2,
          data: mockDistricts,
        }),
      } as unknown as Response);

      const res = await service.getDistricts();

      expect(res.success).toBe(true);
      expect(res.count).toBe(2);
      expect(res.data.length).toBe(2);
      expect(res.data[0].name).toBe('Kab. Cilacap');
    });

    it('harus mengembalikan array kosong dan error saat terjadi kegagalan jaringan', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const res = await service.getDistricts();

      expect(res.success).toBe(false);
      expect(res.count).toBe(0);
      expect(res.data).toEqual([]);
      expect(res.error).toContain('Network error');
    });
  });

  describe('getConfig() & saveConfig()', () => {
    it('harus memuat konfigurasi preset yang tersimpan di server', async () => {
      const mockConfig = { viewMode: 'by-indicator' };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          hasConfig: true,
          config: mockConfig,
          updatedAt: '2026-10-22T06:00:00Z',
        }),
      } as unknown as Response);

      const res = await service.getConfig('chart');

      expect(res.success).toBe(true);
      expect(res.hasConfig).toBe(true);
      expect(res.config).toEqual(mockConfig);
    });

    it('harus menangani respon 404/empty dengan hasConfig false', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          hasConfig: false,
          config: null,
        }),
      } as unknown as Response);

      const res = await service.getConfig('join');

      expect(res.success).toBe(true);
      expect(res.hasConfig).toBe(false);
      expect(res.config).toBeNull();
    });

    it('harus menyimpan konfigurasi preset ke server melalui PUT', async () => {
      const payload = { test: 123 };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Saved',
          updatedAt: '2026-10-22T06:00:00Z',
        }),
      } as unknown as Response);

      const res = await service.saveConfig('join', payload);

      expect(res.success).toBe(true);
      expect(res.message).toBe('Saved');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/configs/join',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      );
    });
  });

  describe('listPeriods(), loadPeriod() & savePeriod()', () => {
    it('harus memanggil /api/periods dan mengembalikan daftar periode', async () => {
      const mockPeriods = [
        { year: 2026, quarter: 'TW1', hasRaw: true, hasResult: false, fileSize: 1024 },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          periods: mockPeriods,
        }),
      } as unknown as Response);

      const res = await service.listPeriods();

      expect(res.success).toBe(true);
      expect(res.periods.length).toBe(1);
      expect(res.periods[0].quarter).toBe('TW1');
    });

    it('harus memuat detail periode dan mengunduh berkas biner jika hasRaw true', async () => {
      const mockMeta = {
        hasData: true,
        year: 2026,
        quarter: 'TW1',
        hasRaw: true,
        hasResult: false,
        observationsCount: 35,
      };

      const dummyBinary = new Uint8Array([1, 2, 3]).buffer;

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/download/raw')) {
          return Promise.resolve({
            ok: true,
            blob: async () => new Blob([dummyBinary]),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockMeta,
        });
      });

      const res = await service.loadPeriod(2026, 'TW1');

      expect(res.success).toBe(true);
      expect(res.hasData).toBe(true);
      expect(res.rawExcelBuffer).toBeDefined();
    });

    it('harus mengirim multipart form data saat savePeriod dipanggil', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Saved',
          periodId: 1,
          year: 2026,
          quarter: 'TW1',
        }),
      } as unknown as Response);

      const res = await service.savePeriod({
        year: 2026,
        quarter: 'TW1',
        rawExcelBuffer: new Uint8Array([1, 2, 3]).buffer,
        observations: [{ districtCode: '3301', indicatorKey: 'stunting', numericValue: 10 }],
      });

      expect(res.success).toBe(true);
      expect(res.periodId).toBe(1);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/periods/2026/TW1',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
    });
  });

  describe('getAvailableIndicators() & getIndicatorTrends()', () => {
    it('harus memuat daftar indikator unik dari server', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          indicators: ['stunting_prev', 'anc_6x'],
        }),
      } as unknown as Response);

      const indicators = await service.getAvailableIndicators();

      expect(indicators).toEqual(['stunting_prev', 'anc_6x']);
    });

    it('harus mengeksekusi kueri analitik tren dan mengembalikan deret waktu', async () => {
      const mockTrends = {
        success: true,
        indicator: 'stunting_prev',
        scope: 'province',
        totalPeriods: 2,
        series: [
          { year: 2025, quarter: 'TW4', avgValue: 12.5 },
          { year: 2026, quarter: 'TW1', avgValue: 11.2 },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTrends,
      } as unknown as Response);

      const res = await service.getIndicatorTrends('stunting_prev');

      expect(res.success).toBe(true);
      expect(res.series.length).toBe(2);
      expect(res.series[0].avgValue).toBe(12.5);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/analytics/trends?indicator=stunting_prev',
        expect.any(Object)
      );
    });

    it('harus menyertakan parameter district saat kueri tren spesifik wilayah', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          indicator: 'stunting_prev',
          scope: 'district',
          districtCode: '3301',
          series: [],
        }),
      } as unknown as Response);

      await service.getIndicatorTrends('stunting_prev', '3301');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/analytics/trends?indicator=stunting_prev&district=3301',
        expect.any(Object)
      );
    });
  });

  describe('loadDefault(), saveDefault(), & resetDefault()', () => {
    it('harus memuat metadata dan berkas biner Default Kustom dari /api/default', async () => {
      const dummyExcel = new Uint8Array([80, 75, 1, 2]).buffer;
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === '/api/default') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              hasData: true,
              fileName: 'server-default.xlsx',
              config: { version: '1.0', name: 'Default Server', sheets: [] },
              updatedAt: '2026-10-23T08:00:00Z',
            }),
          });
        }
        if (url === '/api/default/download') {
          return Promise.resolve({
            ok: true,
            blob: async () => new Blob([dummyExcel]),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      const res = await service.loadDefault();
      expect(res.success).toBe(true);
      expect(res.hasData).toBe(true);
      expect(res.fileName).toBe('server-default.xlsx');
      expect(res.excelBuffer).toBeDefined();
      expect(res.config).toEqual({ version: '1.0', name: 'Default Server', sheets: [] });
    });

    it('harus mengirim multipart form data saat saveDefault dipanggil dan DELETE saat resetDefault dipanggil', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Saved default',
          updatedAt: '2026-10-23T09:00:00Z',
        }),
      } as unknown as Response);

      const saveRes = await service.saveDefault(
        new Uint8Array([1, 2, 3]).buffer,
        'custom.xlsx',
        { version: '1.0', sheets: [] },
      );
      expect(saveRes.success).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/default',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        }),
      );

      const resetRes = await service.resetDefault();
      expect(resetRes.success).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/default',
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });
});
