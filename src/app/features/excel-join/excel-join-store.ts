import { Injectable } from '@angular/core';
import {
  ColumnConfig,
  ColumnTargetConfig,
} from '../../core/evaluation/indicator-evaluator';
import { ColumnHeaderMeta, ExcelWorkbook, ExcelWorkbookAdapter } from '../../shared/excel';
import { ResultRow, SheetInfo } from './excel-join.component';

export interface ExcelJoinStoredState {
  version: '1.0';
  savedAt: string;
  fileInfo: {
    name: string;
    size?: number;
    type?: string;
  } | null;
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
  dataFetchTimestamp?: string | null;
}

/**
 * ExcelJoinStore: layanan state singleton (providedIn: 'root') yang mempertahankan
 * data, progress konfigurasi, dan hasil join selama sesi aplikasi berjalan, sehingga
 * pekerjaan tidak hilang ketika user berpindah menu/rute (SPA navigation).
 *
 * State sengaja TIDAK ditulis ke sessionStorage/localStorage: membuka atau memuat
 * ulang aplikasi selalu menampilkan halaman Kelola Data yang bersih, sehingga data
 * yang belum tersimpan di server tidak pernah muncul seperti data bawaan.
 */
@Injectable({
  providedIn: 'root',
})
export class ExcelJoinStore {
  static readonly LEGACY_STORAGE_KEY = 'dinkes_excel_join_session_state';

  private inMemoryState: ExcelJoinStoredState | null = null;
  private inMemoryWorkbook: ExcelWorkbook | null = null;
  private inMemoryFile: File | null = null;

  constructor() {
    // Bersihkan sisa state lama dari versi yang masih memakai sessionStorage
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(ExcelJoinStore.LEGACY_STORAGE_KEY);
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('dinkes_excel_join_state');
      }
    } catch {}
  }

  /**
   * Menyimpan snapshot state dan objek workbook/file ke memori sesi aplikasi.
   */
  saveState(
    state: ExcelJoinStoredState,
    workbook?: ExcelWorkbook | null,
    file?: File | null,
  ): void {
    this.inMemoryState = state;
    if (workbook !== undefined) {
      this.inMemoryWorkbook = workbook;
    }
    if (file !== undefined && file !== null) {
      this.inMemoryFile = file;
    }
  }

  /**
   * Memeriksa apakah terdapat state yang valid pada sesi aplikasi berjalan.
   */
  hasState(): boolean {
    const state = this.inMemoryState;
    if (!state) {
      return false;
    }
    return (
      (state.sheets && state.sheets.length > 0) ||
      (state.resultRows && state.resultRows.length > 0) ||
      !!state.fileInfo
    );
  }

  /**
   * Mengambil snapshot state aktif sesi aplikasi berjalan.
   */
  getState(): ExcelJoinStoredState | null {
    return this.inMemoryState;
  }

  /**
   * Mengambil referensi workbook SheetJS yang tersimpan di memori sesi.
   */
  getWorkbook(): ExcelWorkbook | null {
    return this.inMemoryWorkbook;
  }

  /**
   * Mengambil referensi File asli yang tersimpan di memori sesi.
   * Tidak akan mengembalikan File kosong (0-byte) jika workbook tersedia.
   */
  getFile(): File | null {
    if (this.inMemoryFile && this.inMemoryFile.size > 0) {
      return this.inMemoryFile;
    }

    // Buat File nyata dari inMemoryWorkbook jika inMemoryFile kosong
    if (this.inMemoryWorkbook) {
      try {
        const rawBuffer = ExcelWorkbookAdapter.writeToBuffer(this.inMemoryWorkbook);
        this.inMemoryFile = new File(
          [rawBuffer],
          this.inMemoryState?.fileInfo?.name || 'hasil-join.xlsx',
          { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        );
        return this.inMemoryFile;
      } catch (e) {
        console.warn('Gagal membuat File dari inMemoryWorkbook:', e);
      }
    }

    return null;
  }

  /**
   * Membersihkan seluruh data state dari memori sesi aplikasi.
   */
  clearState(): void {
    this.inMemoryState = null;
    this.inMemoryWorkbook = null;
    this.inMemoryFile = null;
  }
}
