import { Injectable, signal } from '@angular/core';

export interface TransferredChartData {
  title?: string;
  source: 'join' | 'upload';
  categoryColumn: string;
  columns: string[];
  rows: Record<string, unknown>[];
  targetValue?: number | null;
}

/**
 * ChartDataBridge: Layanan transfer data antara modul pengolahan (seperti Excel Join)
 * dan modul visualisasi grafik, tersinkronisasi otomatis dengan sessionStorage.
 */
@Injectable({
  providedIn: 'root',
})
export class ChartDataBridge {
  private static readonly STORAGE_KEY = 'dinkes_chart_bridge_data';

  private dataSignal = signal<TransferredChartData | null>(this.readInitialData());
  data = this.dataSignal.asReadonly();

  setData(data: TransferredChartData): void {
    this.dataSignal.set(data);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(ChartDataBridge.STORAGE_KEY, JSON.stringify(data));
      }
    } catch (e) {
      console.warn('Gagal menyimpan data grafik ke sessionStorage:', e);
    }
  }

  clearData(): void {
    this.dataSignal.set(null);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(ChartDataBridge.STORAGE_KEY);
      }
    } catch {}
  }

  private readInitialData(): TransferredChartData | null {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      const raw = sessionStorage.getItem(ChartDataBridge.STORAGE_KEY);
      return raw ? (JSON.parse(raw) as TransferredChartData) : null;
    } catch {
      return null;
    }
  }
}
