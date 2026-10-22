import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HealthDataExchange } from '../../core/domain/health-data-exchange';
import { RegionNormalizer } from '../../core/domain/region-normalizer';
import { IndicatorEvaluator } from '../../core/evaluation/indicator-evaluator';
import {
  IndicatorPolarity,
  StuntingCategoryConfig,
  StuntingEvaluationEngine,
  StuntingEvaluationResult,
  StuntingQuarterInputConfig,
  StuntingSubCategoryConfig,
} from '../../core/stunting/stunting-evaluation-engine';
import { ColumnInfo, ExcelEngine } from '../../shared/excel';
import { StuntingExcelExporter } from '../../core/stunting/stunting-excel-exporter';
import { StuntingWorkflowEngine } from '../../core/stunting/stunting-workflow-engine';
import * as XLSX from 'xlsx';
import { ExcelJoinEngine } from '../../core/excel/excel-join-engine';
import { DinkesSpreadsheetParser } from '../../core/excel/dinkes-spreadsheet-parser';
import { DEFAULT_JOIN_CONFIG } from '../excel-join/default-join-config';
import {
  GasPeriodItem,
  GasStorageService,
  QuarterSlot,
} from '../../core/storage/gas-storage.service';
import { PeriodPartitionWorkspace } from '../../core/storage/period-partition-workspace';
import {
  AnyStuntingPreset,
  StuntingConfigurationPreset,
  StuntingPipelinePreset,
  StuntingPresetStore,
} from './stunting-preset-store';

export interface SecondarySheetSetup {
  sheetName: string;
  keyCol: string;
  selected: boolean;
  headerStartRow: number;
  headerEndRow: number;
  dataStartRow: number;
  columns: ColumnInfo[];
}

import { UiAlertComponent, UiButtonComponent, UiPageHeaderComponent } from '../../shared/ui';

export interface JoinedRowPreviewItem {
  id: string;
  key: string;
  data: Record<string, unknown>;
  isExcluded: boolean;
  excludeReason?: string;
}

export interface LoadedQuarterItem {
  quarter: 1 | 2 | 3 | 4;
  slot: QuarterSlot;
  source: 'cloud' | 'local';
  fileName: string;
  rows: Record<string, unknown>[];
  columns: string[];
  keyCol: string;
  summaryRow: Record<string, unknown> | null;
  targetRow: Record<string, unknown> | null;
  totalRow: Record<string, unknown> | null;
}

@Component({
  selector: 'app-stunting-monitoring',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    DatePipe,
    UiPageHeaderComponent,
    UiButtonComponent,
    UiAlertComponent,
  ],
  templateUrl: './stunting-monitoring.component.html',
})
export class StuntingMonitoringComponent implements OnInit {
  private router = inject(Router);
  private healthDataExchange = inject(HealthDataExchange);
  gasStorageService = inject(GasStorageService);
  periodPartitionWorkspace = inject(PeriodPartitionWorkspace);
  workflowEngine = inject(StuntingWorkflowEngine);

  async ngOnInit(): Promise<void> {
    this.loadTransferredData();
    if (this.gasStorageService.isConfigured()) {
      await this.fetchPeriodSlots();
    }
  }

  // Stepper State: 1 = Unggah & Join, 2 = Kategori & Indikator, 3 = Dashboard Monitoring
  activeStep = this.workflowEngine.activeStep;

  // ============================================================
  // MULTI-QUARTER CLOUD STORAGE STATE (GOOGLE APPS SCRIPT)
  // ============================================================
  currentYear = new Date().getFullYear();
  availableYears = signal<number[]>([2026, 2025, 2024, 2023, 2022]);
  selectedYear = signal<number>(2026);
  periodSlots = signal<GasPeriodItem[]>([]);
  isLoadingPeriods = signal<boolean>(false);
  isLoadingCloudData = signal<boolean>(false);

  quarterOptions: { value: QuarterSlot; qNum: 1 | 2 | 3 | 4; label: string; months: string }[] = [
    { value: 'TW1', qNum: 1, label: 'TW 1', months: 'Jan - Mar' },
    { value: 'TW2', qNum: 2, label: 'TW 2', months: 'Apr - Jun' },
    { value: 'TW3', qNum: 3, label: 'TW 3', months: 'Jul - Sep' },
    { value: 'TW4', qNum: 4, label: 'TW 4', months: 'Okt - Des' },
  ];

  selectedQuarterSlots = signal<Record<QuarterSlot, boolean>>({
    TW1: false,
    TW2: false,
    TW3: false,
    TW4: false,
  });

  quarterLocalFiles = signal<Partial<Record<QuarterSlot, File>>>({});
  cloudLoadNotice = signal<string | null>(null);
  isMultiQuarterCloudMode = signal<boolean>(false);

  hasAnyGasConfigured = computed<boolean>(() => this.gasStorageService.isConfigured());

  selectedQuartersCount = computed<number>(() => {
    return this.quarterOptions.filter((q) => this.selectedQuarterSlots()[q.value]).length;
  });

  selectedQuartersWithDataCount = computed<number>(() => {
    return this.quarterOptions.filter((q) => {
      if (!this.selectedQuarterSlots()[q.value]) return false;
      return (
        this.isQuarterAvailableInCloud(this.selectedYear(), q.value) ||
        !!this.quarterLocalFiles()[q.value]
      );
    }).length;
  });

  hasIncompleteQuarterInSelection = computed<boolean>(() => {
    return this.quarterOptions.some((q) => {
      if (!this.selectedQuarterSlots()[q.value]) return false;
      return (
        !this.isQuarterAvailableInCloud(this.selectedYear(), q.value) &&
        !this.quarterLocalFiles()[q.value]
      );
    });
  });

  yearQuarterCount = computed<number>(() => {
    const yr = this.selectedYear();
    const periods = this.periodSlots().filter((p) => p.year === yr && (p.hasRaw || p.hasResult));
    return periods.length;
  });

  // ============================================================
  // STEP 1: FILE UPLOAD & MULTI-SHEET JOIN
  // ============================================================
  file = signal<File | null>(null);
  workbook: any = null;
  showSettings = signal<boolean>(false);

  availableSheets = signal<string[]>([]);
  primarySheet = signal<string>('');
  primaryKeyCol = this.workflowEngine.primaryKeyCol;
  primaryHeaderStartRow = signal<number>(1);
  primaryHeaderEndRow = signal<number>(1);
  primaryDataStartRow = signal<number>(2);
  primaryColumns = signal<ColumnInfo[]>([]);

  secondarySheets = signal<SecondarySheetSetup[]>([]);
  stripKabupaten = this.workflowEngine.stripKabupaten;
  excludedRowKeywords = this.workflowEngine.excludedRowKeywords;
  manualExcludedKeys = this.workflowEngine.manualExcludedKeys;
  excludedRowIds = this.workflowEngine.excludedRowIds;

  // Raw & Joined Dataset
  joinedRows = this.workflowEngine.joinedRows;
  joinedColumns = this.workflowEngine.joinedColumns;
  previewExpanded = signal<boolean>(false);
  previewWrapText = signal<boolean>(true);

  // Summary & Target Rows for Pre-Calculated Direct Evaluation
  calculationDataSource = this.workflowEngine.calculationDataSource;
  summaryRowId = this.workflowEngine.summaryRowId;
  targetRowId = this.workflowEngine.targetRowId;
  totalRowId = this.workflowEngine.totalRowId;
  summaryRowData = this.workflowEngine.summaryRowData;
  targetRowData = this.workflowEngine.targetRowData;
  totalRowData = this.workflowEngine.totalRowData;

  isHasilJoinFormat = this.workflowEngine.isHasilJoinFormat;
  availableSummaryRows = this.workflowEngine.availableSummaryRows;
  availableTargetRows = this.workflowEngine.availableTargetRows;
  validJoinedRows = this.workflowEngine.validJoinedRows;
  activeRegionRows = this.workflowEngine.activeRegionRows;
  previewRows = this.workflowEngine.previewRows;

  // ============================================================
  // STEP 2: CATEGORY & SUB-CATEGORY BUILDER
  // ============================================================
  categories = this.workflowEngine.categories;
  totalIndicatorsCount = this.workflowEngine.totalIndicatorsCount;
  canProceedToStep2 = this.workflowEngine.canProceedToStep2;
  canProceedToStep3 = this.workflowEngine.canProceedToStep3;

  // ============================================================
  // STEP 3: DASHBOARD MONITORING & MULTI-QUARTER EVALUATION
  // ============================================================
  manualActiveQuarter = this.workflowEngine.manualActiveQuarter;
  toleranceThreshold = this.workflowEngine.toleranceThreshold;
  quarterWeight = this.workflowEngine.quarterWeight;
  evaluationResult = this.workflowEngine.evaluationResult;
  availableQuarters = this.workflowEngine.availableQuarters;
  activeQuarter = this.workflowEngine.activeQuarter;
  searchQuery = signal<string>('');
  activeFilter = signal<string>('all');
  collapsedCategories = signal<Record<string, boolean>>({});
  viewMode = signal<'auto' | 'single_quarter' | 'all_quarters'>('all_quarters');
  subActiveQuarter = signal<Record<string, 1 | 2 | 3 | 4>>({});

