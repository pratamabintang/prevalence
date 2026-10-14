import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx-js-style';
import { ChartDataBridge } from '../../core/chart/chart-data-bridge';
import {
  ChartBarItem,
  ChartDataRow,
  ChartLayoutEngine,
  ChartLayoutResult,
  ChartSeriesConfig,
} from '../../core/chart/chart-layout-engine';
import { IndicatorEvaluator } from '../../core/evaluation/indicator-evaluator';
import { ColumnInfo, ExcelEngine } from '../../shared/excel';
import {
  ChartConfigurationPreset,
  ChartPresetStore,
} from './chart-preset-store';

import {
  UiAlertComponent,
  UiBadgeComponent,
  UiButtonComponent,
  UiPageHeaderComponent,
} from '../../shared/ui';

export interface IndicatorStats {
  total: number;
  validCount: number;
  missingCount: number;
  zeroCount: number;
  achievedCount: number;
  avgValue: number | null;
  highest: { name: string; value: number } | null;
  lowest: { name: string; value: number } | null;
  targetValue: number | null;
}

export interface IndicatorChartGroup {
  series: ChartSeriesConfig;
  layout: ChartLayoutResult;
  stats: IndicatorStats;
}

@Component({
  selector: 'app-chart-visualizer',
  standalone: true,
  imports: [
    FormsModule,
    UiPageHeaderComponent,
    UiButtonComponent,
    UiBadgeComponent,
    UiAlertComponent,
  ],
  templateUrl: './chart-visualizer.component.html',
})
export class ChartVisualizerComponent {
  private chartDataBridge = inject(ChartDataBridge);

  // Status & Panel
  dataSource = signal<'join' | 'upload' | 'empty'>('empty');
  notificationMessage = signal<string | null>(null);

  notificationMessageType = computed<'info' | 'success' | 'warning' | 'error'>(() => {
    const msg = this.notificationMessage()?.toLowerCase() || '';
    if (msg.includes('berhasil')) return 'success';
    if (msg.includes('gagal') || msg.includes('tidak didukung')) return 'error';
    return 'info';
  });

  showSettingsPanel = signal(false);
  showSettings = signal(false);

  toggleSettings(): void {
    this.showSettings.update((v) => !v);
  }

  // Fitur Simpan & Muat Konfigurasi Preset
  pendingPreset: ChartConfigurationPreset | null = null;
  hasSavedConfig = signal<boolean>(ChartPresetStore.hasSavedPreset());
  activePresetName = signal<string>('');
  configNotification = signal<{
    type: 'success' | 'warning' | 'info';
    message: string;
    details?: string[];
  } | null>(null);

  // ============================================================
  // WORKBOOK & INLINE STEP CONFIGURATION (FLOW FITUR JOIN)
  // ============================================================
  file = signal<File | null>(null);
  workbook: XLSX.WorkBook | null = null;
  sheetNames = signal<string[]>([]);
  selectedSheet = signal<string>('');
  isProcessing = signal(false);

  // Step 2: Konfigurasi Baris Header & Data (Multi-tier header support)
  headerStartRow = signal<number>(1);
  headerEndRow = signal<number>(1);
  dataStartRow = signal<number>(2);

  // Kolom sheet aktif
  sheetColumns = signal<ColumnInfo[]>([]);

  // Step 3: Kolom Kategori (Sumbu Y) & Kolom Seri (Batang)
  categoryColumn = signal<string>('');
  selectedSeriesKeys = signal<string[]>([]);
  columnSearchQuery = signal<string>('');

  // Metadata & Konfigurasi Judul
  chartTitle = signal('Visualisasi Capaian Indikator Kesehatan');
  chartSubtitle = signal('Grafik Batang Kelompok (Grouped Horizontal Bar Chart)');

  // Kolom Data untuk Layout
  allColumns = signal<string[]>([]);

  // Seleksi & Manajemen Baris (Label Sumbu Y)
  availableCategories = signal<string[]>([]);
  selectedCategories = signal<string[]>([]);
  categorySearchQuery = signal('');

  // Seri Indikator Aktif (Warna & Geometri Batang)
  seriesList = signal<ChartSeriesConfig[]>([]);
  dataRows = signal<ChartDataRow[]>([]);
  originalDataRows = signal<ChartDataRow[]>([]);
  hasData = computed(() => this.dataRows().length > 0);
  targetValue = signal<number | null>(null);

  // Mode Tampilan: 'by-region' (Multi-Indikator per Daerah) vs 'by-indicator' (Per Kolom Indikator)
  viewMode = signal<'by-region' | 'by-indicator'>('by-region');

  // Pengurutan Wilayah pada Mode Per Indikator
  indicatorSortMode = signal<'default' | 'desc' | 'asc'>('default');

  // Filter Tab Indikator pada Mode Per Indikator ('all' atau key seri tertentu)
  selectedIndicatorFilter = signal<string>('all');

  setViewMode(mode: 'by-region' | 'by-indicator'): void {
    this.viewMode.set(mode);
  }

  setIndicatorSortMode(mode: 'default' | 'desc' | 'asc'): void {
    this.indicatorSortMode.set(mode);
  }

  setSelectedIndicatorFilter(key: string): void {
    this.selectedIndicatorFilter.set(key);
  }

  // Nilai Target Khusus Per-Indikator
  indicatorTargets = signal<Record<string, number | null>>({});

  getIndicatorTarget(seriesKey: string): number | null {
    const specific = this.indicatorTargets()[seriesKey];
    if (specific !== undefined) {
      return specific;
    }
    return this.targetValue();
  }

  setIndicatorTarget(seriesKey: string, val: number | null): void {
    this.indicatorTargets.update((curr) => ({
      ...curr,
      [seriesKey]: val,
    }));
  }

  onIndicatorTargetChange(seriesKey: string, rawVal: string): void {
    const trimmed = (rawVal ?? '').trim();
    if (trimmed === '') {
      this.setIndicatorTarget(seriesKey, null);
    } else {
      const num = Number(trimmed);
      this.setIndicatorTarget(seriesKey, isNaN(num) ? null : num);
    }
  }

