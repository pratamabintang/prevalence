import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

export type QuarterSlot = 'TW1' | 'TW2' | 'TW3' | 'TW4';

export interface BackendPingResult {
  success: boolean;
  status?: string;
  walMode?: boolean;
  journalMode?: string;
  uptime?: number;
  timestamp?: string;
  database?: string;
  error?: string;
}

export interface BackendDistrictItem {
  id: number;
  code: string;
  name: string;
  type: 'KAB' | 'KOTA';
}

export interface BackendDistrictsResult {
  success: boolean;
  count: number;
  data: BackendDistrictItem[];
  error?: string;
}

export type StorageConfigType = 'join' | 'chart' | 'stunting';

export interface BackendConfigLoadResult {
  success: boolean;
  hasConfig: boolean;
  config?: unknown;
  updatedAt?: string;
  error?: string;
}

export interface BackendConfigSaveResult {
  success: boolean;
  message?: string;
  updatedAt?: string;
  error?: string;
}

export interface BackendPeriodItem {
  id?: number;
  year: number;
  quarter: QuarterSlot;
  hasRaw: boolean;
  hasResult: boolean;
  rawFileName?: string;
  resultFileName?: string;
  fileSize?: number;
  updatedAt?: string;
}

export interface BackendPeriodListResult {
  success: boolean;
  periods: BackendPeriodItem[];
  message?: string;
  error?: string;
}

export interface BackendPeriodLoadResult {
  success: boolean;
  hasData: boolean;
  year?: number;
  quarter?: QuarterSlot;
  status?: string;
  updatedAt?: string;
  hasRaw?: boolean;
  hasResult?: boolean;
  rawExcelBuffer?: ArrayBuffer;
  resultExcelBuffer?: ArrayBuffer;
  config?: unknown;
  observationsCount?: number;
  observations?: unknown[];
  message?: string;
  error?: string;
}

export interface BackendPeriodSavePayload {
  year: number;
  quarter: QuarterSlot;
  rawExcelBuffer?: ArrayBuffer;
  resultExcelBuffer?: ArrayBuffer;
  rawFileName?: string;
  resultFileName?: string;
  config?: unknown;
  observations?: unknown[];
}

export interface BackendPeriodSaveResult {
  success: boolean;
  message?: string;
  periodId?: number;
  year?: number;
  quarter?: QuarterSlot;
  updatedAt?: string;
  error?: string;
}

export interface BackendTrendPoint {
  year: number;
  quarter: string;
  count: number;
  avgValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  districtCode?: string;
  districtName?: string;
  displayText?: string;
}

export interface BackendTrendsResult {
  success: boolean;
  indicator: string;
  scope: 'province' | 'district';
  districtCode?: string;
  districtName?: string;
  totalPeriods: number;
  series: BackendTrendPoint[];
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class BackendStorageService {
  /**
   * Signal status ketersediaan koneksi server backend.
   */
  readonly isConnected = signal<boolean>(false);

  /**
   * Signal timestamp pemeriksaan terakhir.
   */
  readonly lastPingTime = signal<string | null>(null);

  /**
   * Mengambil basis URL API backend yang aktif.
   */
  getBaseUrl(): string {
    const raw = (environment as unknown as { backendApiUrl?: string }).backendApiUrl;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim().replace(/\/+$/, '');
    }
    return '/api';
  }

  /**
   * Mengecek apakah endpoint backend API dikonfigurasi.
   */
  isConfigured(): boolean {
    return this.getBaseUrl().length > 0;
  }

