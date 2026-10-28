import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export type QuarterSlot = 'TW1' | 'TW2' | 'TW3' | 'TW4';

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

export interface GasTemplateConfigResult {
  success: boolean;
  hasConfig: boolean;
  config?: unknown;
  fileName?: string;
  updatedAt?: string;
  message?: string;
  error?: string;
}

export interface GasPingResult {
  success: boolean;
  message?: string;
  timestamp?: string;
  error?: string;
}

export interface GasPeriodItem {
  year: number;
  quarter: QuarterSlot;
  hasRaw: boolean;
  hasResult: boolean;
  hasConfig: boolean;
  rawFileName?: string;
  resultFileName?: string;
  updatedAt?: string;
  fileSize?: number;
}

export interface GasPeriodListResult {
  success: boolean;
  periods: GasPeriodItem[];
  message?: string;
  error?: string;
}

export interface GasPeriodLoadResult {
  success: boolean;
  hasData: boolean;
  year?: number;
  quarter?: QuarterSlot;
  fileName?: string;
  rawExcelBuffer?: ArrayBuffer;
  resultExcelBuffer?: ArrayBuffer;
  config?: unknown;
  resultExcelAvailable?: boolean;
  isResultExcel?: boolean;
  updatedAt?: string;
  fileSize?: number;
  message?: string;
  error?: string;
}

