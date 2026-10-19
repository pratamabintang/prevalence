import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface GasLoadResult {
  success: boolean;
  hasData: boolean;
  fileName?: string;
  excelBuffer?: ArrayBuffer;
  config?: unknown;
  updatedAt?: string;
  message?: string;
  error?: string;
}

export interface GasSaveResult {
  success: boolean;
  message?: string;
  updatedAt?: string;
  error?: string;
}

export interface GasPingResult {
  success: boolean;
  message?: string;
  timestamp?: string;
  error?: string;
}

/**
 * Mengubah ArrayBuffer menjadi base64 string dengan chunking aman.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Mengubah base64 string kembali menjadi ArrayBuffer.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

@Injectable({
  providedIn: 'root',
})
export class GasStorageService {
  /**
   * Mengambil URL Google Apps Script Web App yang aktif.
   * Terpusat langsung dari environment repositori utama.
   */
  getUrl(): string {
    return (environment.googleAppsScriptUrl || '').trim();
  }

  /**
   * Mengecek apakah URL GAS sudah dikonfigurasi di repositori utama.
   */
  isConfigured(): boolean {
    return this.getUrl().length > 0;
  }

  /**
   * Uji konektivitas ke Google Apps Script Web App.
   */
  async ping(customUrl?: string): Promise<GasPingResult> {
    const url = (customUrl || this.getUrl()).trim();
    if (!url) {
      return { success: false, error: 'URL Google Apps Script belum diisi.' };
    }

    try {
      const queryUrl = url.includes('?') ? `${url}&action=ping` : `${url}?action=ping`;
      const res = await fetch(queryUrl, {
        method: 'GET',
        redirect: 'follow',
      });

      if (!res.ok) {
        return {
          success: false,
          error: `Server merespon dengan status ${res.status}: ${res.statusText}`,
        };
      }

      const data = await res.json();
      return {
        success: !!data.success,
        message: data.message || 'Koneksi ke Google Apps Script berhasil.',
        timestamp: data.timestamp,
        error: data.error,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Gagal terhubung ke Google Apps Script: ${msg}`,
      };
    }
  }

  /**
   * Memuat file Excel default dan konfigurasi join dari Google Drive.
   */
  async loadDefault(): Promise<GasLoadResult> {
    const url = this.getUrl();
    if (!url) {
      return {
        success: false,
        hasData: false,
        message: 'URL Google Apps Script belum dikonfigurasi.',
      };
    }

    try {
      const queryUrl = url.includes('?') ? `${url}&action=loadDefault` : `${url}?action=loadDefault`;
      const res = await fetch(queryUrl, {
        method: 'GET',
        redirect: 'follow',
      });

      if (!res.ok) {
        return {
          success: false,
          hasData: false,
          error: `HTTP error status ${res.status}: ${res.statusText}`,
        };
      }

      const data = await res.json();
      if (!data.success) {
        return {
          success: false,
          hasData: false,
          error: data.error || 'Gagal memuat data dari Google Drive.',
        };
      }

      if (!data.hasData || !data.excelBase64) {
        return {
          success: true,
          hasData: false,
          message: data.message || 'Belum ada data default di Google Drive.',
        };
      }

      const excelBuffer = base64ToArrayBuffer(data.excelBase64);
      return {
        success: true,
        hasData: true,
        fileName: data.fileName || 'default-join-data.xlsx',
        excelBuffer,
        config: data.config,
        updatedAt: data.updatedAt,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        hasData: false,
        error: `Koneksi Google Apps Script bermasalah: ${msg}`,
      };
    }
  }

  /**
   * Menyimpan file Excel dan konfigurasi ke Google Drive (menimpa default lama).
   */
  async saveDefault(
    excelBuffer: ArrayBuffer,
    fileName: string,
    config: unknown
  ): Promise<GasSaveResult> {
    const url = this.getUrl();
    if (!url) {
      return {
        success: false,
        error: 'URL Google Apps Script belum dikonfigurasi.',
      };
    }

    if (!excelBuffer || excelBuffer.byteLength === 0) {
      return {
        success: false,
        error: 'Data file Excel kosong (0 byte). Field excelBase64 wajib diisi.',
      };
    }

    try {
      const excelBase64 = arrayBufferToBase64(excelBuffer);
      if (!excelBase64) {
        return {
          success: false,
          error: 'Gagal mengonversi file Excel ke base64 (hasil konversi kosong).',
        };
      }
      const payload = {
        action: 'saveDefault',
        fileName,
        excelBase64,
        config,
      };

      // Menggunakan text/plain agar browser tidak mengirimkan preflight OPTIONS yang diblokir oleh GAS
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
        redirect: 'follow',
      });

      if (!res.ok) {
        return {
          success: false,
          error: `Gagal mengunggah ke Google Drive (status ${res.status}: ${res.statusText})`,
        };
      }

      const data = await res.json();
      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Google Apps Script melaporkan kegagalan penyimpanan.',
        };
      }

      return {
        success: true,
        message: data.message || 'Berhasil menyimpan default ke Google Drive.',
        updatedAt: data.updatedAt,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      let hint = '';
      if (msg.includes('Failed to fetch')) {
        hint = ' (Periksa: 1. Hak akses deployment wajib "Anyone", 2. URL wajib berakhiran /exec, 3. Fungsi testAuthorizeDrive sudah dijalankan untuk izin Drive)';
      }
      return {
        success: false,
        error: `Gagal mengirim data ke Google Apps Script: ${msg}${hint}`,
      };
    }
  }

  /**
   * Menghapus default kustom dari Google Drive (reset ke bawaan sistem).
   */
  async resetDefault(): Promise<GasSaveResult> {
    const url = this.getUrl();
    if (!url) {
      return {
        success: false,
        error: 'URL Google Apps Script belum dikonfigurasi.',
      };
    }

    try {
      const payload = {
        action: 'resetDefault',
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
        redirect: 'follow',
      });

      if (!res.ok) {
        return {
          success: false,
          error: `Gagal reset di Google Drive (status ${res.status}: ${res.statusText})`,
        };
      }

      const data = await res.json();
      return {
        success: !!data.success,
        message: data.message || 'Default kustom di Google Drive berhasil dihapus.',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Gagal mengirim permintaan reset ke Google Apps Script: ${msg}`,
      };
    }
  }
}
