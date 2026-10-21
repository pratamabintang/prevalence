import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  GasStorageService,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from './gas-storage.service';
import { environment } from '../../../environments/environment';

describe('GasStorageService', () => {
  let service: GasStorageService;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    environment.googleAppsScriptUrl = '';
    service = new GasStorageService();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    environment.googleAppsScriptUrl = '';
    vi.restoreAllMocks();
  });

  describe('Base64 Conversion Utilities', () => {
    it('harus dapat mengonversi ArrayBuffer ke base64 dan kembali dengan presisi penuh', () => {
      const originalText = 'Dinas Kesehatan Kota/Kabupaten Data Test 12345!@#$%';
      const encoder = new TextEncoder();
      const buffer = encoder.encode(originalText).buffer;

      const base64 = arrayBufferToBase64(buffer);
      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(0);

      const reconstructedBuffer = base64ToArrayBuffer(base64);
      const decoder = new TextDecoder();
      const reconstructedText = decoder.decode(reconstructedBuffer);

      expect(reconstructedText).toBe(originalText);
    });

    it('dapat menangani buffer kosong dengan benar', () => {
      const emptyBuffer = new ArrayBuffer(0);
      const base64 = arrayBufferToBase64(emptyBuffer);
      expect(base64).toBe('');

      const restored = base64ToArrayBuffer('');
      expect(restored.byteLength).toBe(0);
    });
  });

  describe('URL Configuration Management', () => {
    it('mengembalikan URL terpusat dari environment', () => {
      environment.googleAppsScriptUrl = 'https://script.google.com/macros/s/TEST/exec';
      expect(service.getUrl()).toBe('https://script.google.com/macros/s/TEST/exec');
      expect(service.isConfigured()).toBe(true);
    });

    it('mengetahui kapan URL belum dikonfigurasi', () => {
      environment.googleAppsScriptUrl = '';
      expect(service.isConfigured()).toBe(false);
      expect(service.getUrl()).toBe('');
    });
  });

  describe('API Calls (Ping, Load, Save, Reset)', () => {
    it('ping mengembalikan error jika URL belum diisi', async () => {
      environment.googleAppsScriptUrl = '';
      const res = await service.ping('');
      expect(res.success).toBe(false);
      expect(res.error).toContain('belum diisi');
    });

    it('ping berhasil saat server merespon sukses', async () => {
      environment.googleAppsScriptUrl = 'https://script.google.com/macros/s/MOCK/exec';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: 'Ready' }),
      });
      globalThis.fetch = mockFetch;

      const res = await service.ping();
      expect(res.success).toBe(true);
      expect(res.message).toBe('Ready');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://script.google.com/macros/s/MOCK/exec?action=ping',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('loadDefault mengembalikan status belum dikonfigurasi jika URL kosong', async () => {
      environment.googleAppsScriptUrl = '';
      const res = await service.loadDefault();
      expect(res.success).toBe(false);
      expect(res.hasData).toBe(false);
      expect(res.message).toContain('belum dikonfigurasi');
    });

    it('loadDefault berhasil membaca data dari Google Drive', async () => {
      environment.googleAppsScriptUrl = 'https://script.google.com/macros/s/MOCK/exec';
      const testBuffer = new TextEncoder().encode('excel-content').buffer;
      const b64 = arrayBufferToBase64(testBuffer);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          hasData: true,
          fileName: 'default-custom.xlsx',
          excelBase64: b64,
          config: { version: '1.0', sheets: [] },
          updatedAt: '2026-10-12T00:00:00Z',
        }),
      });

      const res = await service.loadDefault();
      expect(res.success).toBe(true);
      expect(res.hasData).toBe(true);
      expect(res.fileName).toBe('default-custom.xlsx');
      expect(res.excelBuffer?.byteLength).toBe(testBuffer.byteLength);
      expect(res.config).toEqual({ version: '1.0', sheets: [] });
    });

    it('loadDefault menangani kasus di mana Google Drive belum memiliki data', async () => {
      environment.googleAppsScriptUrl = 'https://script.google.com/macros/s/MOCK/exec';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          hasData: false,
          message: 'Belum ada data default',
        }),
      });

      const res = await service.loadDefault();
      expect(res.success).toBe(true);
      expect(res.hasData).toBe(false);
      expect(res.message).toBe('Belum ada data default');
    });

    it('saveDefault mengirimkan payload ke Google Apps Script dengan text/plain', async () => {
      environment.googleAppsScriptUrl = 'https://script.google.com/macros/s/MOCK/exec';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Berhasil menyimpan',
          updatedAt: '2026-10-12T00:00:00Z',
        }),
      });
      globalThis.fetch = mockFetch;

      const dummyBuffer = new ArrayBuffer(8);
      const res = await service.saveDefault(dummyBuffer, 'test.xlsx', { version: '1.0' });

      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://script.google.com/macros/s/MOCK/exec',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        })
      );
    });

    it('saveDefault menolak buffer kosong (0 byte) dengan pesan error jelas', async () => {
      environment.googleAppsScriptUrl = 'https://script.google.com/macros/s/MOCK/exec';
      const emptyBuffer = new ArrayBuffer(0);
      const res = await service.saveDefault(emptyBuffer, 'test.xlsx', { version: '1.0' });

      expect(res.success).toBe(false);
      expect(res.error).toContain('kosong');
    });

    it('resetDefault mengirim permintaan reset ke GAS', async () => {
      environment.googleAppsScriptUrl = 'https://script.google.com/macros/s/MOCK/exec';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: 'Direset' }),
      });
      globalThis.fetch = mockFetch;

      const res = await service.resetDefault();
      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://script.google.com/macros/s/MOCK/exec',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        })
      );
    });
  });

  describe('Multi-Quarter Period Storage API', () => {
    it('listPeriods mengembalikan error jika URL belum dikonfigurasi', async () => {
      environment.googleAppsScriptUrl = '';
      const res = await service.listPeriods();
      expect(res.success).toBe(false);
      expect(res.periods).toEqual([]);
      expect(res.message).toContain('belum dikonfigurasi');
    });

    it('listPeriods berhasil mengambil daftar slot periode dari Google Drive', async () => {
      environment.googleAppsScriptUrl = 'https://script.google.com/macros/s/MOCK/exec';
      const mockPeriods = [
        {
          year: 2026,
          quarter: 'TW1',
          hasRaw: true,
          hasResult: true,
          hasConfig: true,
          rawFileName: 'raw-data.xlsx',
          resultFileName: 'joined-result.xlsx',
          updatedAt: '2026-03-31T00:00:00Z',
          fileSize: 4096,
        },
      ];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, periods: mockPeriods }),
      });

      const res = await service.listPeriods();
      expect(res.success).toBe(true);
      expect(res.periods).toHaveLength(1);
      expect(res.periods[0].quarter).toBe('TW1');
      expect(res.periods[0].year).toBe(2026);
    });

    it('loadPeriod mengembalikan hasData false jika data belum ada di slot', async () => {
      environment.googleAppsScriptUrl = 'https://script.google.com/macros/s/MOCK/exec';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          hasData: false,
          message: 'Belum ada data untuk periode 2025 TW2',
        }),
      });

      const res = await service.loadPeriod(2025, 'TW2');
      expect(res.success).toBe(true);
      expect(res.hasData).toBe(false);
      expect(res.message).toContain('2025 TW2');
    });

    it('loadPeriod berhasil membaca raw-data.xlsx dan konfigurasi dari Google Drive', async () => {
      environment.googleAppsScriptUrl = 'https://script.google.com/macros/s/MOCK/exec';
      const rawBytes = new TextEncoder().encode('raw-excel-binary').buffer;
      const b64 = arrayBufferToBase64(rawBytes);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          hasData: true,
          year: 2026,
          quarter: 'TW1',
          fileName: 'raw-data.xlsx',
          excelBase64: b64,
          config: { joinBy: 'KABUPATEN' },
          resultExcelAvailable: true,
          updatedAt: '2026-03-31T12:00:00Z',
        }),
      });

      const res = await service.loadPeriod(2026, 'TW1');
      expect(res.success).toBe(true);
      expect(res.hasData).toBe(true);
      expect(res.year).toBe(2026);
      expect(res.quarter).toBe('TW1');
      expect(res.rawExcelBuffer?.byteLength).toBe(rawBytes.byteLength);
      expect(res.config).toEqual({ joinBy: 'KABUPATEN' });
      expect(res.resultExcelAvailable).toBe(true);
    });

    it('savePeriod menolak jika rawExcelBuffer kosong (0 byte)', async () => {
      environment.googleAppsScriptUrl = 'https://script.google.com/macros/s/MOCK/exec';
      const res = await service.savePeriod({
        year: 2026,
        quarter: 'TW1',
        rawExcelBuffer: new ArrayBuffer(0),
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('kosong');
    });

    it('savePeriod mengirim payload lengkap (raw, result, config) ke GAS', async () => {
      environment.googleAppsScriptUrl = 'https://script.google.com/macros/s/MOCK/exec';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Data periode 2026 TW1 berhasil disimpan',
          updatedAt: '2026-03-31T12:00:00Z',
        }),
      });
      globalThis.fetch = mockFetch;

      const rawBuffer = new TextEncoder().encode('dummy-raw').buffer;
      const resultBuffer = new TextEncoder().encode('dummy-result').buffer;

      const res = await service.savePeriod({
        year: 2026,
        quarter: 'TW1',
        rawExcelBuffer: rawBuffer,
        resultExcelBuffer: resultBuffer,
        config: { joinBy: 'KABUPATEN' },
      });

      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://script.google.com/macros/s/MOCK/exec',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        })
      );

      // Verify payload passed in body
      const passedCall = mockFetch.mock.calls[0];
      const parsedBody = JSON.parse(passedCall[1].body);
      expect(parsedBody.action).toBe('savePeriod');
      expect(parsedBody.year).toBe(2026);
      expect(parsedBody.quarter).toBe('TW1');
      expect(parsedBody.rawExcelBase64).toBeTruthy();
      expect(parsedBody.resultExcelBase64).toBeTruthy();
      expect(parsedBody.config).toEqual({ joinBy: 'KABUPATEN' });
    });
  });

  describe('Template Configuration (loadTemplateConfig & saveTemplateConfig)', () => {
    it('loadTemplateConfig mengembalikan status belum dikonfigurasi jika URL kosong', async () => {
      environment.googleAppsScriptUrl = '';
      const res = await service.loadTemplateConfig();
      expect(res.success).toBe(false);
      expect(res.hasConfig).toBe(false);
      expect(res.message).toContain('belum dikonfigurasi');
    });

    it('loadTemplateConfig memuat template konfigurasi dari Google Drive dengan sukses', async () => {
      environment.googleAppsScriptUrl = 'https://script.google.com/macros/s/MOCK/exec';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          hasConfig: true,
          config: { joinBy: 'Kabupaten/Kota', sheets: [] },
          fileName: 'template-config.json',
          updatedAt: '2026-10-20T10:00:00Z',
        }),
      });
      globalThis.fetch = mockFetch;

      const res = await service.loadTemplateConfig();
      expect(res.success).toBe(true);
      expect(res.hasConfig).toBe(true);
      expect(res.config).toEqual({ joinBy: 'Kabupaten/Kota', sheets: [] });
      expect(res.fileName).toBe('template-config.json');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://script.google.com/macros/s/MOCK/exec?action=loadTemplateConfig',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('loadTemplateConfig otomatis fallback ke loadDefault jika GAS versi lama belum mendukung action loadTemplateConfig', async () => {
      environment.googleAppsScriptUrl = 'https://script.google.com/macros/s/MOCK/exec';
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: false,
            error: 'Aksi GET tidak dikenali: loadTemplateConfig',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            hasData: true,
            excelBase64: 'ZHVtbXk=',
            config: { joinBy: 'FallbackKab', sheets: [] },
            updatedAt: '2026-10-19T08:00:00Z',
          }),
        });
      globalThis.fetch = mockFetch;

      const res = await service.loadTemplateConfig();
      expect(res.success).toBe(true);
      expect(res.hasConfig).toBe(true);
      expect(res.config).toEqual({ joinBy: 'FallbackKab', sheets: [] });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('saveTemplateConfig menyimpan template ke Google Drive dengan sukses', async () => {
      environment.googleAppsScriptUrl = 'https://script.google.com/macros/s/MOCK/exec';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Template konfigurasi berhasil disimpan',
          updatedAt: '2026-10-20T11:00:00Z',
        }),
      });
      globalThis.fetch = mockFetch;

      const res = await service.saveTemplateConfig({ joinBy: 'Kabupaten/Kota' });
      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://script.google.com/macros/s/MOCK/exec',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const parsedBody = JSON.parse(callArgs[1].body);
      expect(parsedBody.action).toBe('saveTemplateConfig');
      expect(parsedBody.config).toEqual({ joinBy: 'Kabupaten/Kota' });
    });
  });
});
