import { Injectable, signal } from '@angular/core';
import * as XLSX from 'xlsx-js-style';
import {
  ColumnConfig,
  ColumnTargetConfig,
} from '../../core/evaluation/indicator-evaluator';
import { ColumnHeaderMeta } from '../../shared/excel';
import { ResultRow, SheetInfo } from './excel-join.component';

export interface ExcelJoinStoredState {
  version: '1.0';
  savedAt: string;
  fileInfo: {
    name: string;
    size?: number;
    type?: string;
    base64?: string;
  } | null;
  isDefaultData: boolean;
  isCloudDefault: boolean;
  showSettings: boolean;
  activePresetName: string;
  sheets: SheetInfo[];
  joinBy: string;
  stripKabupaten: boolean;
  outputHeaderFormat: 'full' | 'concat';
  includeSheetPrefix: boolean;
  enableTarget: boolean;
  enableCapaian: boolean;
  enableJumlah: boolean;
  enableAverage: boolean;
  columnTargets: Record<string, ColumnTargetConfig>;
  columnConfigs: Record<string, ColumnConfig>;
  sumColumns: Record<string, boolean>;
  avgColumns: Record<string, boolean>;
  customColumnNames: Record<string, string>;
  resultColumns: string[];
  resultColumnsMeta: ColumnHeaderMeta[];
  defaultResultColumns: string[];
  defaultResultColumnsMeta: ColumnHeaderMeta[];
  resultRows: ResultRow[];
  originalResultRows: ResultRow[];
}

/**
 * ExcelJoinStore: Layanan state singleton tingkat aplikasi (providedIn: 'root')
 * yang mempertahankan data, progress konfigurasi, dan hasil join ketika user
 * berpindah menu/rute lain (SPA navigation) serta menyinkronkan snapshot ke localStorage
 * agar tidak hilang saat reload atau sesi tidak sengaja terputus.
 */
@Injectable({
  providedIn: 'root',
})
export class ExcelJoinStore {
  static readonly STORAGE_KEY = 'dinkes_excel_join_state';

  private inMemoryState: ExcelJoinStoredState | null = null;
  private inMemoryWorkbook: XLSX.WorkBook | null = null;
  private inMemoryFile: File | null = null;

  constructor() {
    this.inMemoryState = this.readFromLocalStorage();
  }

  /**
   * Menyimpan snapshot state dan objek workbook/file ke in-memory service dan localStorage.
   */
  saveState(
    state: ExcelJoinStoredState,
    workbook?: XLSX.WorkBook | null,
    file?: File | null,
  ): void {
    this.inMemoryState = state;
    if (workbook !== undefined) {
      this.inMemoryWorkbook = workbook;
    }
    if (file !== undefined) {
      this.inMemoryFile = file;
    }

    this.persistToLocalStorage(state);
  }

  /**
   * Memeriksa apakah terdapat state tersimpan yang valid (baik di memori maupun localStorage).
   */
  hasState(): boolean {
    if (this.inMemoryState) {
      return (
        (this.inMemoryState.sheets && this.inMemoryState.sheets.length > 0) ||
        (this.inMemoryState.resultRows && this.inMemoryState.resultRows.length > 0) ||
        !!this.inMemoryState.fileInfo
      );
    }

    const fromLocal = this.readFromLocalStorage();
    if (fromLocal) {
      this.inMemoryState = fromLocal;
      return (
        (fromLocal.sheets && fromLocal.sheets.length > 0) ||
        (fromLocal.resultRows && fromLocal.resultRows.length > 0) ||
        !!fromLocal.fileInfo
      );
    }

    return false;
  }

  /**
   * Mengambil snapshot state aktif.
   */
  getState(): ExcelJoinStoredState | null {
    if (!this.inMemoryState) {
      this.inMemoryState = this.readFromLocalStorage();
    }
    return this.inMemoryState;
  }

  /**
   * Mengambil referensi workbook SheetJS yang tersimpan di memori.
   */
  getWorkbook(): XLSX.WorkBook | null {
    if (this.inMemoryWorkbook) {
      return this.inMemoryWorkbook;
    }

    // Jika di memori kosong (misal hard refresh), coba rekonstruksi dari base64 jika tersedia
    if (this.inMemoryState?.fileInfo?.base64) {
      try {
        const binary = atob(this.inMemoryState.fileInfo.base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        this.inMemoryWorkbook = XLSX.read(bytes.buffer, { type: 'array', raw: true });
        return this.inMemoryWorkbook;
      } catch (e) {
        console.warn('Gagal merekonstruksi workbook dari base64 localStorage:', e);
      }
    }

    return null;
  }

  /**
   * Mengambil referensi File asli yang tersimpan di memori.
   */
  getFile(): File | null {
    if (this.inMemoryFile) {
      return this.inMemoryFile;
    }

    if (this.inMemoryState?.fileInfo?.base64 && typeof window !== 'undefined') {
      try {
        const binary = atob(this.inMemoryState.fileInfo.base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const restoredFile = new File(
          [bytes.buffer],
          this.inMemoryState.fileInfo.name || 'restored.xlsx',
          { type: this.inMemoryState.fileInfo.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        );
        this.inMemoryFile = restoredFile;
        return restoredFile;
      } catch (e) {
        console.warn('Gagal merekonstruksi File dari base64 localStorage:', e);
      }
    }

    return null;
  }

  /**
   * Membersihkan seluruh data state (in-memory dan localStorage).
   */
  clearState(): void {
    this.inMemoryState = null;
    this.inMemoryWorkbook = null;
    this.inMemoryFile = null;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(ExcelJoinStore.STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Gagal menghapus state dari localStorage:', e);
    }
  }

  private persistToLocalStorage(state: ExcelJoinStoredState): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const serialized = JSON.stringify(state);
      localStorage.setItem(ExcelJoinStore.STORAGE_KEY, serialized);
    } catch (err: unknown) {
      // Jika melebihi kuota penyimpanan (QuotaExceededError),
      // buang base64 binary dan simpan hanya metadata konfigurasi + baris data
      if (state.fileInfo?.base64) {
        try {
          const strippedState: ExcelJoinStoredState = {
            ...state,
            fileInfo: {
              ...state.fileInfo,
              base64: undefined,
            },
          };
          localStorage.setItem(ExcelJoinStore.STORAGE_KEY, JSON.stringify(strippedState));
        } catch (innerErr) {
          console.warn('Gagal menyimpan state ke localStorage (kuota penuh):', innerErr);
        }
      } else {
        console.warn('Gagal menyimpan state ke localStorage:', err);
      }
    }
  }

  private readFromLocalStorage(): ExcelJoinStoredState | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    try {
      const raw = localStorage.getItem(ExcelJoinStore.STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as ExcelJoinStoredState;
      if (parsed && parsed.version === '1.0') {
        return parsed;
      }
      return null;
    } catch (e) {
      console.warn('Gagal membaca state dari localStorage:', e);
      return null;
    }
  }
}