export interface GasPeriodSavePayload {
  year: number;
  quarter: QuarterSlot;
  rawExcelBuffer: ArrayBuffer;
  resultExcelBuffer?: ArrayBuffer;
  config?: unknown;
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
      return { success: false, error: 'URL server belum diisi.' };
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
        message: data.message || 'Koneksi ke server penyimpanan berhasil.',
        timestamp: data.timestamp,
        error: data.error,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Gagal terhubung ke server: ${msg}`,
      };
    }
  }

  /**
   * Mengambil daftar seluruh periode lintas triwulan yang tersimpan di Google Drive.
   */
  async listPeriods(customUrl?: string): Promise<GasPeriodListResult> {
    const url = (customUrl || this.getUrl()).trim();
    if (!url) {
      return {
        success: false,
        periods: [],
        message: 'URL server belum dikonfigurasi.',
      };
    }

    try {
      const queryUrl = url.includes('?') ? `${url}&action=listPeriods` : `${url}?action=listPeriods`;
      const res = await fetch(queryUrl, {
        method: 'GET',
        redirect: 'follow',
      });

      if (!res.ok) {
        return {
          success: false,
          periods: [],
          error: `HTTP error status ${res.status}: ${res.statusText}`,
        };
      }

      const data = await res.json();
      if (!data.success) {
        return {
          success: false,
          periods: [],
          error: data.error || 'Gagal mengambil daftar periode tersimpan.',
        };
      }

      return {
        success: true,
        periods: Array.isArray(data.periods) ? data.periods : [],
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        periods: [],
        error: `Koneksi server bermasalah: ${msg}`,
      };
    }
  }

  /**
   * Memuat file mentah, hasil join, dan konfigurasi dari periode triwulan tertentu di Google Drive.
   */
  async loadPeriod(
    year: number,
    quarter: QuarterSlot,
    optionsOrCustomUrl?: { preferResult?: boolean; customUrl?: string } | string
  ): Promise<GasPeriodLoadResult> {
    const customUrl = typeof optionsOrCustomUrl === 'string' ? optionsOrCustomUrl : optionsOrCustomUrl?.customUrl;
    const preferResult = typeof optionsOrCustomUrl === 'object' ? !!optionsOrCustomUrl?.preferResult : false;

    const url = (customUrl || this.getUrl()).trim();
    if (!url) {
      return {
        success: false,
        hasData: false,
        message: 'URL server belum dikonfigurasi.',
      };
    }

    try {
      let params = `action=loadPeriod&year=${encodeURIComponent(year)}&quarter=${encodeURIComponent(quarter)}`;
      if (preferResult) {
        params += `&preferResult=true`;
      }
      const queryUrl = url.includes('?') ? `${url}&${params}` : `${url}?${params}`;
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
          error: data.error || `Gagal memuat periode ${year} ${quarter}.`,
        };
      }

      if (!data.hasData || (!data.excelBase64 && !data.rawExcelBase64 && !data.resultExcelBase64)) {
        return {
          success: true,
          hasData: false,
          year,
          quarter,
          message: data.message || `Belum ada data tersimpan untuk periode ${year} ${quarter}.`,
        };
      }

      let rawExcelBuffer: ArrayBuffer | undefined = undefined;
      let resultExcelBuffer: ArrayBuffer | undefined = undefined;

      if (data.resultExcelBase64) {
        resultExcelBuffer = base64ToArrayBuffer(data.resultExcelBase64);
      }
      if (data.rawExcelBase64) {
        rawExcelBuffer = base64ToArrayBuffer(data.rawExcelBase64);
      }
      if (data.excelBase64) {
        const primaryBuf = base64ToArrayBuffer(data.excelBase64);
        if (data.isResultExcel) {
          resultExcelBuffer = resultExcelBuffer || primaryBuf;
        } else {
          rawExcelBuffer = rawExcelBuffer || primaryBuf;
        }
      }

      return {
        success: true,
        hasData: true,
        year: data.year || year,
        quarter: data.quarter || quarter,
        fileName: data.fileName || (data.isResultExcel ? 'joined-result.xlsx' : 'raw-data.xlsx'),
        rawExcelBuffer,
        resultExcelBuffer,
        config: data.config,
        resultExcelAvailable: !!data.resultExcelAvailable,
        isResultExcel: !!data.isResultExcel,
        fileSize: data.fileSize,
        updatedAt: data.updatedAt,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        hasData: false,
        error: `Koneksi server bermasalah: ${msg}`,
      };
    }
  }

  /**
   * Menyimpan berkas mentah dan berkas hasil penggabungan periode ke Google Drive.
   */
  async savePeriod(
    payload: GasPeriodSavePayload,
    customUrl?: string
  ): Promise<GasSaveResult> {
    const url = (customUrl || this.getUrl()).trim();
    if (!url) {
      return {
        success: false,
        error: 'URL server belum dikonfigurasi.',
      };
    }

    if (!payload.rawExcelBuffer || payload.rawExcelBuffer.byteLength === 0) {
      return {
        success: false,
        error: 'Data file mentah Excel kosong (0 byte).',
      };
    }

    try {
      const rawExcelBase64 = arrayBufferToBase64(payload.rawExcelBuffer);
      let resultExcelBase64: string | undefined = undefined;
      if (payload.resultExcelBuffer && payload.resultExcelBuffer.byteLength > 0) {
        resultExcelBase64 = arrayBufferToBase64(payload.resultExcelBuffer);
      }

      const requestBody = {
        action: 'savePeriod',
        year: payload.year,
        quarter: payload.quarter,
        rawExcelBase64,
        resultExcelBase64,
        config: payload.config,
      };

      // Gunakan text/plain untuk melewati CORS preflight OPTIONS pada backend/GAS
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(requestBody),
        redirect: 'follow',
      });

      if (!res.ok) {
        return {
          success: false,
          error: `Gagal mengunggah ke penyimpanan (status ${res.status}: ${res.statusText})`,
        };
      }

      const data = await res.json();
      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Server melaporkan kegagalan penyimpanan periode.',
        };
      }

      return {
        success: true,
        message: data.message || `Berhasil menyimpan data periode ${payload.year} ${payload.quarter}.`,
        updatedAt: data.updatedAt,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Gagal mengirim data periode ke server: ${msg}`,
      };
    }
  }

  /**
   * Memuat file Excel default dan konfigurasi join dari Google Drive (legacy).
   */
  async loadDefault(): Promise<GasLoadResult> {
    const url = this.getUrl();
    if (!url) {
      return {
        success: false,
        hasData: false,
        message: 'URL server belum dikonfigurasi.',
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
          error: data.error || 'Gagal memuat data tersimpan.',
        };
      }

      if (!data.hasData || !data.excelBase64) {
        return {
          success: true,
          hasData: false,
          message: data.message || 'Belum ada data default tersimpan.',
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
        error: `Koneksi server bermasalah: ${msg}`,
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
        error: 'URL server belum dikonfigurasi.',
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
          error: `Gagal mengunggah ke server (status ${res.status}: ${res.statusText})`,
        };
      }

      const data = await res.json();
      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Server melaporkan kegagalan penyimpanan.',
        };
      }

      return {
        success: true,
        message: data.message || 'Berhasil menyimpan default.',
        updatedAt: data.updatedAt,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Gagal mengirim data ke server: ${msg}`,
      };
    }
  }

  /**
   * Menghapus default kustom (reset ke bawaan sistem).
   */
  async resetDefault(): Promise<GasSaveResult> {
    const url = this.getUrl();
    if (!url) {
      return {
        success: false,
        error: 'URL server belum dikonfigurasi.',
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
          error: `Gagal reset di server (status ${res.status}: ${res.statusText})`,
        };
      }

      const data = await res.json();
      return {
        success: !!data.success,
        message: data.message || 'Default kustom berhasil dihapus.',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Gagal mengirim permintaan reset ke server: ${msg}`,
      };
    }
  }

  /**
   * Mengambil template konfigurasi join terbaru dari Google Drive.
   * Jika backend GAS belum mendukung loadTemplateConfig (misal deployment lama),
   * secara otomatis fallback ke loadDefault() untuk mengekstrak file konfigurasi.
   */
  async loadTemplateConfig(customUrl?: string): Promise<GasTemplateConfigResult> {
    const url = (customUrl || this.getUrl()).trim();
    if (!url) {
      return {
        success: false,
        hasConfig: false,
        message: 'URL server belum dikonfigurasi.',
      };
    }

    try {
      const queryUrl = url.includes('?') ? `${url}&action=loadTemplateConfig` : `${url}?action=loadTemplateConfig`;
      const res = await fetch(queryUrl, {
        method: 'GET',
        redirect: 'follow',
      });

      if (!res.ok) {
        return {
          success: false,
          hasConfig: false,
          error: `HTTP error status ${res.status}: ${res.statusText}`,
        };
      }

      const data = await res.json();
      if (!data.success) {
        // Fallback untuk GAS versi lama yang belum mengenal loadTemplateConfig
        if (data.error && data.error.includes('Aksi GET tidak dikenali')) {
          const defaultRes = await this.loadDefault();
          if (defaultRes.success && defaultRes.config) {
            return {
              success: true,
              hasConfig: true,
              config: defaultRes.config,
              fileName: 'default-join-config.json',
              updatedAt: defaultRes.updatedAt,
            };
          }
        }
        return {
          success: false,
          hasConfig: false,
          error: data.error || 'Gagal memuat template konfigurasi.',
        };
      }

      return {
        success: true,
        hasConfig: !!data.hasConfig,
        config: data.config,
        fileName: data.fileName,
        updatedAt: data.updatedAt,
        message: data.message,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        hasConfig: false,
        error: `Koneksi server bermasalah: ${msg}`,
      };
    }
  }

  /**
   * Menyimpan template konfigurasi join murni.
   */
  async saveTemplateConfig(
    config: unknown,
    customUrl?: string
  ): Promise<GasSaveResult> {
    const url = (customUrl || this.getUrl()).trim();
    if (!url) {
      return {
        success: false,
        error: 'URL server belum dikonfigurasi.',
      };
    }

    if (!config) {
      return {
        success: false,
        error: 'Konfigurasi template kosong.',
      };
    }

    try {
      const payload = {
        action: 'saveTemplateConfig',
        config,
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
          error: `Gagal menyimpan template ke server (status ${res.status}: ${res.statusText})`,
        };
      }

      const data = await res.json();
      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Server melaporkan kegagalan penyimpanan template konfigurasi.',
        };
      }

      return {
        success: true,
        message: data.message || 'Berhasil menyimpan template konfigurasi.',
        updatedAt: data.updatedAt,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Gagal mengirim template konfigurasi ke server: ${msg}`,
      };
    }
  }
}