  readonly colorPalette = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
    '#14b8a6', // teal
  ];

  // Tooltip Interaktif
  hoveredBar = signal<{
    categoryName: string;
    seriesLabel: string;
    color: string;
    displayLabel: string;
    numericVal: number | null;
    isZero: boolean;
    isMissing: boolean;
    status: 'achieved' | 'unachieved' | 'none';
    diff: number | null;
    targetValue: number | null;
  } | null>(null);

  tooltipPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  constructor() {
    this.loadTransferredData();
  }

  // ============================================================
  // LOAD DATA DARI FITUR JOIN
  // ============================================================

  private loadTransferredData(): void {
    const transferred = this.chartDataBridge.data();
    if (!transferred || transferred.rows.length === 0) {
      return;
    }

    this.dataSource.set(transferred.source);
    if (transferred.title) {
      this.chartTitle.set(transferred.title);
      this.chartSubtitle.set(`Visualisasi data dari hasil join sheet`);
    }

    this.allColumns.set(transferred.columns);
    this.categoryColumn.set(transferred.categoryColumn);
    this.dataRows.set(transferred.rows);
    this.originalDataRows.set(transferred.rows);

    const mappedCols: ColumnInfo[] = transferred.columns.map((col, idx) => ({
      colIndex: idx,
      colLetter: XLSX.utils.encode_col(idx),
      header: col,
      leafHeader: col,
      layers: [col],
    }));
    this.sheetColumns.set(mappedCols);

    const cats = Array.from(
      new Set(
        transferred.rows
          .map((r) => String(r[transferred.categoryColumn] ?? '').trim())
          .filter(Boolean),
      ),
    );
    this.availableCategories.set(cats);
    this.selectedCategories.set(cats);

    const candidateSeries = transferred.columns.filter(
      (c) =>
        c !== transferred.categoryColumn &&
        !c.startsWith('__') &&
        c !== 'No' &&
        c !== 'Capaian',
    );

    const initialSeries = candidateSeries.slice(0, 6).map((col, idx) => ({
      key: col,
      label: col,
      color: this.colorPalette[idx % this.colorPalette.length],
    }));

    this.seriesList.set(initialSeries);
    this.selectedSeriesKeys.set(initialSeries.map((s) => s.key));

    if (transferred.targetValue !== undefined) {
      this.targetValue.set(transferred.targetValue);
    }

    this.notificationMessage.set(
      `Data hasil Join berhasil dimuat! (${cats.length} baris, ${initialSeries.length} seri)`,
    );
  }

  // ============================================================
  // STEP 1 : FILE UPLOAD & MANAGEMENT
  // ============================================================

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.notificationMessage.set('File harus berformat .xlsx');
      input.value = '';
      return;
    }

    this.file.set(file);
    this.isProcessing.set(true);

    try {
      const buffer = await file.arrayBuffer();
      const wb = ExcelEngine.readWorkbook(buffer);
      this.workbook = wb;
      this.sheetNames.set(wb.SheetNames);

      this.dataSource.set('upload');
      this.chartTitle.set(`Visualisasi - ${file.name}`);

      if (this.pendingPreset) {
        const p = this.pendingPreset;
        this.pendingPreset = null;
        this.applyConfiguration(p, this.activePresetName() || 'Konfigurasi Terpilih');
      } else if (wb.SheetNames.length > 0) {
        this.selectSheet(wb.SheetNames[0]);
      }
    } catch (err) {
      console.error('File Error:', err);
      this.notificationMessage.set(
        `Gagal membaca file: ${err instanceof Error ? err.message : 'Format tidak didukung.'}`,
      );
    } finally {
      this.isProcessing.set(false);
      input.value = '';
    }
  }

  clearFile(): void {
    this.file.set(null);
    this.workbook = null;
    this.sheetNames.set([]);
    this.selectedSheet.set('');
    this.sheetColumns.set([]);
    this.allColumns.set([]);
    this.categoryColumn.set('');
    this.selectedSeriesKeys.set([]);
    this.dataRows.set([]);
    this.originalDataRows.set([]);
    this.availableCategories.set([]);
    this.selectedCategories.set([]);
    this.seriesList.set([]);
    this.indicatorTargets.set({});
    this.dataSource.set('empty');
    this.showSettings.set(true);
  }

  // ============================================================
  // STEP 2 : PILIH SHEET & KONFIGURASI BARIS HEADER (MULTI-TIER)
  // ============================================================

  selectSheet(sheetName: string): void {
    if (!this.workbook) return;
    const worksheet = this.workbook.Sheets[sheetName];
    if (!worksheet) return;

    this.selectedSheet.set(sheetName);
    this.chartTitle.set(`Visualisasi Capaian Indikator - ${sheetName}`);
    this.chartSubtitle.set(`Sumber: ${this.file()?.name || 'File Excel'}`);

    const struct = ExcelEngine.detectSheetStructure(worksheet);
    this.headerStartRow.set(struct.headerStartRow);
    this.headerEndRow.set(struct.headerEndRow);
    this.dataStartRow.set(struct.dataStartRow);

    this.refreshSheetColumnsAndData(
      worksheet,
      struct.headerStartRow,
      struct.headerEndRow,
      struct.dataStartRow,
    );
  }

  refreshSheetColumnsAndData(
    worksheet: XLSX.WorkSheet,
    startRow: number,
    endRow: number,
    dataStart: number,
  ): void {
    const cols = ExcelEngine.extractSheetColumns(worksheet, startRow, endRow);
    this.sheetColumns.set(cols);
    this.allColumns.set(cols.map((c) => c.header));

    // Otomatis tentukan kolom kategori jika belum ada atau sudah berubah
    const colHeaders = cols.map((c) => c.header);
    let cat = this.categoryColumn();
    if (!cat || !colHeaders.includes(cat)) {
      cat =
        cols.find((c) => {
          const lower = c.header.toLowerCase();
          return (
            lower.includes('wilayah') ||
            lower.includes('kabupaten') ||
            lower.includes('kota') ||
            lower.includes('daerah') ||
            lower.includes('nama') ||
            lower.includes('puskesmas')
          );
        })?.header || (cols.length > 0 ? cols[0].header : '');
      this.categoryColumn.set(cat);
    }

    // Rekomendasi seri indikator (hanya kolom angka yang relevan, jangan semua!)
    let selectedSeries = this.selectedSeriesKeys().filter(
      (s) => s !== cat && colHeaders.includes(s),
    );

    if (selectedSeries.length === 0) {
      const sampleRows = ExcelEngine.readSheetRows(worksheet, cols, dataStart).slice(0, 10);
      const numericCols: string[] = [];

      for (const col of cols) {
        if (col.header === cat || col.header.startsWith('__') || col.header === 'No') {
          continue;
        }
        const hasNumber = sampleRows.some(
          (r) => IndicatorEvaluator.parseSmartNumber(r[col.header]) !== null,
        );
        if (hasNumber) {
          numericCols.push(col.header);
        }
      }
      selectedSeries = numericCols.slice(0, 4);
    }
    this.selectedSeriesKeys.set(selectedSeries);

    this.rebuildChartData(worksheet, cols, cat, selectedSeries, dataStart);
  }

  rebuildChartData(
    worksheet: XLSX.WorkSheet,
    cols: ColumnInfo[],
    catCol: string,
    seriesKeys: string[],
    dataStart: number,
  ): void {
    if (!catCol || seriesKeys.length === 0) {
      this.dataRows.set([]);
      this.availableCategories.set([]);
      this.selectedCategories.set([]);
      this.seriesList.set([]);
      return;
    }

    const rows = ExcelEngine.readSheetRows(worksheet, cols, dataStart);
    const cleanedRows = rows.filter((r) => {
      const val = String(r[catCol] ?? '').trim();
      if (!val) return false;
      const lower = val.toLowerCase();
      return (
        !lower.startsWith('total') &&
        !lower.startsWith('jumlah') &&
        !lower.startsWith('rata-rata') &&
        !lower.startsWith('sub total')
      );
    });

    const cats = Array.from(
      new Set(cleanedRows.map((r) => String(r[catCol] ?? '').trim()).filter(Boolean)),
    );

    const series: ChartSeriesConfig[] = seriesKeys.map((key, idx) => ({
      key,
      label: key,
      color: this.colorPalette[idx % this.colorPalette.length],
    }));

    this.dataRows.set(cleanedRows);
    this.originalDataRows.set(cleanedRows);
    this.availableCategories.set(cats);
    this.selectedCategories.set(cats);
    this.seriesList.set(series);
  }

  onHeaderStartRowChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1) {
      const nextEnd = Math.max(val, this.headerEndRow());
      this.headerStartRow.set(val);
      this.headerEndRow.set(nextEnd);
      const nextDataStart = Math.max(nextEnd + 1, this.dataStartRow());
      this.dataStartRow.set(nextDataStart);

      if (this.workbook && this.selectedSheet()) {
        const ws = this.workbook.Sheets[this.selectedSheet()];
        if (ws) {
          this.refreshSheetColumnsAndData(ws, val, nextEnd, nextDataStart);
        }
      }
    }
  }

  onHeaderEndRowChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1) {
      const nextStart = Math.min(val, this.headerStartRow());
      this.headerStartRow.set(nextStart);
      this.headerEndRow.set(val);
      const nextDataStart = Math.max(val + 1, this.dataStartRow());
      this.dataStartRow.set(nextDataStart);

      if (this.workbook && this.selectedSheet()) {
        const ws = this.workbook.Sheets[this.selectedSheet()];
        if (ws) {
          this.refreshSheetColumnsAndData(ws, nextStart, val, nextDataStart);
        }
      }
    }
  }

  onDataStartRowChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1) {
      this.dataStartRow.set(val);
      if (this.workbook && this.selectedSheet()) {
        const ws = this.workbook.Sheets[this.selectedSheet()];
        if (ws) {
          this.refreshSheetColumnsAndData(
            ws,
            this.headerStartRow(),
            this.headerEndRow(),
            val,
          );
        }
      }
    }
  }

  // ============================================================
  // STEP 3 : PILIH KOLOM KATEGORI (SUMBU Y) & SERI INDIKATOR (BATANG)
  // ============================================================

  candidateSeriesColumns = computed<ColumnInfo[]>(() => {
    const cat = this.categoryColumn();
    const q = this.columnSearchQuery().toLowerCase().trim();
    let cols = this.sheetColumns();
    if (cols.length === 0 && this.allColumns().length > 0) {
      cols = this.allColumns().map((col, idx) => ({
        colIndex: idx,
        colLetter: XLSX.utils.encode_col(idx),
        header: col,
        leafHeader: col,
        layers: [col],
      }));
    }
    const filtered = cols.filter(
      (c) =>
        c.header !== cat &&
        !c.header.startsWith('__') &&
        c.header !== 'No' &&
        c.header !== 'Capaian',
    );
    if (!q) return filtered;
    return filtered.filter(
      (c) =>
        c.header.toLowerCase().includes(q) ||
        c.leafHeader.toLowerCase().includes(q),
    );
  });

  private syncSeriesList(keys: string[]): void {
    const current = this.seriesList();
    const series: ChartSeriesConfig[] = keys.map((key, idx) => {
      const existing = current.find((s) => s.key === key);
      return (
        existing || {
          key,
          label: key,
          color: this.colorPalette[idx % this.colorPalette.length],
        }
      );
    });
    this.seriesList.set(series);
  }

  onCategoryColumnChange(newCat: string): void {
    this.categoryColumn.set(newCat);
    this.categorySearchQuery.set('');
    const updatedSeries = this.selectedSeriesKeys().filter((c) => c !== newCat);
    this.selectedSeriesKeys.set(updatedSeries);

    if (this.workbook && this.selectedSheet()) {
      const ws = this.workbook.Sheets[this.selectedSheet()];
      if (ws) {
        this.rebuildChartData(
          ws,
          this.sheetColumns(),
          newCat,
          updatedSeries,
          this.dataStartRow(),
        );
      }
    } else {
      const rows = this.originalDataRows().length > 0 ? this.originalDataRows() : this.dataRows();
      const cats = Array.from(
        new Set(rows.map((r) => String(r[newCat] ?? '').trim()).filter(Boolean)),
      );
      this.availableCategories.set(cats);
      this.selectedCategories.set(cats);
      this.syncSeriesList(updatedSeries);
    }
  }

  toggleSeriesColumn(colHeader: string): void {
    const current = this.selectedSeriesKeys();
    const exists = current.includes(colHeader);

    const updated = exists ? current.filter((c) => c !== colHeader) : [...current, colHeader];
    this.selectedSeriesKeys.set(updated);

    if (this.workbook && this.selectedSheet()) {
      const ws = this.workbook.Sheets[this.selectedSheet()];
      if (ws) {
        this.rebuildChartData(
          ws,
          this.sheetColumns(),
          this.categoryColumn(),
          updated,
          this.dataStartRow(),
        );
      }
    } else {
      this.syncSeriesList(updated);
    }
  }

  selectAllSeriesColumns(): void {
    const candidateHeaders = this.candidateSeriesColumns().map((c) => c.header);
    this.selectedSeriesKeys.set(candidateHeaders);
    if (this.workbook && this.selectedSheet()) {
      const ws = this.workbook.Sheets[this.selectedSheet()];
      if (ws) {
        this.rebuildChartData(
          ws,
          this.sheetColumns(),
          this.categoryColumn(),
          candidateHeaders,
          this.dataStartRow(),
        );
      }
    } else {
      this.syncSeriesList(candidateHeaders);
    }
  }

  clearAllSeriesColumns(): void {
    this.selectedSeriesKeys.set([]);
    if (this.workbook && this.selectedSheet()) {
      const ws = this.workbook.Sheets[this.selectedSheet()];
      if (ws) {
        this.rebuildChartData(
          ws,
          this.sheetColumns(),
          this.categoryColumn(),
          [],
          this.dataStartRow(),
        );
      }
    } else {
      this.seriesList.set([]);
    }
  }

  selectNumericSeriesColumns(): void {
    const cat = this.categoryColumn();
    const cols = this.candidateSeriesColumns();

    if (this.workbook && this.selectedSheet()) {
      const ws = this.workbook.Sheets[this.selectedSheet()];
      if (!ws) return;

      const allCols = this.sheetColumns();
      const sampleRows = ExcelEngine.readSheetRows(ws, allCols, this.dataStartRow()).slice(0, 15);
      const numericCols = cols
        .filter((c) =>
          sampleRows.some((r) => IndicatorEvaluator.parseSmartNumber(r[c.header]) !== null),
        )
        .map((c) => c.header);

      if (numericCols.length > 0) {
        this.selectedSeriesKeys.set(numericCols);
        this.rebuildChartData(ws, allCols, cat, numericCols, this.dataStartRow());
      }
    } else {
      const sampleRows = (this.originalDataRows().length > 0 ? this.originalDataRows() : this.dataRows()).slice(0, 15);
      const numericCols = cols
        .filter((c) =>
          sampleRows.some((r) => IndicatorEvaluator.parseSmartNumber(r[c.header]) !== null),
        )
        .map((c) => c.header);

      if (numericCols.length > 0) {
        this.selectedSeriesKeys.set(numericCols);
        this.syncSeriesList(numericCols);
      }
    }
  }

  // ============================================================
  // STEP 4 : KENDALI GRAFIK, FILTER WILAYAH & SORTING
  // ============================================================

  canRenderChart = computed<boolean>(() => {
    return (
      (this.dataSource() === 'join' &&
        this.seriesList().length > 0 &&
        this.dataRows().length > 0) ||
      (this.dataSource() === 'upload' &&
        !!this.selectedSheet() &&
        !!this.categoryColumn() &&
        this.seriesList().length > 0 &&
        this.dataRows().length > 0)
    );
  });

  filteredAvailableCategories = computed<string[]>(() => {
    const q = this.categorySearchQuery().toLowerCase().trim();
    const all = this.availableCategories();
    if (!q) return all;
    return all.filter((cat) => cat.toLowerCase().includes(q));
  });

  toggleCategory(cat: string): void {
    this.selectedCategories.update((current) =>
      current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat],
    );
  }

  isCategorySelected(cat: string): boolean {
    return this.selectedCategories().includes(cat);
  }

  selectAllCategories(): void {
    this.selectedCategories.set([...this.availableCategories()]);
  }

  clearAllCategories(): void {
    this.selectedCategories.set([]);
  }

  isSeriesActive(colKey: string): boolean {
    return this.seriesList().some((s) => s.key === colKey);
  }

  toggleSeries(colKey: string): void {
    const current = this.seriesList();
    const exists = current.find((s) => s.key === colKey);

    if (exists) {
      if (current.length <= 1) {
        return; // Minimal 1 seri
      }
      const updated = current.filter((s) => s.key !== colKey);
      this.seriesList.set(updated);
      this.selectedSeriesKeys.set(updated.map((s) => s.key));
    } else {
      const idx = current.length;
      const nextColor = this.colorPalette[idx % this.colorPalette.length];
      const updated = [...current, { key: colKey, label: colKey, color: nextColor }];
      this.seriesList.set(updated);
      this.selectedSeriesKeys.set(updated.map((s) => s.key));
    }
  }

  selectAllSeries(): void {
    this.selectAllSeriesColumns();
  }

  clearAllSeries(): void {
    this.clearAllSeriesColumns();
  }

  getSeriesColor(key: string): string {
    const active = this.seriesList().find((s) => s.key === key);
    if (active) return active.color;
    const idx = this.candidateSeriesColumns().findIndex((c) => c.header === key);
    return this.colorPalette[(idx >= 0 ? idx : 0) % this.colorPalette.length];
  }

  // Baris aktif yang ditampilkan (mengikuti urutan asli dari tabel data)
  visibleCategories = computed<string[]>(() => {
    const selected = this.selectedCategories();
    const available = this.availableCategories();
    return available.filter((cat) => selected.includes(cat));
  });

  // Alias untuk kompatibilitas
  sortedCategories = computed<string[]>(() => this.visibleCategories());

  // Hapus baris tertentu dari visualisasi
  deleteRow(cat: string): void {
    this.availableCategories.update((list) => list.filter((c) => c !== cat));
    this.selectedCategories.update((list) => list.filter((c) => c !== cat));
    this.dataRows.update((rows) =>
      rows.filter((r) => String(r[this.categoryColumn()] ?? '').trim() !== cat),
    );
    this.notificationMessage.set(`Baris "${cat}" berhasil dihapus dari visualisasi.`);
  }

  // Pulihkan semua baris yang dihapus/disembunyikan
  restoreAllRows(): void {
    const originals = this.originalDataRows();
    const catCol = this.categoryColumn();
    const cats = Array.from(
      new Set(originals.map((r) => String(r[catCol] ?? '').trim()).filter(Boolean)),
    );
    this.dataRows.set([...originals]);
    this.availableCategories.set(cats);
    this.selectedCategories.set(cats);
    this.notificationMessage.set(`Seluruh baris (${cats.length} baris) berhasil dipulihkan.`);
  }

  // Mengecek apakah ada baris yang disembunyikan atau dihapus
  hasHiddenOrDeletedRows = computed(() => {
    const origCount = this.originalDataRows().length;
    const activeCount = this.visibleCategories().length;
    return origCount > 0 && activeCount < origCount;
  });

  // ============================================================
  // TOOLTIP INTERAKTIF
  // ============================================================

  onBarHover(
    event: MouseEvent,
    bar: ChartBarItem,
    categoryName: string,
    targetOverride?: number | null,
  ): void {
    let status: 'achieved' | 'unachieved' | 'none' = 'none';
    let diff: number | null = null;
    const target =
      targetOverride !== undefined
        ? targetOverride
        : this.getIndicatorTarget(bar.seriesKey);

    if (target !== null && bar.numericVal !== null) {
      diff = Math.round((bar.numericVal - target) * 10) / 10;
      status = bar.numericVal >= target ? 'achieved' : 'unachieved';
    }

    this.hoveredBar.set({
      categoryName,
      seriesLabel: bar.seriesLabel,
      color: bar.color,
      displayLabel: bar.displayLabel,
      numericVal: bar.numericVal,
      isZero: bar.isZero,
      isMissing: bar.isMissing,
      status,
      diff,
      targetValue: target,
    });
    this.updateTooltipPosition(event);
  }

  onBarMouseMove(event: MouseEvent): void {
    if (this.hoveredBar()) {
      this.updateTooltipPosition(event);
    }
  }

  onBarLeave(): void {
    this.hoveredBar.set(null);
  }

  private updateTooltipPosition(event: MouseEvent): void {
    this.tooltipPos.set({
      x: event.clientX + 14,
      y: event.clientY + 14,
    });
  }

  closeNotification(): void {
    this.notificationMessage.set(null);
  }

  // ============================================================
  // PRESET CONFIGURATION (JSON & LOCALSTORAGE)
  // ============================================================

  exportConfiguration(): void {
    const sheet = this.selectedSheet() || (this.dataSource() === 'join' ? 'Hasil Join' : '');
    const series =
      this.selectedSeriesKeys().length > 0
        ? this.selectedSeriesKeys()
        : this.seriesList().map((s) => s.key);

    if (!sheet || series.length === 0) {
      this.configNotification.set({
        type: 'warning',
        message: 'Pilih sheet dan minimal 1 kolom indikator terlebih dahulu sebelum menyimpan konfigurasi.',
      });
      return;
    }

    const catCol = this.categoryColumn();
    const allOrigCats = Array.from(
      new Set(this.originalDataRows().map((r) => String(r[catCol] ?? '').trim()).filter(Boolean)),
    );
    const availableCats = this.availableCategories();
    const selectedCats = this.selectedCategories();

    const deletedRows = allOrigCats.filter((c) => !availableCats.includes(c));
    const hiddenRows = availableCats.filter((c) => !selectedCats.includes(c));

    const preset: ChartConfigurationPreset = {
      version: '1.0',
      name: this.file() ? `Konfigurasi - ${this.file()!.name}` : `Konfigurasi - ${sheet}`,
      savedAt: new Date().toISOString(),
      sheetName: sheet,
      headerStartRow: this.headerStartRow(),
      headerEndRow: this.headerEndRow(),
      dataStartRow: this.dataStartRow(),
      categoryColumn: catCol,
      seriesKeys: [...series],
      targetValue: this.targetValue(),
      chartTitle: this.chartTitle(),
      chartSubtitle: this.chartSubtitle(),
      hiddenRows,
      deletedRows,
      viewMode: this.viewMode(),
      indicatorTargets: { ...this.indicatorTargets() },
    };

    ChartPresetStore.savePreset(preset, true);
    this.hasSavedConfig.set(true);
    this.activePresetName.set(preset.name || 'Konfigurasi Tersimpan');

    this.configNotification.set({
      type: 'success',
      message: 'Konfigurasi grafik berhasil disimpan dan diunduh (.json)! Berkas ini juga tersimpan otomatis di browser ini.',
    });
  }

  onConfigFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const preset = ChartPresetStore.parsePresetJson(text);
        this.applyConfiguration(preset, file.name);
      } catch (err) {
        this.configNotification.set({
          type: 'warning',
          message: err instanceof Error ? err.message : 'Format berkas JSON konfigurasi tidak valid.',
        });
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  }

  loadSavedConfigurationFromStorage(): void {
    const preset = ChartPresetStore.loadLastPreset();
    if (!preset) {
      this.configNotification.set({
        type: 'info',
        message: 'Belum ada konfigurasi grafik tersimpan di browser ini.',
      });
      return;
    }
    this.applyConfiguration(preset, preset.name || 'Penyimpanan Lokal');
  }

  closeConfigNotification(): void {
    this.configNotification.set(null);
  }

  applyConfiguration(preset: ChartConfigurationPreset, sourceName: string): void {
    if (!preset || !preset.sheetName || !Array.isArray(preset.seriesKeys)) {
      this.configNotification.set({
        type: 'warning',
        message: 'Format konfigurasi grafik tidak valid.',
      });
      return;
    }

    ChartPresetStore.savePreset(preset, false);
    this.hasSavedConfig.set(true);
    this.activePresetName.set(sourceName);

    if (preset.viewMode) {
      this.viewMode.set(preset.viewMode);
    }

    if (preset.indicatorTargets) {
      this.indicatorTargets.set({ ...preset.indicatorTargets });
    }

    if (!this.workbook || this.sheetNames().length === 0) {
      if (this.dataSource() === 'join') {
        const allCols = this.allColumns();
        const colInfos: ColumnInfo[] = allCols.map((h, idx) => ({
          colIndex: idx,
          colLetter: XLSX.utils.encode_col(idx),
          header: h,
          leafHeader: h,
          layers: [h],
        }));
        this.sheetColumns.set(colInfos);
        const matchedCat = ChartPresetStore.findMatchingHeader(preset.categoryColumn, colInfos) || this.categoryColumn();
        if (matchedCat) {
          this.categoryColumn.set(matchedCat);
        }

        const matchedSeries: string[] = [];
        const unmatchedSeries: string[] = [];
        for (const s of preset.seriesKeys) {
          const m = ChartPresetStore.findMatchingHeader(s, colInfos);
          if (m) {
            matchedSeries.push(m);
          } else {
            unmatchedSeries.push(s);
          }
        }

        if (matchedSeries.length > 0) {
          this.selectedSeriesKeys.set(matchedSeries);
          const series: ChartSeriesConfig[] = matchedSeries.map((key, idx) => ({
            key,
            label: key,
            color: this.colorPalette[idx % this.colorPalette.length],
          }));
          this.seriesList.set(series);
        }

        if (preset.targetValue !== undefined) {
          this.targetValue.set(preset.targetValue);
        }
        if (preset.chartTitle) {
          this.chartTitle.set(preset.chartTitle);
        }
        if (preset.chartSubtitle) {
          this.chartSubtitle.set(preset.chartSubtitle);
        }
        if (preset.viewMode) {
          this.viewMode.set(preset.viewMode);
        }

        if (preset.deletedRows && Array.isArray(preset.deletedRows) && preset.deletedRows.length > 0) {
          const toDel = new Set(preset.deletedRows);
          this.availableCategories.update((list) => list.filter((c) => !toDel.has(c)));
          this.selectedCategories.update((list) => list.filter((c) => !toDel.has(c)));
          this.dataRows.update((rows) =>
            rows.filter((r) => !toDel.has(String(r[this.categoryColumn()] ?? '').trim())),
          );
        }

        if (preset.hiddenRows && Array.isArray(preset.hiddenRows) && preset.hiddenRows.length > 0) {
          const toHide = new Set(preset.hiddenRows);
          this.selectedCategories.update((curr) => curr.filter((c) => !toHide.has(c)));
        }

        if (unmatchedSeries.length === 0) {
          this.configNotification.set({
            type: 'success',
            message: `Konfigurasi "${sourceName}" berhasil dimuat 100%! Seluruh ${matchedSeries.length} seri indikator cocok sempurna.`,
          });
        } else {
          this.configNotification.set({
            type: 'warning',
            message: `Konfigurasi dimuat: ${matchedSeries.length} dari ${preset.seriesKeys.length} seri indikator cocok.`,
            details: [`Indikator tidak ditemukan: ${unmatchedSeries.join(', ')}`],
          });
        }
        return;
      }

      this.pendingPreset = preset;
      this.configNotification.set({
        type: 'info',
        message: `Konfigurasi "${sourceName}" berhasil dimuat! Silakan unggah file Excel (.xlsx), grafik akan otomatis dibuat.`,
      });
      return;
    }

    const availableSheets = this.sheetNames();
    const matchedSheet = ChartPresetStore.findMatchingSheet(preset.sheetName, availableSheets);

    if (!matchedSheet) {
      this.configNotification.set({
        type: 'warning',
        message: `Sheet "${preset.sheetName}" tidak ditemukan dalam file ini. Sheet tersedia: ${availableSheets.join(', ')}`,
      });
      return;
    }

    this.selectedSheet.set(matchedSheet);
    const hStart = preset.headerStartRow || 1;
    const hEnd = preset.headerEndRow || 1;
    const dStart = preset.dataStartRow || 2;

    this.headerStartRow.set(hStart);
    this.headerEndRow.set(hEnd);
    this.dataStartRow.set(dStart);

    const ws = this.workbook.Sheets[matchedSheet];
    if (!ws) {
      this.configNotification.set({
        type: 'warning',
        message: `Lembar kerja "${matchedSheet}" tidak dapat dibaca.`,
      });
      return;
    }

    const cols = ExcelEngine.extractSheetColumns(ws, hStart, hEnd);
    this.sheetColumns.set(cols);
    this.allColumns.set(cols.map((c) => c.header));

    const matchedCat =
      ChartPresetStore.findMatchingHeader(preset.categoryColumn, cols) ||
      (cols.length > 0 ? cols[0].header : '');
    this.categoryColumn.set(matchedCat);

    const matchedSeries: string[] = [];
    const unmatchedSeries: string[] = [];

    for (const s of preset.seriesKeys) {
      const m = ChartPresetStore.findMatchingHeader(s, cols);
      if (m) {
        matchedSeries.push(m);
      } else {
        unmatchedSeries.push(s);
      }
    }

    this.selectedSeriesKeys.set(matchedSeries);
    this.rebuildChartData(ws, cols, matchedCat, matchedSeries, dStart);

    if (preset.targetValue !== undefined) {
      this.targetValue.set(preset.targetValue);
    }
    if (preset.chartTitle) {
      this.chartTitle.set(preset.chartTitle);
    }
    if (preset.chartSubtitle) {
      this.chartSubtitle.set(preset.chartSubtitle);
    }
    if (preset.viewMode) {
      this.viewMode.set(preset.viewMode);
    }

    if (preset.deletedRows && Array.isArray(preset.deletedRows) && preset.deletedRows.length > 0) {
      const toDel = new Set(preset.deletedRows);
      this.availableCategories.update((list) => list.filter((c) => !toDel.has(c)));
      this.selectedCategories.update((list) => list.filter((c) => !toDel.has(c)));
      this.dataRows.update((rows) =>
        rows.filter((r) => !toDel.has(String(r[matchedCat] ?? '').trim())),
      );
    }

    if (preset.hiddenRows && Array.isArray(preset.hiddenRows) && preset.hiddenRows.length > 0) {
      const toHide = new Set(preset.hiddenRows);
      this.selectedCategories.update((curr) => curr.filter((c) => !toHide.has(c)));
    }

    if (unmatchedSeries.length === 0) {
      this.configNotification.set({
        type: 'success',
        message: `Konfigurasi "${sourceName}" berhasil dimuat 100%! Sheet "${matchedSheet}" dan seluruh ${matchedSeries.length} seri indikator cocok sempurna. Data langsung divisualisasikan.`,
      });
    } else {
      this.configNotification.set({
        type: 'warning',
        message: `Konfigurasi dimuat: ${matchedSeries.length} dari ${preset.seriesKeys.length} seri indikator cocok.`,
        details: [`Indikator tidak ditemukan: ${unmatchedSeries.join(', ')}`],
      });
    }
  }

  toggleSettingsPanel(): void {
    this.showSettingsPanel.set(!this.showSettingsPanel());
  }

  // ============================================================
  // EKSPOR GAMBAR (SVG & PNG)
  // ============================================================

  exportSvg(svgId = 'chartSvg', customFileName?: string): void {
    const svg =
      (document.getElementById(svgId) as SVGSVGElement | null) ||
      document.querySelector<SVGSVGElement>('#chartSvg') ||
      document.querySelector<SVGSVGElement>('svg.chart-canvas');
    if (!svg) return;

    this.downloadSvgElement(svg, customFileName || this.chartTitle());
  }

  exportPng(svgId = 'chartSvg', customFileName?: string): void {
    const svg =
      (document.getElementById(svgId) as SVGSVGElement | null) ||
      document.querySelector<SVGSVGElement>('#chartSvg') ||
      document.querySelector<SVGSVGElement>('svg.chart-canvas');
    if (!svg) return;

    this.downloadPngFromSvg(svg, customFileName || this.chartTitle());
  }

  private downloadSvgElement(svg: SVGSVGElement, title: string): void {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute(
      'style',
      'background-color: #ffffff; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
    );

    const serializer = new XMLSerializer();
    const svgString =
      '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(clone);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.slugify(title) || 'grafik-dinkes'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private downloadPngFromSvg(svg: SVGSVGElement, title: string): void {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute(
      'style',
      'background-color: #ffffff; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
    );

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const viewBoxStr = svg.getAttribute('viewBox') || '';
    const parts = viewBoxStr.split(' ').map(Number);
    const width = parts.length === 4 && parts[2] > 0 ? parts[2] : 960;
    const height = parts.length === 4 && parts[3] > 0 ? parts[3] : 600;
    const scale = 2;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `${this.slugify(title) || 'grafik-dinkes'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(pngUrl);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  // ============================================================
  // EKSPOR DATA KE EXCEL (.XLSX)
  // Data tabel bersih terfilter untuk membuat grafik bawaan Excel (Alt+F1 / Insert Chart)
  // ============================================================

  buildExcelWorkbook(): XLSX.WorkBook {
    const catCol = this.categoryColumn();
    const series = this.seriesList();
    const cats = this.visibleCategories();
    const rows = this.dataRows();

    // Pemetaan Data Berdasarkan Label Baris
    const rowMap = new Map<string, ChartDataRow>();
    for (const r of rows) {
      const key = String(r[catCol] ?? '').trim();
      if (key) {
        rowMap.set(key, r);
      }
    }

    const wb = XLSX.utils.book_new();

    // MODE PER INDIKATOR: Sheet terpisah sebanyak indikator yang digunakan,
    // masing-masing sheet hanya memiliki 2 kolom (Kolom Y dan Indikator)
    if (this.viewMode() === 'by-indicator') {
      const usedSheetNames = new Set<string>();

      for (let sIdx = 0; sIdx < series.length; sIdx++) {
        const s = series[sIdx];
        const headerRow = [catCol, s.label];
        const aoaData: (string | number | null)[][] = [headerRow];

        for (const cat of cats) {
          const rowObj = rowMap.get(cat);
          const rawVal = rowObj ? rowObj[s.key] : null;
          const num = IndicatorEvaluator.parseSmartNumber(rawVal);
          aoaData.push([cat, num !== null ? num : '']);
        }

        const ws = XLSX.utils.aoa_to_sheet(aoaData);

        // Styling Header dengan xlsx-js-style
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:B1');
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r: 0, c });
          if (ws[addr]) {
            ws[addr].s = {
              fill: { fgColor: { rgb: '2563EB' } }, // Biru Dinkes
              font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
              alignment: { horizontal: c === 0 ? 'left' : 'center', vertical: 'center' },
            };
          }
        }

        // Lebar kolom otomatis
        const colWidths = headerRow.map((h, idx) => {
          let maxLen = h.length;
          for (const r of aoaData.slice(1)) {
            const valStr = String(r[idx] ?? '');
            if (valStr.length > maxLen) maxLen = valStr.length;
          }
          return { wch: Math.max(maxLen + 4, 14) };
        });
        ws['!cols'] = colWidths;

        // Sanitasi nama sheet Excel (maks 31 karakter, hindari karakter ilegal Excel)
        let baseName = s.label.replace(/[\\/?*[\]:]/g, '_').trim() || `Indikator ${sIdx + 1}`;
        baseName = baseName.slice(0, 31);
        let sheetName = baseName;
        let counter = 2;
        while (usedSheetNames.has(sheetName.toLowerCase())) {
          const suffix = ` (${counter})`;
          sheetName = `${baseName.slice(0, 31 - suffix.length)}${suffix}`;
          counter++;
        }
        usedSheetNames.add(sheetName.toLowerCase());

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      return wb;
    }

    // MODE PER WILAYAH: 1 sheet tunggal menggabungkan seluruh seri indikator
    const headerRow = [catCol, ...series.map((s) => s.label)];
    const aoaData: (string | number | null)[][] = [headerRow];

    for (const cat of cats) {
      const rowObj = rowMap.get(cat);
      const rowValues: (string | number | null)[] = [cat];

      for (const s of series) {
        const rawVal = rowObj ? rowObj[s.key] : null;
        const num = IndicatorEvaluator.parseSmartNumber(rawVal);
        rowValues.push(num !== null ? num : '');
      }

      aoaData.push(rowValues);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoaData);

    // Styling Header dengan xlsx-js-style
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[addr]) {
        ws[addr].s = {
          fill: { fgColor: { rgb: '2563EB' } }, // Biru Dinkes
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { horizontal: c === 0 ? 'left' : 'center', vertical: 'center' },
        };
      }
    }

    // Lebar kolom otomatis
    const colWidths = headerRow.map((h, idx) => {
      let maxLen = h.length;
      for (const r of aoaData.slice(1)) {
        const valStr = String(r[idx] ?? '');
        if (valStr.length > maxLen) maxLen = valStr.length;
      }
      return { wch: Math.max(maxLen + 4, 14) };
    });
    ws['!cols'] = colWidths;

    const sheetTitle = (this.selectedSheet() || 'Data Visualisasi').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

    return wb;
  }

  exportExcel(): void {
    const series = this.seriesList();
    const cats = this.visibleCategories();

    if (cats.length === 0 || series.length === 0) {
      this.notificationMessage.set('Tidak ada baris atau kolom indikator yang dipilih untuk diekspor.');
      return;
    }

    const wb = this.buildExcelWorkbook();

    if (this.viewMode() === 'by-indicator') {
      const fileName = `${this.slugify(this.chartTitle()) || 'data-grafik-indikator'}.xlsx`;
      XLSX.writeFile(wb, fileName);
      this.notificationMessage.set(
        `Berkas "${fileName}" dengan ${series.length} sheet terpisah per indikator berhasil diunduh.`,
      );
      return;
    }

    const fileName = `${this.slugify(this.chartTitle()) || 'data-grafik-dinkes'}.xlsx`;
    XLSX.writeFile(wb, fileName);
    this.notificationMessage.set(`Berkas "${fileName}" berhasil diunduh. Buka di Excel dan tekan Alt+F1 untuk membuat grafik asli bawaan Excel.`);
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }

  // ============================================================
  // LAYOUT ENGINE COMPUTATION
  // ============================================================

  layout = computed<ChartLayoutResult>(() => {
    return ChartLayoutEngine.computeLayout({
      categoryColumn: this.categoryColumn(),
      categories: this.visibleCategories(),
      series: this.seriesList(),
      rows: this.dataRows(),
      targetValue: this.targetValue(),
      width: 960,
      margin: { top: 75, right: 95, bottom: 45, left: 200 },
    });
  });

  // ============================================================
  // PER-INDICATOR (PER-KOLOM) COMPARISON LAYOUTS
  // Menghasilkan kelompok grafik terpisah untuk setiap indikator yang dipilih
  // ============================================================

  indicatorLayouts = computed<IndicatorChartGroup[]>(() => {
    const series = this.seriesList();
    const catCol = this.categoryColumn();
    const rawCats = this.visibleCategories();
    const rows = this.dataRows();
    const sortMode = this.indicatorSortMode();

    const rowMap = new Map<string, ChartDataRow>();
    for (const r of rows) {
      const key = String(r[catCol] ?? '').trim().toLowerCase();
      if (key) {
        rowMap.set(key, r);
      }
    }

    return series.map((s) => {
      let cats = [...rawCats];
      const target = this.getIndicatorTarget(s.key);

      if (sortMode === 'desc' || sortMode === 'asc') {
        cats.sort((a, b) => {
          const rowA = rowMap.get(a.trim().toLowerCase());
          const rowB = rowMap.get(b.trim().toLowerCase());
          const valA = rowA ? IndicatorEvaluator.parseSmartNumber(rowA[s.key]) : null;
          const valB = rowB ? IndicatorEvaluator.parseSmartNumber(rowB[s.key]) : null;

          if (valA === null && valB === null) return 0;
          if (valA === null) return 1;
          if (valB === null) return -1;

          return sortMode === 'desc' ? valB - valA : valA - valB;
        });
      }

      let validCount = 0;
      let missingCount = 0;
      let zeroCount = 0;
      let achievedCount = 0;
      let sum = 0;
      let highest: { name: string; value: number } | null = null;
      let lowest: { name: string; value: number } | null = null;

      for (const cat of rawCats) {
        const r = rowMap.get(cat.trim().toLowerCase());
        const raw = r ? r[s.key] : null;
        const num = IndicatorEvaluator.parseSmartNumber(raw);

        if (num === null) {
          missingCount++;
        } else {
          validCount++;
          sum += num;
          if (num === 0) zeroCount++;
          if (target !== null && num >= target) achievedCount++;

          if (highest === null || num > highest.value) {
            highest = { name: cat, value: num };
          }
          if (lowest === null || num < lowest.value) {
            lowest = { name: cat, value: num };
          }
        }
      }

      const avgValue = validCount > 0 ? Math.round((sum / validCount) * 10) / 10 : null;

      const layout = ChartLayoutEngine.computeLayout({
        categoryColumn: catCol,
        categories: cats,
        series: [s],
        rows,
        targetValue: target,
        width: 960,
        rowHeight: 38,
        margin: { top: 60, right: 95, bottom: 40, left: 200 },
      });

      return {
        series: s,
        layout,
        stats: {
          total: rawCats.length,
          validCount,
          missingCount,
          zeroCount,
          achievedCount,
          avgValue,
          highest,
          lowest,
          targetValue: target,
        },
      };
    });
  });

  filteredIndicatorLayouts = computed<IndicatorChartGroup[]>(() => {
    const all = this.indicatorLayouts();
    const filter = this.selectedIndicatorFilter();
    if (filter === 'all') return all;
    const filtered = all.filter((item) => item.series.key === filter);
    return filtered.length > 0 ? filtered : all;
  });
}