  displayedQuarters = computed<(1 | 2 | 3 | 4)[]>(() => {
    const mode = this.viewMode();
    if (mode === 'single_quarter') {
      return [this.activeQuarter()];
    }
    return [1, 2, 3, 4];
  });

  onTrackCount = this.workflowEngine.onTrackCount;
  perluPercepatanCount = this.workflowEngine.perluPercepatanCount;
  perluPerhatianCount = this.workflowEngine.perluPerhatianCount;

  setViewMode(mode: 'auto' | 'single_quarter' | 'all_quarters'): void {
    this.viewMode.set(mode);
  }

  // Preset State
  pendingPreset: AnyStuntingPreset | null = null;
  hasSavedConfig = signal<boolean>(StuntingPresetStore.hasSavedPreset());
  activePresetName = signal<string>('');
  configNotification = signal<{
    type: 'success' | 'warning' | 'info';
    message: string;
    details?: string[];
  } | null>(null);

  notificationMessage = signal<string | null>(null);

  notificationMessageType = computed<'info' | 'success' | 'warning' | 'error'>(() => {
    const msg = this.notificationMessage()?.toLowerCase() || '';
    if (msg.includes('berhasil')) return 'success';
    if (msg.includes('gagal') || msg.includes('harus') || msg.includes('tidak ada')) return 'error';
    return 'info';
  });

  constructor() {
    this.loadStandardCategories();
  }

  // ============================================================
  // STEP 1 HANDLERS: FILE UPLOAD & SHEET SETUP
  // ============================================================

