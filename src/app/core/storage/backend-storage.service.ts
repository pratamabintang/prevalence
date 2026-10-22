import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

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
}
