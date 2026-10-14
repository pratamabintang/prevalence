import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx-js-style';
import { ChartDataBridge } from '../../core/chart/chart-data-bridge';
import { StuntingDataBridge } from '../../core/stunting/stunting-data-bridge';
import { RegionNormalizer } from '../../core/domain/region-normalizer';
import {
  CapaianSummary,
  ColumnConfig,
  ColumnDataType,
  ColumnTargetConfig,
  IndicatorEvaluator,
  TargetOperator,
} from '../../core/evaluation/indicator-evaluator';
import { GasStorageService } from '../../core/storage/gas-storage.service';
import {
  ColumnHeaderMeta,
  ColumnInfo,
  ExcelEngine,
  HeaderGridCell,
  SummaryRowSpec,
} from '../../shared/excel';
import {
  JoinConfigurationPreset,
  PresetStore,
  SheetConfigPreset,
} from './preset-store';
import { DEFAULT_JOIN_CONFIG } from './default-join-config';

export type {
  ColumnConfig,
  ColumnDataType,
  ColumnTargetConfig,
  JoinConfigurationPreset,
  SheetConfigPreset,
  TargetOperator,
};

export interface SheetInfo {
  name: string;
  columns: ColumnInfo[];
  headers: string[];
  selected: boolean;
  variables: string[];
  joinColumn?: string;

  headerStartRow: number;
  headerEndRow: number;
  dataStartRow: number;
}

import {
  UiAlertComponent,
  UiButtonComponent,
  UiPageHeaderComponent,
} from '../../shared/ui';

export interface ResultRow {
  [key: string]: unknown;
}

@Component({
  selector: 'app-excel-join',
  standalone: true,
  imports: [
    FormsModule,
    UiPageHeaderComponent,
    UiButtonComponent,
    UiAlertComponent,
  ],
  templateUrl: './excel-join.component.html',
})
export class ExcelJoinComponent implements OnInit {
  private router = inject(Router);
  private chartDataBridge = inject(ChartDataBridge);
  private stuntingDataBridge = inject(StuntingDataBridge);
  gasStorageService = inject(GasStorageService);

  file = signal<File | null>(null);
  workbook: XLSX.WorkBook | null = null;

  // Kontrol Tampilan Settings (Tombol Gerigi) & Status Default Data
  showSettings = signal<boolean>(false);
  isDefaultData = signal<boolean>(false);
  isCloudDefault = signal<boolean>(false);

