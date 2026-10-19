import { DecimalPipe } from '@angular/common';
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
  StuntingSubCategoryConfig,
} from '../../core/stunting/stunting-evaluation-engine';
import { ColumnInfo, ExcelEngine } from '../../shared/excel';
import { StuntingExcelExporter } from '../../core/stunting/stunting-excel-exporter';
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

import {
  UiAlertComponent,
  UiButtonComponent,
  UiPageHeaderComponent,
} from '../../shared/ui';

export interface JoinedRowPreviewItem {
  id: string;
  key: string;
  data: Record<string, unknown>;
  isExcluded: boolean;
  excludeReason?: string;
}

@Component({
  selector: 'app-stunting-monitoring',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    UiPageHeaderComponent,
    UiButtonComponent,
    UiAlertComponent,
  ],
  templateUrl: './stunting-monitoring.component.html',
})
export class StuntingMonitoringComponent implements OnInit {
  private router = inject(Router);
  private healthDataExchange = inject(HealthDataExchange);

  ngOnInit(): void {
    this.loadTransferredData();
  }

  // Stepper State: 1 = Unggah & Join, 2 = Kategori & Indikator, 3 = Dashboard Monitoring
  activeStep = signal<1 | 2 | 3>(1);

  // ============================================================
  // STEP 1: FILE UPLOAD & MULTI-SHEET JOIN
  // ============================================================
  file = signal<File | null>(null);
  workbook: any = null;
  showSettings = signal<boolean>(false);

  availableSheets = signal<string[]>([]);
  primarySheet = signal<string>('');
  primaryKeyCol = signal<string>('');
  primaryHeaderStartRow = signal<number>(1);
  primaryHeaderEndRow = signal<number>(1);
  primaryDataStartRow = signal<number>(2);
  primaryColumns = signal<ColumnInfo[]>([]);

  secondarySheets = signal<SecondarySheetSetup[]>([]);
  stripKabupaten = signal<boolean>(true);
  excludedRowKeywords = signal<string>('TOTAL, JUMLAH, KABUPATEN');
  manualExcludedKeys = signal<Set<string>>(new Set());
  excludedRowIds = signal<Set<string>>(new Set());

  // Raw & Joined Dataset
  joinedRows = signal<Record<string, unknown>[]>([]);
  joinedColumns = signal<string[]>([]);
  previewExpanded = signal<boolean>(false);
  previewWrapText = signal<boolean>(false);

  // Summary & Target Rows for Pre-Calculated Direct Evaluation
  calculationDataSource = signal<'summary_row' | 'all_rows'>('all_rows');
  summaryRowId = signal<string>('');
  targetRowId = signal<string>('');
  summaryRowData = signal<Record<string, unknown> | null>(null);
  targetRowData = signal<Record<string, unknown> | null>(null);

  availableSummaryRows = computed(() => {
    const pKey = this.primaryKeyCol();
    return this.joinedRows().map((r, idx) => ({
      id: String(r['__id'] ?? `row-${idx}`),
      label: String(r[pKey] ?? '').trim() || `[Baris ${idx + 1}]`,
      data: r,
    }));
  });

  availableTargetRows = computed(() => {
    const pKey = this.primaryKeyCol();
    return this.joinedRows().map((r, idx) => ({
      id: String(r['__id'] ?? `row-${idx}`),
      label: String(r[pKey] ?? '').trim() || `[Baris ${idx + 1}]`,
      data: r,
    }));
  });

  // Valid rows for evaluation: if in summary_row mode and summaryRowData is present, use single pre-calculated row
  validJoinedRows = computed(() => {
    if (this.calculationDataSource() === 'summary_row' && this.summaryRowData()) {
      return [this.summaryRowData()!];
    }
    const rows = this.joinedRows();
    const exIds = this.excludedRowIds();
    return rows.filter((r) => !exIds.has(String(r['__id'])));
  });

  // Preview List for checklist table
  previewRows = computed<JoinedRowPreviewItem[]>(() => {
    const rows = this.joinedRows();
    const pKey = this.primaryKeyCol();
    const exIds = this.excludedRowIds();
    const keywords = this.excludedRowKeywords()
      .split(',')
      .map((k) => k.trim().toUpperCase())
      .filter((k) => k.length > 0);

    return rows.map((r, idx) => {
      const id = String(r['__id'] ?? `row-${idx}`);
      const keyVal = String(r[pKey] ?? '').trim();
      const isExcluded = exIds.has(id);

      let reason = '';
      if (isExcluded) {
        if (!keyVal) {
          reason = 'Baris kosong / tanpa nama wilayah';
        } else {
          const upperKey = keyVal.toUpperCase();
          for (const kw of keywords) {
            if (upperKey.includes(kw)) {
              reason = `Baris akumulasi (${kw})`;
              break;
            }
          }
          if (!reason) {
            reason = 'Dinonaktifkan manual';
          }
        }
      }

      return {
        id,
        key: keyVal || `[Baris ${idx + 1} - Tanpa Nama]`,
        data: r,
        isExcluded,
        excludeReason: reason,
      };
    });
  });

