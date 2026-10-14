import { Injectable, signal } from '@angular/core';

export interface TransferredStuntingData {
  title?: string;
  source: 'join';
  keyColumn: string;
  columns: string[];
  rows: Record<string, unknown>[];
  summaryRow?: Record<string, unknown>;
  targetRow?: Record<string, unknown>;
  averageRow?: Record<string, unknown>;
}

/**
 * StuntingDataBridge: Layanan jembatan data antara modul Excel Join
 * dan modul Pemantauan Stunting, tersinkronisasi otomatis dengan sessionStorage.
 */
@Injectable({
  providedIn: 'root',
})
export class StuntingDataBridge {
  private static readonly STORAGE_KEY = 'dinkes_stunting_bridge_data';

  private dataSignal = signal<TransferredStuntingData | null>(this.readInitialData());
  data = this.dataSignal.asReadonly();

  setData(data: TransferredStuntingData): void {
    this.dataSignal.set(data);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(StuntingDataBridge.STORAGE_KEY, JSON.stringify(data));
      }
    } catch (e) {
      console.warn('Gagal menyimpan data transfer stunting ke sessionStorage:', e);
    }
  }

  clearData(): void {
    this.dataSignal.set(null);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(StuntingDataBridge.STORAGE_KEY);
      }
    } catch {}
  }

  private readInitialData(): TransferredStuntingData | null {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      const raw = sessionStorage.getItem(StuntingDataBridge.STORAGE_KEY);
      return raw ? (JSON.parse(raw) as TransferredStuntingData) : null;
    } catch {
      return null;
    }
  }
}
