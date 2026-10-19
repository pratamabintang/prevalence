import { Component, computed, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx-js-style';
import { HealthDataExchange } from '../../core/domain/health-data-exchange';
import { RegionNormalizer } from '../../core/domain/region-normalizer';
import { ExcelJoinEngine } from '../../core/excel/excel-join-engine';
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
} from '../../shared/excel';
import {
  JoinConfigurationPreset,
  PresetStore,
  SheetConfigPreset,
} from './preset-store';
import { DEFAULT_JOIN_CONFIG } from './default-join-config';
import { ExcelJoinStore, ExcelJoinStoredState } from './excel-join-store';

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
export class ExcelJoinComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private healthDataExchange = inject(HealthDataExchange);
  gasStorageService = inject(GasStorageService);
  excelJoinStore = inject(ExcelJoinStore);

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
    if (this.excelJoinStore.hasState()) {
      const restored = await this.restoreStateFromStore();
      if (restored) {
        return;
      }
    }
    await this.loadDefaultDataAndConfig();
  }

  ngOnDestroy(): void {
    this.saveCurrentStateToStore();
  }

  saveCurrentStateToStore(): void {
    if (!this.file() && !this.workbook && this.sheets().length === 0 && this.resultRows().length === 0) {
      return;
    }

    const fileObj = this.file();
    const state: ExcelJoinStoredState = {
      version: '1.0',
      savedAt: new Date().toISOString(),
      fileInfo: fileObj
        ? {
            name: fileObj.name,
            size: fileObj.size,
            type: fileObj.type,
          }
        : null,
      isDefaultData: this.isDefaultData(),
      isCloudDefault: this.isCloudDefault(),
      showSettings: this.showSettings(),
      activePresetName: this.activePresetName(),
      sheets: this.sheets(),
      joinBy: this.joinBy(),
      stripKabupaten: this.stripKabupaten(),
      outputHeaderFormat: this.outputHeaderFormat(),
      includeSheetPrefix: this.includeSheetPrefix(),
      enableTarget: this.enableTarget(),
      enableCapaian: this.enableCapaian(),
      enableJumlah: this.enableJumlah(),
      enableAverage: this.enableAverage(),
      columnTargets: { ...this.columnTargets() },
      columnConfigs: { ...this.columnConfigs() },
      sumColumns: { ...this.sumColumns() },
      avgColumns: { ...this.avgColumns() },
      customColumnNames: { ...this.customColumnNames() },
      resultColumns: [...this.resultColumns()],
      resultColumnsMeta: [...this.resultColumnsMeta()],
      defaultResultColumns: [...this.defaultResultColumns()],
      defaultResultColumnsMeta: [...this.defaultResultColumnsMeta()],
      resultRows: [...this.resultRows()],
      originalResultRows: [...this.originalResultRows()],
    };

    this.excelJoinStore.saveState(state, this.workbook, this.file());
  }

  async restoreStateFromStore(): Promise<boolean> {
    const state = this.excelJoinStore.getState();
    if (!state) {
      return false;
    }

    try {
      let wb = this.excelJoinStore.getWorkbook();
      let file = this.excelJoinStore.getFile();

      if (!wb) {
        if (state.isCloudDefault && this.gasStorageService.isConfigured()) {
          try {
            const cloudRes = await this.gasStorageService.loadDefault();
            if (cloudRes.success && cloudRes.excelBuffer) {
              wb = ExcelEngine.readWorkbook(cloudRes.excelBuffer);
              file = new File([cloudRes.excelBuffer], cloudRes.fileName || 'default-join-data.xlsx', {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              });
            }
          } catch {}
        } else if (state.isDefaultData) {
          try {
            const res = await fetch('/data/default-join-data.xlsx');
            if (res.ok) {
              const buf = await res.arrayBuffer();
              wb = ExcelEngine.readWorkbook(buf);
              file = new File([buf], 'Format Analisas Intervensi Spesifik TW3 01102026.xlsx', {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              });
            }
          } catch {}
        }
      }

      if (!file && state.fileInfo) {
        file = new File([], state.fileInfo.name, { type: state.fileInfo.type || '' });
      }

      this.workbook = wb;
      this.file.set(file);

      this.sheets.set(state.sheets || []);
      this.joinBy.set(state.joinBy || '');
      this.stripKabupaten.set(state.stripKabupaten ?? true);
      this.outputHeaderFormat.set(state.outputHeaderFormat || 'full');
      this.includeSheetPrefix.set(state.includeSheetPrefix ?? true);

      this.enableTarget.set(state.enableTarget ?? true);
      this.enableCapaian.set(state.enableCapaian ?? true);
      this.enableJumlah.set(state.enableJumlah ?? false);
      this.enableAverage.set(state.enableAverage ?? false);
      this.columnTargets.set(state.columnTargets || {});
      this.columnConfigs.set(state.columnConfigs || {});
      this.sumColumns.set(state.sumColumns || {});
      this.avgColumns.set(state.avgColumns || {});
      this.customColumnNames.set(state.customColumnNames || {});

      this.resultColumns.set(state.resultColumns || []);
      this.resultColumnsMeta.set(state.resultColumnsMeta || []);
      this.defaultResultColumns.set(state.defaultResultColumns || []);
      this.defaultResultColumnsMeta.set(state.defaultResultColumnsMeta || []);
      this.resultRows.set(state.resultRows || []);
      this.originalResultRows.set(state.originalResultRows || []);

      this.showSettings.set(state.showSettings ?? false);
      this.isDefaultData.set(state.isDefaultData ?? false);
      this.isCloudDefault.set(state.isCloudDefault ?? false);
      this.activePresetName.set(state.activePresetName || '');

      return true;
    } catch (e) {
      console.warn('Gagal memulihkan state Excel Join dari storage:', e);
      return false;
    }
  }

  toggleSettings(): void {
    this.showSettings.update((v) => !v);
    this.saveCurrentStateToStore();
  }

  async loadDefaultDataAndConfig(force = false): Promise<void> {
    if (!force && (this.file() || this.resultRows().length > 0)) {
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
          } else if (cloudRes.message) {
            this.configNotification.set({
              type: 'info',
              message: `Penyimpanan Cloud: ${cloudRes.message}. Menggunakan template bawaan sistem.`,
            });
          }
        } catch (gasErr) {
          console.warn('Gagal memuat dari Google Apps Script:', gasErr);
        }
      } else if (force) {
        this.configNotification.set({
          type: 'warning',
          message: 'URL Google Apps Script belum dikonfigurasi. Menggunakan template bawaan sistem.',
        });
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
    this.excelJoinStore.clearState();
    this.clearFile();
    this.preservedPreset = null;
    this.preservedPresetName = null;
    await this.loadDefaultDataAndConfig(true);
  }

  async reloadFromDrive(): Promise<void> {
    this.preservedPreset = null;
    this.preservedPresetName = null;
    this.excelJoinStore.clearState();
    this.clearFile();
    this.preservedPreset = null;
    this.preservedPresetName = null;
    await this.loadDefaultDataAndConfig(true);
  }

  visualizeInChart(): void {
    if (this.resultRows().length === 0 || this.resultColumns().length === 0) {
      return;
    }

    const isTargetEnabled = this.enableTarget();
    const targets = isTargetEnabled ? this.columnTargets() : {};
    let firstTarget: number | null = null;
    if (isTargetEnabled) {
      for (const col of this.resultColumns()) {
        const t = targets[col];
        if (t && t.enabled !== false && t.value !== null && t.value !== undefined) {
          firstTarget = t.value;
          break;
        }
      }
    }

    const resolvedTarget = firstTarget !== null ? firstTarget : (isTargetEnabled ? undefined : 50);

    this.healthDataExchange.publishJoinedToChart({
      title: this.file() ? `Grafik Hasil Join - ${this.file()!.name}` : 'Grafik Hasil Join Excel',
      rows: this.resultRows(),
      columns: this.resultColumns(),
      categoryColumn: this.resultColumns()[0],
      customColumnNames: this.customColumnNames(),
      columnTargets: isTargetEnabled ? this.columnTargets() : undefined,
      columnConfigs: this.columnConfigs(),
      targetValue: resolvedTarget,
    });

    this.router.navigate(['/chart']);
  }

  transferToStuntingMonitoring(): void {
    if (this.resultRows().length === 0 || this.resultColumns().length === 0) {
      return;
    }

    const sums: Record<string, number | null> = {};
    if (this.enableJumlah()) {
      for (const col of this.resultColumns()) {
        if (this.sumColumns()[col]) {
          sums[col] = this.getColumnSum(col);
        }
      }
    }

    const avgs: Record<string, number | null> = {};
    if (this.enableAverage()) {
      for (const col of this.resultColumns()) {
        if (this.avgColumns()[col]) {
          avgs[col] = this.getColumnAverage(col);
        }
      }
    }

    this.healthDataExchange.publishJoinedToStunting({
      title: this.file() ? `Hasil Join - ${this.file()!.name}` : 'Hasil Join Excel',
      rows: this.resultRows(),
      columns: this.resultColumns(),
      customColumnNames: this.customColumnNames(),
      columnTargets: this.enableTarget() ? this.columnTargets() : undefined,
      enableJumlah: this.enableJumlah(),
      sumColumns: this.sumColumns(),
      columnSums: sums,
      enableAverage: this.enableAverage(),
      avgColumns: this.avgColumns(),
      columnAverages: avgs,
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

  // Fitur Jumlah
  enableJumlah = signal(false);
  sumColumns = signal<Record<string, boolean>>({});

  // Fitur Rata-rata
  enableAverage = signal(false);
  avgColumns = signal<Record<string, boolean>>({});

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
      selected.some((sheet) => sheet.variables.length > 0)
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

    const hasAnyVariables = selected.some((sheet) => sheet.variables.length > 0);
    if (!hasAnyVariables) {
      return 'Pilih minimal 1 variabel untuk ditampilkan.';
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
          this.saveCurrentStateToStore();
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
          this.saveCurrentStateToStore();
          return;
        }
      }

      this.showSettings.set(true);
      this.saveCurrentStateToStore();
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
    if (this.canPreview()) {
      this.preview();
    } else {
      this.clearResult();
    }
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
    if (this.canPreview()) {
      this.preview();
    } else {
      this.clearResult();
    }
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
    if (this.canPreview()) {
      this.preview();
    } else {
      this.clearResult();
    }
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

    if (this.canPreview()) {
      this.preview();
    } else {
      this.clearResult();
    }
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
    if (this.canPreview()) {
      this.preview();
    } else {
      this.clearResult();
    }
  }

  clearVariables(sheet: SheetInfo): void {
    this.sheets.update((sheets) =>
      sheets.map((s) => (s.name === sheet.name ? { ...s, variables: [] } : s)),
    );
    if (this.canPreview()) {
      this.preview();
    } else {
      this.clearResult();
    }
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
    this.saveCurrentStateToStore();
  }

  resetColumnCustomName(col: string): void {
    this.customColumnNames.update((names) => {
      const copy = { ...names };
      delete copy[col];
      return copy;
    });
    this.saveCurrentStateToStore();
  }

  resetAllCustomColumnNames(): void {
    this.customColumnNames.set({});
    this.saveCurrentStateToStore();
  }

  // ============================================================
  // PENGUBAHAN NAMA KOLOM INLINE (DOUBLE CLICK RENAME)
  // ============================================================

  editingColumnKey = signal<string | null>(null);
  editingColumnValue = signal<string>('');

  startEditingColumn(colKey: string | null | undefined, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (!colKey || colKey.startsWith('__')) {
      return;
    }
    this.editingColumnKey.set(colKey);
    this.editingColumnValue.set(this.getColumnDisplayName(colKey));
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('.inline-column-rename-input');
      if (input) {
        input.focus();
        input.select();
      }
    }, 50);
  }

  saveInlineColumnRename(colKey: string | null | undefined, newName: string): void {
    if (!colKey || this.editingColumnKey() !== colKey) {
      return;
    }
    this.editingColumnKey.set(null);
    this.setColumnCustomName(colKey, newName);
  }

  cancelInlineColumnRename(): void {
    this.editingColumnKey.set(null);
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

  // ============================================================
  // PENGENDALI GESER KOLOM BERSAMA (SHARED SHIFT CONTROL)
  // ============================================================

  selectedColumnForMove = signal<string | null>(null);

  selectedColumnIndex = computed(() => {
    const col = this.selectedColumnForMove();
    if (!col) return -1;
    return this.resultColumns().indexOf(col);
  });

  canMoveSelectedColumnLeft = computed(() => {
    const idx = this.selectedColumnIndex();
    return this.canMoveColumnLeft(idx);
  });

  canMoveSelectedColumnRight = computed(() => {
    const idx = this.selectedColumnIndex();
    return this.canMoveColumnRight(idx);
  });

  selectColumnForMove(colKey: string | null | undefined): void {
    if (!colKey || colKey.startsWith('__')) {
      this.selectedColumnForMove.set(null);
      return;
    }
    const cols = this.resultColumns();
    // Kolom kunci (index 0) tidak dapat digeser
    if (colKey === cols[0]) {
      this.selectedColumnForMove.set(null);
      return;
    }
    // Jika kolom yang sama diklik lagi, batalkan pilihan (toggle); jika beda, pilih kolom tersebut
    if (this.selectedColumnForMove() === colKey) {
      this.selectedColumnForMove.set(null);
    } else {
      this.selectedColumnForMove.set(colKey);
    }
  }

  clearSelectedColumnForMove(): void {
    this.selectedColumnForMove.set(null);
  }

  moveSelectedColumnLeft(): void {
    const idx = this.selectedColumnIndex();
    if (this.canMoveColumnLeft(idx)) {
      this.moveColumnLeft(idx);
    }
  }

  moveSelectedColumnRight(): void {
    const idx = this.selectedColumnIndex();
    if (this.canMoveColumnRight(idx)) {
      this.moveColumnRight(idx);
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardMove(event: KeyboardEvent): void {
    if (!this.selectedColumnForMove()) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable) {
        return;
      }
    }

    if (event.key === 'ArrowLeft') {
      if (this.canMoveSelectedColumnLeft()) {
        event.preventDefault();
        this.moveSelectedColumnLeft();
      }
    } else if (event.key === 'ArrowRight') {
      if (this.canMoveSelectedColumnRight()) {
        event.preventDefault();
        this.moveSelectedColumnRight();
      }
    } else if (event.key === 'Escape') {
      this.clearSelectedColumnForMove();
    }
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

      let buffer: ArrayBuffer | null = null;
      if (this.file() && this.file()!.size > 0) {
        buffer = await this.file()!.arrayBuffer();
      } else if (this.workbook) {
        const raw = XLSX.write(this.workbook, { bookType: 'xlsx', type: 'array' });
        const u8 = new Uint8Array(raw);
        buffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
      }

      if (!buffer || buffer.byteLength === 0) {
        this.errorMessage.set('Tidak ada data Excel yang valid untuk disimpan ke Google Drive.');
        this.isSavingDefault.set(false);
        this.showSaveDefaultConfirm.set(false);
        return;
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
    this.excelJoinStore.clearState();
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
      this.saveCurrentStateToStore();
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

    const previousCols = [...this.resultColumns()];
    this.errorMessage.set('');
    this.clearResult();
    this.isJoining.set(true);

    try {
      const result = ExcelJoinEngine.executeJoin({
        workbook: this.workbook,
        selectedSheets: this.selectedSheets(),
        joinBy: this.joinBy(),
        stripKabupaten: this.stripKabupaten(),
        outputHeaderFormat: this.outputHeaderFormat(),
        includeSheetPrefix: this.includeSheetPrefix(),
        previousColumnOrder: previousCols,
      });

      this.resultRows.set(result.rows);
      this.originalResultRows.set(result.rows);

      if (result.rows.length > 0) {
        this.defaultResultColumns.set(result.defaultColumns);
        this.defaultResultColumnsMeta.set(result.defaultColumnsMeta);
        this.resultColumns.set(result.columns);
        this.resultColumnsMeta.set(result.columnsMeta);
        this.updateColumnTargetsAfterPreview(result.columns);
        this.updateColumnConfigsAfterPreview(result.columns);
        this.updateColumnSumsAfterPreview(result.columns);
        this.updateColumnAvgsAfterPreview(result.columns);
        this.saveCurrentStateToStore();
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

    ExcelJoinEngine.exportJoinedWorkbook({
      resultRows: this.resultRows(),
      resultColumns: this.resultColumns(),
      resultColumnsMeta: this.resultColumnsMeta(),
      customColumnNames: this.customColumnNames(),
      outputHeaderFormat: this.outputHeaderFormat(),
      columnConfigs: this.columnConfigs(),
      enableJumlah: this.enableJumlah(),
      sumColumns: this.sumColumns(),
      enableAverage: this.enableAverage(),
      avgColumns: this.avgColumns(),
      enableTarget: this.enableTarget(),
      columnTargets: this.columnTargets(),
      enableCapaian: this.enableCapaian(),
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
    this.selectedColumnForMove.set(null);
    this.editingColumnKey.set(null);
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
    this.selectedColumnForMove.set(null);
    this.editingColumnKey.set(null);
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
    this.excelJoinStore.clearState();
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
