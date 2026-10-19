/**
 * StorageAdapter: Antarmuka seam untuk persistensi nilai string.
 */
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * LocalStorageAdapter: Implementasi StorageAdapter berbasis peramban (window.localStorage).
 * Dilengkapi pengamanan SSR dan penanganan error aman (misal kuota habis atau izin browser diblokir).
 */
export class LocalStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return null;
      }
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (error) {
      console.warn(`[LocalStorageAdapter] Gagal menyimpan kunci "${key}":`, error);
    }
  }

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Abaikan error pada removeItem
    }
  }
}

/**
 * InMemoryStorageAdapter: Adapter memori tanpa dependensi lingkungan browser.
 * Sangat ideal untuk unit test cepat dan lingkungan headless / server.
 */
export class InMemoryStorageAdapter implements StorageAdapter {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * FileDownloadAdapter: Antarmuka seam untuk mengunduh berkas teks / JSON.
 */
export interface FileDownloadAdapter {
  download(content: string, fileName: string, mimeType?: string): void;
}

/**
 * BrowserFileDownloadAdapter: Adapter unduh berkas di peramban memanfaatkan Blob dan tag <a> tersembunyi.
 */
export class BrowserFileDownloadAdapter implements FileDownloadAdapter {
  download(content: string, fileName: string, mimeType = 'application/json;charset=utf-8;'): void {
    if (typeof document === 'undefined') {
      return;
    }

    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn(`[BrowserFileDownloadAdapter] Gagal memicu unduh berkas "${fileName}":`, error);
    }
  }
}

/**
 * InMemoryFileDownloadAdapter: Adapter unduh di memori untuk keperluan pengujian dan verifikasi assertion.
 */
export class InMemoryFileDownloadAdapter implements FileDownloadAdapter {
  downloads: Array<{ content: string; fileName: string; mimeType?: string }> = [];

  download(content: string, fileName: string, mimeType?: string): void {
    this.downloads.push({ content, fileName, mimeType });
  }

  get lastDownload(): { content: string; fileName: string; mimeType?: string } | undefined {
    return this.downloads[this.downloads.length - 1];
  }

  clear(): void {
    this.downloads = [];
  }
}

/**
 * Opsi konfigurasi untuk menginstansiasi modul PresetStore<T>.
 */
export interface PresetStoreOptions<T> {
  /** Kunci penyimpanan di localStorage */
  storageKey: string;
  /** Prefiks nama berkas jika generator kustom tidak disediakan */
  defaultFileNamePrefix?: string;
  /** Adapter penyimpanan (default: LocalStorageAdapter) */
  storage?: StorageAdapter;
  /** Adapter unduh berkas (default: BrowserFileDownloadAdapter) */
  downloader?: FileDownloadAdapter;
  /** Fungsi validasi schema & normalisasi parsing */
  validator?: (data: unknown) => T;
  /** Generator penamaan berkas unduh dinamis berdasarkan isi preset */
  generateFileName?: (preset: T) => string;
}

/**
 * PresetStore<T>: Modul domain yang mendalam (Deep Module) untuk persistensi konfigurasi preset,
 * mencakup serialisasi JSON, validasi skema, toleransi penyimpanan browser, dan penanganan berkas unduh.
 */
export class GenericPresetStore<T> {
  private readonly storageKey: string;
  private readonly defaultFileNamePrefix: string;
  private readonly storage: StorageAdapter;
  private readonly downloader: FileDownloadAdapter;
  private readonly validator?: (data: unknown) => T;
  private readonly generateFileName?: (preset: T) => string;

  constructor(options: PresetStoreOptions<T>) {
    this.storageKey = options.storageKey;
    this.defaultFileNamePrefix = options.defaultFileNamePrefix || 'konfigurasi';
    this.storage = options.storage || new LocalStorageAdapter();
    this.downloader = options.downloader || new BrowserFileDownloadAdapter();
    this.validator = options.validator;
    this.generateFileName = options.generateFileName;
  }

  /**
   * Mengecek apakah ada konfigurasi tersimpan di media penyimpanan.
   */
  hasSavedPreset(): boolean {
    return !!this.storage.getItem(this.storageKey);
  }

  /**
   * Membaca preset terakhir dari media penyimpanan. Mengembalikan null jika belum ada atau gagal parse.
   */
  loadLastPreset(): T | null {
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      if (this.validator) {
        return this.validator(parsed);
      }
      return parsed as T;
    } catch {
      return null;
    }
  }

  /**
   * Menyimpan preset ke media penyimpanan dan opsi mengunduh berkas .json secara otomatis.
   */
  savePreset(preset: T, triggerDownload = true): void {
    const jsonString = JSON.stringify(preset, null, 2);
    this.storage.setItem(this.storageKey, jsonString);

    if (triggerDownload) {
      const fileName = this.generateFileName
        ? this.generateFileName(preset)
        : `${this.defaultFileNamePrefix}_${new Date().toISOString().slice(0, 10)}.json`;
      this.downloader.download(jsonString, fileName);
    }
  }

  /**
   * Mengurai teks JSON menjadi objek konfigurasi T dengan validasi skema.
   */
  parsePresetJson(text: string): T {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Format berkas konfigurasi tidak valid (bukan JSON yang valid).');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Format berkas konfigurasi tidak valid.');
    }

    if (this.validator) {
      return this.validator(parsed);
    }
    return parsed as T;
  }

  /**
   * Menghapus preset yang tersimpan dari media penyimpanan.
   */
  clearPreset(): void {
    this.storage.removeItem(this.storageKey);
  }

  getStorageKey(): string {
    return this.storageKey;
  }
}