  async onPrimaryFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.notificationMessage.set('File harus berformat .xlsx');
      input.value = '';
      return;
    }

    this.file.set(file);
    this.showSettings.set(false);

    try {
      const buffer = await file.arrayBuffer();
      const wb = ExcelEngine.readWorkbook(buffer);
      this.workbook = wb;
      this.refreshAvailableSheets();

      if (this.pendingPreset) {
        const p = this.pendingPreset;
        this.pendingPreset = null;
        this.applyConfiguration(p, this.activePresetName() || 'Konfigurasi Terpilih');
      } else if (wb.SheetNames.length > 0) {
        this.selectPrimarySheet(wb.SheetNames[0]);
        if (this.isHasilJoinFormat()) {
          const details: string[] = [
            `Wilayah: ${this.activeRegionRows().length} Kabupaten/Kota`,
            'Format Standar Dinkes (Hasil Join) terdeteksi & 14 indikator terkonfigurasi otomatis.',
          ];
          if (this.summaryRowData()) {
            details.push(`Capaian %: ${this.summaryRowData()![this.primaryKeyCol()]}`);
          }
          if (this.totalRowData()) {
            details.push(`Numerator (Kasus): ${this.totalRowData()![this.primaryKeyCol()]}`);
          }
          if (this.targetRowData()) {
            details.push(`Target: ${this.targetRowData()![this.primaryKeyCol()]}`);
          }
          this.configNotification.set({
            type: 'success',
            message: `Berkas "${file.name}" berhasil dimuat! Format Standar Dinkes terdeteksi.`,
            details,
          });
          this.notificationMessage.set(null);
        } else {
          this.configNotification.set({
            type: 'success',
            message: `Berkas "${file.name}" berhasil dimuat (${this.activeRegionRows().length} wilayah).`,
          });
          this.notificationMessage.set(null);
        }
      }
    } catch (err) {
      console.error('File Error:', err);
      this.notificationMessage.set(
        `Gagal membaca berkas: ${err instanceof Error ? err.message : 'Format tidak didukung.'}`,
      );
    } finally {
      input.value = '';
    }
  }

  async loadSampleHasilJoin(): Promise<void> {
    try {
      const response = await fetch('/Hasil_Join_Excel_2026-10-15.xlsx');
      if (!response.ok) {
        throw new Error('Berkas contoh tidak dapat diakses.');
      }
      const buffer = await response.arrayBuffer();
      const wb = ExcelEngine.readWorkbook(buffer);
      this.workbook = wb;
      this.file.set(new File([buffer], 'Hasil_Join_Excel_2026-10-15.xlsx'));
      this.showSettings.set(false);
      this.refreshAvailableSheets();
      if (wb.SheetNames.length > 0) {
        this.selectPrimarySheet(wb.SheetNames[0]);
      }
      this.configNotification.set({
        type: 'success',
        message:
          'Contoh data Hasil Join standar Dinkes (35 Kabupaten/Kota Jawa Tengah) berhasil dimuat!',
        details: [
          `Wilayah: ${this.activeRegionRows().length} Kabupaten/Kota`,
          '14 pasangan indikator serta baris acuan Rata-rata dan Target Dinkes otomatis terkonfigurasi.',
        ],
      });
      this.notificationMessage.set(null);
    } catch (err) {
      console.error('Sample Load Error:', err);
      this.notificationMessage.set(
        `Gagal memuat contoh berkas: ${err instanceof Error ? err.message : 'Kesalahan jaringan.'}`,
      );
    }
  }

  // ============================================================
  // MULTI-QUARTER GOOGLE APPS SCRIPT METHODS
  // ============================================================

  async fetchPeriodSlots(): Promise<void> {
    if (this.isLoadingPeriods()) return;
    this.isLoadingPeriods.set(true);
    try {
      const periods = await this.periodPartitionWorkspace.refreshPeriods();
      this.periodSlots.set(periods);
      this.availableYears.set(this.periodPartitionWorkspace.availableYears());
      if (!this.periodPartitionWorkspace.availableYears().includes(this.selectedYear())) {
        this.selectedYear.set(this.periodPartitionWorkspace.availableYears()[0]);
      }
      this.updateQuarterSlotsSelectionForYear(this.selectedYear());
    } catch (err) {
      console.warn('Gagal memuat daftar periode GAS:', err);
    } finally {
      this.isLoadingPeriods.set(false);
    }
  }

  onYearChange(year: number): void {
    this.selectedYear.set(year);
    this.updateQuarterSlotsSelectionForYear(year);
  }

  updateQuarterSlotsSelectionForYear(year: number): void {
    const hasTw1 = this.isQuarterAvailableInCloud(year, 'TW1');
    const hasTw2 = this.isQuarterAvailableInCloud(year, 'TW2');
    const hasTw3 = this.isQuarterAvailableInCloud(year, 'TW3');
    const hasTw4 = this.isQuarterAvailableInCloud(year, 'TW4');

    const hasAnyInCloud = hasTw1 || hasTw2 || hasTw3 || hasTw4;
    if (hasAnyInCloud) {
      this.selectedQuarterSlots.set({
        TW1: hasTw1,
        TW2: hasTw2,
        TW3: hasTw3,
        TW4: hasTw4,
      });
    } else {
      // Default ke TW1 jika belum ada data cloud untuk tahun ini
      this.selectedQuarterSlots.set({
        TW1: true,
        TW2: false,
        TW3: false,
        TW4: false,
      });
    }
  }

  isQuarterAvailableInCloud(year: number, quarter: QuarterSlot): boolean {
    return (
      this.periodSlots().some(
        (p) => p.year === year && p.quarter === quarter && (p.hasRaw || p.hasResult),
      ) || this.periodPartitionWorkspace.isQuarterAvailable(year, quarter)
    );
  }

  getQuarterCloudInfo(year: number, quarter: QuarterSlot): GasPeriodItem | undefined {
    return (
      this.periodSlots().find((p) => p.year === year && p.quarter === quarter) ||
      this.periodPartitionWorkspace.getQuarterSlotItem(year, quarter)
    );
  }

  toggleQuarterSlot(slot: QuarterSlot): void {
    this.selectedQuarterSlots.update((prev) => ({
      ...prev,
      [slot]: !prev[slot],
    }));
  }

  onQuarterLocalFileSelected(slot: QuarterSlot, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.notificationMessage.set('Berkas harus berformat .xlsx');
      input.value = '';
      return;
    }

    this.quarterLocalFiles.update((map) => ({
      ...map,
      [slot]: file,
    }));

    // Otomatis centang triwulan ini
    this.selectedQuarterSlots.update((prev) => ({
      ...prev,
      [slot]: true,
    }));

    this.notificationMessage.set(
      `Berkas lokal "${file.name}" berhasil disiapkan untuk slot ${slot}.`,
    );
    input.value = '';
  }

  removeQuarterLocalFile(slot: QuarterSlot): void {
    this.quarterLocalFiles.update((map) => {
      const copy = { ...map };
      delete copy[slot];
      return copy;
    });
  }

  async loadMultiQuarterFromCloud(): Promise<void> {
    if (this.isLoadingCloudData()) return;
    this.isLoadingCloudData.set(true);

    try {
      const selectedSlots = this.quarterOptions.filter((q) => this.selectedQuarterSlots()[q.value]);
      if (selectedSlots.length === 0) {
        this.notificationMessage.set('Pilih setidaknya 1 triwulan untuk dibandingkan.');
        return;
      }

      const year = this.selectedYear();
      const selectedSlotValues = selectedSlots.map((s) => s.value);
      const resolution = await this.periodPartitionWorkspace.loadMultiQuarters(
        year,
        selectedSlotValues,
        this.quarterLocalFiles(),
        { prefer: 'result' },
      );

      const loadedQuarters: LoadedQuarterItem[] = resolution.loadedQuarters.map((q) => {
        const slotOpt = this.quarterOptions.find((opt) => opt.value === q.quarter)!;
        return {
          quarter: slotOpt.qNum,
          slot: q.quarter,
          source: q.source,
          fileName: q.fileName,
          rows: q.dataset.regionRows,
          columns: q.dataset.columns,
          keyCol: q.dataset.keyCol,
          summaryRow: q.dataset.summaryRow || null,
          targetRow: q.dataset.targetRow || null,
          totalRow: q.dataset.totalRow || null,
        };
      });

      if (loadedQuarters.length === 0) {
        this.notificationMessage.set(
          `Tidak ada data valid yang dapat dimuat untuk triwulan terpilih pada tahun ${year}. Pastikan data tersedia di Google Drive atau unggah berkas lokal.`,
        );
        return;
      }

      const quartersLoadedNums = loadedQuarters.map((lq) => lq.quarter).sort((a, b) => a - b);
      const latestQ = quartersLoadedNums[quartersLoadedNums.length - 1];
      this.manualActiveQuarter.set(latestQ);

      this.isMultiQuarterCloudMode.set(true);
      this.processMergedQuarterDatasets(loadedQuarters, year);
      this.autoPopulateIndicatorsFromData();
      this.setAllSubActiveQuarter(latestQ);

      const quarterNames = loadedQuarters.map((lq) => lq.slot).join(', ');
      const notice = `Berhasil memuat dan menggabungkan data perbandingan ${quarterNames} (Tahun ${year}). Terdeteksi ${this.activeRegionRows().length} wilayah.`;

      const missingQuarters: string[] = [];
      for (const q of this.quarterOptions) {
        if (!loadedQuarters.some((lq) => lq.quarter === q.qNum)) {
          missingQuarters.push(q.label);
        }
      }

      if (missingQuarters.length > 0) {
        this.cloudLoadNotice.set(
          `Perhatian data: ${missingQuarters.join(' & ')} belum disertakan / belum diinput. Evaluasi kinerja stunting berjalan lancar berdasarkan triwulan yang tersedia (${quarterNames}).`,
        );
      } else {
        this.cloudLoadNotice.set(null);
      }

      this.isMultiQuarterCloudMode.set(true);

      const details: string[] = [
        `Wilayah aktif: ${this.activeRegionRows().length} Kab/Kota terdeteksi`,
      ];
      if (this.isHasilJoinFormat()) {
        details.push(
          'Format Standar Dinkes (Hasil Join) terdeteksi & 14 indikator terkonfigurasi otomatis.',
        );
        if (this.summaryRowData()) {
          details.push(`Capaian %: ${this.summaryRowData()![this.primaryKeyCol()]}`);
        }
        if (this.totalRowData()) {
          details.push(`Numerator (Kasus): ${this.totalRowData()![this.primaryKeyCol()]}`);
        }
        if (this.targetRowData()) {
          details.push(`Target: ${this.targetRowData()![this.primaryKeyCol()]}`);
        }
      }
      if (missingQuarters.length > 0) {
        details.push(`Triwulan belum diinput/disertakan: ${missingQuarters.join(', ')}.`);
      }

      this.configNotification.set({
        type: 'success',
        message: `Berhasil memuat data periode Tahun ${year} (${quarterNames}) dari Google Drive.`,
        details,
      });
      this.notificationMessage.set(null);
    } catch (err) {
      console.error('Multi-Quarter Load Error:', err);
      this.configNotification.set({
        type: 'warning',
        message: `Gagal memproses data multi-triwulan: ${err instanceof Error ? err.message : 'Kesalahan internal'}`,
      });
      this.notificationMessage.set(null);
    } finally {
      this.isLoadingCloudData.set(false);
    }
  }

  private extractDatasetFromBuffer(
    buffer: ArrayBuffer,
    config?: unknown,
  ): {
    rows: Record<string, unknown>[];
    columns: string[];
    keyCol: string;
    summaryRow: Record<string, unknown> | null;
    targetRow: Record<string, unknown> | null;
    totalRow: Record<string, unknown> | null;
  } {
    const parsed = DinkesSpreadsheetParser.parse(buffer, {
      preset:
        config && typeof config === 'object' && 'sheets' in config ? (config as any) : undefined,
      stripKabupaten: this.stripKabupaten(),
    });

    return {
      rows: parsed.regionRows,
      columns: parsed.columns,
      keyCol: parsed.keyCol,
      summaryRow: parsed.summaryRow,
      targetRow: parsed.targetRow,
      totalRow: parsed.totalRow,
    };
  }

  private processMergedQuarterDatasets(loadedQuarters: LoadedQuarterItem[], year: number): void {
    if (loadedQuarters.length === 0) return;

    const primaryKey = 'Kabupaten/Kota';
    this.primaryKeyCol.set(primaryKey);
    this.primarySheet.set('Hasil Join');

    const isNonIndicatorCol = (c: string, keyCol: string): boolean => {
      const cl = c.trim().toLowerCase();
      return cl === keyCol.toLowerCase() || cl === 'no' || cl === '__id' || cl === 'capaian';
    };

    // Kumpulkan seluruh wilayah unik dari seluruh triwulan yang dimuat
    const regionMap = new Map<
      string,
      { displayName: string; quarterRows: Map<number, Record<string, unknown>> }
    >();

    for (const lq of loadedQuarters) {
      for (const r of lq.rows) {
        const rawVal = String(r[lq.keyCol] ?? '').trim();
        if (!rawVal) continue;
        const norm = RegionNormalizer.normalizeJoinKey(rawVal, this.stripKabupaten());
        const cleanName = this.stripKabupaten()
          ? RegionNormalizer.cleanKabupatenPrefix(rawVal)
          : rawVal;
        if (!regionMap.has(norm)) {
          regionMap.set(norm, { displayName: cleanName, quarterRows: new Map() });
        }
        regionMap.get(norm)!.quarterRows.set(lq.quarter, r);
      }
    }

    // Kumpulkan daftar kolom gabungan
    const allMergedColumns: string[] = [primaryKey];
    const isMulti = loadedQuarters.length > 1;

    for (const lq of loadedQuarters) {
      for (const col of lq.columns) {
        if (isNonIndicatorCol(col, lq.keyCol)) continue;
        const mergedColName = isMulti ? `${col} (${lq.slot})` : col;
        if (!allMergedColumns.includes(mergedColName)) {
          allMergedColumns.push(mergedColName);
        }
      }
    }

    // Buat baris wilayah gabungan
    const mergedRows: Record<string, unknown>[] = [];
    let rowIdx = 0;

    for (const [, { displayName, quarterRows }] of regionMap.entries()) {
      const mRow: Record<string, unknown> = {
        __id: `row-${rowIdx++}`,
        [primaryKey]: displayName,
      };
      for (const lq of loadedQuarters) {
        const qRow = quarterRows.get(lq.quarter);
        for (const col of lq.columns) {
          if (isNonIndicatorCol(col, lq.keyCol)) continue;
          const mergedColName = isMulti ? `${col} (${lq.slot})` : col;
          mRow[mergedColName] = qRow ? (qRow[col] ?? null) : null;
        }
      }
      mergedRows.push(mRow);
    }

    // Baris Target Gabungan
    const mergedTarget: Record<string, unknown> = {
      __id: `row-target-${rowIdx++}`,
      [primaryKey]: 'TARGET',
    };
    let hasAnyTarget = false;
    for (const lq of loadedQuarters) {
      if (lq.targetRow) {
        hasAnyTarget = true;
        for (const col of lq.columns) {
          if (isNonIndicatorCol(col, lq.keyCol)) continue;
          const mergedColName = isMulti ? `${col} (${lq.slot})` : col;
          mergedTarget[mergedColName] = lq.targetRow[col] ?? null;
        }
      }
    }
    if (hasAnyTarget) {
      mergedRows.push(mergedTarget);
      const tgtId = String(mergedTarget['__id']);
      this.targetRowId.set(tgtId);
      this.targetRowData.set(mergedTarget);
      this.excludedRowIds.update((s) => new Set(s).add(tgtId));
    } else {
      this.targetRowId.set('');
      this.targetRowData.set(null);
    }

    // Baris Ringkasan Gabungan (Rata-rata Jawa Tengah)
    const mergedSummary: Record<string, unknown> = {
      __id: `row-summary-${rowIdx++}`,
      [primaryKey]: 'PROVINSI JAWA TENGAH',
    };
    let hasAnySummary = false;
    for (const lq of loadedQuarters) {
      if (lq.summaryRow) {
        hasAnySummary = true;
        for (const col of lq.columns) {
          if (isNonIndicatorCol(col, lq.keyCol)) continue;
          const mergedColName = isMulti ? `${col} (${lq.slot})` : col;
          mergedSummary[mergedColName] = lq.summaryRow[col] ?? null;
        }
      }
    }
    if (hasAnySummary) {
      mergedRows.push(mergedSummary);
      const sumId = String(mergedSummary['__id']);
      this.summaryRowId.set(sumId);
      this.summaryRowData.set(mergedSummary);
      this.calculationDataSource.set('summary_row');
      this.excludedRowIds.update((s) => new Set(s).add(sumId));
    } else {
      this.summaryRowId.set('');
      this.summaryRowData.set(null);
      this.calculationDataSource.set('all_rows');
    }

    // Baris Total Kasus Gabungan
    const mergedTotal: Record<string, unknown> = {
      __id: `row-total-${rowIdx++}`,
      [primaryKey]: 'JUMLAH KASUS',
    };
    let hasAnyTotal = false;
    for (const lq of loadedQuarters) {
      if (lq.totalRow) {
        hasAnyTotal = true;
        for (const col of lq.columns) {
          if (isNonIndicatorCol(col, lq.keyCol)) continue;
          const mergedColName = isMulti ? `${col} (${lq.slot})` : col;
          mergedTotal[mergedColName] = lq.totalRow[col] ?? null;
        }
      }
    }
    if (hasAnyTotal) {
      mergedRows.push(mergedTotal);
      const totId = String(mergedTotal['__id']);
      this.totalRowId.set(totId);
      this.totalRowData.set(mergedTotal);
      this.excludedRowIds.update((s) => new Set(s).add(totId));
    } else {
      this.totalRowId.set('');
      this.totalRowData.set(null);
    }

    this.joinedRows.set(mergedRows);
    this.joinedColumns.set(allMergedColumns);
    this.applyKeywordAndPatternExclusions(mergedRows);
  }

  toggleSettings(): void {
    this.showSettings.update((v) => !v);
  }

  togglePreviewExpanded(): void {
    this.previewExpanded.update((v) => !v);
  }

  togglePreviewWrapText(): void {
    this.previewWrapText.update((v) => !v);
  }

  private loadTransferredData(): void {
    const transferred = this.healthDataExchange.stuntingData();
    if (!transferred || transferred.rows.length === 0) {
      return;
    }

    const pKey = transferred.keyColumn || transferred.columns[0] || 'Wilayah';
    this.primaryKeyCol.set(pKey);
    const title = transferred.title || 'Hasil Join Excel';
    this.primarySheet.set(title);
    this.availableSheets.set([title]);
    this.joinedColumns.set(transferred.columns);

    const rowsWithId: Record<string, unknown>[] = transferred.rows.map((r, idx) => {
      const rowCopy: Record<string, unknown> = {
        ...r,
        __id: String(r['__id'] ?? `row-${idx}`),
      };
      if (this.stripKabupaten() && rowCopy[pKey] && typeof rowCopy[pKey] === 'string') {
        rowCopy[pKey] = RegionNormalizer.cleanKabupatenPrefix(rowCopy[pKey]);
      }
      return rowCopy;
    });

    if (transferred.summaryRow) {
      const sumId = `row-summary-${rowsWithId.length}`;
      rowsWithId.push({ ...transferred.summaryRow, __id: sumId });
      this.totalRowId.set(sumId);
      this.totalRowData.set(transferred.summaryRow);
      this.excludedRowIds.update((s) => new Set(s).add(sumId));
    }
    if (transferred.targetRow) {
      const tgtId = `row-target-${rowsWithId.length}`;
      rowsWithId.push({ ...transferred.targetRow, __id: tgtId });
      this.targetRowId.set(tgtId);
      this.targetRowData.set(transferred.targetRow);
      this.excludedRowIds.update((s) => new Set(s).add(tgtId));
    }
    if (transferred.averageRow) {
      const avgId = `row-avg-${rowsWithId.length}`;
      rowsWithId.push({ ...transferred.averageRow, __id: avgId });
      this.summaryRowId.set(avgId);
      this.summaryRowData.set(transferred.averageRow);
      this.calculationDataSource.set('summary_row');
      this.excludedRowIds.update((s) => new Set(s).add(avgId));
    }

    this.joinedRows.set(rowsWithId);
    this.applyKeywordAndPatternExclusions(rowsWithId);

    // Deteksi baris ringkasan (RATA-RATA / JAWA TENGAH / PROVINSI), baris target (TARGET), dan baris total (JUMLAH)
    let detectedSummaryRow: Record<string, unknown> | null = this.summaryRowData();
    let detectedTargetRow: Record<string, unknown> | null = this.targetRowData();
    let detectedTotalRow: Record<string, unknown> | null = this.totalRowData();

    for (const r of rowsWithId) {
      const keyStr = String(r[pKey] ?? '')
        .trim()
        .toUpperCase();
      if (keyStr.includes('TARGET')) {
        if (!detectedTargetRow) detectedTargetRow = r;
      } else if (
        keyStr.includes('RATA') ||
        keyStr.includes('AVERAGE') ||
        keyStr.includes('JAWA TENGAH') ||
        keyStr.includes('PROVINSI') ||
        keyStr.startsWith('PROV')
      ) {
        if (!detectedSummaryRow) detectedSummaryRow = r;
      } else if (keyStr.includes('TOTAL') || keyStr.includes('JUMLAH')) {
        if (!detectedTotalRow) detectedTotalRow = r;
      }
    }

    if (!detectedSummaryRow && detectedTotalRow) {
      detectedSummaryRow = detectedTotalRow;
    }

    if (detectedSummaryRow) {
      const sId = String(detectedSummaryRow['__id']);
      this.summaryRowId.set(sId);
      this.summaryRowData.set(detectedSummaryRow);
      this.calculationDataSource.set('summary_row');
      this.excludedRowIds.update((s) => new Set(s).add(sId));
    }

    if (detectedTargetRow) {
      const tId = String(detectedTargetRow['__id']);
      this.targetRowId.set(tId);
      this.targetRowData.set(detectedTargetRow);
      this.excludedRowIds.update((s) => new Set(s).add(tId));
    }

    if (detectedTotalRow) {
      const totId = String(detectedTotalRow['__id']);
      this.totalRowId.set(totId);
      this.totalRowData.set(detectedTotalRow);
      this.excludedRowIds.update((s) => new Set(s).add(totId));
    }

    this.autoPopulateIndicatorsFromData();

    this.notificationMessage.set(
      `Data hasil join berhasil dimuat (${transferred.rows.length} baris wilayah, ${transferred.columns.length} kolom)! Anda dapat langsung memeriksa baris aktif atau melanjutkan ke Langkah 2.`,
    );

    this.healthDataExchange.clearStuntingData();
  }

  private refreshAvailableSheets(): void {
    const sheets: string[] = this.workbook ? [...this.workbook.SheetNames] : [];
    this.availableSheets.set(sheets);

    // Populate secondary sheets selection
    const p = this.primarySheet();
    const secondaries: SecondarySheetSetup[] = [];
    for (const sheetName of sheets) {
      if (sheetName !== p) {
        const ws = this.getWorksheet(sheetName);
        const struct = ws
          ? ExcelEngine.detectSheetStructure(ws)
          : { headerStartRow: 1, headerEndRow: 1, dataStartRow: 2 };
        const cols = ws
          ? ExcelEngine.extractSheetColumns(ws, struct.headerStartRow, struct.headerEndRow)
          : [];
        const detectedKey = this.autoDetectKeyColumn(cols);

        secondaries.push({
          sheetName,
          keyCol: detectedKey,
          selected: false,
          headerStartRow: struct.headerStartRow,
          headerEndRow: struct.headerEndRow,
          dataStartRow: struct.dataStartRow,
          columns: cols,
        });
      }
    }
    this.secondarySheets.set(secondaries);
  }

  private getWorksheet(sheetName: string): any {
    return this.workbook ? this.workbook.Sheets[sheetName] : null;
  }

  selectPrimarySheet(sheetName: string): void {
    if (!this.workbook || !sheetName) return;
    const ws = this.workbook.Sheets[sheetName];
    if (!ws) return;

    this.primarySheet.set(sheetName);
    const struct = ExcelEngine.detectSheetStructure(ws);
    this.primaryHeaderStartRow.set(struct.headerStartRow);
    this.primaryHeaderEndRow.set(struct.headerEndRow);
    this.primaryDataStartRow.set(struct.dataStartRow);

    const cols = ExcelEngine.extractSheetColumns(ws, struct.headerStartRow, struct.headerEndRow);
    this.primaryColumns.set(cols);

    const autoKey = this.autoDetectKeyColumn(cols);
    this.primaryKeyCol.set(autoKey);

    // Deteksi triwulan aktif dari nama berkas atau nama lembar kerja (contoh: TW3)
    const contextName = `${sheetName} ${this.file()?.name || ''}`.toLowerCase();
    if (
      contextName.includes('tw3') ||
      contextName.includes('tw 3') ||
      contextName.includes('triwulan 3')
    ) {
      this.manualActiveQuarter.set(3);
    } else if (
      contextName.includes('tw2') ||
      contextName.includes('tw 2') ||
      contextName.includes('triwulan 2')
    ) {
      this.manualActiveQuarter.set(2);
    } else if (
      contextName.includes('tw4') ||
      contextName.includes('tw 4') ||
      contextName.includes('triwulan 4')
    ) {
      this.manualActiveQuarter.set(4);
    } else if (
      contextName.includes('tw1') ||
      contextName.includes('tw 1') ||
      contextName.includes('triwulan 1')
    ) {
      this.manualActiveQuarter.set(1);
    }

    this.refreshAvailableSheets();
    this.performJoin();

    // Auto-populate indikator jika berada pada mode ringkasan dan indikator masih kosong
    if (
      this.calculationDataSource() === 'summary_row' &&
      this.categories().every((c) => c.subCategories.length === 0)
    ) {
      this.autoPopulateIndicatorsFromData();
    }
  }

  onPrimaryHeaderStartRowChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1) {
      const nextEnd = Math.max(val, this.primaryHeaderEndRow());
      this.primaryHeaderStartRow.set(val);
      this.primaryHeaderEndRow.set(nextEnd);
      const nextData = Math.max(nextEnd + 1, this.primaryDataStartRow());
      this.primaryDataStartRow.set(nextData);
      this.reloadPrimaryColumnsAndJoin();
    }
  }

  onPrimaryHeaderEndRowChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1) {
      const nextStart = Math.min(val, this.primaryHeaderStartRow());
      this.primaryHeaderStartRow.set(nextStart);
      this.primaryHeaderEndRow.set(val);
      const nextData = Math.max(val + 1, this.primaryDataStartRow());
      this.primaryDataStartRow.set(nextData);
      this.reloadPrimaryColumnsAndJoin();
    }
  }

  onPrimaryDataStartRowChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1) {
      this.primaryDataStartRow.set(val);
      this.performJoin();
    }
  }

  private reloadPrimaryColumnsAndJoin(): void {
    if (!this.workbook || !this.primarySheet()) return;
    const ws = this.workbook.Sheets[this.primarySheet()];
    if (!ws) return;
    const cols = ExcelEngine.extractSheetColumns(
      ws,
      this.primaryHeaderStartRow(),
      this.primaryHeaderEndRow(),
    );
    this.primaryColumns.set(cols);
    if (!cols.some((c) => c.header === this.primaryKeyCol())) {
      this.primaryKeyCol.set(this.autoDetectKeyColumn(cols));
    }
    this.performJoin();
  }

  onSecondaryHeaderStartRowChange(sheetName: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1) {
      this.secondarySheets.update((list) =>
        list.map((s) => {
          if (s.sheetName !== sheetName) return s;
          const nextEnd = Math.max(val, s.headerEndRow);
          const nextData = Math.max(nextEnd + 1, s.dataStartRow);
          return { ...s, headerStartRow: val, headerEndRow: nextEnd, dataStartRow: nextData };
        }),
      );
      this.reloadSecondaryColumnsAndJoin(sheetName);
    }
  }

  onSecondaryHeaderEndRowChange(sheetName: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1) {
      this.secondarySheets.update((list) =>
        list.map((s) => {
          if (s.sheetName !== sheetName) return s;
          const nextStart = Math.min(val, s.headerStartRow);
          const nextData = Math.max(val + 1, s.dataStartRow);
          return { ...s, headerStartRow: nextStart, headerEndRow: val, dataStartRow: nextData };
        }),
      );
      this.reloadSecondaryColumnsAndJoin(sheetName);
    }
  }

  onSecondaryDataStartRowChange(sheetName: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1) {
      this.secondarySheets.update((list) =>
        list.map((s) => (s.sheetName === sheetName ? { ...s, dataStartRow: val } : s)),
      );
      this.performJoin();
    }
  }

  private reloadSecondaryColumnsAndJoin(sheetName: string): void {
    const ws = this.getWorksheet(sheetName);
    if (!ws) return;

    this.secondarySheets.update((list) =>
      list.map((s) => {
        if (s.sheetName !== sheetName) return s;
        const cols = ExcelEngine.extractSheetColumns(ws, s.headerStartRow, s.headerEndRow);
        const nextKey = cols.some((c) => c.header === s.keyCol)
          ? s.keyCol
          : this.autoDetectKeyColumn(cols);
        return { ...s, columns: cols, keyCol: nextKey };
      }),
    );
    this.performJoin();
  }

  autoDetectKeyColumn(cols: ColumnInfo[]): string {
    const colHeaders = cols.map((c) => c.header);

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
        l === 'kab'
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

  toggleSecondarySheet(sec: SecondarySheetSetup): void {
    this.secondarySheets.update((list) =>
      list.map((s) => (s.sheetName === sec.sheetName ? { ...s, selected: !s.selected } : s)),
    );
    this.performJoin();
  }

  updateSecondaryKey(sheetName: string, keyCol: string): void {
    this.secondarySheets.update((list) =>
      list.map((s) => (s.sheetName === sheetName ? { ...s, keyCol } : s)),
    );
    this.performJoin();
  }

  toggleRowExclusion(rowId: string): void {
    const row = this.joinedRows().find((r) => r['__id'] === rowId);
    const rawKey = row
      ? String(row[this.primaryKeyCol()] ?? '')
          .trim()
          .toLowerCase()
      : '';

    this.excludedRowIds.update((set) => {
      const next = new Set(set);
      if (next.has(rowId)) {
        // Re-activate row
        next.delete(rowId);
        if (rawKey) {
          this.manualExcludedKeys.update((mSet) => {
            const mNext = new Set(mSet);
            mNext.delete(rawKey);
            return mNext;
          });
        }
      } else {
        // Deactivate row
        next.add(rowId);
        if (rawKey) {
          this.manualExcludedKeys.update((mSet) => {
            const mNext = new Set(mSet);
            mNext.add(rawKey);
            return mNext;
          });
        }
      }
      return next;
    });
  }

  setAllRowsActive(active: boolean): void {
    if (active) {
      this.excludedRowIds.set(new Set());
      this.manualExcludedKeys.set(new Set());
    } else {
      const allIds = new Set(this.joinedRows().map((r) => String(r['__id'])));
      this.excludedRowIds.set(allIds);
    }
  }

  onExcludedKeywordsChange(val: string): void {
    this.excludedRowKeywords.set(val);
    this.applyKeywordAndPatternExclusions();
  }

  applyKeywordAndPatternExclusions(rows = this.joinedRows()): void {
    this.workflowEngine.applyKeywordAndPatternExclusions(rows);
  }

  // ============================================================
  // MULTI-SHEET JOIN EXECUTION
  // ============================================================

  performJoin(): void {
    if (!this.workbook || !this.primarySheet()) return;
    const masterWs = this.workbook.Sheets[this.primarySheet()];
    if (!masterWs) return;

    const pCols = this.primaryColumns();
    const pKey = this.primaryKeyCol();
    const activeSecondaries = this.secondarySheets().filter((s) => s.selected);

    const selectedSheets = [
      {
        name: this.primarySheet(),
        selected: true,
        dataStartRow: this.primaryDataStartRow(),
        columns: pCols,
        headers: pCols.map((c) => c.header),
        variables: pCols.map((c) => c.header).filter((h) => h.toLowerCase() !== pKey.toLowerCase()),
        joinColumn: pKey,
      },
      ...activeSecondaries.map((sec) => ({
        name: sec.sheetName,
        selected: true,
        dataStartRow: sec.dataStartRow,
        columns: sec.columns,
        headers: sec.columns.map((c) => c.header),
        variables: sec.columns.map((c) => c.header).filter((h) => h.toLowerCase() !== sec.keyCol.toLowerCase()),
        joinColumn: sec.keyCol,
      })),
    ];

    this.workflowEngine.executeWorkbookJoin({
      workbook: this.workbook,
      selectedSheets,
      joinBy: pKey,
      stripKabupaten: this.stripKabupaten(),
      outputHeaderFormat: 'concat',
      includeSheetPrefix: false,
    });

    // Auto-populate indikator jika format Hasil Join terdeteksi atau indikator masih kosong
    if (
      this.isHasilJoinFormat() ||
      this.categories().length === 0 ||
      this.categories().every((c) => c.subCategories.length === 0)
    ) {
      this.autoPopulateIndicatorsFromData();
    }
  }

  onSummaryRowChange(id: string): void {
    this.workflowEngine.setSummaryRowId(id);
    if (!id || id === 'none') {
      this.workflowEngine.setCalculationDataSource('all_rows');
    } else {
      this.workflowEngine.setCalculationDataSource('summary_row');
    }
  }

  onTargetRowChange(id: string): void {
    this.workflowEngine.setTargetRowId(id);
  }

  onDataSourceModeChange(mode: 'summary_row' | 'all_rows'): void {
    this.workflowEngine.setCalculationDataSource(mode);
  }

  autoPopulateIndicatorsFromData(): void {
    const totalLoaded = this.workflowEngine.autoPopulateIndicators();
    if (totalLoaded > 0) {
      this.notificationMessage.set(
        `Berhasil memuat ${totalLoaded} indikator langsung dari baris data dan target. Silakan periksa pemetaan indikator atau lanjutkan ke Langkah 3.`,
      );
    }
  }

  moveSubCategoryToCategory(sourceCatId: string, subId: string, targetCatId: string): void {
    if (sourceCatId === targetCatId) return;
    let movingSub: StuntingSubCategoryConfig | undefined;
    this.categories.update((cats) =>
      cats.map((c) => {
        if (c.id === sourceCatId) {
          movingSub = c.subCategories.find((s) => s.id === subId);
          return { ...c, subCategories: c.subCategories.filter((s) => s.id !== subId) };
        }
        return c;
      }),
    );
    if (movingSub) {
      this.categories.update((cats) =>
        cats.map((c) =>
          c.id === targetCatId ? { ...c, subCategories: [...c.subCategories, movingSub!] } : c,
        ),
      );
    }
  }

  onQuarterSumColChange(catId: string, subId: string, q: number, colName: string): void {
    const quarter = (q >= 1 && q <= 4 ? q : 1) as 1 | 2 | 3 | 4;
    const countSource = this.totalRowData() || this.summaryRowData();
    let countVal: number | null = null;
    if (this.calculationDataSource() === 'summary_row' && countSource && colName) {
      countVal = IndicatorEvaluator.parseSmartNumber(countSource[colName]);
    }

    this.categories.update((cats) =>
      cats.map((c) => {
        if (c.id !== catId) return c;
        return {
          ...c,
          subCategories: c.subCategories.map((s) => {
            if (s.id !== subId) return s;
            const prevQ = s.quarterColumns?.[quarter] || {};
            const updatedQ: StuntingQuarterInputConfig = {
              ...prevQ,
              sumCol: colName || undefined,
              countValue: countVal !== null ? countVal : colName ? prevQ.countValue : undefined,
            };
            const newQuarterColumns = {
              ...(s.quarterColumns || {}),
              [quarter]: updatedQ,
            };
            const updates: Partial<StuntingSubCategoryConfig> = {
              quarterColumns: newQuarterColumns,
            };
            if (quarter === this.activeQuarter()) {
              updates.sumCol = colName || undefined;
              if (countVal !== null) updates.countValue = countVal;
            }
            return { ...s, ...updates };
          }),
        };
      }),
    );
  }

  onQuarterMeanColChange(catId: string, subId: string, q: number, colName: string): void {
    const quarter = (q >= 1 && q <= 4 ? q : 1) as 1 | 2 | 3 | 4;
    const summaryRow = this.summaryRowData();
    const directVal =
      summaryRow && colName ? IndicatorEvaluator.parseSmartNumber(summaryRow[colName]) : null;
    const targetRow = this.targetRowData();
    const rawTarget = targetRow && colName ? targetRow[colName] : null;
    const cleanedTarget = StuntingEvaluationEngine.cleanTargetValue(rawTarget);

    this.categories.update((cats) =>
      cats.map((c) => {
        if (c.id !== catId) return c;
        return {
          ...c,
          subCategories: c.subCategories.map((s) => {
            if (s.id !== subId) return s;
            const prevQ = s.quarterColumns?.[quarter] || {};
            const updatedQ: StuntingQuarterInputConfig = {
              ...prevQ,
              meanCol: colName || undefined,
              numeratorCol: colName || undefined,
              actualValue: directVal !== null ? directVal : colName ? prevQ.actualValue : undefined,
            };
            const newQuarterColumns = {
              ...(s.quarterColumns || {}),
              [quarter]: updatedQ,
            };
            const updates: Partial<StuntingSubCategoryConfig> = {
              quarterColumns: newQuarterColumns,
            };
            if (quarter === this.activeQuarter()) {
              updates.meanCol = colName || undefined;
              updates.numeratorCol = colName || '';
              updates.dataCol = colName || '';
              if (directVal !== null) updates.actualValue = directVal;
            }
            if (cleanedTarget.value !== null && s.targetCurrentYear === null) {
              updates.targetCurrentYear = cleanedTarget.value;
            }
            if (cleanedTarget.polarity !== 'positive' && s.polarity === 'positive') {
              updates.polarity = cleanedTarget.polarity;
            }
            return { ...s, ...updates };
          }),
        };
      }),
    );
  }

  onSumColChange(catId: string, subId: string, colName: string): void {
    const q = this.getSubActiveQuarter(subId);
    this.onQuarterSumColChange(catId, subId, q, colName);
  }

  onMeanColChange(catId: string, subId: string, colName: string): void {
    const q = this.getSubActiveQuarter(subId);
    this.onQuarterMeanColChange(catId, subId, q, colName);
  }

  copyQuarterToAll(catId: string, subId: string, sourceQ: number): void {
    const quarter = (sourceQ >= 1 && sourceQ <= 4 ? sourceQ : 1) as 1 | 2 | 3 | 4;
    this.categories.update((cats) =>
      cats.map((c) => {
        if (c.id !== catId) return c;
        return {
          ...c,
          subCategories: c.subCategories.map((s) => {
            if (s.id !== subId) return s;
            const srcConfig = s.quarterColumns?.[quarter] || {
              sumCol: s.sumCol,
              meanCol: s.meanCol || s.numeratorCol,
              numeratorCol: s.numeratorCol,
              actualValue: s.actualValue,
              countValue: s.countValue,
            };

            const newQuarterColumns: Record<1 | 2 | 3 | 4, StuntingQuarterInputConfig> = {
              1: { ...srcConfig },
              2: { ...srcConfig },
              3: { ...srcConfig },
              4: { ...srcConfig },
            };

            return {
              ...s,
              quarterColumns: newQuarterColumns,
            };
          }),
        };
      }),
    );
    this.notificationMessage.set(
      `Konfigurasi TW ${quarter} berhasil disalin ke semua Triwulan (TW 1 - TW 4).`,
    );
  }

  clearQuarterConfig(catId: string, subId: string, q: number): void {
    const quarter = (q >= 1 && q <= 4 ? q : 1) as 1 | 2 | 3 | 4;
    this.categories.update((cats) =>
      cats.map((c) => {
        if (c.id !== catId) return c;
        return {
          ...c,
          subCategories: c.subCategories.map((s) => {
            if (s.id !== subId) return s;
            const newQuarterColumns = { ...(s.quarterColumns || {}) };
            delete newQuarterColumns[quarter];

            const updates: Partial<StuntingSubCategoryConfig> = {
              quarterColumns: newQuarterColumns,
            };
            if (quarter === this.activeQuarter()) {
              updates.sumCol = undefined;
              updates.meanCol = undefined;
              updates.numeratorCol = '';
              updates.actualValue = null;
              updates.countValue = null;
            }
            return { ...s, ...updates };
          }),
        };
      }),
    );
    this.notificationMessage.set(`Konfigurasi TW ${quarter} berhasil dikosongkan.`);
  }

  // ============================================================
  // STEP 2: CATEGORY & INDICATOR BUILDER METHODS
  // ============================================================

  loadStandardCategories(): void {
    this.categories.set([
      {
        id: 'cat-1',
        name: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
        subCategories: [],
      },
      {
        id: 'cat-2',
        name: 'Intervensi untuk balita (setelah kelahiran)',
        subCategories: [],
      },
      {
        id: 'cat-3',
        name: 'Intervensi lintas siklus hidup',
        subCategories: [],
      },
    ]);
  }

  addCategory(name = ''): void {
    const id = `cat-${Date.now()}`;
    const newCatName = name.trim() || `Kategori Intervensi ${this.categories().length + 1}`;
    this.categories.update((cats) => [...cats, { id, name: newCatName, subCategories: [] }]);
  }

  removeCategory(catId: string): void {
    this.categories.update((cats) => cats.filter((c) => c.id !== catId));
  }

  updateCategoryName(catId: string, event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.categories.update((cats) => cats.map((c) => (c.id === catId ? { ...c, name: val } : c)));
  }

  addSubCategory(catId: string): void {
    this.workflowEngine.addSubCategory(catId);
  }

  removeSubCategory(catId: string, subId: string): void {
    this.workflowEngine.removeSubCategory(catId, subId);
  }

  onNumeratorColChange(catId: string, subId: string, colName: string): void {
    const targetRow = this.targetRowData();
    const summaryRow = this.summaryRowData();

    let rawTarget = targetRow ? targetRow[colName] : null;
    if (rawTarget === undefined || rawTarget === null || rawTarget === '') {
      const colIdx = this.joinedColumns().indexOf(colName);
      if (colIdx > 0) {
        const prevCol = this.joinedColumns()[colIdx - 1];
        rawTarget = targetRow ? targetRow[prevCol] : null;
      }
    }
    const cleanedTarget = StuntingEvaluationEngine.cleanTargetValue(rawTarget);

    let directVal: number | null = null;
    let countVal: number | null = null;
    if (this.calculationDataSource() === 'summary_row' && summaryRow) {
      directVal = IndicatorEvaluator.parseSmartNumber(summaryRow[colName]);
      const countSource = this.totalRowData() || summaryRow;
      const colIdx = this.joinedColumns().indexOf(colName);
      if (colIdx > 0) {
        const prevCol = this.joinedColumns()[colIdx - 1];
        countVal = IndicatorEvaluator.parseSmartNumber(countSource ? countSource[prevCol] : null);
      }
    }

    this.categories.update((cats) =>
      cats.map((c) => {
        if (c.id !== catId) return c;
        return {
          ...c,
          subCategories: c.subCategories.map((s) => {
            if (s.id !== subId) return s;
            const shouldAutoRename = !s.name || s.name === s.numeratorCol;
            const actQ = this.getSubActiveQuarter(s.id);
            const prevQ = s.quarterColumns?.[actQ] || {};
            const updatedQ: StuntingQuarterInputConfig = {
              ...prevQ,
              numeratorCol: colName,
              meanCol: colName,
              actualValue:
                directVal !== null
                  ? directVal
                  : this.calculationDataSource() === 'summary_row'
                    ? prevQ.actualValue
                    : undefined,
              countValue:
                countVal !== null
                  ? countVal
                  : this.calculationDataSource() === 'summary_row'
                    ? prevQ.countValue
                    : undefined,
            };
            const newQuarterColumns = s.quarterColumns
              ? {
                  ...s.quarterColumns,
                  [actQ]: updatedQ,
                }
              : undefined;

            return {
              ...s,
              numeratorCol: colName,
              dataCol: colName,
              meanCol: colName,
              actualValue:
                directVal !== null
                  ? directVal
                  : this.calculationDataSource() === 'summary_row'
                    ? s.actualValue
                    : undefined,
              countValue: countVal !== null ? countVal : s.countValue,
              name: shouldAutoRename ? colName : s.name,
              targetCurrentYear:
                cleanedTarget.value !== null ? cleanedTarget.value : s.targetCurrentYear,
              polarity: cleanedTarget.polarity !== 'positive' ? cleanedTarget.polarity : s.polarity,
              ...(newQuarterColumns ? { quarterColumns: newQuarterColumns } : {}),
            };
          }),
        };
      }),
    );
  }

  getSubActiveQuarter(subId: string): 1 | 2 | 3 | 4 {
    return this.subActiveQuarter()[subId] || this.activeQuarter() || 1;
  }

  setSubActiveQuarter(subId: string, q: number): void {
    const quarter = (q >= 1 && q <= 4 ? q : 1) as 1 | 2 | 3 | 4;
    this.subActiveQuarter.update((m) => ({ ...m, [subId]: quarter }));
  }

  setAllSubActiveQuarter(q: number): void {
    const quarter = (q >= 1 && q <= 4 ? q : 1) as 1 | 2 | 3 | 4;
    this.setActiveQuarter(quarter);
    this.subActiveQuarter.update((m) => {
      const nextMap: Record<string, 1 | 2 | 3 | 4> = { ...m };
      for (const cat of this.categories()) {
        for (const sub of cat.subCategories) {
          nextMap[sub.id] = quarter;
        }
      }
      return nextMap;
    });
  }

  getQuarterSumCol(sub: StuntingSubCategoryConfig, q: number): string {
    const quarter = (q >= 1 && q <= 4 ? q : 1) as 1 | 2 | 3 | 4;
    if (sub.quarterColumns?.[quarter]?.sumCol !== undefined) {
      return sub.quarterColumns[quarter]!.sumCol || '';
    }
    if (
      (!sub.quarterColumns || Object.keys(sub.quarterColumns).length === 0) &&
      quarter === this.activeQuarter()
    ) {
      return sub.sumCol || '';
    }
    return '';
  }

  getQuarterMeanCol(sub: StuntingSubCategoryConfig, q: number): string {
    const quarter = (q >= 1 && q <= 4 ? q : 1) as 1 | 2 | 3 | 4;
    if (sub.quarterColumns?.[quarter]?.meanCol !== undefined) {
      return sub.quarterColumns[quarter]!.meanCol || '';
    }
    if (sub.quarterColumns?.[quarter]?.numeratorCol !== undefined) {
      return sub.quarterColumns[quarter]!.numeratorCol || '';
    }
    if (
      (!sub.quarterColumns || Object.keys(sub.quarterColumns).length === 0) &&
      quarter === this.activeQuarter()
    ) {
      return sub.meanCol || sub.numeratorCol || '';
    }
    return '';
  }

  hasQuarterConfig(sub: StuntingSubCategoryConfig, q: number): boolean {
    const quarter = (q >= 1 && q <= 4 ? q : 1) as 1 | 2 | 3 | 4;
    const qCfg = sub.quarterColumns?.[quarter];
    if (qCfg) {
      return !!(
        qCfg.sumCol ||
        qCfg.meanCol ||
        qCfg.numeratorCol ||
        (qCfg.actualValue !== undefined && qCfg.actualValue !== null) ||
        (qCfg.countValue !== undefined && qCfg.countValue !== null)
      );
    }
    if (
      (!sub.quarterColumns || Object.keys(sub.quarterColumns).length === 0) &&
      quarter === this.activeQuarter()
    ) {
      return !!(
        sub.sumCol ||
        sub.meanCol ||
        sub.numeratorCol ||
        (sub.actualValue !== undefined && sub.actualValue !== null) ||
        (sub.countValue !== undefined && sub.countValue !== null)
      );
    }
    return false;
  }

  getQuarterNumeratorCol(sub: StuntingSubCategoryConfig, q: number): string {
    const quarter = (q >= 1 && q <= 4 ? q : 1) as 1 | 2 | 3 | 4;
    if (sub.quarterColumns?.[quarter]?.numeratorCol !== undefined) {
      return sub.quarterColumns[quarter]!.numeratorCol || '';
    }
    // Fallback for single/legacy config
    if (
      (!sub.quarterColumns || Object.keys(sub.quarterColumns).length === 0) &&
      quarter === this.activeQuarter()
    ) {
      return sub.numeratorCol || '';
    }
    return '';
  }

  updateSubCategory(
    catId: string,
    subId: string,
    updates: Partial<StuntingSubCategoryConfig>,
  ): void {
    this.categories.update((cats) =>
      cats.map((c) => {
        if (c.id !== catId) return c;
        return {
          ...c,
          subCategories: c.subCategories.map((s) => (s.id === subId ? { ...s, ...updates } : s)),
        };
      }),
    );
  }

  toggleSubPolarity(catId: string, subId: string): void {
    this.categories.update((cats) =>
      cats.map((c) => {
        if (c.id !== catId) return c;
        return {
          ...c,
          subCategories: c.subCategories.map((s) => {
            if (s.id !== subId) return s;
            const nextPol: IndicatorPolarity = s.polarity === 'negative' ? 'positive' : 'negative';
            return { ...s, polarity: nextPol };
          }),
        };
      }),
    );
  }

  getSubCategoryQuarterLiveStats(
    sub: StuntingSubCategoryConfig,
    q: number,
  ): {
    sumNum: number | null;
    sumDen: number | null;
    actualPercentage: number | null;
  } {
    const quarter = (q >= 1 && q <= 4 ? q : 1) as 1 | 2 | 3 | 4;
    return this.workflowEngine.calculateQuarterActual(sub, quarter, this.validJoinedRows());
  }

  getSubCategoryLiveStats(sub: StuntingSubCategoryConfig): {
    sumNum: number | null;
    sumDen: number | null;
    actualPercentage: number | null;
  } {
    return this.getSubCategoryQuarterLiveStats(sub, this.activeQuarter());
  }

  getInitialStatusBadge(sub: StuntingSubCategoryConfig): {
    label: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
  } {
    const stats = this.getSubCategoryLiveStats(sub);
    const target = IndicatorEvaluator.parseSmartNumber(sub.targetCurrentYear);
    if (stats.actualPercentage === null || target === null) {
      return {
        label: 'Belum Dinilai',
        bgClass: 'bg-slate-100',
        textClass: 'text-slate-600',
        borderClass: 'border-slate-200',
      };
    }
    const isNegative = sub.polarity === 'negative';
    const isSuccess = isNegative
      ? stats.actualPercentage <= target
      : stats.actualPercentage >= target;
    if (isSuccess) {
      return {
        label: 'On Track',
        bgClass: 'bg-emerald-100',
        textClass: 'text-emerald-800',
        borderClass: 'border-emerald-200',
      };
    } else {
      return {
        label: 'Perlu Percepatan',
        bgClass: 'bg-rose-100',
        textClass: 'text-rose-800',
        borderClass: 'border-rose-200',
      };
    }
  }

  filteredGroupedRows = computed(() => {
    const res = this.evaluationResult();
    if (!res) return [];

    const query = this.searchQuery().trim().toLowerCase();
    const filter = this.activeFilter();

    return res.groupedRows
      .map((group) => {
        const filtered = group.rows.filter((r) => {
          const matchQuery =
            !query ||
            r.name.toLowerCase().includes(query) ||
            r.category.toLowerCase().includes(query);
          if (!matchQuery) return false;

          if (filter === 'all') return true;
          if (filter === 'on_track') return r.status === 'on_track';
          if (filter === 'perlu_perhatian') return r.status === 'perlu_perhatian';
          if (filter === 'perlu_percepatan') return r.status === 'perlu_percepatan';
          if (filter === 'belum_dinilai') return r.status === 'belum_dinilai';
          if (filter === 'target_tercapai') return r.isTargetReached;
          if (filter === 'meningkat') return r.isImproved;
          if (filter === 'menurun') return r.isDeclined;

          return r.pattern === filter;
        });

        return {
          ...group,
          rows: filtered,
        };
      })
      .filter((g) => g.rows.length > 0);
  });

  setActiveQuarter(q: number): void {
    const validQ = (q >= 1 && q <= 4 ? q : 1) as 1 | 2 | 3 | 4;
    this.manualActiveQuarter.set(validQ);
  }

  setFilter(filter: string): void {
    this.activeFilter.set(filter);
  }

  toggleCategoryCollapse(catName: string): void {
    this.collapsedCategories.update((map) => ({
      ...map,
      [catName]: !map[catName],
    }));
  }

  goToStep(step: 1 | 2 | 3): void {
    const check = this.workflowEngine.canTransitionTo(step);
    if (!check.allowed) {
      if (step === 2) {
        this.notificationMessage.set(
          'Harap unggah berkas dan pastikan minimal ada 1 baris data aktif.',
        );
      } else if (step === 3) {
        this.notificationMessage.set('Harap buat minimal 1 sub-kategori indikator pada Langkah 2.');
      } else {
        this.notificationMessage.set(check.reason || 'Transisi langkah tidak diizinkan.');
      }
      return;
    }
    this.workflowEngine.transitionTo(step);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ============================================================
  // EXPORT EXCEL & CHART VISUALIZER BRIDGE
  // ============================================================

  exportJoinedData(): void {
    const rows =
      this.activeRegionRows().length > 0 ? this.activeRegionRows() : this.validJoinedRows();
    if (rows.length === 0) {
      this.notificationMessage.set('Tidak ada data gabungan yang aktif untuk diekspor.');
      return;
    }

    const fileName = StuntingExcelExporter.exportJoinedData({
      rows,
      primaryKeyColumn: this.primaryKeyCol(),
      joinedColumns: this.joinedColumns(),
    });

    this.notificationMessage.set(`Data gabungan ${fileName} berhasil diunduh.`);
  }

  exportExcel(): void {
    const res = this.evaluationResult();
    if (!res || res.rows.length === 0) {
      this.notificationMessage.set('Tidak ada data monitoring untuk diekspor.');
      return;
    }

    const quartersToExport =
      this.viewMode() === 'single_quarter' ? [this.activeQuarter()] : this.displayedQuarters();

    const fileName = StuntingExcelExporter.exportMonitoringReport({
      evaluationResult: res,
      availableQuarters: quartersToExport,
      validJoinedRows:
        this.activeRegionRows().length > 0 ? this.activeRegionRows() : this.validJoinedRows(),
      primaryKeyColumn: this.primaryKeyCol(),
      joinedColumns: this.joinedColumns(),
    });

    this.notificationMessage.set(`Laporan ${fileName} berhasil diunduh.`);
  }

  visualizeInChart(): void {
    const res = this.evaluationResult();
    if (!res || res.rows.length === 0) return;

    this.healthDataExchange.publishStuntingEvaluationToChart({
      activeQuarter: this.activeQuarter(),
      rows: res.rows,
    });

    this.router.navigate(['/chart']);
  }

  // ============================================================
  // PRESET CONFIGURATION (JSON & LOCALSTORAGE)
  // ============================================================

  exportConfiguration(): void {
    const preset: StuntingPipelinePreset = {
      version: '2.0',
      name: this.file() ? `Preset Stunting - ${this.file()!.name}` : 'Preset Pemantauan Stunting',
      savedAt: new Date().toISOString(),
      primarySheet: this.primarySheet(),
      primaryKeyColumn: this.primaryKeyCol(),
      primaryHeaderStartRow: this.primaryHeaderStartRow(),
      primaryHeaderEndRow: this.primaryHeaderEndRow(),
      primaryDataStartRow: this.primaryDataStartRow(),
      secondarySheets: this.secondarySheets()
        .filter((s) => s.selected)
        .map((s) => ({
          sheetName: s.sheetName,
          keyColumn: s.keyCol,
          headerStartRow: s.headerStartRow,
          headerEndRow: s.headerEndRow,
          dataStartRow: s.dataStartRow,
        })),
      excludedRowKeywords: this.excludedRowKeywords()
        .split(',')
        .map((k) => k.trim()),
      manualExcludedKeys: Array.from(this.manualExcludedKeys()),
      categories: this.categories(),
      activeQuarter: this.activeQuarter(),
      toleranceThreshold: this.toleranceThreshold(),
    };

    StuntingPresetStore.savePreset(preset, true);
    this.hasSavedConfig.set(true);
    this.activePresetName.set(preset.name || 'Preset Tersimpan');

    this.configNotification.set({
      type: 'success',
      message: 'Konfigurasi pipeline stunting berhasil disimpan dan diunduh (.json)!',
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
        const preset = StuntingPresetStore.parsePresetJson(text);
        this.applyConfiguration(preset, file.name);
      } catch (err) {
        this.configNotification.set({
          type: 'warning',
          message:
            'Format file JSON tidak valid. Pastikan file berasal dari ekspor konfigurasi stunting.',
        });
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  }

  loadSavedConfigurationFromStorage(): void {
    const preset = StuntingPresetStore.loadLastPreset();
    if (!preset) {
      this.configNotification.set({
        type: 'info',
        message: 'Belum ada konfigurasi tersimpan di browser ini.',
      });
      return;
    }
    this.applyConfiguration(preset, preset.name || 'Penyimpanan Lokal');
  }

  closeConfigNotification(): void {
    this.configNotification.set(null);
  }

  applyConfiguration(preset: AnyStuntingPreset, sourceName: string): void {
    StuntingPresetStore.savePreset(preset, false);
    this.hasSavedConfig.set(true);
    this.activePresetName.set(preset.name || sourceName);

    if (!this.file() && !this.workbook) {
      this.pendingPreset = preset;
      this.configNotification.set({
        type: 'info',
        message: `Preset "${sourceName}" berhasil dimuat ke memori. Silakan unggah berkas Excel untuk melanjutkan analisis otomatis.`,
      });
      return;
    }

    if (preset.version === '2.0') {
      const p2 = preset as StuntingPipelinePreset;
      if (p2.categories && Array.isArray(p2.categories)) {
        this.categories.set(p2.categories);
      }
      if (p2.activeQuarter) {
        this.setActiveQuarter(p2.activeQuarter);
      }
      if (p2.toleranceThreshold !== undefined) {
        this.toleranceThreshold.set(p2.toleranceThreshold);
      }
      if (p2.primarySheet && this.workbook?.Sheets[p2.primarySheet]) {
        this.selectPrimarySheet(p2.primarySheet);
      }
      if (p2.primaryHeaderStartRow !== undefined) {
        this.primaryHeaderStartRow.set(p2.primaryHeaderStartRow);
      }
      if (p2.primaryHeaderEndRow !== undefined) {
        this.primaryHeaderEndRow.set(p2.primaryHeaderEndRow);
      }
      if (p2.primaryDataStartRow !== undefined) {
        this.primaryDataStartRow.set(p2.primaryDataStartRow);
      }
      if (this.primarySheet() && this.workbook?.Sheets[this.primarySheet()]) {
        const ws = this.workbook.Sheets[this.primarySheet()];
        const cols = ExcelEngine.extractSheetColumns(
          ws,
          this.primaryHeaderStartRow(),
          this.primaryHeaderEndRow(),
        );
        this.primaryColumns.set(cols);
      }
      if (p2.primaryKeyColumn) {
        this.primaryKeyCol.set(p2.primaryKeyColumn);
      }
      if (p2.secondarySheets && Array.isArray(p2.secondarySheets)) {
        this.secondarySheets.update((current) =>
          current.map((sheet) => {
            const savedSec = p2.secondarySheets.find((s) => s.sheetName === sheet.sheetName);
            if (savedSec) {
              const hStart = savedSec.headerStartRow ?? sheet.headerStartRow;
              const hEnd = savedSec.headerEndRow ?? sheet.headerEndRow;
              const dStart = savedSec.dataStartRow ?? sheet.dataStartRow;
              const ws = this.getWorksheet(sheet.sheetName);
              const cols = ws ? ExcelEngine.extractSheetColumns(ws, hStart, hEnd) : sheet.columns;
              return {
                ...sheet,
                selected: true,
                keyCol: savedSec.keyColumn || sheet.keyCol,
                headerStartRow: hStart,
                headerEndRow: hEnd,
                dataStartRow: dStart,
                columns: cols,
              };
            }
            return sheet;
          }),
        );
      }
      if (p2.excludedRowKeywords && Array.isArray(p2.excludedRowKeywords)) {
        this.excludedRowKeywords.set(p2.excludedRowKeywords.join(', '));
      }
      if (p2.manualExcludedKeys && Array.isArray(p2.manualExcludedKeys)) {
        this.manualExcludedKeys.set(new Set(p2.manualExcludedKeys.map((k) => k.toLowerCase())));
      }
      this.performJoin();

      this.configNotification.set({
        type: 'success',
        message: `Preset "${sourceName}" berhasil diterapkan! Struktur kategori dan konfigurasi join telah dimuat.`,
      });
    } else {
      // Legacy preset v1.0
      const p1 = preset as StuntingConfigurationPreset;
      if (p1.activeQuarter) this.setActiveQuarter(p1.activeQuarter);
      if (p1.toleranceThreshold !== undefined) this.toleranceThreshold.set(p1.toleranceThreshold);
      if (p1.sheetName && this.workbook?.Sheets[p1.sheetName]) {
        this.selectPrimarySheet(p1.sheetName);
      }
      this.configNotification.set({
        type: 'success',
        message: `Preset versi 1.0 "${sourceName}" berhasil dimuat.`,
      });
    }
  }

  clearFile(): void {
    this.workflowEngine.reset();
    this.file.set(null);
    this.workbook = null;
    this.availableSheets.set([]);
    this.primarySheet.set('');
    this.primaryColumns.set([]);
    this.secondarySheets.set([]);
    this.showSettings.set(false);
    this.healthDataExchange.clearStuntingData();
    this.notificationMessage.set(null);
    this.isMultiQuarterCloudMode.set(false);
    this.cloudLoadNotice.set(null);
  }
}