  // ============================================================
  // STEP 2: CATEGORY & SUB-CATEGORY BUILDER
  // ============================================================
  categories = signal<StuntingCategoryConfig[]>([]);

  totalIndicatorsCount = computed(() =>
    this.categories().reduce((sum, c) => sum + c.subCategories.length, 0),
  );

  canProceedToStep2 = computed(() => this.validJoinedRows().length > 0);

  canProceedToStep3 = computed(
    () =>
      this.validJoinedRows().length > 0 &&
      this.categories().some((c) => c.subCategories.length > 0),
  );

  // ============================================================
  // STEP 3: DASHBOARD MONITORING & MULTI-QUARTER EVALUATION
  // ============================================================
  manualActiveQuarter = signal<1 | 2 | 3 | 4 | null>(null);
  toleranceThreshold = signal<number>(-5.0);
  quarterWeight = signal<number | null>(null);
  searchQuery = signal<string>('');
  activeFilter = signal<string>('all');
  collapsedCategories = signal<Record<string, boolean>>({});
  viewMode = signal<'auto' | 'single_quarter' | 'all_quarters'>('auto');

  displayedQuarters = computed<(1 | 2 | 3 | 4)[]>(() => {
    const mode = this.viewMode();
    if (mode === 'single_quarter') {
      return [this.activeQuarter()];
    }
    if (mode === 'all_quarters') {
      return this.availableQuarters();
    }
    return this.availableQuarters();
  });

