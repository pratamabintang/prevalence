import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChartDataBridge } from '../../core/chart/chart-data-bridge';
import { RegionNormalizer } from '../../core/domain/region-normalizer';
import { IndicatorEvaluator } from '../../core/evaluation/indicator-evaluator';
import {
  EvaluatedStuntingRow,
  IndicatorPolarity,
  StuntingCategoryConfig,
  StuntingEvaluationEngine,
  StuntingEvaluationResult,
  StuntingLifecycleCategory,
  StuntingSubCategoryConfig,
} from '../../core/stunting/stunting-evaluation-engine';
import { ColumnHeaderMeta, ColumnInfo, ExcelEngine } from '../../shared/excel';
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
export class StuntingMonitoringComponent {
  private router = inject(Router);
  private chartDataBridge = inject(ChartDataBridge);

  // Stepper State: 1 = Unggah & Join, 2 = Kategori & Indikator, 3 = Dashboard Monitoring
  activeStep = signal<1 | 2 | 3>(1);

  // ============================================================
  // STEP 1: FILE UPLOAD & MULTI-SHEET JOIN
  // ============================================================
  file = signal<File | null>(null);
  workbook: any = null;
  isProcessing = signal(false);
  isJoining = signal(false);
  showFormatGuide = signal<boolean>(true);
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

  // Valid rows for evaluation (excluding unchecked, blank, summary rows)
  validJoinedRows = computed(() => {
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
    this.isProcessing.set(true);

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
      this.isProcessing.set(false);
      input.value = '';
    }
  }

  toggleFormatGuide(): void {
    this.showFormatGuide.update((v) => !v);
  }

