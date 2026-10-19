import { Injectable } from '@angular/core';
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
 * berpindah menu/rute lain dalam tab yang sama (SPA navigation) via sessionStorage.
 *
 * Pada saat user membuka browser atau tab baru, sessionStorage kosong sehingga
 * sumber awal data dipastikan selalu fresh dari Google Drive.
 */
@Injectable({
  providedIn: 'root',
})
export class ExcelJoinStore {
  static readonly STORAGE_KEY = 'dinkes_excel_join_session_state';

  private inMemoryState: ExcelJoinStoredState | null = null;
  private inMemoryWorkbook: XLSX.WorkBook | null = null;
  private inMemoryFile: File | null = null;

  constructor() {
    // Bersihkan legacy localStorage jika ada dari versi sebelumnya
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('dinkes_excel_join_state');
      }
    } catch {}

    this.inMemoryState = this.readFromSessionStorage();
  }

  /**
   * Menyimpan snapshot state dan objek workbook/file ke in-memory service dan sessionStorage tab aktif.
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
    if (file !== undefined && file !== null) {
      this.inMemoryFile = file;
    }

    this.persistToSessionStorage(state);
  }

  /**
   * Memeriksa apakah terdapat state tersimpan yang valid pada sesi tab saat ini.
   */
  hasState(): boolean {
    if (this.inMemoryState) {
      return (
        (this.inMemoryState.sheets && this.inMemoryState.sheets.length > 0) ||
        (this.inMemoryState.resultRows && this.inMemoryState.resultRows.length > 0) ||
        !!this.inMemoryState.fileInfo
      );
    }

    const fromSession = this.readFromSessionStorage();
    if (fromSession) {
      this.inMemoryState = fromSession;
      return (
        (fromSession.sheets && fromSession.sheets.length > 0) ||
        (fromSession.resultRows && fromSession.resultRows.length > 0) ||
        !!fromSession.fileInfo
      );
    }

    return false;
  }

  /**
   * Mengambil snapshot state aktif sesi ini.
   */
  getState(): ExcelJoinStoredState | null {
    if (!this.inMemoryState) {
      this.inMemoryState = this.readFromSessionStorage();
    }
    return this.inMemoryState;
  }

  /**
   * Mengambil referensi workbook SheetJS yang tersimpan di memori sesi.
   */
  getWorkbook(): XLSX.WorkBook | null {
    if (this.inMemoryWorkbook) {
      return this.inMemoryWorkbook;
    }

    // Jika di memori null tapi ada base64 di sessionStorage
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
        console.warn('Gagal merekonstruksi workbook dari base64 sessionStorage:', e);
      }
    }

    return null;
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
        const u8 = XLSX.write(this.inMemoryWorkbook, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
        const cleanBytes = new Uint8Array(u8);
        this.inMemoryFile = new File(
          [cleanBytes],
          this.inMemoryState?.fileInfo?.name || 'default-join-data.xlsx',
          { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        );
        return this.inMemoryFile;
      } catch (e) {
        console.warn('Gagal membuat File dari inMemoryWorkbook:', e);
      }
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
          [bytes],
          this.inMemoryState.fileInfo.name || 'restored.xlsx',
          { type: this.inMemoryState.fileInfo.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        );
        this.inMemoryFile = restoredFile;
        return restoredFile;
      } catch (e) {
        console.warn('Gagal merekonstruksi File dari base64 sessionStorage:', e);
      }
    }

    return null;
  }

  /**
   * Membersihkan seluruh data state (in-memory dan sessionStorage).
   */
  clearState(): void {
    this.inMemoryState = null;
    this.inMemoryWorkbook = null;
    this.inMemoryFile = null;

    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(ExcelJoinStore.STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Gagal menghapus state dari sessionStorage:', e);
    }
  }

  private persistToSessionStorage(state: ExcelJoinStoredState): void {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }

    try {
      const serialized = JSON.stringify(state);
      sessionStorage.setItem(ExcelJoinStore.STORAGE_KEY, serialized);
    } catch (err: unknown) {
      // Jika melebihi kuota penyimpanan, buang base64 binary dan simpan hanya metadata konfigurasi + baris data
      if (state.fileInfo?.base64) {
        try {
          const strippedState: ExcelJoinStoredState = {
            ...state,
            fileInfo: {
              ...state.fileInfo,
              base64: undefined,
            },
          };
          sessionStorage.setItem(ExcelJoinStore.STORAGE_KEY, JSON.stringify(strippedState));
        } catch (innerErr) {
          console.warn('Gagal menyimpan state ke sessionStorage (kuota penuh):', innerErr);
        }
      } else {
        console.warn('Gagal menyimpan state ke sessionStorage:', err);
      }
    }
  }

  private readFromSessionStorage(): ExcelJoinStoredState | null {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return null;
    }

    try {
      const raw = sessionStorage.getItem(ExcelJoinStore.STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as ExcelJoinStoredState;
      if (parsed && parsed.version === '1.0') {
        return parsed;
      }
      return null;
    } catch (e) {
      console.warn('Gagal membaca state dari sessionStorage:', e);
      return null;
    }
  }
}