  onTrackCount = computed(() => this.evaluationResult()?.rows.filter((r) => r.status === 'on_track').length ?? 0);
  perluPercepatanCount = computed(() => this.evaluationResult()?.rows.filter((r) => r.status === 'perlu_percepatan').length ?? 0);
  perluPerhatianCount = computed(() => this.evaluationResult()?.rows.filter((r) => r.status === 'perlu_perhatian').length ?? 0);

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
    }
    if (transferred.targetRow) {
      const tgtId = `row-target-${rowsWithId.length}`;
      rowsWithId.push({ ...transferred.targetRow, __id: tgtId });
    }
    if (transferred.averageRow) {
      const avgId = `row-avg-${rowsWithId.length}`;
      rowsWithId.push({ ...transferred.averageRow, __id: avgId });
    }

    this.joinedRows.set(rowsWithId);
    this.applyKeywordAndPatternExclusions(rowsWithId);

    // Deteksi baris ringkasan (JAWA TENGAH / PROVINSI / TOTAL / JUMLAH) dan baris target (TARGET)
    let detectedSummaryRow: Record<string, unknown> | null = null;
    let detectedTargetRow: Record<string, unknown> | null = null;

    for (const r of rowsWithId) {
      const keyStr = String(r[pKey] ?? '').trim().toUpperCase();
      if (keyStr.includes('TARGET')) {
        detectedTargetRow = r;
      } else if (
        keyStr.includes('JAWA TENGAH') ||
        keyStr.includes('PROVINSI') ||
        keyStr.startsWith('PROV') ||
        keyStr.includes('TOTAL') ||
        keyStr.includes('JUMLAH')
      ) {
        if (!detectedSummaryRow) detectedSummaryRow = r;
      }
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

    if (transferred.averageRow) {
      const avgRow = rowsWithId.find((r) => String(r[pKey] ?? '').toUpperCase().includes('RATA'));
      if (avgRow) {
        this.excludedRowIds.update((s) => new Set(s).add(String(avgRow['__id'])));
      }
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
        const struct = ws ? ExcelEngine.detectSheetStructure(ws) : { headerStartRow: 1, headerEndRow: 1, dataStartRow: 2 };
        const cols = ws ? ExcelEngine.extractSheetColumns(ws, struct.headerStartRow, struct.headerEndRow) : [];
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
    if (contextName.includes('tw3') || contextName.includes('tw 3') || contextName.includes('triwulan 3')) {
      this.manualActiveQuarter.set(3);
    } else if (contextName.includes('tw2') || contextName.includes('tw 2') || contextName.includes('triwulan 2')) {
      this.manualActiveQuarter.set(2);
    } else if (contextName.includes('tw4') || contextName.includes('tw 4') || contextName.includes('triwulan 4')) {
      this.manualActiveQuarter.set(4);
    } else if (contextName.includes('tw1') || contextName.includes('tw 1') || contextName.includes('triwulan 1')) {
      this.manualActiveQuarter.set(1);
    }

    this.refreshAvailableSheets();
    this.performJoin();

    // Auto-populate indikator jika berada pada mode ringkasan dan indikator masih kosong
    if (this.calculationDataSource() === 'summary_row' && this.categories().every((c) => c.subCategories.length === 0)) {
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
    const cols = ExcelEngine.extractSheetColumns(ws, this.primaryHeaderStartRow(), this.primaryHeaderEndRow());
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
        const nextKey = cols.some((c) => c.header === s.keyCol) ? s.keyCol : this.autoDetectKeyColumn(cols);
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
    const rawKey = row ? String(row[this.primaryKeyCol()] ?? '').trim().toLowerCase() : '';

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
    const pKey = this.primaryKeyCol();
    const keywords = this.excludedRowKeywords()
      .split(',')
      .map((k) => k.trim().toUpperCase())
      .filter((k) => k.length > 0);
    const manualEx = this.manualExcludedKeys();

    const exIds = new Set<string>();

    for (const r of rows) {
      const id = String(r['__id']);
      const rawKey = String(r[pKey] ?? '').trim();
      const lowerKey = rawKey.toLowerCase();
      const upperKey = rawKey.toUpperCase();

      // 1. Empty or whitespace key (blank spacer row, footnote, footer without name)
      if (!rawKey) {
        exIds.add(id);
        continue;
      }

      // 2. Previously manually excluded key
      if (manualEx.has(lowerKey)) {
        exIds.add(id);
        continue;
      }

      // 3. Keyword in primary key column
      let isMatch = false;
      for (const kw of keywords) {
        if (upperKey.includes(kw)) {
          isMatch = true;
          break;
        }
      }

      // 4. Keyword in any column of the row (e.g. "TOTAL" in another cell)
      if (!isMatch) {
        for (const [col, val] of Object.entries(r)) {
          if (col === '__id') continue;
          const strVal = String(val ?? '').trim().toUpperCase();
          for (const kw of keywords) {
            if (strVal === kw || strVal.startsWith(kw + ' ') || strVal.endsWith(' ' + kw)) {
              isMatch = true;
              break;
            }
          }
          if (isMatch) break;
        }
      }

      if (isMatch) {
        exIds.add(id);
      }
    }

    this.excludedRowIds.set(exIds);
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

    // Read master rows
    const masterRows = ExcelEngine.readSheetRows(
      masterWs,
      pCols,
      this.primaryDataStartRow(),
    );

    const activeSecondaries = this.secondarySheets().filter((s) => s.selected);
    const allColsMap = new Map<string, string>(); // normalized -> original column header

    // Register master columns
    for (const c of pCols) {
      allColsMap.set(c.header.toLowerCase(), c.header);
    }

    // Map secondary sheets data
    const secondaryIndexes: {
      sheet: SecondarySheetSetup;
      map: Map<string, Record<string, unknown>>;
    }[] = [];

    for (const sec of activeSecondaries) {
      const ws = this.getWorksheet(sec.sheetName);
      if (!ws) continue;

      const secRows = ExcelEngine.readSheetRows(ws, sec.columns, sec.dataStartRow);
      const map = new Map<string, Record<string, unknown>>();

      for (const sr of secRows) {
        const rawK = String(sr[sec.keyCol] ?? '').trim();
        if (rawK) {
          const normK = RegionNormalizer.normalizeJoinKey(rawK, this.stripKabupaten());
          map.set(normK, sr);
        }
      }

      secondaryIndexes.push({ sheet: sec, map });

      // Register secondary columns (prefix with sheet name if collision occurs)
      for (const sc of sec.columns) {
        if (sc.header.toLowerCase() === sec.keyCol.toLowerCase()) continue;
        let colHeader = sc.header;
        if (allColsMap.has(colHeader.toLowerCase())) {
          colHeader = `${sec.sheetName} - ${sc.header}`;
        }
        allColsMap.set(colHeader.toLowerCase(), colHeader);
      }
    }

    // Merge rows
    const merged: Record<string, unknown>[] = [];
    let rowCounter = 0;
    for (const mr of masterRows) {
      const rawPKey = String(mr[pKey] ?? '').trim();
      const normPKey = RegionNormalizer.normalizeJoinKey(rawPKey, this.stripKabupaten());

      const mergedRow: Record<string, unknown> = {
        __id: `row-${rowCounter++}`,
        ...mr,
      };

      for (const { sheet, map } of secondaryIndexes) {
        const secRow = map.get(normPKey);
        if (secRow) {
          for (const sc of sheet.columns) {
            if (sc.header.toLowerCase() === sheet.keyCol.toLowerCase()) continue;
            let targetName = sc.header;
            if (pCols.some((pc) => pc.header.toLowerCase() === sc.header.toLowerCase())) {
              targetName = `${sheet.sheetName} - ${sc.header}`;
            }
            mergedRow[targetName] = secRow[sc.header];
          }
        }
      }

      merged.push(mergedRow);
    }

    this.joinedRows.set(merged);
    this.joinedColumns.set(Array.from(allColsMap.values()));
    this.applyKeywordAndPatternExclusions(merged);

    // Deteksi baris ringkasan (JAWA TENGAH / PROVINSI / TOTAL) dan baris target (TARGET)
    let detectedSummaryRow: Record<string, unknown> | null = null;
    let detectedTargetRow: Record<string, unknown> | null = null;

    for (const r of merged) {
      const keyStr = String(r[pKey] ?? '').trim().toUpperCase();
      if (keyStr.includes('TARGET')) {
        detectedTargetRow = r;
      } else if (
        keyStr.includes('JAWA TENGAH') ||
        keyStr.includes('PROVINSI') ||
        keyStr.startsWith('PROV')
      ) {
        detectedSummaryRow = r;
      }
    }

    if (!detectedSummaryRow) {
      for (const r of merged) {
        const keyStr = String(r[pKey] ?? '').trim().toUpperCase();
        if (keyStr.includes('TOTAL') || keyStr.includes('JUMLAH')) {
          detectedSummaryRow = r;
          break;
        }
      }
    }

    if (detectedSummaryRow) {
      this.summaryRowId.set(String(detectedSummaryRow['__id']));
      this.summaryRowData.set(detectedSummaryRow);
      const keyStr = String(detectedSummaryRow[pKey] ?? '').trim().toUpperCase();
      if (keyStr.includes('JAWA TENGAH') || keyStr.includes('PROVINSI')) {
        this.calculationDataSource.set('summary_row');
      }
    }

    if (detectedTargetRow) {
      this.targetRowId.set(String(detectedTargetRow['__id']));
      this.targetRowData.set(detectedTargetRow);
    }
  }

  onSummaryRowChange(id: string): void {
    this.summaryRowId.set(id);
    if (!id || id === 'none') {
      this.summaryRowData.set(null);
      this.calculationDataSource.set('all_rows');
    } else {
      const row = this.joinedRows().find((r) => r['__id'] === id);
      this.summaryRowData.set(row ?? null);
      this.calculationDataSource.set('summary_row');
    }
  }

  onTargetRowChange(id: string): void {
    this.targetRowId.set(id);
    if (!id || id === 'none') {
      this.targetRowData.set(null);
    } else {
      const row = this.joinedRows().find((r) => r['__id'] === id);
      this.targetRowData.set(row ?? null);
    }
  }

  onDataSourceModeChange(mode: 'summary_row' | 'all_rows'): void {
    this.calculationDataSource.set(mode);
  }

  autoPopulateIndicatorsFromData(): void {
    const cols = this.joinedColumns();
    const summaryRow = this.summaryRowData();
    const targetRow = this.targetRowData();

    const cat1Subs: StuntingSubCategoryConfig[] = [];
    const cat2Subs: StuntingSubCategoryConfig[] = [];
    const cat3Subs: StuntingSubCategoryConfig[] = [];
    const matchedMeanCols = new Set<string>();
    const matchedSumCols = new Set<string>();

    // 1. First pass: Match standard Dinkes indicators
    for (const std of StuntingEvaluationEngine.DINKES_STANDARD_INDICATORS) {
      let matchedSum: string | undefined;
      let matchedMean: string | undefined;

      // Find best sumCol match
      for (const kw of std.sumKeywords) {
        const found = cols.find((c) => c.toLowerCase().trim() === kw.toLowerCase().trim()) ||
          cols.find((c) => c.toLowerCase().includes(kw.toLowerCase()));
        if (found) {
          matchedSum = found;
          break;
        }
      }

      // Find best meanCol match
      for (const kw of std.meanKeywords) {
        const found = cols.find((c) => c.toLowerCase().trim() === kw.toLowerCase().trim()) ||
          cols.find((c) => c.toLowerCase().includes(kw.toLowerCase()));
        if (found) {
          matchedMean = found;
          break;
        }
      }

      // If either sum or mean column matched in the dataset
      if (matchedSum || matchedMean) {
        const effectiveMean = matchedMean || matchedSum!;
        matchedMeanCols.add(effectiveMean);
        if (matchedSum) matchedSumCols.add(matchedSum);

        let rawTarget = targetRow ? (targetRow[effectiveMean] ?? (matchedSum ? targetRow[matchedSum] : null)) : null;
        const cleanedTarget = StuntingEvaluationEngine.cleanTargetValue(rawTarget);
        const targetVal = cleanedTarget.value !== null ? cleanedTarget.value : std.defaultTargetCurrent;

        const rawDirectVal = summaryRow ? summaryRow[effectiveMean] : null;
        const directVal = IndicatorEvaluator.parseSmartNumber(rawDirectVal);

        const rawCountVal = matchedSum && summaryRow ? summaryRow[matchedSum] : null;
        const countVal = IndicatorEvaluator.parseSmartNumber(rawCountVal);

        const subConfig: StuntingSubCategoryConfig = {
          id: `sub-std-${std.no}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          no: std.no,
          name: std.name,
          sumCol: matchedSum,
          meanCol: matchedMean,
          numeratorCol: effectiveMean,
          dataCol: effectiveMean,
          actualValue: directVal,
          countValue: countVal,
          calculationMode: 'percentage',
          targetCurrentYear: targetVal,
          prevYearMode: 'manual',
          actualPrevYear: std.defaultActualPrev ?? null,
          targetPrevYear: std.defaultTargetPrev ?? null,
          polarity: cleanedTarget.polarity !== 'positive' ? cleanedTarget.polarity : std.polarity,
        };

        if (std.canonicalCategory === 'sebelum_kelahiran') {
          cat1Subs.push(subConfig);
        } else if (std.canonicalCategory === 'setelah_kelahiran') {
          cat2Subs.push(subConfig);
        } else {
          cat3Subs.push(subConfig);
        }
      }
    }

    // 2. Second pass: Any other % or cakupan columns that were not matched by standard definitions
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const lowerCol = col.toLowerCase();

      if (matchedMeanCols.has(col) || matchedSumCols.has(col)) {
        continue;
      }

      if (!col.includes('%') && !lowerCol.includes('persen') && !lowerCol.includes('cakupan')) {
        continue;
      }

      const prevCol = i > 0 && !matchedMeanCols.has(cols[i - 1]) ? cols[i - 1] : undefined;
      const rawDirectVal = summaryRow ? summaryRow[col] : null;
      const directVal = IndicatorEvaluator.parseSmartNumber(rawDirectVal);

      if (rawDirectVal === undefined && directVal === null && !this.validJoinedRows().some((r) => r[col] !== undefined)) {
        continue;
      }

      const rawCountVal = prevCol && summaryRow ? summaryRow[prevCol] : null;
      const countVal = IndicatorEvaluator.parseSmartNumber(rawCountVal);

      let rawTarget = targetRow ? targetRow[col] : null;
      if (rawTarget === undefined || rawTarget === null || rawTarget === '') {
        rawTarget = prevCol && targetRow ? targetRow[prevCol] : null;
      }
      const cleanedTarget = StuntingEvaluationEngine.cleanTargetValue(rawTarget);

      let polarity: IndicatorPolarity = cleanedTarget.polarity;
      if (lowerCol.includes('anemia') || lowerCol.includes('kek') || lowerCol.includes('gibur') || lowerCol.includes('kurang')) {
        polarity = 'negative';
      }

      const subId = `sub-auto-${i}-${Date.now()}`;
      const subConfig: StuntingSubCategoryConfig = {
        id: subId,
        no: String(cat1Subs.length + cat2Subs.length + cat3Subs.length + 1),
        name: col.trim(),
        sumCol: prevCol,
        meanCol: col,
        numeratorCol: col,
        dataCol: col,
        actualValue: directVal,
        countValue: countVal,
        calculationMode: 'percentage',
        targetCurrentYear: cleanedTarget.value !== null ? cleanedTarget.value : null,
        prevYearMode: 'manual',
        actualPrevYear: null,
        targetPrevYear: null,
        polarity,
      };

      const countColLower = prevCol ? prevCol.toLowerCase() : '';
      const isCat1 =
        lowerCol.includes('rematri') ||
        lowerCol.includes('remaja') ||
        lowerCol.includes('bumil') ||
        lowerCol.includes('hamil') ||
        lowerCol.includes('anc') ||
        lowerCol.includes('ttd') ||
        countColLower.includes('rematri') ||
        countColLower.includes('bumil') ||
        countColLower.includes('hamil');

      const isCat2 =
        lowerCol.includes('balita') ||
        lowerCol.includes('baduta') ||
        lowerCol.includes('bayi') ||
        lowerCol.includes('d/s') ||
        lowerCol.includes('tumbang') ||
        lowerCol.includes('asi') ||
        lowerCol.includes('mpasi') ||
        lowerCol.includes('gizi') ||
        lowerCol.includes('bb') ||
        lowerCol.includes('gibur') ||
        lowerCol.includes('idl') ||
        countColLower.includes('balita') ||
        countColLower.includes('baduta');

      if (isCat1) {
        cat1Subs.push(subConfig);
      } else if (isCat2) {
        cat2Subs.push(subConfig);
      } else {
        cat3Subs.push(subConfig);
      }
    }

    // 3. Fallback: If still no subcategories were populated, scaffold standard indicators
    if (cat1Subs.length === 0 && cat2Subs.length === 0 && cat3Subs.length === 0) {
      for (const std of StuntingEvaluationEngine.DINKES_STANDARD_INDICATORS) {
        const subConfig: StuntingSubCategoryConfig = {
          id: `sub-std-${std.no}-${Date.now()}`,
          no: std.no,
          name: std.name,
          numeratorCol: '',
          dataCol: '',
          actualValue: null,
          countValue: null,
          calculationMode: 'percentage',
          targetCurrentYear: std.defaultTargetCurrent,
          prevYearMode: 'manual',
          actualPrevYear: std.defaultActualPrev ?? null,
          targetPrevYear: std.defaultTargetPrev ?? null,
          polarity: std.polarity,
        };
        if (std.canonicalCategory === 'sebelum_kelahiran') {
          cat1Subs.push(subConfig);
        } else if (std.canonicalCategory === 'setelah_kelahiran') {
          cat2Subs.push(subConfig);
        } else {
          cat3Subs.push(subConfig);
        }
      }
    }

    this.categories.set([
      {
        id: 'cat-1',
        name: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
        subCategories: cat1Subs,
      },
      {
        id: 'cat-2',
        name: 'Intervensi untuk balita (setelah kelahiran)',
        subCategories: cat2Subs,
      },
      {
        id: 'cat-3',
        name: 'Intervensi lintas siklus hidup',
        subCategories: cat3Subs,
      },
    ]);

    const totalLoaded = cat1Subs.length + cat2Subs.length + cat3Subs.length;
    this.notificationMessage.set(
      `Berhasil memuat ${totalLoaded} indikator langsung dari baris data dan target. Silakan atur kategori dan isikan capaian serta target tahun sebelumnya.`,
    );
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
        cats.map((c) => (c.id === targetCatId ? { ...c, subCategories: [...c.subCategories, movingSub!] } : c)),
      );
    }
  }

  onSumColChange(catId: string, subId: string, colName: string): void {
    const summaryRow = this.summaryRowData();
    let countVal: number | null = null;
    if (this.calculationDataSource() === 'summary_row' && summaryRow && colName) {
      countVal = IndicatorEvaluator.parseSmartNumber(summaryRow[colName]);
    }
    this.updateSubCategory(catId, subId, {
      sumCol: colName,
      countValue: countVal !== null ? countVal : undefined,
    });
  }

  onMeanColChange(catId: string, subId: string, colName: string): void {
    this.onNumeratorColChange(catId, subId, colName);
    this.updateSubCategory(catId, subId, {
      meanCol: colName,
    });
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
    this.categories.update((cats) =>
      cats.map((c) => (c.id === catId ? { ...c, name: val } : c)),
    );
  }

  addSubCategory(catId: string): void {
    const pKey = this.primaryKeyCol();
    const metricCols = this.joinedColumns().filter((c) => c !== pKey);
    const subId = `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const cat = this.categories().find((c) => c.id === catId);
    const existingCount = cat ? cat.subCategories.length : 0;
    const numCol = metricCols.length > 1 ? metricCols[1] : metricCols[0] || '';
    const prevCol = metricCols.length > 1 ? metricCols[0] : '';
    const summaryRow = this.summaryRowData();
    const targetRow = this.targetRowData();

    let rawTarget = targetRow ? targetRow[numCol] : null;
    const cleanedTarget = StuntingEvaluationEngine.cleanTargetValue(rawTarget);
    const directVal = summaryRow ? IndicatorEvaluator.parseSmartNumber(summaryRow[numCol]) : null;
    const countVal = prevCol && summaryRow ? IndicatorEvaluator.parseSmartNumber(summaryRow[prevCol]) : null;

    const newSub: StuntingSubCategoryConfig = {
      id: subId,
      no: String(existingCount + 1),
      name: numCol || 'Indikator Baru',
      sumCol: prevCol || undefined,
      meanCol: numCol || undefined,
      numeratorCol: numCol,
      dataCol: numCol,
      actualValue: directVal,
      countValue: countVal,
      calculationMode: 'percentage',
      targetCurrentYear: cleanedTarget.value !== null ? cleanedTarget.value : null,
      prevYearMode: 'manual',
      actualPrevYear: null,
      targetPrevYear: null,
      polarity: cleanedTarget.polarity,
    };

    this.categories.update((cats) =>
      cats.map((c) => (c.id === catId ? { ...c, subCategories: [...c.subCategories, newSub] } : c)),
    );
  }

  removeSubCategory(catId: string, subId: string): void {
    this.categories.update((cats) =>
      cats.map((c) =>
        c.id === catId ? { ...c, subCategories: c.subCategories.filter((s) => s.id !== subId) } : c,
      ),
    );
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
      const colIdx = this.joinedColumns().indexOf(colName);
      if (colIdx > 0) {
        const prevCol = this.joinedColumns()[colIdx - 1];
        countVal = IndicatorEvaluator.parseSmartNumber(summaryRow[prevCol]);
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
            return {
              ...s,
              numeratorCol: colName,
              dataCol: colName,
              actualValue: directVal !== null ? directVal : (this.calculationDataSource() === 'summary_row' ? s.actualValue : undefined),
              countValue: countVal !== null ? countVal : s.countValue,
              name: shouldAutoRename ? colName : s.name,
              targetCurrentYear: cleanedTarget.value !== null ? cleanedTarget.value : s.targetCurrentYear,
              polarity: cleanedTarget.polarity !== 'positive' ? cleanedTarget.polarity : s.polarity,
            };
          }),
        };
      }),
    );
  }

  getQuarterNumeratorCol(sub: StuntingSubCategoryConfig, q: number): string {
    const quarter = (q >= 1 && q <= 4 ? q : 1) as 1 | 2 | 3 | 4;
    if (sub.quarterColumns?.[quarter]?.numeratorCol !== undefined) {
      return sub.quarterColumns[quarter]!.numeratorCol || '';
    }
    // Fallback for single/legacy config
    if ((!sub.quarterColumns || Object.keys(sub.quarterColumns).length === 0) && quarter === this.activeQuarter()) {
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

  getSubCategoryQuarterLiveStats(sub: StuntingSubCategoryConfig, q: number): {
    sumNum: number | null;
    sumDen: number | null;
    actualPercentage: number | null;
  } {
    const quarter = (q >= 1 && q <= 4 ? q : 1) as 1 | 2 | 3 | 4;
    const sumCol = sub.quarterColumns?.[quarter]?.sumCol || sub.sumCol;
    let meanCol = sub.quarterColumns?.[quarter]?.meanCol || sub.meanCol;
    let numCol = this.getQuarterNumeratorCol(sub, quarter);
    if (!meanCol && !numCol && quarter === this.activeQuarter()) {
      meanCol = sub.meanCol || sub.numeratorCol;
      numCol = sub.numeratorCol;
    } else if (!meanCol) {
      meanCol = numCol;
    }

    if (!sumCol && !meanCol && !numCol && sub.actualValue === null && sub.countValue === null) {
      return { sumNum: null, sumDen: null, actualPercentage: null };
    }

    const rows = this.validJoinedRows();
    const denCol = sub.quarterColumns?.[quarter]?.denominatorCol || sub.denominatorCol;

    let sumNum: number | null = null;
    let sumDen: number | null = null;
    let actualPercentage: number | null = null;

    if (sub.actualValue !== undefined && sub.actualValue !== null && quarter === this.activeQuarter()) {
      actualPercentage = sub.actualValue;
      sumNum = sub.countValue ?? null;
    } else {
      // 1. Calculate sumNum
      const targetSumCol = denCol ? (numCol || sumCol) : (sumCol || (sub.calculationMode === 'absolute' ? (meanCol || numCol) : undefined));
      if (targetSumCol && rows.length > 0) {
        if (rows.length === 1) {
          sumNum = IndicatorEvaluator.parseSmartNumber(rows[0][targetSumCol]);
        } else {
          sumNum = StuntingEvaluationEngine.sumColumnValues(rows, targetSumCol);
        }
      }
      if (sumNum === null && sub.countValue !== undefined && sub.countValue !== null) {
        sumNum = sub.countValue;
      }

      // 2. Calculate actualPercentage
      if (denCol && rows.length > 0) {
        sumDen = StuntingEvaluationEngine.sumColumnValues(rows, denCol);
        if (sumDen && sumDen > 0 && sumNum !== null) {
          actualPercentage = Math.round((sumNum / sumDen) * 10000) / 100;
        }
      }

      if (actualPercentage === null) {
        const targetMeanCol = meanCol || (!denCol ? numCol : undefined);
        if (rows.length === 1 && targetMeanCol) {
          const directVal = IndicatorEvaluator.parseSmartNumber(rows[0][targetMeanCol]);
          actualPercentage = directVal;
          if (sumNum === null) {
            sumNum = sub.countValue ?? (typeof directVal === 'number' && directVal > 100 ? directVal : null);
          }
        } else if (rows.length > 0) {
          if (targetMeanCol && sub.calculationMode !== 'absolute') {
            actualPercentage = StuntingEvaluationEngine.averageColumnValues(rows, targetMeanCol);
          } else if (targetSumCol && sub.calculationMode === 'absolute') {
            actualPercentage = sumNum;
          }
        }
      }
    }

    return { sumNum, sumDen, actualPercentage };
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
    const isSuccess = isNegative ? stats.actualPercentage <= target : stats.actualPercentage >= target;
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

  // ============================================================
  // STEP 3: DASHBOARD EVALUATION & MONITORING
  // ============================================================

  evaluationResult = computed<StuntingEvaluationResult | null>(() => {
    const cats = this.categories();
    const rows = this.validJoinedRows();

    // Check if any subcategory exists
    const hasSubCategories = cats.some((c) => c.subCategories.length > 0);
    if (!hasSubCategories || rows.length === 0) {
      return null;
    }

    return StuntingEvaluationEngine.evaluateAggregatedDataset(cats, rows, {
      activeQuarter: this.manualActiveQuarter() ?? undefined,
      toleranceThresholdPercent: this.toleranceThreshold(),
      quarterWeight: this.quarterWeight() ?? undefined,
    });
  });

  availableQuarters = computed<(1 | 2 | 3 | 4)[]>(() => {
    const res = this.evaluationResult();
    if (!res || !res.availableQuarters || res.availableQuarters.length === 0) {
      return [1];
    }
    return res.availableQuarters;
  });

  activeQuarter = computed<1 | 2 | 3 | 4>(() => {
    const manual = this.manualActiveQuarter();
    if (manual) return manual;
    const res = this.evaluationResult();
    return res?.activeQuarter ?? 1;
  });

  filteredGroupedRows = computed(() => {
    const res = this.evaluationResult();
    if (!res) return [];

    const query = this.searchQuery().trim().toLowerCase();
    const filter = this.activeFilter();

    return res.groupedRows
      .map((group) => {
        const filtered = group.rows.filter((r) => {
          const matchQuery = !query || r.name.toLowerCase().includes(query) || r.category.toLowerCase().includes(query);
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
    if (step === 2 && this.validJoinedRows().length === 0) {
      this.notificationMessage.set('Harap unggah berkas dan pastikan minimal ada 1 baris data aktif.');
      return;
    }
    if (step === 3 && (!this.categories().some((c) => c.subCategories.length > 0) || this.validJoinedRows().length === 0)) {
      this.notificationMessage.set('Harap buat minimal 1 sub-kategori indikator pada Langkah 2.');
      return;
    }
    this.activeStep.set(step);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ============================================================
  // EXPORT EXCEL & CHART VISUALIZER BRIDGE
  // ============================================================

  exportJoinedData(): void {
    const rows = this.validJoinedRows();
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

    const quartersToExport = this.viewMode() === 'single_quarter'
      ? [this.activeQuarter()]
      : this.availableQuarters();

    const fileName = StuntingExcelExporter.exportMonitoringReport({
      evaluationResult: res,
      availableQuarters: quartersToExport,
      validJoinedRows: this.validJoinedRows(),
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
      excludedRowKeywords: this.excludedRowKeywords().split(',').map((k) => k.trim()),
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
          message: 'Format file JSON tidak valid. Pastikan file berasal dari ekspor konfigurasi stunting.',
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
        const cols = ExcelEngine.extractSheetColumns(ws, this.primaryHeaderStartRow(), this.primaryHeaderEndRow());
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
    this.file.set(null);
    this.workbook = null;
    this.availableSheets.set([]);
    this.primarySheet.set('');
    this.primaryColumns.set([]);
    this.secondarySheets.set([]);
    this.joinedRows.set([]);
    this.joinedColumns.set([]);
    this.excludedRowIds.set(new Set());
    this.manualExcludedKeys.set(new Set());
    this.manualActiveQuarter.set(null);
    this.showSettings.set(false);
    this.summaryRowId.set('');
    this.targetRowId.set('');
    this.summaryRowData.set(null);
    this.targetRowData.set(null);
    this.calculationDataSource.set('all_rows');
    this.healthDataExchange.clearStuntingData();
    this.notificationMessage.set(null);
    this.activeStep.set(1);
  }
}