  // Status dan modal Google Apps Script Cloud Storage
  isSavingDefault = signal<boolean>(false);
  showSaveDefaultConfirm = signal<boolean>(false);
  showResetDefaultConfirm = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    await this.loadDefaultDataAndConfig();
  }

  toggleSettings(): void {
    this.showSettings.update((v) => !v);
  }

  async loadDefaultDataAndConfig(): Promise<void> {
    if (this.file() || this.resultRows().length > 0) {
      return;
    }

    try {
      this.isProcessing.set(true);

      // 1. Coba muat dari Google Apps Script jika URL sudah dikonfigurasi
      if (this.gasStorageService.isConfigured()) {
        try {
          const cloudRes = await this.gasStorageService.loadDefault();
          if (cloudRes.success && cloudRes.hasData && cloudRes.excelBuffer) {
            const fileName = cloudRes.fileName || 'default-join-data.xlsx';
            const cloudFile = new File(
              [cloudRes.excelBuffer],
              fileName,
              { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
            );

            this.file.set(cloudFile);
            this.workbook = ExcelEngine.readWorkbook(cloudRes.excelBuffer);
            this.loadSheets();

            if (cloudRes.config) {
              const preset = cloudRes.config as JoinConfigurationPreset;
              this.applyConfiguration(
                preset,
                preset.name || 'Default Google Drive',
              );
            } else {
              this.applyConfiguration(
                DEFAULT_JOIN_CONFIG,
                DEFAULT_JOIN_CONFIG.name || 'Konfigurasi Standar TW3',
              );
            }

            this.isDefaultData.set(true);
            this.isCloudDefault.set(true);
            this.showSettings.set(false);
            this.configNotification.set({
              type: 'success',
              message: 'Berhasil memuat file Excel dan konfigurasi default dari Google Drive.',
            });
            return;
          } else if (cloudRes.error) {
            this.configNotification.set({
              type: 'warning',
              message: `Penyimpanan Cloud: ${cloudRes.error}. Menggunakan template bawaan sistem.`,
            });
          }
        } catch (gasErr) {
          console.warn('Gagal memuat dari Google Apps Script:', gasErr);
        }
      }

      // 2. Fallback ke file aset bawaan sistem (/data/default-join-data.xlsx)
      const res = await fetch('/data/default-join-data.xlsx');
      if (!res.ok) {
        this.showSettings.set(true);
        return;
      }
      const arrayBuffer = await res.arrayBuffer();
      const defaultFile = new File(
        [arrayBuffer],
        'Format Analisas Intervensi Spesifik TW3 01102026.xlsx',
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      );

      this.file.set(defaultFile);
      this.workbook = ExcelEngine.readWorkbook(arrayBuffer);
      this.loadSheets();

      // Terapkan konfigurasi default (konfigurasi_join_excel_2026-10-08.json)
      this.applyConfiguration(
        DEFAULT_JOIN_CONFIG,
        DEFAULT_JOIN_CONFIG.name || 'Konfigurasi Standar TW3',
      );
      this.isDefaultData.set(true);
      this.isCloudDefault.set(false);
      this.showSettings.set(false);
    } catch {
      this.showSettings.set(true);
    } finally {
      this.isProcessing.set(false);
    }
  }

  async resetToDefaultData(): Promise<void> {
    this.clearFile();
    await this.loadDefaultDataAndConfig();
  }

  visualizeInChart(): void {
    const rows = this.resultRows();
    const cols = this.resultColumns();
    if (rows.length === 0 || cols.length === 0) {
      return;
    }

    const catCol = cols[0] || 'Wilayah';
    let target: number | null = null;
    const targets = this.columnTargets();
    for (const c of cols) {
      if (targets[c]?.enabled && targets[c]?.value !== null) {
        target = targets[c].value;
        break;
      }
    }

    const displayCols = cols.map((c) => this.getColumnDisplayName(c));
    const displayCatCol = this.getColumnDisplayName(catCol);
    const mappedRows = rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const c of cols) {
        out[this.getColumnDisplayName(c)] = r[c];
      }
      return out;
    });

    this.chartDataBridge.setData({
      title: this.file() ? `Grafik Hasil Join - ${this.file()!.name}` : 'Grafik Hasil Join Excel',
      source: 'join',
      categoryColumn: displayCatCol,
      columns: displayCols,
      rows: mappedRows,
      targetValue: target,
    });

    this.router.navigate(['/chart']);
  }

  transferToStuntingMonitoring(): void {
    const rows = this.resultRows();
    const cols = this.resultColumns();
    if (rows.length === 0 || cols.length === 0) {
      return;
    }

    const pKey = cols[0] || 'Wilayah';
    const displayPKey = this.getColumnDisplayName(pKey);
    const displayCols = cols.map((c) => this.getColumnDisplayName(c));

    const mappedRows = rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const c of cols) {
        out[this.getColumnDisplayName(c)] = r[c];
      }
      return out;
    });

    // Summary row (Jumlah) if enabled
    let summaryRow: Record<string, unknown> | undefined = undefined;
    if (this.enableJumlah()) {
      const sumObj: Record<string, unknown> = { [displayPKey]: 'TOTAL' };
      for (const col of cols) {
        if (col !== pKey && this.sumColumns()[col]) {
          const sum = this.getColumnSum(col);
          if (sum !== null) {
            sumObj[this.getColumnDisplayName(col)] = sum;
          }
        }
      }
      summaryRow = sumObj;
    }

    // Target row if enabled
    let targetRow: Record<string, unknown> | undefined = undefined;
    if (this.enableTarget()) {
      const tgtObj: Record<string, unknown> = { [displayPKey]: 'TARGET' };
      const targets = this.columnTargets();
      for (const col of cols) {
        if (col !== pKey && targets[col]?.enabled && targets[col]?.value !== null) {
          tgtObj[this.getColumnDisplayName(col)] = `${targets[col].operator} ${targets[col].value}`;
        }
      }
      targetRow = tgtObj;
    }

    // Average row if enabled
    let averageRow: Record<string, unknown> | undefined = undefined;
    if (this.enableAverage()) {
      const avgObj: Record<string, unknown> = { [displayPKey]: 'RATA-RATA' };
      for (const col of cols) {
        if (col !== pKey && this.avgColumns()[col]) {
          const avg = this.getColumnAverage(col);
          if (avg !== null) {
            avgObj[this.getColumnDisplayName(col)] = avg;
          }
        }
      }
      averageRow = avgObj;
    }

    this.stuntingDataBridge.setData({
      title: this.file() ? `Hasil Join - ${this.file()!.name}` : 'Hasil Join Excel',
      source: 'join',
      keyColumn: displayPKey,
      columns: displayCols,
      rows: mappedRows,
      summaryRow,
      targetRow,
      averageRow,
    });

    this.router.navigate(['/stunting-monitoring']);
  }

  // Fitur Simpan & Muat Konfigurasi Preset
  pendingPreset: JoinConfigurationPreset | null = null;
  preservedPreset: JoinConfigurationPreset | null = null;
  preservedPresetName: string | null = null;
  activePresetName = signal<string>('');
  configNotification = signal<{
    type: 'success' | 'warning' | 'info';
    message: string;
    details?: string[];
  } | null>(null);

  sheets = signal<SheetInfo[]>([]);
  joinBy = signal('');

  resultColumns = signal<string[]>([]);
  resultColumnsMeta = signal<ColumnHeaderMeta[]>([]);
  resultRows = signal<ResultRow[]>([]);
  originalResultRows = signal<ResultRow[]>([]);

  isProcessing = signal(false);
  isJoining = signal(false);

  errorMessage = signal('');

  // Pengaturan format output:
  // 'full': Hierarki bertingkat multi-baris (e.g. Header / Sub 1 / Sub 2)
  // 'concat': Gabungan teks hierarki dari atas ke bawah dengan '-' (e.g. "Header - Sub 1 - Sub 2")
  outputHeaderFormat = signal<'full' | 'concat'>('full');
  includeSheetPrefix = signal(false);

  // Kustomisasi nama kolom (alias) & urutan kolom hasil join
  customColumnNames = signal<Record<string, string>>({});
  defaultResultColumns = signal<string[]>([]);
  defaultResultColumnsMeta = signal<ColumnHeaderMeta[]>([]);
  hasAnyCustomColumnNames = computed(() => Object.keys(this.customColumnNames()).length > 0);

  // Pencarian variabel pada tiap sheet
  variableSearch = signal<Record<string, string>>({});

  // Fitur Strip 'Kabupaten' Saja pada Join Key
  stripKabupaten = signal(true);

  // ============================================================
  // FITUR TARGET & CAPAIAN
  // ============================================================
  enableTarget = signal(false);
  enableCapaian = signal(true);
  columnTargets = signal<Record<string, ColumnTargetConfig>>({});
  columnConfigs = signal<Record<string, ColumnConfig>>({});
  showColumnSettings = signal(false);
  showFormatSettings = signal(false);

  // Fitur Jumlah
  enableJumlah = signal(false);
  sumColumns = signal<Record<string, boolean>>({});

  activeSumColumnCount = computed(() => {
    if (!this.enableJumlah()) {
      return 0;
    }
    const cols = this.sumColumns();
    const configs = this.columnConfigs();
    return Object.entries(cols).filter(
      ([col, active]) => active && configs[col]?.dataType !== 'string',
    ).length;
  });

  // Fitur Rata-rata
  enableAverage = signal(false);
  avgColumns = signal<Record<string, boolean>>({});

  activeAvgColumnCount = computed(() => {
    if (!this.enableAverage()) {
      return 0;
    }
    const cols = this.avgColumns();
    const configs = this.columnConfigs();
    return Object.entries(cols).filter(
      ([col, active]) => active && configs[col]?.dataType !== 'string',
    ).length;
  });

  activeTargetCount = computed(() => {
    if (!this.enableTarget()) {
      return 0;
    }
    const targets = this.columnTargets();
    const configs = this.columnConfigs();
    return Object.entries(targets).filter(
      ([col, t]) => configs[col]?.dataType !== 'string' && t.enabled && t.value !== null,
    ).length;
  });

  activeAnomalyColumnCount = computed(() => {
    const configs = this.columnConfigs();
    return Object.values(configs).filter((c) => c.anomalyEnabled).length;
  });

  capaianStats = computed<CapaianSummary>(() => {
    return IndicatorEvaluator.calculateCapaianStats(
      this.resultRows(),
      this.resultColumns(),
      this.columnTargets(),
      this.columnConfigs(),
      this.enableTarget(),
      this.enableCapaian(),
    );
  });

  // ============================================================
  // COMPUTED PROPERTIES (HEADER HIERARCHY GRID)
  // ============================================================

  htmlHeaderGrid = computed<HeaderGridCell[][]>(() => {
    const meta = this.resultColumnsMeta();
    if (meta.length === 0) {
      return [];
    }

    const customNames = this.customColumnNames();
    const isConcat = this.outputHeaderFormat() === 'concat';

    const processedMeta: ColumnHeaderMeta[] = meta.map((m) => {
      const custom = customNames[m.key]?.trim();
      if (!custom) {
        if (isConcat) {
          return { ...m, layers: [m.layers.join(' - ')] };
        }
        return m;
      }
      if (isConcat) {
        return { ...m, layers: [custom] };
      } else {
        const nextLayers = [...m.layers];
        if (custom.includes(' - ')) {
          return { ...m, layers: custom.split(' - ').map((s) => s.trim()) };
        } else {
          nextLayers[nextLayers.length - 1] = custom;
          return { ...m, layers: nextLayers };
        }
      }
    });

    const allCols: ColumnHeaderMeta[] = [
      { key: '__aksi__', layers: ['Hapus'] },
      { key: '__no__', layers: ['No'] },
      ...processedMeta,
    ];

    if (this.enableTarget() && this.enableCapaian()) {
      allCols.push({ key: '__capaian__', layers: ['Capaian'] });
    }

    return ExcelEngine.buildHeaderGrid(allCols);
  });

  selectedSheets = computed(() => this.sheets().filter((sheet) => sheet.selected));

  commonJoinColumns = computed(() => {
    const selected = this.selectedSheets();

    if (selected.length < 2) {
      return [];
    }

    const firstSheet = selected[0];

    return firstSheet.headers.filter((header) =>
      selected.every((sheet) =>
        sheet.headers.some(
          (sheetHeader) => this.normalizeKey(sheetHeader) === this.normalizeKey(header),
        ),
      ),
    );
  });

  hasValidJoinColumns = computed(() => {
    const selected = this.selectedSheets();
    return selected.length >= 2 && selected.every((sheet) => !!this.getSheetJoinColumn(sheet));
  });

  canPreview = computed(() => {
    const selected = this.selectedSheets();

    return (
      selected.length >= 2 &&
      selected.every((sheet) => !!this.getSheetJoinColumn(sheet)) &&
      selected.every((sheet) => sheet.variables.length > 0)
    );
  });

  validationMessage = computed(() => {
    const selected = this.selectedSheets();

    if (selected.length < 2) {
      return 'Pilih minimal 2 sheet.';
    }

    const missingKeySheet = selected.find((sheet) => !this.getSheetJoinColumn(sheet));
    if (missingKeySheet) {
      return `Pilih kolom kunci join untuk sheet "${missingKeySheet.name}".`;
    }

    const invalidSheet = selected.find((sheet) => sheet.variables.length === 0);

    if (invalidSheet) {
      return `Pilih minimal 1 variabel dari sheet "${invalidSheet.name}".`;
    }

    return '';
  });

  // ============================================================
  // FILE SELECTION
  // ============================================================

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) {
      return;
    }

    const file = input.files[0];

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.errorMessage.set('File harus berformat .xlsx');
      input.value = '';
      return;
    }

    // 1. Simpan konfigurasi aktif sebelum reset
    // Prioritas: pendingPreset (unggah file json), konfigurasi aktif saat ini, atau preservedPreset (dari clearFile)
    const presetToApply =
      this.pendingPreset ||
      (this.selectedSheets().length > 0
        ? this.getCurrentPreset(this.activePresetName() || undefined)
        : null) ||
      this.preservedPreset;

    const presetNameToApply =
      this.activePresetName() ||
      this.preservedPresetName ||
      (this.isCloudDefault() ? 'Default Google Drive' : 'Konfigurasi Aktif');

    this.reset();

    this.isDefaultData.set(false);
    this.isCloudDefault.set(false);
    this.file.set(file);
    this.isProcessing.set(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = ExcelEngine.readWorkbook(buffer);

      this.workbook = workbook;
      this.loadSheets();

      if (presetToApply && presetToApply.sheets && presetToApply.sheets.length > 0) {
        // Cek apakah ada sheet pada workbook baru yang cocok dengan preset
        const matchedSheetMap = PresetStore.matchSheets(
          this.sheets().map((s) => s.name),
          presetToApply.sheets,
        );

        if (matchedSheetMap.size > 0) {
          // Ada sheet yang cocok! Terapkan konfigurasi aktif ke file baru
          this.pendingPreset = null;
          this.preservedPreset = null;
          this.preservedPresetName = null;
          this.applyConfiguration(presetToApply, presetNameToApply);

          // Jika data hasil join berhasil diekstrak, tutup panel pengaturan agar user langsung melihat preview tabel data baru
          if (this.resultRows().length > 0) {
            this.showSettings.set(false);
          } else {
            this.showSettings.set(true);
          }
          return;
        } else {
          // Workbook baru memiliki struktur sheet yang sama sekali berbeda
          this.preservedPreset = null;
          this.preservedPresetName = null;
          this.showSettings.set(true);
          this.configNotification.set({
            type: 'info',
            message: `File "${file.name}" berhasil dimuat. Sheet pada file baru berbeda dengan konfigurasi sebelumnya, silakan pilih sheet dan variabel.`,
          });
          return;
        }
      }

      this.showSettings.set(true);
    } catch (error) {
      console.error('EXCEL ERROR:', error);
      this.errorMessage.set(error instanceof Error ? error.message : 'Gagal membaca file Excel.');
    } finally {
      this.isProcessing.set(false);
      input.value = '';
    }
  }

  // ============================================================
  // SHEETS
  // ============================================================

  detectDefaultJoinColumn(columns: ColumnInfo[]): string {
    if (!columns || columns.length === 0) return '';
    const colHeaders = columns.map((c) => c.header);

    // 1. Prioritas Utama: Kolom Wilayah / Kabupaten / Kota
    const districtMatch = colHeaders.find((h) => {
      const l = h.toLowerCase();
      if (
        l.includes('dirujuk') ||
        l.includes('jumlah') ||
        l.includes('kasus') ||
        l.includes('%') ||
        l.includes('cakupan') ||
        l.includes('persentase') ||
        l.includes('total')
      ) {
        return false;
      }
      return (
        l.includes('kabupaten/kota') ||
        l.includes('kab/kota') ||
        l.includes('kabupaten') ||
        l.includes('kota') ||
        l.includes('wilayah') ||
        l.includes('nama_kab') ||
        l === 'kab' ||
        l.includes('daerah')
      );
    });
    if (districtMatch) return districtMatch;

    // 2. Prioritas Kedua: Unit Fasilitas / Faskes / Kecamatan / Puskesmas
    const unitMatch = colHeaders.find((h) => {
      const l = h.toLowerCase();
      if (
        l.includes('dirujuk') ||
        l.includes('jumlah') ||
        l.includes('kasus') ||
        l.includes('%') ||
        l.includes('cakupan') ||
        l.includes('persentase') ||
        l.includes('total')
      ) {
        return false;
      }
      return (
        l.includes('nama_puskesmas') ||
        l.includes('puskesmas') ||
        l.includes('kecamatan') ||
        l.includes('desa') ||
        l.includes('faskes') ||
        l.includes('unit') ||
        l === 'nama'
      );
    });
    if (unitMatch) return unitMatch;

    // 3. Cadangan: Jika kolom 0 adalah nomor urut ('No'), utamakan kolom 1
    if (colHeaders.length > 1 && /^(no|nomor|no\.)(\s|$)/i.test(colHeaders[0].trim())) {
      return colHeaders[1];
    }

    return colHeaders[0] || '';
  }

  private loadSheets(): void {
    if (!this.workbook) {
      return;
    }

    const sheets: SheetInfo[] = this.workbook.SheetNames.map((sheetName) => {
      const worksheet = this.workbook!.Sheets[sheetName];
      const struct = ExcelEngine.detectSheetStructure(worksheet);
      const columns = ExcelEngine.extractSheetColumns(
        worksheet,
        struct.headerStartRow,
        struct.headerEndRow,
      );
      const defaultJoin = this.detectDefaultJoinColumn(columns);

      return {
        name: sheetName,
        columns,
        headers: columns.map((col) => col.header),
        selected: false,
        variables: [],
        joinColumn: defaultJoin,
        headerStartRow: struct.headerStartRow,
        headerEndRow: struct.headerEndRow,
        dataStartRow: struct.dataStartRow,
      };
    });

    this.sheets.set(sheets);
  }

  updateSheetConfig(
    sheetName: string,
    updates: Partial<Pick<SheetInfo, 'headerStartRow' | 'headerEndRow' | 'dataStartRow'>>,
  ): void {
    if (!this.workbook) {
      return;
    }

    const worksheet = this.workbook.Sheets[sheetName];
    if (!worksheet) {
      return;
    }

    this.sheets.update((sheets) =>
      sheets.map((s) => {
        if (s.name !== sheetName) {
          return s;
        }

        const nextStart = updates.headerStartRow ?? s.headerStartRow;
        const nextEnd = updates.headerEndRow ?? s.headerEndRow;
        const nextDataStart = updates.dataStartRow ?? nextEnd + 1;

        const newColumns = ExcelEngine.extractSheetColumns(worksheet, nextStart, nextEnd);
        const nextJoinCol =
          s.joinColumn && newColumns.some((c) => c.header === s.joinColumn)
            ? s.joinColumn
            : this.detectDefaultJoinColumn(newColumns);

        return {
          ...s,
          headerStartRow: nextStart,
          headerEndRow: nextEnd,
          dataStartRow: nextDataStart,
          columns: newColumns,
          headers: newColumns.map((c) => c.header),
          joinColumn: nextJoinCol,
          variables: s.variables.filter((v) =>
            newColumns.some((c) => c.header === v) && this.normalizeKey(v) !== this.normalizeKey(nextJoinCol),
          ),
        };
      }),
    );

    this.clearResult();
  }

  onHeaderStartRowChange(sheet: SheetInfo, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1) {
      const nextEnd = Math.max(val, sheet.headerEndRow);
      this.updateSheetConfig(sheet.name, {
        headerStartRow: val,
        headerEndRow: nextEnd,
        dataStartRow: Math.max(nextEnd + 1, sheet.dataStartRow),
      });
    }
  }

  onHeaderEndRowChange(sheet: SheetInfo, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1) {
      const nextStart = Math.min(val, sheet.headerStartRow);
      this.updateSheetConfig(sheet.name, {
        headerStartRow: nextStart,
        headerEndRow: val,
        dataStartRow: Math.max(val + 1, sheet.dataStartRow),
      });
    }
  }

  onDataStartRowChange(sheet: SheetInfo, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1) {
      this.updateSheetConfig(sheet.name, {
        dataStartRow: val,
      });
    }
  }

  toggleSheet(sheet: SheetInfo): void {
    this.sheets.update((sheets) =>
      sheets.map((s) => {
        if (s.name === sheet.name) {
          const selected = !s.selected;
          return {
            ...s,
            selected,
            variables: [],
          };
        }
        return s;
      }),
    );

    const selected = this.selectedSheets();
    if (selected.length > 0) {
      this.joinBy.set(this.getSheetJoinColumn(selected[0]));
    } else {
      this.joinBy.set('');
    }
    this.clearResult();
  }

  getSheetJoinColumn(sheet: SheetInfo): string {
    if (sheet.joinColumn && sheet.columns.some((c) => c.header === sheet.joinColumn)) {
      return sheet.joinColumn;
    }
    return this.detectDefaultJoinColumn(sheet.columns);
  }

  updateSheetJoinColumn(sheetName: string, colHeader: string): void {
    this.sheets.update((sheets) =>
      sheets.map((s) => {
        if (s.name !== sheetName) return s;
        return {
          ...s,
          joinColumn: colHeader,
          variables: s.variables.filter(
            (v) => this.normalizeKey(v) !== this.normalizeKey(colHeader),
          ),
        };
      }),
    );
    const selected = this.selectedSheets();
    if (selected.length > 0) {
      this.joinBy.set(this.getSheetJoinColumn(selected[0]));
    }
    this.clearResult();
  }

  applyCommonJoinColumn(colHeader: string): void {
    if (!colHeader) return;
    this.joinBy.set(colHeader);
    this.sheets.update((sheets) =>
      sheets.map((s) => {
        if (!s.selected) return s;
        const matched = this.findHeader(s.headers, colHeader);
        if (matched) {
          return {
            ...s,
            joinColumn: matched,
            variables: s.variables.filter((v) => this.normalizeKey(v) !== this.normalizeKey(matched)),
          };
        }
        return s;
      }),
    );
    this.clearResult();
  }

  onJoinByChanged(newJoinBy?: string): void {
    if (newJoinBy !== undefined) {
      this.applyCommonJoinColumn(newJoinBy);
    }
  }

  toggleVariable(sheet: SheetInfo, variable: string): void {
    if (this.isJoinColumn(sheet, variable)) {
      return;
    }

    this.sheets.update((sheets) =>
      sheets.map((s) => {
        if (s.name !== sheet.name) {
          return s;
        }

        const exists = s.variables.some(
          (item) => this.normalizeKey(item) === this.normalizeKey(variable),
        );

        return {
          ...s,
          variables: exists
            ? s.variables.filter((item) => this.normalizeKey(item) !== this.normalizeKey(variable))
            : [...s.variables, variable],
        };
      }),
    );

    this.clearResult();
  }

  isVariableSelected(sheet: SheetInfo, variable: string): boolean {
    return sheet.variables.some((item) => this.normalizeKey(item) === this.normalizeKey(variable));
  }

  isJoinColumn(sheet: SheetInfo, variable: string): boolean {
    const sheetKey = this.getSheetJoinColumn(sheet);
    if (!sheetKey) {
      return false;
    }

    return this.normalizeKey(variable) === this.normalizeKey(sheetKey);
  }

  updateVariableSearch(sheetName: string, query: string): void {
    this.variableSearch.update((curr) => ({
      ...curr,
      [sheetName]: query,
    }));
  }

  getFilteredVariables(sheet: SheetInfo): string[] {
    const query = (this.variableSearch()[sheet.name] || '').trim().toLowerCase();
    if (!query) {
      return sheet.headers;
    }
    return sheet.headers.filter((header) => {
      const col = sheet.columns.find((c) => c.header === header);
      const letter = col?.colLetter?.toLowerCase() || '';
      const h = header.toLowerCase();
      const leaf = col?.leafHeader?.toLowerCase() || '';
      return (
        h.includes(query) ||
        letter === query ||
        letter.startsWith(query) ||
        leaf.includes(query)
      );
    });
  }

  getColumnLetter(sheet: SheetInfo, variable: string): string {
    const col = sheet.columns.find((c) => c.header === variable);
    return col?.colLetter || '';
  }

  selectAllVariables(sheet: SheetInfo): void {
    const filtered = this.getFilteredVariables(sheet);
    this.sheets.update((sheets) =>
      sheets.map((s) => {
        if (s.name !== sheet.name) return s;
        const newVars = Array.from(
          new Set([...s.variables, ...filtered.filter((v) => !this.isJoinColumn(s, v))]),
        );
        return { ...s, variables: newVars };
      }),
    );
    this.clearResult();
  }

  clearVariables(sheet: SheetInfo): void {
    this.sheets.update((sheets) =>
      sheets.map((s) => (s.name === sheet.name ? { ...s, variables: [] } : s)),
    );
    this.clearResult();
  }

  setOutputHeaderFormat(format: 'full' | 'concat'): void {
    this.outputHeaderFormat.set(format);
    if (this.resultRows().length > 0) {
      this.preview();
    }
  }

  toggleIncludeSheetPrefix(): void {
    this.includeSheetPrefix.set(!this.includeSheetPrefix());
    if (this.resultRows().length > 0) {
      this.preview();
    }
  }

  private getOutputColumnName(sheet: SheetInfo, variableHeader: string): string {
    const baseName = variableHeader;

    if (this.includeSheetPrefix()) {
      return `${sheet.name} - ${baseName}`;
    }

    return baseName;
  }

  // ============================================================
  // KUSTOMISASI NAMA KOLOM & URUTAN KOLOM
  // ============================================================

  getColumnDisplayName(col: string): string {
    const custom = this.customColumnNames()[col]?.trim();
    return custom || col;
  }

  getColumnCustomName(col: string): string {
    return this.customColumnNames()[col] || '';
  }

  hasCustomColumnName(col: string): boolean {
    return !!this.customColumnNames()[col]?.trim();
  }

  setColumnCustomName(col: string, name: string): void {
    this.customColumnNames.update((names) => {
      const trimmed = name.trim();
      if (!trimmed || trimmed === col) {
        const copy = { ...names };
        delete copy[col];
        return copy;
      }
      return { ...names, [col]: trimmed };
    });
  }

  resetColumnCustomName(col: string): void {
    this.customColumnNames.update((names) => {
      const copy = { ...names };
      delete copy[col];
      return copy;
    });
  }

  resetAllCustomColumnNames(): void {
    this.customColumnNames.set({});
  }

  moveColumn(fromIndex: number, toIndex: number): void {
    const cols = [...this.resultColumns()];
    const meta = [...this.resultColumnsMeta()];
    if (
      fromIndex < 1 ||
      fromIndex >= cols.length ||
      toIndex < 1 ||
      toIndex >= cols.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const [movedCol] = cols.splice(fromIndex, 1);
    cols.splice(toIndex, 0, movedCol);

    const [movedMeta] = meta.splice(fromIndex, 1);
    meta.splice(toIndex, 0, movedMeta);

    this.resultColumns.set(cols);
    this.resultColumnsMeta.set(meta);
  }

  moveColumnLeft(index: number): void {
    if (this.canMoveColumnLeft(index)) {
      this.moveColumn(index, index - 1);
    }
  }

  moveColumnRight(index: number): void {
    if (this.canMoveColumnRight(index)) {
      this.moveColumn(index, index + 1);
    }
  }

  canMoveColumnLeft(index: number): boolean {
    return index > 1;
  }

  canMoveColumnRight(index: number): boolean {
    return index >= 1 && index < this.resultColumns().length - 1;
  }

  resetColumnOrder(): void {
    const def = this.defaultResultColumns();
    if (def.length === 0) return;
    const currentMetaMap = new Map(this.resultColumnsMeta().map((m) => [m.key, m]));
    const nextMeta: ColumnHeaderMeta[] = [];
    for (const c of def) {
      const m = currentMetaMap.get(c);
      if (m) nextMeta.push(m);
    }
    this.resultColumns.set([...def]);
    this.resultColumnsMeta.set(nextMeta);
  }

  deleteRow(index: number): void {
    this.resultRows.update((rows) => rows.filter((_, i) => i !== index));
  }

  restoreRows(): void {
    this.resultRows.set(this.originalResultRows());
  }

  toggleStripKabupaten(): void {
    this.stripKabupaten.update((v) => !v);
    if (this.canPreview()) {
      this.preview();
    }
  }

  toggleTargetFeature(): void {
    const next = !this.enableTarget();
    this.enableTarget.set(next);
    if (next) {
      this.enableCapaian.set(true);
    }
  }

  toggleCapaianFeature(): void {
    this.enableCapaian.set(!this.enableCapaian());
  }

  updateTargetConfig(col: string, updates: Partial<ColumnTargetConfig>): void {
    this.columnTargets.update((targets) => {
      const prev = targets[col] || { enabled: false, operator: '>=', value: null };
      const next = { ...prev, ...updates };
      if (updates.value !== undefined) {
        next.enabled = updates.value !== null && !isNaN(updates.value);
      }
      return {
        ...targets,
        [col]: next,
      };
    });
  }

  onTargetOperatorChange(col: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.updateTargetConfig(col, { operator: select.value as TargetOperator });
  }

  onTargetValueChange(col: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawVal = input.value.trim();
    const val = rawVal === '' ? null : parseFloat(rawVal);
    this.updateTargetConfig(col, {
      value: val,
      enabled: val !== null && !isNaN(val),
    });
  }

  toggleColumnTarget(col: string): void {
    this.columnTargets.update((targets) => {
      const prev = targets[col] || { enabled: false, operator: '>=', value: null };
      const nextEnabled = !prev.enabled;
      let nextValue = prev.value;
      if (nextEnabled && (nextValue === null || isNaN(nextValue))) {
        const cfg = this.columnConfigs()[col];
        nextValue = cfg?.dataType === 'percentage' || col.includes('%') ? 80 : 0;
      }
      return {
        ...targets,
        [col]: {
          ...prev,
          enabled: nextEnabled,
          value: nextValue,
        },
      };
    });
  }

  selectAllPercentageColumnsForTarget(): void {
    const configs = this.columnConfigs();
    this.columnTargets.update((targets) => {
      const updated = { ...targets };
      this.resultColumns().forEach((col, idx) => {
        if (idx === 0) return;
        const cfg = configs[col];
        const isPct = cfg?.dataType === 'percentage' || (cfg?.dataType === 'auto' && col.includes('%'));
        if (isPct) {
          const prev = targets[col] || { enabled: false, operator: '>=', value: null };
          updated[col] = {
            ...prev,
            enabled: true,
            operator: prev.operator || '>=',
            value: prev.value !== null && !isNaN(prev.value) ? prev.value : 80,
          };
        }
      });
      return updated;
    });
  }

  clearAllTargetColumns(): void {
    this.columnTargets.update((targets) => {
      const updated: Record<string, ColumnTargetConfig> = {};
      for (const [col, t] of Object.entries(targets)) {
        updated[col] = {
          ...t,
          enabled: false,
        };
      }
      return updated;
    });
  }

  parseSmartNumber(value: unknown): number | null {
    return IndicatorEvaluator.parseSmartNumber(value);
  }

  isTargetAchieved(rowValue: unknown, target: ColumnTargetConfig): boolean {
    return IndicatorEvaluator.isTargetAchieved(rowValue, target);
  }

  getRowCapaian(row: ResultRow): number {
    if (!this.enableTarget()) {
      return 0;
    }
    return IndicatorEvaluator.calculateRowCapaian(
      row,
      this.resultColumns(),
      this.columnTargets(),
      this.columnConfigs(),
    );
  }

  toggleFormatSettings(): void {
    this.showFormatSettings.set(!this.showFormatSettings());
  }

  toggleColumnSettings(): void {
    this.showColumnSettings.set(!this.showColumnSettings());
  }

  setColumnDataType(col: string, dataType: ColumnDataType): void {
    this.columnConfigs.update((configs) => {
      const prev = configs[col] || {
        dataType: 'auto',
        anomalyEnabled: false,
        minAnomaly: 0,
        maxAnomaly: 100,
      };
      const anomalyEnabled = dataType === 'percentage' ? true : prev.anomalyEnabled;
      return {
        ...configs,
        [col]: {
          ...prev,
          dataType,
          anomalyEnabled,
        },
      };
    });

    this.convertColumnValuesInResultRows(col, dataType);
  }

  private convertColumnValuesInResultRows(col: string, dataType: ColumnDataType): void {
    const originals = this.originalResultRows();
    this.resultRows.update((rows) =>
      rows.map((row, index) => {
        const origRow = originals[index];
        const rawVal = origRow && origRow[col] !== undefined ? origRow[col] : row[col];

        if (this.isEmptyValue(rawVal)) {
          return { ...row, [col]: '' };
        }

        if (dataType === 'number' || dataType === 'percentage') {
          const num = IndicatorEvaluator.parseSmartNumber(rawVal);
          return { ...row, [col]: num !== null ? num : rawVal };
        } else if (dataType === 'string') {
          return { ...row, [col]: String(rawVal) };
        } else {
          const num = IndicatorEvaluator.parseSmartNumber(rawVal);
          if (typeof rawVal === 'string' && /^-?\d+([.,]\d+)?%?$/.test(rawVal.trim()) && num !== null) {
            return { ...row, [col]: num };
          }
          return { ...row, [col]: rawVal };
        }
      }),
    );
  }

  toggleColumnAnomaly(col: string): void {
    this.columnConfigs.update((configs) => {
      const prev = configs[col] || {
        dataType: 'auto',
        anomalyEnabled: false,
        minAnomaly: 0,
        maxAnomaly: 100,
      };
      return {
        ...configs,
        [col]: {
          ...prev,
          anomalyEnabled: !prev.anomalyEnabled,
        },
      };
    });
  }

  updateColumnMinAnomaly(col: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.trim() === '' ? null : parseFloat(input.value);
    this.columnConfigs.update((configs) => {
      const prev = configs[col] || {
        dataType: 'auto',
        anomalyEnabled: false,
        minAnomaly: 0,
        maxAnomaly: 100,
      };
      return {
        ...configs,
        [col]: {
          ...prev,
          minAnomaly: val,
        },
      };
    });
  }

  updateColumnMaxAnomaly(col: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.trim() === '' ? null : parseFloat(input.value);
    this.columnConfigs.update((configs) => {
      const prev = configs[col] || {
        dataType: 'auto',
        anomalyEnabled: false,
        minAnomaly: 0,
        maxAnomaly: 100,
      };
      return {
        ...configs,
        [col]: {
          ...prev,
          maxAnomaly: val,
        },
      };
    });
  }

  applyPercentagePresetToTargetColumns(): void {
    const targets = this.columnTargets();
    for (const col of this.resultColumns()) {
      if (col === this.resultColumns()[0]) continue;
      const t = targets[col];
      if (t && t.enabled) {
        this.setColumnDataType(col, 'percentage');
      }
    }
  }

  disableAllAnomalyFormatting(): void {
    this.columnConfigs.update((configs) => {
      const updated: Record<string, ColumnConfig> = {};
      for (const [col, cfg] of Object.entries(configs)) {
        updated[col] = {
          ...cfg,
          anomalyEnabled: false,
        };
      }
      return updated;
    });
  }

  resetAllColumnConfigs(): void {
    const updated: Record<string, ColumnConfig> = {};
    for (const col of this.resultColumns()) {
      updated[col] = {
        dataType: 'auto',
        anomalyEnabled: false,
        minAnomaly: 0,
        maxAnomaly: 100,
      };
      this.convertColumnValuesInResultRows(col, 'auto');
    }
    this.columnConfigs.set(updated);
  }

  toggleJumlahFeature(): void {
    this.enableJumlah.set(!this.enableJumlah());
  }

  toggleColumnSum(col: string): void {
    this.sumColumns.update((cols) => ({
      ...cols,
      [col]: !cols[col],
    }));
  }

  getColumnSum(col: string): number | null {
    if (!this.sumColumns()[col]) {
      return null;
    }
    return IndicatorEvaluator.calculateColumnSum(this.resultRows(), col);
  }

  formatSumValue(sum: number | null): string {
    return IndicatorEvaluator.formatSumValue(sum);
  }

  selectAllNumericColumnsForSum(): void {
    const updated: Record<string, boolean> = {};
    const configs = this.columnConfigs();
    this.resultColumns().forEach((col, idx) => {
      if (idx === 0) return;
      const cfg = configs[col];
      if (cfg?.dataType !== 'string' && cfg?.dataType !== 'percentage') {
        updated[col] = true;
      }
    });
    this.sumColumns.set(updated);
  }

  clearAllSumColumns(): void {
    this.sumColumns.set({});
  }

  private updateColumnSumsAfterPreview(columns: string[]): void {
    const current = this.sumColumns();
    const updated: Record<string, boolean> = {};
    for (const col of columns) {
      updated[col] = current[col] || false;
    }
    this.sumColumns.set(updated);
  }

  toggleAverageFeature(): void {
    this.enableAverage.set(!this.enableAverage());
  }

  toggleColumnAvg(col: string): void {
    this.avgColumns.update((cols) => ({
      ...cols,
      [col]: !cols[col],
    }));
  }

  getColumnAverage(col: string): number | null {
    if (!this.avgColumns()[col]) {
      return null;
    }
    return IndicatorEvaluator.calculateColumnAverage(this.resultRows(), col);
  }

  formatAverageValue(avg: number | null): string {
    return IndicatorEvaluator.formatAverageValue(avg);
  }

  selectAllNumericColumnsForAvg(): void {
    const updated: Record<string, boolean> = {};
    const configs = this.columnConfigs();
    this.resultColumns().forEach((col, idx) => {
      if (idx === 0) return;
      const cfg = configs[col];
      if (cfg?.dataType !== 'string') {
        updated[col] = true;
      }
    });
    this.avgColumns.set(updated);
  }

  clearAllAvgColumns(): void {
    this.avgColumns.set({});
  }

  private updateColumnAvgsAfterPreview(columns: string[]): void {
    const current = this.avgColumns();
    const updated: Record<string, boolean> = {};
    for (const col of columns) {
      updated[col] = current[col] || false;
    }
    this.avgColumns.set(updated);
  }

  getColumnSampleValue(column: string): string {
    const rows = this.resultRows();
    for (const r of rows) {
      const v = r[column];
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        const parsed = IndicatorEvaluator.parseSmartNumber(v);
        if (parsed !== null && typeof v === 'string' && v.includes(',')) {
          return `${v} → ${parsed}`;
        }
        return String(v);
      }
    }
    return '-';
  }

  formatCellValue(val: unknown, column: string): string {
    const config = this.columnConfigs()[column];
    return IndicatorEvaluator.formatCellValue(val, config);
  }

  getCellFormatClass(val: unknown, colKey: string): string {
    const config = this.columnConfigs()[colKey];
    const target = this.columnTargets()[colKey];
    return IndicatorEvaluator.getCellFormatClass(val, config, target, this.enableTarget());
  }

  getCapaianFormatClass(capaianValue: number): string {
    return IndicatorEvaluator.getCapaianFormatClass(capaianValue, this.capaianStats());
  }

  private updateColumnTargetsAfterPreview(columns: string[]): void {
    const current = this.columnTargets();
    const updated: Record<string, ColumnTargetConfig> = {};

    for (const col of columns) {
      if (current[col]) {
        updated[col] = current[col];
      } else {
        updated[col] = {
          enabled: false,
          operator: '>=',
          value: null,
        };
      }
    }

    this.columnTargets.set(updated);
  }

  private updateColumnConfigsAfterPreview(columns: string[]): void {
    const current = this.columnConfigs();
    const updated: Record<string, ColumnConfig> = {};

    columns.forEach((col, idx) => {
      if (current[col]) {
        updated[col] = current[col];
      } else {
        if (idx === 0) {
          updated[col] = {
            dataType: 'string',
            anomalyEnabled: false,
            minAnomaly: 0,
            maxAnomaly: 100,
          };
        } else {
          updated[col] = {
            dataType: 'auto',
            anomalyEnabled: false,
            minAnomaly: 0,
            maxAnomaly: 100,
          };
        }
      }
    });

    this.columnConfigs.set(updated);
  }

  // ============================================================
  // PRESET CONFIGURATION (JSON & LOCALSTORAGE)
  // ============================================================

  getCurrentPreset(customName?: string): JoinConfigurationPreset {
    const selected = this.selectedSheets();
    return {
      version: '1.0',
      name: customName || (this.file() ? `Konfigurasi - ${this.file()!.name}` : 'Konfigurasi Excel Join'),
      savedAt: new Date().toISOString(),
      outputHeaderFormat: this.outputHeaderFormat(),
      includeSheetPrefix: this.includeSheetPrefix(),
      joinBy: this.joinBy() || (selected[0] ? this.getSheetJoinColumn(selected[0]) : ''),
      stripKabupaten: this.stripKabupaten(),
      sheets: selected.map((s) => ({
        sheetName: s.name,
        headerStartRow: s.headerStartRow,
        headerEndRow: s.headerEndRow,
        dataStartRow: s.dataStartRow,
        joinColumn: this.getSheetJoinColumn(s),
        variables: [...s.variables],
      })),
      enableTarget: this.enableTarget(),
      enableCapaian: this.enableCapaian(),
      enableJumlah: this.enableJumlah(),
      enableAverage: this.enableAverage(),
      columnTargets: { ...this.columnTargets() },
      columnConfigs: { ...this.columnConfigs() },
      sumColumns: { ...this.sumColumns() },
      avgColumns: { ...this.avgColumns() },
      customColumnNames: { ...this.customColumnNames() },
      columnOrder: [...this.resultColumns()],
    };
  }

  exportConfiguration(): void {
    const selected = this.selectedSheets();
    if (selected.length === 0) {
      this.configNotification.set({
        type: 'warning',
        message: 'Pilih minimal 1 sheet dan variabel terlebih dahulu sebelum menyimpan konfigurasi.',
      });
      return;
    }

    const preset = this.getCurrentPreset();
    PresetStore.savePreset(preset, true);
    this.activePresetName.set(preset.name || 'Konfigurasi Tersimpan');

    this.configNotification.set({
      type: 'success',
      message: 'Konfigurasi berhasil disimpan dan diunduh (.json)!',
    });
  }

  // ============================================================
  // PENYIMPANAN EKSTERNAL GOOGLE APPS SCRIPT (CLOUD STORAGE)
  // ============================================================

  openSaveDefaultConfirm(): void {
    if (!this.file() && !this.workbook) {
      this.errorMessage.set('Silakan pilih atau muat file Excel terlebih dahulu.');
      return;
    }

    if (!this.gasStorageService.isConfigured()) {
      this.configNotification.set({
        type: 'warning',
        message: 'URL Google Apps Script belum dikonfigurasi di repositori utama (src/environments/environment.ts).',
      });
      return;
    }

    this.showSaveDefaultConfirm.set(true);
  }

  closeSaveDefaultConfirm(): void {
    this.showSaveDefaultConfirm.set(false);
  }

  async confirmSaveDefaultToCloud(): Promise<void> {
    if (!this.file() && !this.workbook) {
      this.showSaveDefaultConfirm.set(false);
      return;
    }

    try {
      this.isSavingDefault.set(true);

      let buffer: ArrayBuffer;
      if (this.file()) {
        buffer = await this.file()!.arrayBuffer();
      } else {
        const u8 = XLSX.write(this.workbook!, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
        buffer = u8.buffer as ArrayBuffer;
      }

      const preset = this.getCurrentPreset('Default Google Drive');
      const fileName = this.file()?.name || 'default-join-data.xlsx';

      const res = await this.gasStorageService.saveDefault(buffer, fileName, preset);
      if (res.success) {
        this.isDefaultData.set(true);
        this.isCloudDefault.set(true);
        this.showSaveDefaultConfirm.set(false);
        this.configNotification.set({
          type: 'success',
          message: res.message || 'File Excel dan konfigurasi default berhasil disimpan ke Google Drive (menimpa default lama).',
        });
      } else {
        this.configNotification.set({
          type: 'warning',
          message: res.error || 'Gagal menyimpan default ke Google Drive.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.errorMessage.set(`Gagal menyimpan default ke Google Drive: ${msg}`);
    } finally {
      this.isSavingDefault.set(false);
    }
  }

  openResetDefaultConfirm(): void {
    this.showResetDefaultConfirm.set(true);
  }

  closeResetDefaultConfirm(): void {
    this.showResetDefaultConfirm.set(false);
  }

  async confirmResetToFactoryDefault(): Promise<void> {
    this.showResetDefaultConfirm.set(false);
    this.preservedPreset = null;
    this.preservedPresetName = null;
    try {
      if (this.gasStorageService.isConfigured()) {
        await this.gasStorageService.resetDefault();
      }
    } catch (e) {
      console.warn('Gagal reset di Google Apps Script:', e);
    }
    await this.resetToDefaultData();
    this.configNotification.set({
      type: 'success',
      message: 'Data dan konfigurasi telah dikembalikan ke bawaan sistem awal.',
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
        const preset = PresetStore.parsePresetJson(text);
        this.applyConfiguration(preset, file.name);
      } catch (err) {
        this.configNotification.set({
          type: 'warning',
          message: 'Format file JSON tidak valid. Pastikan file adalah file konfigurasi yang benar.',
        });
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  }

  closeConfigNotification(): void {
    this.configNotification.set(null);
  }

  applyConfiguration(preset: JoinConfigurationPreset, sourceName: string): void {
    if (!preset || !Array.isArray(preset.sheets)) {
      this.configNotification.set({
        type: 'warning',
        message: 'Format konfigurasi tidak valid (data sheet tidak ditemukan).',
      });
      return;
    }

    PresetStore.savePreset(preset, false);
    this.activePresetName.set(sourceName);

    if (!this.workbook || this.sheets().length === 0) {
      this.pendingPreset = preset;
      this.configNotification.set({
        type: 'info',
        message: `Konfigurasi "${sourceName}" berhasil dimuat! Silakan unggah file Excel (.xlsx), konfigurasi dan join akan otomatis diekstrak.`,
      });
      return;
    }

    const availableSheets = this.sheets();
    const unmatchedSheets: string[] = [];
    const unmatchedVariables: { sheet: string; var: string }[] = [];
    let matchedSheetCount = 0;
    let matchedVarCount = 0;
    let totalPresetVarCount = 0;

    if (preset.outputHeaderFormat) {
      this.outputHeaderFormat.set(preset.outputHeaderFormat);
    }
    if (preset.includeSheetPrefix !== undefined) {
      this.includeSheetPrefix.set(preset.includeSheetPrefix);
    }

    // Pemetaan 1-ke-1 sheet workbook dengan preset sheets
    const matchedSheetMap = PresetStore.matchSheets(
      availableSheets.map((s) => s.name),
      preset.sheets,
    );

    const matchedSheetsOrdered: SheetInfo[] = [];
    const unmatchedSheetsList: SheetInfo[] = [];

    // Proses sheet preset sesuai urutan yang tersimpan dalam konfigurasi
    for (const ps of preset.sheets) {
      const currentSheet = availableSheets.find(
        (s) => matchedSheetMap.get(s.name) === ps,
      );

      if (!currentSheet) {
        unmatchedSheets.push(ps.sheetName);
        continue;
      }

      matchedSheetCount++;

      const hStart = ps.headerStartRow ?? currentSheet.headerStartRow;
      const hEnd = ps.headerEndRow ?? currentSheet.headerEndRow;
      const dStart = ps.dataStartRow ?? currentSheet.dataStartRow;

      let columns = currentSheet.columns;
      if (this.workbook) {
        const worksheet = this.workbook.Sheets[currentSheet.name];
        if (worksheet) {
          columns = ExcelEngine.extractSheetColumns(worksheet, hStart, hEnd);
        }
      }

      const availableHeaders = columns.map((c) => c.header);
      const selectedVars: string[] = [];

      for (const presetVar of ps.variables) {
        totalPresetVarCount++;
        const matchedHeader = PresetStore.findMatchingHeader(presetVar, columns);
        if (matchedHeader) {
          selectedVars.push(matchedHeader);
          matchedVarCount++;
        } else {
          unmatchedVariables.push({ sheet: currentSheet.name, var: presetVar });
        }
      }

      const defaultJoin = this.detectDefaultJoinColumn(columns);
      let matchedJoinCol = defaultJoin;
      if (ps.joinColumn) {
        matchedJoinCol = PresetStore.findMatchingHeader(ps.joinColumn, columns) || defaultJoin;
      } else if (preset.joinBy) {
        matchedJoinCol = PresetStore.findMatchingHeader(preset.joinBy, columns) || defaultJoin;
      }

      matchedSheetsOrdered.push({
        ...currentSheet,
        headerStartRow: hStart,
        headerEndRow: hEnd,
        dataStartRow: dStart,
        columns,
        headers: availableHeaders,
        selected: true,
        joinColumn: matchedJoinCol,
        variables: selectedVars,
      });
    }

    // Sheet yang tidak ada di preset diatur sebagai tidak terpilih
    for (const currentSheet of availableSheets) {
      if (!matchedSheetMap.has(currentSheet.name)) {
        unmatchedSheetsList.push({
          ...currentSheet,
          selected: false,
          variables: [],
        });
      }
    }

    const updatedSheets = [...matchedSheetsOrdered, ...unmatchedSheetsList];
    this.sheets.set(updatedSheets);

    const commonCols = this.commonJoinColumns();
    const matchedJoinBy = PresetStore.findMatchingJoinKey(preset.joinBy, commonCols);
    if (matchedJoinBy) {
      this.joinBy.set(matchedJoinBy);
    } else if (commonCols.length > 0) {
      this.joinBy.set(commonCols[0]);
    } else if (matchedSheetsOrdered.length > 0) {
      this.joinBy.set(this.getSheetJoinColumn(matchedSheetsOrdered[0]));
    }

    if (preset.stripKabupaten !== undefined) {
      this.stripKabupaten.set(preset.stripKabupaten);
    }
    if (preset.enableTarget !== undefined) {
      this.enableTarget.set(preset.enableTarget);
    }
    if (preset.enableCapaian !== undefined) {
      this.enableCapaian.set(preset.enableCapaian);
    }
    if (preset.enableJumlah !== undefined) {
      this.enableJumlah.set(preset.enableJumlah);
    }
    if (preset.enableAverage !== undefined) {
      this.enableAverage.set(preset.enableAverage);
    }

    if (this.canPreview()) {
      this.preview();
      this.reconcileOutputConfigs(preset);
    }

    const details: string[] = [];
    if (unmatchedSheets.length > 0) {
      details.push(`Sheet tidak ditemukan: ${unmatchedSheets.join(', ')}`);
    }
    if (unmatchedVariables.length > 0) {
      const varList = unmatchedVariables.map((v) => `"${v.var}" (${v.sheet})`).join(', ');
      details.push(`Variabel tidak ditemukan: ${varList}`);
    }

    if (unmatchedSheets.length === 0 && unmatchedVariables.length === 0) {
      this.configNotification.set({
        type: 'success',
        message: `Konfigurasi "${sourceName}" berhasil dimuat 100%! Seluruh ${matchedSheetCount} sheet dan ${matchedVarCount} variabel cocok sempurna. Data langsung diekstrak.`,
      });
    } else {
      this.configNotification.set({
        type: 'warning',
        message: `Konfigurasi dimuat: ${matchedSheetCount} sheet dan ${matchedVarCount} dari ${totalPresetVarCount} variabel cocok.`,
        details,
      });
    }
  }

  private reconcileOutputConfigs(preset: JoinConfigurationPreset): void {
    const cols = this.resultColumns();
    if (cols.length === 0) return;

    const findKey = (dict: Record<string, unknown>, col: string): string | undefined => {
      const colNorm = this.normalizeKey(col);
      const colClean = colNorm.replace(/[^a-z0-9]/g, '');
      const colBase = colClean.replace(/\d+$/, '');

      return Object.keys(dict).find((k) => {
        if (k === col) return true;
        const kNorm = this.normalizeKey(k);
        if (kNorm === colNorm) return true;
        const kClean = kNorm.replace(/[^a-z0-9]/g, '');
        if (kClean === colClean) return true;
        if (colBase.length > 5 && kClean.replace(/\d+$/, '') === colBase) return true;
        return false;
      });
    };

    if (preset.columnTargets) {
      const newTargets: Record<string, ColumnTargetConfig> = {};
      for (const col of cols) {
        const matchedKey = findKey(preset.columnTargets, col);
        if (matchedKey && preset.columnTargets[matchedKey]) {
          newTargets[col] = preset.columnTargets[matchedKey];
        }
      }
      if (Object.keys(newTargets).length > 0) {
        this.columnTargets.update((curr) => ({ ...curr, ...newTargets }));
      }
    }

    if (preset.columnConfigs) {
      const newConfigs: Record<string, ColumnConfig> = {};
      for (const col of cols) {
        const matchedKey = findKey(preset.columnConfigs, col);
        if (matchedKey && preset.columnConfigs[matchedKey]) {
          newConfigs[col] = preset.columnConfigs[matchedKey];
          if (preset.columnConfigs[matchedKey].dataType !== 'auto') {
            this.convertColumnValuesInResultRows(col, preset.columnConfigs[matchedKey].dataType);
          }
        }
      }
      if (Object.keys(newConfigs).length > 0) {
        this.columnConfigs.update((curr) => ({ ...curr, ...newConfigs }));
      }
    }

    if (preset.sumColumns) {
      const newSums: Record<string, boolean> = {};
      for (const col of cols) {
        const matchedKey = findKey(preset.sumColumns, col);
        if (matchedKey && preset.sumColumns[matchedKey] !== undefined) {
          newSums[col] = preset.sumColumns[matchedKey];
        }
      }
      if (Object.keys(newSums).length > 0) {
        this.sumColumns.update((curr) => ({ ...curr, ...newSums }));
      }
    }

    if (preset.avgColumns) {
      const newAvgs: Record<string, boolean> = {};
      for (const col of cols) {
        const matchedKey = findKey(preset.avgColumns, col);
        if (matchedKey && preset.avgColumns[matchedKey] !== undefined) {
          newAvgs[col] = preset.avgColumns[matchedKey];
        }
      }
      if (Object.keys(newAvgs).length > 0) {
        this.avgColumns.update((curr) => ({ ...curr, ...newAvgs }));
      }
    }

    if (preset.customColumnNames) {
      const newCustomNames: Record<string, string> = {};
      for (const col of cols) {
        const matchedKey = findKey(preset.customColumnNames, col);
        if (matchedKey && preset.customColumnNames[matchedKey]) {
          newCustomNames[col] = preset.customColumnNames[matchedKey];
        }
      }
      if (Object.keys(newCustomNames).length > 0) {
        this.customColumnNames.set(newCustomNames);
      }
    }

    if (preset.columnOrder && preset.columnOrder.length > 0) {
      const currentCols = [...this.resultColumns()];
      const currentMetaMap = new Map(this.resultColumnsMeta().map((m) => [m.key, m]));
      const orderedCols: string[] = [];
      const orderedMeta: ColumnHeaderMeta[] = [];

      for (const ord of preset.columnOrder) {
        const matched = currentCols.find((c) => this.normalizeKey(c) === this.normalizeKey(ord));
        if (matched && !orderedCols.includes(matched)) {
          orderedCols.push(matched);
          const m = currentMetaMap.get(matched);
          if (m) orderedMeta.push(m);
        }
      }
      for (const c of currentCols) {
        if (!orderedCols.includes(c)) {
          orderedCols.push(c);
          const m = currentMetaMap.get(c);
          if (m) orderedMeta.push(m);
        }
      }

      if (orderedCols.length > 0) {
        this.resultColumns.set(orderedCols);
        this.resultColumnsMeta.set(orderedMeta);
      }
    }
  }

  // ============================================================
  // JOIN EXECUTION
  // ============================================================

  preview(): void {
    if (!this.canPreview() || !this.workbook) {
      return;
    }

    this.errorMessage.set('');
    this.clearResult();
    this.isJoining.set(true);

    try {
      const selectedSheets = this.selectedSheets();
      const currentJoinBy = this.joinBy();

      const masterSheet = selectedSheets[0];
      const masterWorksheet = this.workbook.Sheets[masterSheet.name];
      const masterRows = ExcelEngine.readSheetRows(
        masterWorksheet,
        masterSheet.columns,
        masterSheet.dataStartRow,
      );

      const masterJoinHeader =
        this.findHeader(masterSheet.headers, this.getSheetJoinColumn(masterSheet)) ||
        this.getSheetJoinColumn(masterSheet);

      if (!masterJoinHeader) {
        throw new Error(`Kolom join tidak ditentukan untuk sheet "${masterSheet.name}".`);
      }

      const outputColMap = new Map<string, string>();
      const outputMetaList: ColumnHeaderMeta[] = [];
      const usedOutputNames = new Map<string, number>();

      const joinByOutputName = masterJoinHeader;
      usedOutputNames.set(this.normalizeKey(joinByOutputName), 1);

      const masterJoinCol = masterSheet.columns.find((c) => c.header === masterJoinHeader);
      const joinKeyLayers =
        masterJoinCol && masterJoinCol.layers && masterJoinCol.layers.length > 0
          ? masterJoinCol.layers
          : [joinByOutputName];

      outputMetaList.push({
        key: joinByOutputName,
        layers: this.outputHeaderFormat() === 'concat'
          ? [joinKeyLayers.join(' - ')]
          : joinKeyLayers,
      });

      for (const variable of masterSheet.variables) {
        const rawName = this.getOutputColumnName(masterSheet, variable);
        let finalName = rawName;
        const norm = this.normalizeKey(rawName);
        const count = usedOutputNames.get(norm) || 0;
        if (count > 0) {
          finalName = `${rawName} (${masterSheet.name})`;
        }
        usedOutputNames.set(norm, count + 1);
        outputColMap.set(`${masterSheet.name}:::${variable}`, finalName);

        const col = masterSheet.columns.find((c) => c.header === variable);
        let layers = col && col.layers && col.layers.length > 0 ? [...col.layers] : [variable];
        if (this.outputHeaderFormat() === 'concat') {
          const fullConcat = layers.join(' - ');
          const finalConcat = this.includeSheetPrefix() ? `${masterSheet.name} - ${fullConcat}` : fullConcat;
          layers = [count > 0 ? `${finalConcat} (${masterSheet.name})` : finalConcat];
        } else {
          if (this.includeSheetPrefix()) {
            layers = [masterSheet.name, ...layers];
          }
          if (count > 0) {
            layers[layers.length - 1] = `${layers[layers.length - 1]} (${masterSheet.name})`;
          }
        }

        outputMetaList.push({
          key: finalName,
          layers,
        });
      }

      for (let index = 1; index < selectedSheets.length; index++) {
        const sheet = selectedSheets[index];
        for (const variable of sheet.variables) {
          const rawName = this.getOutputColumnName(sheet, variable);
          let finalName = rawName;
          const norm = this.normalizeKey(rawName);
          const count = usedOutputNames.get(norm) || 0;
          if (count > 0) {
            finalName = `${rawName} (${sheet.name})`;
          }
          usedOutputNames.set(norm, count + 1);
          outputColMap.set(`${sheet.name}:::${variable}`, finalName);

          const col = sheet.columns.find((c) => c.header === variable);
          let layers = col && col.layers && col.layers.length > 0 ? [...col.layers] : [variable];
          if (this.outputHeaderFormat() === 'concat') {
            const fullConcat = layers.join(' - ');
            const finalConcat = this.includeSheetPrefix() ? `${sheet.name} - ${fullConcat}` : fullConcat;
            layers = [count > 0 ? `${finalConcat} (${sheet.name})` : finalConcat];
          } else {
            if (this.includeSheetPrefix()) {
              layers = [sheet.name, ...layers];
            }
            if (count > 0) {
              layers[layers.length - 1] = `${layers[layers.length - 1]} (${sheet.name})`;
            }
          }

          outputMetaList.push({
            key: finalName,
            layers,
          });
        }
      }

      const joinedMap = new Map<string, ResultRow>();

      // Master sheet
      for (const row of masterRows) {
        const joinValue = row[masterJoinHeader];

        if (this.isEmptyValue(joinValue)) {
          continue;
        }

        const key = RegionNormalizer.normalizeJoinKey(joinValue, this.stripKabupaten());
        const displayJoinValue = this.stripKabupaten()
          ? RegionNormalizer.cleanKabupatenPrefix(joinValue)
          : RegionNormalizer.cleanCodePrefix(joinValue);

        const result: ResultRow = {
          [joinByOutputName]: displayJoinValue,
        };

        for (const variable of masterSheet.variables) {
          const actualHeader = this.findHeader(masterSheet.headers, variable);
          if (!actualHeader) {
            continue;
          }
          const outCol = outputColMap.get(`${masterSheet.name}:::${variable}`) || variable;
          result[outCol] = row[actualHeader];
        }

        joinedMap.set(key, result);
      }

      // Subsequent sheets (Left Join)
      for (let index = 1; index < selectedSheets.length; index++) {
        const sheet = selectedSheets[index];
        const worksheet = this.workbook.Sheets[sheet.name];
        const rows = ExcelEngine.readSheetRows(worksheet, sheet.columns, sheet.dataStartRow);
        const joinHeader =
          this.findHeader(sheet.headers, this.getSheetJoinColumn(sheet)) ||
          this.getSheetJoinColumn(sheet);

        if (!joinHeader) {
          continue;
        }

        for (const row of rows) {
          const joinValue = row[joinHeader];

          if (this.isEmptyValue(joinValue)) {
            continue;
          }

          const key = RegionNormalizer.normalizeJoinKey(joinValue, this.stripKabupaten());
          const existing = joinedMap.get(key);

          if (!existing) {
            continue;
          }

          for (const variable of sheet.variables) {
            const actualHeader = this.findHeader(sheet.headers, variable);
            if (!actualHeader) {
              continue;
            }
            const outCol = outputColMap.get(`${sheet.name}:::${variable}`) || variable;
            existing[outCol] = row[actualHeader];
          }
        }
      }

      const rows = Array.from(joinedMap.values());
      this.resultRows.set(rows);
      this.originalResultRows.set(rows);

      if (rows.length > 0) {
        const cols = Object.keys(rows[0]);
        this.resultColumns.set(cols);
        this.resultColumnsMeta.set(outputMetaList);
        this.defaultResultColumns.set([...cols]);
        this.defaultResultColumnsMeta.set([...outputMetaList]);
        this.updateColumnTargetsAfterPreview(cols);
        this.updateColumnConfigsAfterPreview(cols);
        this.updateColumnSumsAfterPreview(cols);
        this.updateColumnAvgsAfterPreview(cols);
      }
    } catch (error) {
      console.error('JOIN ERROR:', error);
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Terjadi error ketika melakukan join.',
      );
    } finally {
      this.isJoining.set(false);
    }
  }

  // ============================================================
  // EXPORT TO EXCEL
  // ============================================================

  exportToExcel(): void {
    if (this.resultRows().length === 0 || this.resultColumns().length === 0) {
      return;
    }

    const customNames = this.customColumnNames();
    const isConcat = this.outputHeaderFormat() === 'concat';

    const processedMeta: ColumnHeaderMeta[] = this.resultColumnsMeta().map((m) => {
      const custom = customNames[m.key]?.trim();
      if (!custom) {
        if (isConcat) {
          return { ...m, layers: [m.layers.join(' - ')] };
        }
        return m;
      }
      if (isConcat) {
        return { ...m, layers: [custom] };
      } else {
        const nextLayers = [...m.layers];
        if (custom.includes(' - ')) {
          return { ...m, layers: custom.split(' - ').map((s) => s.trim()) };
        } else {
          nextLayers[nextLayers.length - 1] = custom;
          return { ...m, layers: nextLayers };
        }
      }
    });

    const excelCols: ColumnHeaderMeta[] = [
      { key: 'No', layers: ['No'] },
      ...processedMeta,
    ];

    if (this.enableTarget() && this.enableCapaian()) {
      excelCols.push({ key: 'Capaian', layers: ['Capaian'] });
    }

    const dataRows = this.resultRows().map((row, i) => {
      const rowValues: Record<string, unknown> = {};
      for (const col of excelCols) {
        if (col.key === 'No') {
          rowValues['No'] = i + 1;
        } else if (col.key === 'Capaian') {
          rowValues['Capaian'] = this.getRowCapaian(row);
        } else {
          const cfg = this.columnConfigs()[col.key];
          const rawVal = row[col.key];
          if (cfg?.dataType === 'string') {
            rowValues[col.key] = rawVal !== null && rawVal !== undefined ? String(rawVal) : '';
          } else {
            const num = IndicatorEvaluator.parseSmartNumber(rawVal);
            rowValues[col.key] = num !== null ? num : (rawVal ?? '');
          }
        }
      }
      return rowValues;
    });

    const summaryRows: SummaryRowSpec[] = [];

    // 1. Summary row: Jumlah
    if (this.enableJumlah()) {
      const jumlahValues: Record<string, unknown> = {};
      for (let c = 0; c < excelCols.length; c++) {
        const col = excelCols[c];
        if (col.key === 'No') {
          jumlahValues['No'] = '-';
        } else if (c === 1) {
          jumlahValues[col.key] = 'Jumlah';
        } else if (col.key === 'Capaian') {
          jumlahValues['Capaian'] = '-';
        } else {
          if (this.sumColumns()[col.key]) {
            const sum = this.getColumnSum(col.key);
            jumlahValues[col.key] = sum !== null ? sum : '-';
          } else {
            jumlahValues[col.key] = '-';
          }
        }
      }
      summaryRows.push({
        values: jumlahValues,
        styler: (_colKey, _val, colIdx) => ({
          font: { bold: true, color: { rgb: '065F46' }, sz: 10 },
          fill: { fgColor: { rgb: 'ECFDF5' } },
          alignment: {
            horizontal: colIdx === 1 ? 'left' : 'center',
            vertical: 'center',
          },
        }),
      });
    }

    // Summary row: Rata-rata
    if (this.enableAverage()) {
      const avgValues: Record<string, unknown> = {};
      for (let c = 0; c < excelCols.length; c++) {
        const col = excelCols[c];
        if (col.key === 'No') {
          avgValues['No'] = '-';
        } else if (c === 1) {
          avgValues[col.key] = 'Rata-rata';
        } else if (col.key === 'Capaian') {
          avgValues['Capaian'] = '-';
        } else {
          if (this.avgColumns()[col.key]) {
            const avg = this.getColumnAverage(col.key);
            avgValues[col.key] = avg !== null ? avg : '-';
          } else {
            avgValues[col.key] = '-';
          }
        }
      }
      summaryRows.push({
        values: avgValues,
        styler: (_colKey, _val, colIdx) => ({
          font: { bold: true, color: { rgb: '0369A1' }, sz: 10 },
          fill: { fgColor: { rgb: 'F0F9FF' } },
          alignment: {
            horizontal: colIdx === 1 ? 'left' : 'center',
            vertical: 'center',
          },
        }),
      });
    }

    // 2. Summary row: Target
    if (this.enableTarget()) {
      const targetValues: Record<string, unknown> = {};
      const targets = this.columnTargets();

      for (let c = 0; c < excelCols.length; c++) {
        const col = excelCols[c];
        if (col.key === 'No') {
          targetValues['No'] = '-';
        } else if (c === 1) {
          targetValues[col.key] = 'Target';
        } else if (col.key === 'Capaian') {
          targetValues['Capaian'] = this.activeTargetCount();
        } else {
          const cfg = this.columnConfigs()[col.key];
          if (cfg?.dataType === 'string') {
            targetValues[col.key] = '-';
          } else {
            const t = targets[col.key];
            if (t && t.enabled && t.value !== null) {
              targetValues[col.key] = `${t.operator} ${t.value}`;
            } else {
              targetValues[col.key] = '-';
            }
          }
        }
      }

      summaryRows.push({
        values: targetValues,
        styler: (_colKey, _val, colIdx) => ({
          font: { bold: true, color: { rgb: '3730A3' }, sz: 10 },
          fill: { fgColor: { rgb: 'EEF2FF' } },
          alignment: {
            horizontal: colIdx === 1 ? 'left' : 'center',
            vertical: 'center',
          },
        }),
      });
    }

    const stats = this.capaianStats();

    ExcelEngine.exportStyledTable({
      fileName: `Hasil_Join_Excel_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'Hasil Join',
      columns: excelCols,
      dataRows,
      summaryRows,
      cellStyler: (_row, colKey, val, colIndex) => {
        if (colKey === 'No') {
          return {
            font: { color: { rgb: '475569' }, sz: 10, bold: true },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }

        if (colKey === 'Capaian') {
          const valNum = typeof val === 'number' ? val : parseFloat(String(val));
          let fillRgb = '';
          let fontRgb = '334155';

          if (!isNaN(valNum) && stats.min !== null && stats.max !== null && stats.min !== stats.max) {
            if (valNum === stats.max) {
              fillRgb = 'DBEAFE';
              fontRgb = '1E40AF';
            } else if (valNum === stats.min) {
              fillRgb = 'FEE2E2';
              fontRgb = '991B1B';
            }
          }

          return {
            font: { color: { rgb: fontRgb }, sz: 10, bold: true },
            fill: fillRgb ? { fgColor: { rgb: fillRgb } } : undefined,
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }

        const cfg = this.columnConfigs()[colKey];
        const isStringCol = cfg?.dataType === 'string';
        const num = IndicatorEvaluator.parseSmartNumber(val);
        let fillRgb = '';
        let fontRgb = '334155';

        if (!isStringCol && num !== null) {
          if (cfg?.anomalyEnabled) {
            const min = cfg.minAnomaly ?? 0;
            const max = cfg.maxAnomaly ?? 100;
            if (num < min || num > max) {
              fillRgb = 'FEE2E2';
              fontRgb = '991B1B';
            }
          }

          if (!fillRgb && this.enableTarget()) {
            const target = this.columnTargets()[colKey];
            if (target && target.enabled && target.value !== null) {
              if (IndicatorEvaluator.isTargetAchieved(val, target)) {
                fillRgb = 'D1FAE5';
                fontRgb = '065F46';
              } else {
                fillRgb = 'FEF3C7';
                fontRgb = '92400E';
              }
            }
          }
        }

        let numFmt: string | undefined = undefined;
        if (cfg?.dataType === 'percentage' && typeof val === 'number') {
          numFmt = '0.0"%"';
        }

        const isTextCol = colIndex === 1 || isStringCol;

        return {
          font: { color: { rgb: fontRgb }, sz: 10, bold: fillRgb !== '' },
          fill: fillRgb ? { fgColor: { rgb: fillRgb } } : undefined,
          alignment: {
            vertical: 'center',
            horizontal: isTextCol ? 'left' : 'center',
          },
          numFmt,
        };
      },
    });
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private findHeader(headers: string[], target: string): string | undefined {
    return headers.find((header) => this.normalizeKey(header) === this.normalizeKey(target));
  }

  private normalizeKey(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '_');
  }

  private isEmptyValue(value: unknown): boolean {
    return value === null || value === undefined || String(value).trim() === '';
  }

  private clearResult(): void {
    this.resultRows.set([]);
    this.originalResultRows.set([]);
    this.resultColumns.set([]);
    this.resultColumnsMeta.set([]);
    this.defaultResultColumns.set([]);
    this.defaultResultColumnsMeta.set([]);
  }

  private reset(): void {
    this.workbook = null;
    this.sheets.set([]);
    this.joinBy.set('');
    this.stripKabupaten.set(true);
    this.resultRows.set([]);
    this.originalResultRows.set([]);
    this.resultColumns.set([]);
    this.resultColumnsMeta.set([]);
    this.defaultResultColumns.set([]);
    this.defaultResultColumnsMeta.set([]);
    this.customColumnNames.set({});
    this.columnTargets.set({});
    this.columnConfigs.set({});
    this.showColumnSettings.set(false);
    this.enableJumlah.set(false);
    this.sumColumns.set({});
    this.enableAverage.set(false);
    this.avgColumns.set({});
    this.variableSearch.set({});
    this.errorMessage.set('');
    this.isJoining.set(false);
  }

  clearFile(): void {
    if (this.selectedSheets().length > 0) {
      this.preservedPreset = this.getCurrentPreset(this.activePresetName() || undefined);
      this.preservedPresetName =
        this.activePresetName() || (this.isCloudDefault() ? 'Default Google Drive' : 'Konfigurasi Sebelumnya');
    }
    this.file.set(null);
    this.isDefaultData.set(false);
    this.isCloudDefault.set(false);
    this.showSettings.set(true);
    this.reset();
  }

  formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '-';
    }
    return String(value);
  }
}