  toggleSettings(): void {
    this.showSettings.update((v) => !v);
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

    this.refreshAvailableSheets();
    this.performJoin();
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

  deleteRow(rowId: string): void {
    const row = this.joinedRows().find((r) => r['__id'] === rowId);
    const rawKey = row ? String(row[this.primaryKeyCol()] ?? '').trim().toLowerCase() : '';

    this.joinedRows.update((rows) => rows.filter((r) => r['__id'] !== rowId));
    this.excludedRowIds.update((set) => {
      const next = new Set(set);
      next.delete(rowId);
      return next;
    });
    if (rawKey) {
      this.manualExcludedKeys.update((mSet) => {
        const mNext = new Set(mSet);
        mNext.delete(rawKey);
        return mNext;
      });
    }
  }

  deleteExcludedRows(): void {
    const exSet = this.excludedRowIds();
    this.joinedRows.update((rows) => rows.filter((r) => !exSet.has(String(r['__id']))));
    this.excludedRowIds.set(new Set());
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

    this.isJoining.set(true);

    try {
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
    } finally {
      this.isJoining.set(false);
    }
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
        name: 'Intervensi lainnya',
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
    const cols = this.joinedColumns();
    const subId = `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const numCol = cols.length > 1 ? cols[1] : cols[0] || '';
    const denCol = cols[0] || '';

    const newSub: StuntingSubCategoryConfig = {
      id: subId,
      name: numCol || 'Indikator Baru',
      numeratorCol: numCol,
      denominatorCol: denCol,
      calculationMode: 'percentage',
      targetCurrentYear: 80,
      prevYearMode: 'manual',
      actualPrevYear: 75,
      targetPrevYear: 75,
      polarity: 'positive',
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
    this.categories.update((cats) =>
      cats.map((c) => {
        if (c.id !== catId) return c;
        return {
          ...c,
          subCategories: c.subCategories.map((s) => {
            if (s.id !== subId) return s;
            // Kolom 2 menjadi nama sub-kategori
            const shouldAutoRename = !s.name || s.name === s.numeratorCol;
            return {
              ...s,
              numeratorCol: colName,
              name: shouldAutoRename ? colName : s.name,
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

  isQuarterConfigured(sub: StuntingSubCategoryConfig, q: number): boolean {
    return !!this.getQuarterNumeratorCol(sub, q);
  }

  onQuarterNumeratorColChange(catId: string, subId: string, q: number, colName: string): void {
    const quarter = (q >= 1 && q <= 4 ? q : 1) as 1 | 2 | 3 | 4;
    this.categories.update((cats) =>
      cats.map((c) => {
        if (c.id !== catId) return c;
        return {
          ...c,
          subCategories: c.subCategories.map((s) => {
            if (s.id !== subId) return s;
            const nextQuarterColumns = {
              ...(s.quarterColumns || {}),
              [quarter]: {
                ...(s.quarterColumns?.[quarter] || {}),
                numeratorCol: colName,
              },
            };
            const shouldAutoRename = !s.name || s.name === s.numeratorCol;
            const nextNumeratorCol = colName || s.numeratorCol;
            return {
              ...s,
              quarterColumns: nextQuarterColumns,
              numeratorCol: nextNumeratorCol,
              name: shouldAutoRename && colName ? colName : s.name,
            };
          }),
        };
      }),
    );
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
    const numCol = this.getQuarterNumeratorCol(sub, quarter);
    if (!numCol) return { sumNum: null, sumDen: null, actualPercentage: null };

    const denCol = sub.quarterColumns?.[quarter]?.denominatorCol || sub.denominatorCol;
    const rows = this.validJoinedRows();
    const sumNum = StuntingEvaluationEngine.sumColumnValues(rows, numCol);
    const sumDen = denCol ? StuntingEvaluationEngine.sumColumnValues(rows, denCol) : null;

    let actualPercentage: number | null = null;
    if (sumNum !== null) {
      if (sub.calculationMode === 'absolute' || sumDen === null || sumDen === 0) {
        actualPercentage = sumNum;
      } else {
        actualPercentage = Math.round((sumNum / sumDen) * 10000) / 100;
      }
    }
    return { sumNum, sumDen, actualPercentage };
  }

  getSubCategoryLiveStats(sub: StuntingSubCategoryConfig): {
    sumNum: number | null;
    sumDen: number | null;
    actualPercentage: number | null;
  } {
    // If active quarter is configured, use its stats; otherwise fallback to primary numeratorCol
    const qStats = this.getSubCategoryQuarterLiveStats(sub, this.activeQuarter());
    if (qStats.sumNum !== null) {
      return qStats;
    }

    const rows = this.validJoinedRows();
    const sumNum = StuntingEvaluationEngine.sumColumnValues(rows, sub.numeratorCol);
    const sumDen = sub.denominatorCol
      ? StuntingEvaluationEngine.sumColumnValues(rows, sub.denominatorCol)
      : null;

    let actualPercentage: number | null = null;
    if (sumNum !== null) {
      if (sub.calculationMode === 'absolute' || sumDen === null || sumDen === 0) {
        actualPercentage = sumNum;
      } else {
        actualPercentage = Math.round((sumNum / sumDen) * 10000) / 100;
      }
    }

    return { sumNum, sumDen, actualPercentage };
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

    const pKey = this.primaryKeyCol();
    const columns: ColumnHeaderMeta[] = [];
    if (pKey) {
      columns.push({ key: pKey, layers: ['Wilayah', pKey] });
    }
    for (const c of this.joinedColumns()) {
      if (c !== pKey) {
        columns.push({ key: c, layers: ['Variabel / Indikator', c] });
      }
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Data_Gabungan_Stunting_${dateStr}.xlsx`;

    ExcelEngine.exportStyledTable({
      sheetName: 'Data Gabungan',
      columns,
      dataRows: rows,
      fileName,
    });

    this.notificationMessage.set(`Data gabungan ${fileName} berhasil diunduh.`);
  }

  exportExcel(): void {
    const res = this.evaluationResult();
    if (!res || res.rows.length === 0) {
      this.notificationMessage.set('Tidak ada data monitoring untuk diekspor.');
      return;
    }

    const availQuarters = this.availableQuarters();
    const columnsRekap: ColumnHeaderMeta[] = [
      { key: 'Kategori', layers: ['Kategori', 'Kategori'] },
      { key: 'No', layers: ['No', 'No'] },
      { key: 'Intervensi', layers: ['Intervensi / Indikator', 'Intervensi / Indikator'] },
      { key: 'TargetCurr', layers: ['Target Tahun Berjalan', 'Target Tahun Berjalan'] },
    ];

    for (const q of availQuarters) {
      columnsRekap.push({ key: `JumlahTW${q}`, layers: [`Triwulan ${q}`, 'Jumlah'] });
      columnsRekap.push({ key: `CapaianTW${q}`, layers: [`Triwulan ${q}`, 'Capaian (%)'] });
    }

    columnsRekap.push({ key: 'Status', layers: ['Status', 'Status'] });

    const exportRows = res.rows.map((r) => {
      const rowObj: Record<string, any> = {
        Kategori: r.category,
        No: r.no,
        Intervensi: r.name,
        TargetCurr: r.targetCurrentYear !== null ? `${r.targetCurrentYear}%` : '-',
      };

      for (const q of availQuarters) {
        const qData = r.quarters[q];
        rowObj[`JumlahTW${q}`] =
          qData?.sumNumerator !== null && qData?.sumNumerator !== undefined
            ? qData.sumNumerator
            : '-';
        rowObj[`CapaianTW${q}`] =
          qData?.actualAchievement !== null && qData?.actualAchievement !== undefined
            ? `${qData.actualAchievement}${r.calculationMode === 'absolute' ? '' : '%'}`
            : '-';
      }

      rowObj['Status'] =
        r.status === 'on_track'
          ? 'On Track'
          : r.status === 'perlu_perhatian'
          ? 'Perlu Perhatian'
          : r.status === 'perlu_percepatan'
          ? 'Perlu Percepatan'
          : 'Belum Dapat Dinilai';

      return rowObj;
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const qStr = availQuarters.map((q) => `TW${q}`).join('_');
    const fileName = `Monitoring_Stunting_${qStr}_${dateStr}.xlsx`;

    const wsRekap = ExcelEngine.buildStyledWorksheet({
      sheetName: `Rekap Kinerja ${qStr}`,
      columns: columnsRekap,
      dataRows: exportRows,
      cellStyler: (row, colKey, val) => {
        if (colKey === 'Status') {
          const s = String(val);
          if (s === 'On Track') return { fill: { fgColor: { rgb: 'D1FAE5' } }, font: { color: { rgb: '065F46' }, bold: true } };
          if (s === 'Perlu Perhatian') return { fill: { fgColor: { rgb: 'FEF3C7' } }, font: { color: { rgb: '92400E' }, bold: true } };
          if (s === 'Perlu Percepatan') return { fill: { fgColor: { rgb: 'FFE4E6' } }, font: { color: { rgb: '9F1239' }, bold: true } };
          return { fill: { fgColor: { rgb: 'F1F5F9' } }, font: { color: { rgb: '475569' } } };
        }
        return undefined;
      },
    });

    const validRows = this.validJoinedRows();
    if (validRows.length > 0) {
      const pKey = this.primaryKeyCol();
      const columnsWilayah: ColumnHeaderMeta[] = [];
      if (pKey) {
        columnsWilayah.push({ key: pKey, layers: ['Wilayah', pKey] });
      }
      for (const col of this.joinedColumns()) {
        if (col !== pKey) {
          columnsWilayah.push({ key: col, layers: ['Indikator / Variabel', col] });
        }
      }

      const wsWilayah = ExcelEngine.buildStyledWorksheet({
        sheetName: 'Data Riil Wilayah',
        columns: columnsWilayah,
        dataRows: validRows,
      });

      ExcelEngine.exportMultiSheetTable(fileName, [
        { sheetName: 'Rekap Kinerja', worksheet: wsRekap },
        { sheetName: 'Data Riil Wilayah', worksheet: wsWilayah },
      ]);
    } else {
      ExcelEngine.exportMultiSheetTable(fileName, [
        { sheetName: 'Rekap Kinerja', worksheet: wsRekap },
      ]);
    }

    this.notificationMessage.set(`Laporan ${fileName} berhasil diunduh.`);
  }

  visualizeInChart(): void {
    const res = this.evaluationResult();
    if (!res || res.rows.length === 0) return;

    const chartRows = res.rows.map((r) => {
      const rowObj: Record<string, any> = {
        Indikator: r.name,
        Target: r.targetCurrentYear ?? 0,
        [`Capaian TW ${this.activeQuarter()}`]: r.activeActual ?? 0,
        [`Expected TW ${this.activeQuarter()}`]: r.activeExpected ?? 0,
      };
      return rowObj;
    });

    this.chartDataBridge.setData({
      title: `Grafik Pemantauan Stunting TW ${this.activeQuarter()}`,
      source: 'join',
      categoryColumn: 'Indikator',
      columns: ['Indikator', 'Target', `Capaian TW ${this.activeQuarter()}`, `Expected TW ${this.activeQuarter()}`],
      rows: chartRows,
      targetValue: null,
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
    this.notificationMessage.set(null);
    this.activeStep.set(1);
  }
}
