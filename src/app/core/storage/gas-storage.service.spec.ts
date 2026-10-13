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
    localStorage.clear();
    environment.googleAppsScriptUrl = '';
    service = new GasStorageService();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
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
});
