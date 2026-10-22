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
});
