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
  hasConfig?: boolean;
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
  fileName?: string;
  hasRaw?: boolean;
  hasResult?: boolean;
  resultExcelAvailable?: boolean;
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

export interface BackendDefaultLoadResult {
  success: boolean;
  hasData: boolean;
  fileName?: string;
  excelBuffer?: ArrayBuffer;
  config?: unknown;
  updatedAt?: string;
  message?: string;
  error?: string;
}

export interface BackendDefaultSaveResult {
  success: boolean;
  message?: string;
  updatedAt?: string;
  error?: string;
}

export interface BackendTrendPoint {
  year: number;
  quarter: string;
  count: number;
  avgValue: number | null;
  averageValue?: number | null;
  medianValue?: number | null;
  minValue: number | null;
  maxValue: number | null;
  achievedCount?: number;
  totalTargeted?: number;
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
   * Mengembalikan string kosong jika environment.backendApiUrl disetel ke "" secara eksplisit.
   */
  getBaseUrl(): string {
    const raw = (environment as unknown as { backendApiUrl?: string }).backendApiUrl;
    if (typeof raw === 'string') {
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
   * Helper internal terpadu untuk eksekusi HTTP JSON dengan penanganan status seragam.
   */
  private async requestJson<T = any>(
    endpoint: string,
    init?: RequestInit,
    fallbackErrorMsg = 'Gagal menghubungi server backend.',
  ): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return { ok: false, error: 'Backend API URL belum dikonfigurasi.' };
    }

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init?.headers || {}),
        },
      });

      if (!response.ok) {
        let errorDetail = `Server mengembalikan status HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData && typeof errData === 'object') {
            const msg =
              (errData as { message?: string; error?: string }).message ||
              (errData as { message?: string; error?: string }).error;
            if (msg) {
              errorDetail = msg;
            }
          }
        } catch {
          // Abaikan jika body respons bukan format JSON
        }
        return {
          ok: false,
          error: errorDetail,
        };
      }

      const data = (await response.json()) as T;
      return { ok: true, data };
    } catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : fallbackErrorMsg,
      };
    }
  }

  /**
   * Melakukan pemeriksaan status server (Health Check) ke endpoint /api/health.
   */
  async pingServer(): Promise<BackendPingResult> {
    const res = await this.requestJson('/health', { method: 'GET' }, 'Koneksi ke backend server gagal.');
    if (!res.ok) {
      this.isConnected.set(false);
      return { success: false, error: res.error };
    }

    const json = res.data;
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
  }

  /**
   * Mengambil daftar master 35 Kabupaten/Kota Jawa Tengah dari SQLite.
   */
  async getDistricts(): Promise<BackendDistrictsResult> {
    const res = await this.requestJson('/districts', { method: 'GET' }, 'Gagal mengambil data wilayah.');
    if (!res.ok) {
      return { success: false, count: 0, data: [], error: res.error };
    }

    const json = res.data;
    return {
      success: !!json.success,
      count: json.count || (json.data ? json.data.length : 0),
      data: json.data || [],
    };
  }

  /**
   * Mengambil konfigurasi preset terpusat dari server SQLite.
   */
  async getConfig(type: StorageConfigType): Promise<BackendConfigLoadResult> {
    const res = await this.requestJson(`/configs/${type}`, { method: 'GET' }, 'Gagal memuat konfigurasi preset.');
    if (!res.ok) {
      return { success: false, hasConfig: false, error: res.error };
    }

    const json = res.data;
    return {
      success: !!json.success,
      hasConfig: !!json.hasConfig,
      config: json.config,
      updatedAt: json.updatedAt,
    };
  }

  /**
   * Menyimpan konfigurasi preset terpusat ke server SQLite.
   */
  async saveConfig(type: StorageConfigType, config: unknown): Promise<BackendConfigSaveResult> {
    const res = await this.requestJson(
      `/configs/${type}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      },
      'Gagal menyimpan konfigurasi preset.',
    );
    if (!res.ok) {
      return { success: false, error: res.error };
    }

    const json = res.data;
    return {
      success: !!json.success,
      message: json.message,
      updatedAt: json.updatedAt,
    };
  }

  /**
   * Mengambil daftar seluruh periode yang telah tersimpan di server.
   */
  async listPeriods(): Promise<BackendPeriodListResult> {
    const res = await this.requestJson('/periods', { method: 'GET' }, 'Gagal mengambil daftar periode.');
    if (!res.ok) {
      return { success: false, periods: [], error: res.error };
    }

    const json = res.data;
    return {
      success: !!json.success,
      periods: (json.periods || []) as BackendPeriodItem[],
    };
  }

  /**
   * Memuat detail periode beserta berkas biner dan baris observasi.
   */
  async loadPeriod(year: number, quarter: QuarterSlot): Promise<BackendPeriodLoadResult> {
    const res = await this.requestJson(`/periods/${year}/${quarter}`, { method: 'GET' }, 'Gagal memuat rincian periode.');
    if (!res.ok) {
      return { success: false, hasData: false, error: res.error };
    }

    const meta = res.data;
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

    const filesArr = Array.isArray(meta.files)
      ? (meta.files as { file_type?: string; file_name?: string }[])
      : [];
    const rawFileEntry = filesArr.find((f) => f.file_type === 'raw');
    const resultFileEntry = filesArr.find((f) => f.file_type === 'result');

    return {
      success: true,
      hasData: true,
      year: meta.year,
      quarter: meta.quarter,
      status: meta.status,
      updatedAt: meta.updatedAt,
      fileName: rawFileEntry?.file_name || resultFileEntry?.file_name,
      hasRaw: meta.hasRaw,
      hasResult: meta.hasResult,
      resultExcelAvailable: Boolean(resultExcelBuffer || meta.hasResult),
      rawExcelBuffer,
      resultExcelBuffer,
      config: meta.config,
      observationsCount: meta.observationsCount,
      observations: meta.observations,
    };
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

    const res = await this.requestJson(
      `/periods/${payload.year}/${payload.quarter}`,
      {
        method: 'POST',
        body: formData,
      },
      'Gagal menyimpan periode ke server.',
    );

    if (!res.ok) {
      return { success: false, error: res.error };
    }

    const json = res.data;
    return {
      success: !!json.success,
      message: json.message,
      periodId: json.periodId,
      year: json.year,
      quarter: json.quarter,
      updatedAt: json.updatedAt,
    };
  }

  /**
   * Menghapus partisi periode (berkas fisik & observasi) di server melalui DELETE /periods/:year/:quarter.
   */
  async deletePeriod(
    year: number,
    quarter: QuarterSlot,
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await this.requestJson(
      `/periods/${year}/${quarter}`,
      {
        method: 'DELETE',
      },
      'Gagal menghapus periode dari server.',
    );

    if (!res.ok) {
      return { success: false, error: res.error };
    }

    const json = res.data;
    return {
      success: !!json.success,
      message: json.message,
      error: json.error,
    };
  }

  /**
   * Mengambil daftar seluruh indikator kesehatan yang tersedia dalam database.
   */
  async getAvailableIndicators(): Promise<string[]> {
    const res = await this.requestJson('/analytics/indicators', { method: 'GET' });
    if (!res.ok) {
      return [];
    }
    return Array.isArray(res.data.indicators) ? res.data.indicators : [];
  }

  /**
   * Melakukan kueri analitik tren multi-periode untuk satu indikator.
   */
  async getIndicatorTrends(
    indicatorKey: string,
    districtCode?: string
  ): Promise<BackendTrendsResult> {
    const params = new URLSearchParams();
    params.set('indicator', indicatorKey);
    if (districtCode) {
      params.set('district', districtCode);
    }

    const res = await this.requestJson(
      `/analytics/trends?${params.toString()}`,
      { method: 'GET' },
      'Gagal mengeksekusi kueri tren.',
    );

    if (!res.ok) {
      return {
        success: false,
        indicator: indicatorKey,
        scope: districtCode ? 'district' : 'province',
        totalPeriods: 0,
        series: [],
        error: res.error,
      };
    }

    const json = res.data;
    return {
      success: !!json.success,
      indicator: json.indicator || indicatorKey,
      scope: json.scope || (districtCode ? 'district' : 'province'),
      districtCode: json.districtCode,
      districtName: json.districtName,
      totalPeriods: json.totalPeriods || (json.series ? json.series.length : 0),
      series: (json.series || []) as BackendTrendPoint[],
    };
  }

  /**
   * Memuat berkas Excel dan konfigurasi Default Kustom dari server (/api/default).
   */
  async loadDefault(): Promise<BackendDefaultLoadResult> {
    const res = await this.requestJson(
      '/default',
      { method: 'GET' },
      'Gagal memuat metadata Default Kustom dari server.',
    );
    if (!res.ok) {
      return { success: false, hasData: false, error: res.error };
    }

    const meta = res.data;
    if (!meta.hasData) {
      return {
        success: true,
        hasData: false,
        message: meta.message || 'Belum ada Default Kustom di server.',
      };
    }

    const baseUrl = this.getBaseUrl();
    let excelBuffer: ArrayBuffer | undefined = undefined;
    try {
      const dlRes = await fetch(`${baseUrl}/default/download`, { method: 'GET' });
      if (dlRes.ok) {
        const blob = await dlRes.blob();
        excelBuffer = await blob.arrayBuffer();
      }
    } catch {
      // Abaikan jika unduhan gagal
    }

    if (!excelBuffer) {
      return {
        success: false,
        hasData: false,
        error: 'Gagal mengunduh berkas biner Default Kustom dari server.',
      };
    }

    return {
      success: true,
      hasData: true,
      fileName: meta.fileName || 'default-join-data.xlsx',
      excelBuffer,
      config: meta.config,
      updatedAt: meta.updatedAt,
    };
  }

  /**
   * Menyimpan berkas Excel dan konfigurasi sebagai Default Kustom di server (/api/default).
   */
  async saveDefault(
    excelBuffer: ArrayBuffer,
    fileName: string,
    config?: unknown,
  ): Promise<BackendDefaultSaveResult> {
    if (!excelBuffer || excelBuffer.byteLength === 0) {
      return {
        success: false,
        error: 'Data file Excel kosong (0 byte).',
      };
    }

    const formData = new FormData();
    const excelBlob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    formData.append('excelFile', excelBlob, fileName || 'default-join-data.xlsx');
    formData.append('fileName', fileName || 'default-join-data.xlsx');
    if (config !== undefined) {
      const serialized = JSON.stringify(config);
      formData.append('configJson', serialized);
      formData.append('config', serialized);
    }

    const res = await this.requestJson(
      '/default',
      {
        method: 'POST',
        body: formData,
      },
      'Gagal menyimpan Default Kustom ke server.',
    );
    if (!res.ok) {
      return { success: false, error: res.error };
    }

    return {
      success: !!res.data.success,
      message: res.data.message,
      updatedAt: res.data.updatedAt,
    };
  }

  /**
   * Menghapus Default Kustom di server (/api/default) dan mengembalikan ke Bawaan Sistem.
   */
  async resetDefault(): Promise<BackendDefaultSaveResult> {
    const res = await this.requestJson(
      '/default',
      { method: 'DELETE' },
      'Gagal menghapus Default Kustom di server.',
    );
    if (!res.ok) {
      return { success: false, error: res.error };
    }

    return {
      success: !!res.data.success,
      message: res.data.message,
    };
  }
}