  /**
   * Melakukan pemeriksaan status server (Health Check) ke endpoint /api/health.
   */
  async pingServer(): Promise<BackendPingResult> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      this.isConnected.set(false);
      return { success: false, error: 'Backend API URL belum dikonfigurasi.' };
    }

    try {
      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        this.isConnected.set(false);
        return {
          success: false,
          error: `Server mengembalikan status HTTP ${response.status}`,
        };
      }

      const json = await response.json();
      const isOk = json.status === 'ok';
      this.isConnected.set(isOk);
      this.lastPingTime.set(new Date().toISOString());

      return {
        success: isOk,
        status: json.status,
        walMode: json.walMode,
        journalMode: json.journalMode,
        uptime: json.uptime,
        timestamp: json.timestamp,
        database: json.database,
      };
    } catch (err: unknown) {
      this.isConnected.set(false);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Koneksi ke backend server gagal.',
      };
    }
  }

  /**
   * Mengambil daftar master 35 Kabupaten/Kota Jawa Tengah dari SQLite.
   */
  async getDistricts(): Promise<BackendDistrictsResult> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return { success: false, count: 0, data: [], error: 'Backend API URL belum dikonfigurasi.' };
    }

    try {
      const response = await fetch(`${baseUrl}/districts`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        return {
          success: false,
          count: 0,
          data: [],
          error: `Server mengembalikan status HTTP ${response.status}`,
        };
      }

      const json = await response.json();
      return {
        success: !!json.success,
        count: json.count || (json.data ? json.data.length : 0),
        data: json.data || [],
      };
    } catch (err: unknown) {
      return {
        success: false,
        count: 0,
        data: [],
        error: err instanceof Error ? err.message : 'Gagal mengambil data wilayah.',
      };
    }
  }

  /**
   * Mengambil konfigurasi preset terpusat dari server SQLite.
   */
  async getConfig(type: StorageConfigType): Promise<BackendConfigLoadResult> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return { success: false, hasConfig: false, error: 'Backend API URL belum dikonfigurasi.' };
    }

    try {
      const response = await fetch(`${baseUrl}/configs/${type}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        return {
          success: false,
          hasConfig: false,
          error: `Server mengembalikan status HTTP ${response.status}`,
        };
      }

      const json = await response.json();
      return {
        success: !!json.success,
        hasConfig: !!json.hasConfig,
        config: json.config,
        updatedAt: json.updatedAt,
      };
    } catch (err: unknown) {
      return {
        success: false,
        hasConfig: false,
        error: err instanceof Error ? err.message : 'Gagal memuat konfigurasi preset.',
      };
    }
  }

  /**
   * Menyimpan konfigurasi preset terpusat ke server SQLite.
   */
  async saveConfig(type: StorageConfigType, config: unknown): Promise<BackendConfigSaveResult> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return { success: false, error: 'Backend API URL belum dikonfigurasi.' };
    }

    try {
      const response = await fetch(`${baseUrl}/configs/${type}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Server mengembalikan status HTTP ${response.status}`,
        };
      }

      const json = await response.json();
      return {
        success: !!json.success,
        message: json.message,
        updatedAt: json.updatedAt,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi preset.',
      };
    }
  }

  /**
   * Mengambil daftar seluruh periode yang telah tersimpan di server.
   */
  async listPeriods(): Promise<BackendPeriodListResult> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return { success: false, periods: [], error: 'Backend API URL belum dikonfigurasi.' };
    }

    try {
      const response = await fetch(`${baseUrl}/periods`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        return {
          success: false,
          periods: [],
          error: `Server mengembalikan status HTTP ${response.status}`,
        };
      }

      const json = await response.json();
      return {
        success: !!json.success,
        periods: (json.periods || []) as BackendPeriodItem[],
      };
    } catch (err: unknown) {
      return {
        success: false,
        periods: [],
        error: err instanceof Error ? err.message : 'Gagal mengambil daftar periode.',
      };
    }
  }

  /**
   * Memuat detail periode beserta berkas biner dan baris observasi.
   */
  async loadPeriod(year: number, quarter: QuarterSlot): Promise<BackendPeriodLoadResult> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return { success: false, hasData: false, error: 'Backend API URL belum dikonfigurasi.' };
    }

    try {
      const metaRes = await fetch(`${baseUrl}/periods/${year}/${quarter}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!metaRes.ok) {
        return {
          success: false,
          hasData: false,
          error: `Server mengembalikan status HTTP ${metaRes.status}`,
        };
      }

      const meta = await metaRes.json();
      if (!meta.hasData) {
        return {
          success: true,
          hasData: false,
          year,
          quarter,
          message: meta.message || 'Periode belum memiliki data.',
        };
      }

      let rawExcelBuffer: ArrayBuffer | undefined = undefined;
      let resultExcelBuffer: ArrayBuffer | undefined = undefined;

      // Unduh berkas fisik biner jika tersedia
      if (meta.hasRaw) {
        try {
          const rawBlob = await this.downloadPeriodFile(year, quarter, 'raw');
          if (rawBlob) {
            rawExcelBuffer = await rawBlob.arrayBuffer();
          }
        } catch {
          // Abaikan jika berkas fisik gagal diunduh
        }
      }

      if (meta.hasResult) {
        try {
          const resBlob = await this.downloadPeriodFile(year, quarter, 'result');
          if (resBlob) {
            resultExcelBuffer = await resBlob.arrayBuffer();
          }
        } catch {
          // Abaikan
        }
      }

      return {
        success: true,
        hasData: true,
        year: meta.year,
        quarter: meta.quarter,
        status: meta.status,
        updatedAt: meta.updatedAt,
        hasRaw: meta.hasRaw,
        hasResult: meta.hasResult,
        rawExcelBuffer,
        resultExcelBuffer,
        observationsCount: meta.observationsCount,
        observations: meta.observations,
      };
    } catch (err: unknown) {
      return {
        success: false,
        hasData: false,
        error: err instanceof Error ? err.message : 'Gagal memuat rincian periode.',
      };
    }
  }

  /**
   * Mengunduh berkas fisik Excel biner langsung dari server.
   */
  async downloadPeriodFile(
    year: number,
    quarter: QuarterSlot,
    type: 'raw' | 'result'
  ): Promise<Blob | null> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return null;
    }

    const response = await fetch(`${baseUrl}/periods/${year}/${quarter}/download/${type}`, {
      method: 'GET',
    });

    if (!response.ok) {
      return null;
    }

    return await response.blob();
  }

  /**
   * Menyimpan partisi periode (berkas fisik & observasi) ke server melalui multipart/form-data.
   */
  async savePeriod(payload: BackendPeriodSavePayload): Promise<BackendPeriodSaveResult> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return { success: false, error: 'Backend API URL belum dikonfigurasi.' };
    }

    try {
      const formData = new FormData();

      if (payload.rawExcelBuffer) {
        const rawBlob = new Blob([payload.rawExcelBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        formData.append(
          'rawFile',
          rawBlob,
          payload.rawFileName || `raw-data-${payload.year}-${payload.quarter}.xlsx`
        );
      }

      if (payload.resultExcelBuffer) {
        const resultBlob = new Blob([payload.resultExcelBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        formData.append(
          'resultFile',
          resultBlob,
          payload.resultFileName || `joined-result-${payload.year}-${payload.quarter}.xlsx`
        );
      }

      if (payload.config) {
        formData.append('config', JSON.stringify(payload.config));
      }

      if (payload.observations && Array.isArray(payload.observations)) {
        formData.append('observations', JSON.stringify(payload.observations));
      }

      const response = await fetch(`${baseUrl}/periods/${payload.year}/${payload.quarter}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Server mengembalikan status HTTP ${response.status}`,
        };
      }

      const json = await response.json();
      return {
        success: !!json.success,
        message: json.message,
        periodId: json.periodId,
        year: json.year,
        quarter: json.quarter,
        updatedAt: json.updatedAt,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Gagal menyimpan periode ke server.',
      };
    }
  }

  /**
   * Mengambil daftar seluruh indikator kesehatan yang tersedia dalam database.
   */
  async getAvailableIndicators(): Promise<string[]> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return [];
    }

    try {
      const response = await fetch(`${baseUrl}/analytics/indicators`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        return [];
      }

      const json = await response.json();
      return Array.isArray(json.indicators) ? json.indicators : [];
    } catch {
      return [];
    }
  }

  /**
   * Melakukan kueri analitik tren multi-periode untuk satu indikator.
   */
  async getIndicatorTrends(
    indicatorKey: string,
    districtCode?: string
  ): Promise<BackendTrendsResult> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return {
        success: false,
        indicator: indicatorKey,
        scope: districtCode ? 'district' : 'province',
        totalPeriods: 0,
        series: [],
        error: 'Backend API URL belum dikonfigurasi.',
      };
    }

    try {
      const params = new URLSearchParams();
      params.set('indicator', indicatorKey);
      if (districtCode) {
        params.set('district', districtCode);
      }

      const response = await fetch(`${baseUrl}/analytics/trends?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        return {
          success: false,
          indicator: indicatorKey,
          scope: districtCode ? 'district' : 'province',
          totalPeriods: 0,
          series: [],
          error: `Server mengembalikan status HTTP ${response.status}`,
        };
      }

      const json = await response.json();
      return {
        success: !!json.success,
        indicator: json.indicator || indicatorKey,
        scope: json.scope || (districtCode ? 'district' : 'province'),
        districtCode: json.districtCode,
        districtName: json.districtName,
        totalPeriods: json.totalPeriods || (json.series ? json.series.length : 0),
        series: (json.series || []) as BackendTrendPoint[],
      };
    } catch (err: unknown) {
      return {
        success: false,
        indicator: indicatorKey,
        scope: districtCode ? 'district' : 'province',
        totalPeriods: 0,
        series: [],
        error: err instanceof Error ? err.message : 'Gagal mengeksekusi kueri tren.',
      };
    }
  }
}
