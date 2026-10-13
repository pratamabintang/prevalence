import { ColumnInfo } from '../../shared/excel';

export interface ChartConfigurationPreset {
  version: '1.0';
  name?: string;
  savedAt: string;
  sheetName: string;
  headerStartRow: number;
  headerEndRow: number;
  dataStartRow: number;
  categoryColumn: string;
  seriesKeys: string[];
  targetValue: number | null;
  chartTitle?: string;
  chartSubtitle?: string;
  hiddenRows?: string[];
  deletedRows?: string[];
}

/**
 * ChartPresetStore: Persistensi konfigurasi grafik visualisasi (localStorage & unduh file .json)
 * dengan algoritma pencocokan tangguh (resilient matching) untuk mendukung reproduksi data berkala.
 */
export class ChartPresetStore {
  private static readonly STORAGE_KEY = 'dinkes_chart_visualizer_config_last';

  /**
   * Mengecek apakah ada konfigurasi grafik tersimpan di browser.
   */
  static hasSavedPreset(): boolean {
    return typeof window !== 'undefined' && !!localStorage.getItem(this.STORAGE_KEY);
  }

  /**
   * Membaca preset terakhir dari localStorage browser.
   */
  static loadLastPreset(): ChartConfigurationPreset | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as ChartConfigurationPreset;
    } catch {
      return null;
    }
  }

  /**
   * Menyimpan preset ke localStorage dan mengunduhnya sebagai berkas .json.
   */
  static savePreset(preset: ChartConfigurationPreset, triggerDownload = true): void {
    const jsonString = JSON.stringify(preset, null, 2);

    try {
      localStorage.setItem(this.STORAGE_KEY, jsonString);
    } catch (e) {
      console.warn('Gagal menyimpan preset grafik ke localStorage:', e);
    }

    if (triggerDownload && typeof document !== 'undefined') {
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 10);
      const safeSheet = (preset.sheetName || 'grafik').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.href = url;
      link.download = `konfigurasi_grafik_${safeSheet}_${timestamp}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Parse teks JSON menjadi ChartConfigurationPreset dengan validasi skema.
   */
  static parsePresetJson(text: string): ChartConfigurationPreset {
    const parsed = JSON.parse(text) as ChartConfigurationPreset;
    if (!parsed || !parsed.sheetName || !Array.isArray(parsed.seriesKeys)) {
      throw new Error('Format berkas konfigurasi grafik tidak valid. Pastikan berkas berasal dari ekspor preset grafik.');
    }
    return parsed;
  }

  /**
   * Pencocokan nama sheet preset dengan sheet yang tersedia (exact -> normalized -> loose).
   */
  static findMatchingSheet(presetSheetName: string, availableSheets: string[]): string | undefined {
    if (!presetSheetName) return undefined;
    const exact = availableSheets.find((s) => s === presetSheetName);
    if (exact) return exact;

    const normPreset = this.normalizeKey(presetSheetName);
    const norm = availableSheets.find((s) => this.normalizeKey(s) === normPreset);
    if (norm) return norm;

    const loose = availableSheets.find((s) => {
      const normS = this.normalizeKey(s);
      return normS.includes(normPreset) || normPreset.includes(normS);
    });
    return loose;
  }

  /**
   * Pencocokan nama kolom preset dengan kolom yang ada (exact -> normalized -> leaf sub-header -> token similarity).
   */
  static findMatchingHeader(presetHeader: string, columns: ColumnInfo[]): string | undefined {
    if (!presetHeader) return undefined;
    const exact = columns.find((c) => c.header === presetHeader);
    if (exact) return exact.header;

    const normPreset = this.normalizeKey(presetHeader);
    const norm = columns.find((c) => this.normalizeKey(c.header) === normPreset);
    if (norm) return norm.header;

    const leaf = columns.find(
      (c) => c.leafHeader && this.normalizeKey(c.leafHeader) === normPreset,
    );
    if (leaf) return leaf.header;

    const cleanPreset = normPreset.replace(/[^a-z0-9]/g, '');
    const cleanMatch = columns.find((c) => {
      const cleanH = this.normalizeKey(c.header).replace(/[^a-z0-9]/g, '');
      const cleanLeaf = c.leafHeader ? this.normalizeKey(c.leafHeader).replace(/[^a-z0-9]/g, '') : '';
      return (
        cleanH === cleanPreset ||
        cleanLeaf === cleanPreset ||
        (cleanPreset.length > 4 && (cleanH.includes(cleanPreset) || cleanPreset.includes(cleanH)))
      );
    });
    return cleanMatch ? cleanMatch.header : undefined;
  }

  private static normalizeKey(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '_');
  }
}
