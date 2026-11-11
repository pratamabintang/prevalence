import { computed, signal } from '@angular/core';
import {
  CapaianSummary,
  ColumnConfig,
  ColumnTargetConfig,
  IndicatorEvaluator,
  TargetOperator,
} from '../../core/evaluation/indicator-evaluator';
import { ColumnHeaderMeta, ExcelEngine, HeaderGridCell } from '../../shared/excel';
import { JoinExportSpec } from '../../core/excel/excel-join-engine';

export type DatasetTableKey = 'intervensi-spesifik' | 'masalah-gizi';

export interface DatasetTablePayload {
  rows: Record<string, unknown>[];
  columns: string[];
  columnsMeta?: ColumnHeaderMeta[];
  targets?: Record<string, ColumnTargetConfig>;
  configs?: Record<string, ColumnConfig>;
  sums?: Record<string, boolean>;
  averages?: Record<string, boolean>;
  customNames?: Record<string, string>;
  enableJumlah?: boolean;
  enableAverage?: boolean;
  enableTarget?: boolean;
  enableCapaian?: boolean;
}

function buildMeta(columns: string[], meta?: ColumnHeaderMeta[]): ColumnHeaderMeta[] {
  if (meta && meta.length > 0) {
    return meta;
  }
  return columns.map((key) => ({ key, layers: [key] }));
}

function buildConfigs(columns: string[], configs?: Record<string, ColumnConfig>): Record<string, ColumnConfig> {
  const next: Record<string, ColumnConfig> = {};
  columns.forEach((col, idx) => {
    next[col] = configs?.[col] ?? {
      dataType: idx === 0 ? 'string' : 'auto',
      anomalyEnabled: false,
      minAnomaly: 0,
      maxAnomaly: 100,
    };
  });
  return next;
}

function buildTargets(
  columns: string[],
  targets?: Record<string, ColumnTargetConfig>,
): Record<string, ColumnTargetConfig> {
  const next: Record<string, ColumnTargetConfig> = {};
  for (const col of columns) {
    next[col] = targets?.[col] ?? { enabled: false, operator: '>=', value: null };
  }
  return next;
}

export class DatasetTableModel {
  readonly key: DatasetTableKey;

  readonly resultRows = signal<Record<string, unknown>[]>([]);
  readonly originalResultRows = signal<Record<string, unknown>[]>([]);
  readonly resultColumns = signal<string[]>([]);
  readonly resultColumnsMeta = signal<ColumnHeaderMeta[]>([]);
  readonly defaultResultColumns = signal<string[]>([]);
  readonly defaultResultColumnsMeta = signal<ColumnHeaderMeta[]>([]);
  readonly customColumnNames = signal<Record<string, string>>({});
  readonly columnTargets = signal<Record<string, ColumnTargetConfig>>({});
  readonly columnConfigs = signal<Record<string, ColumnConfig>>({});
  readonly sumColumns = signal<Record<string, boolean>>({});
  readonly avgColumns = signal<Record<string, boolean>>({});
  readonly enableJumlah = signal(false);
  readonly enableAverage = signal(false);
  readonly enableTarget = signal(false);
  readonly enableCapaian = signal(true);
  readonly presetName = signal('');

  readonly editingColumnKey = signal<string | null>(null);
  readonly editingColumnValue = signal('');
  readonly editingTargetColKey = signal<string | null>(null);
  readonly editingTargetOperator = signal<TargetOperator>('>=');
  readonly editingTargetValue = signal('');
  readonly selectedColumnForMove = signal<string | null>(null);

  readonly hasData = computed(() => this.resultColumns().length > 0);
  readonly rowCount = computed(() => this.resultRows().length);
  readonly columnCount = computed(() => this.resultColumns().length);
  readonly removedRowCount = computed(
    () => this.originalResultRows().length - this.resultRows().length,
  );

  readonly capaianStats = computed<CapaianSummary>(() =>
    IndicatorEvaluator.calculateCapaianStats(
      this.resultRows(),
      this.resultColumns(),
      this.columnTargets(),
      this.columnConfigs(),
      this.enableTarget(),
      this.enableCapaian(),
    ),
  );

  readonly activeTargetCount = computed(() => {
    if (!this.enableTarget()) return 0;
    const targets = this.columnTargets();
    const configs = this.columnConfigs();
    return Object.entries(targets).filter(
      ([col, t]) => configs[col]?.dataType !== 'string' && t.enabled && t.value !== null,
    ).length;
  });

  readonly htmlHeaderGrid = computed<HeaderGridCell[][]>(() => {
    const meta = this.resultColumnsMeta();
    if (meta.length === 0) return [];

    const customNames = this.customColumnNames();
    const processedMeta: ColumnHeaderMeta[] = meta.map((m) => {
      const custom = customNames[m.key]?.trim();
      if (!custom) return m;
      if (custom.includes(' - ')) {
        return { ...m, layers: custom.split(' - ').map((s) => s.trim()) };
      }
      const nextLayers = [...m.layers];
      nextLayers[nextLayers.length - 1] = custom;
      return { ...m, layers: nextLayers };
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

  readonly selectedColumnIndex = computed(() => {
    const col = this.selectedColumnForMove();
    return col ? this.resultColumns().indexOf(col) : -1;
  });

  readonly canMoveSelectedColumnLeft = computed(() =>
    this.canMoveColumnLeft(this.selectedColumnIndex()),
  );
  readonly canMoveSelectedColumnRight = computed(() =>
    this.canMoveColumnRight(this.selectedColumnIndex()),
  );

  constructor(key: DatasetTableKey) {
    this.key = key;
  }

  load(payload: DatasetTablePayload): void {
    const columns = [...payload.columns];
    const meta = buildMeta(columns, payload.columnsMeta);
    this.resultRows.set(payload.rows);
    this.originalResultRows.set(payload.rows.map((r) => ({ ...r })));
    this.resultColumns.set(columns);
    this.resultColumnsMeta.set(meta);
    this.defaultResultColumns.set([...columns]);
    this.defaultResultColumnsMeta.set([...meta]);
    this.customColumnNames.set({ ...(payload.customNames ?? {}) });
    this.columnConfigs.set(buildConfigs(columns, payload.configs));
    this.columnTargets.set(buildTargets(columns, payload.targets));
    this.sumColumns.set({ ...(payload.sums ?? {}) });
    this.avgColumns.set({ ...(payload.averages ?? {}) });
    // Fitur kalkulasi aktif secara default; payload hanya perlu menonaktifkannya
    // bila tabel memang tidak memakai baris Jumlah/Rata-rata/Target/Capaian.
    this.enableJumlah.set(payload.enableJumlah ?? true);
    this.enableAverage.set(payload.enableAverage ?? true);
    this.enableTarget.set(payload.enableTarget ?? true);
    this.enableCapaian.set(payload.enableCapaian ?? true);
    this.selectedColumnForMove.set(null);
    this.editingColumnKey.set(null);
    this.editingTargetColKey.set(null);
  }

  clear(): void {
    this.resultRows.set([]);
    this.originalResultRows.set([]);
    this.resultColumns.set([]);
    this.resultColumnsMeta.set([]);
    this.defaultResultColumns.set([]);
    this.defaultResultColumnsMeta.set([]);
    this.customColumnNames.set({});
    this.columnTargets.set({});
    this.columnConfigs.set({});
    this.sumColumns.set({});
    this.avgColumns.set({});
    this.enableJumlah.set(false);
    this.enableAverage.set(false);
    this.enableTarget.set(false);
    this.enableCapaian.set(true);
    this.selectedColumnForMove.set(null);
    this.editingColumnKey.set(null);
    this.editingTargetColKey.set(null);
  }

  toExportSpec(sheetName: string): JoinExportSpec {
    return {
      sheetName,
      resultRows: this.resultRows(),
      resultColumns: this.resultColumns(),
      resultColumnsMeta: this.resultColumnsMeta(),
      customColumnNames: this.customColumnNames(),
      outputHeaderFormat: 'full',
      columnConfigs: this.columnConfigs(),
      enableJumlah: this.enableJumlah(),
      sumColumns: this.sumColumns(),
      enableAverage: this.enableAverage(),
      avgColumns: this.avgColumns(),
      enableTarget: this.enableTarget(),
      columnTargets: this.columnTargets(),
      enableCapaian: this.enableCapaian(),
    };
  }

  getColumnDisplayName(colKey: string): string {
    return this.customColumnNames()[colKey]?.trim() || colKey;
  }

  setColumnCustomName(colKey: string, newName: string): void {
    const original = this.resultColumns().includes(colKey) ? colKey : '';
    const trimmed = newName.trim();
    this.customColumnNames.update((names) => {
      const next = { ...names };
      if (!trimmed || trimmed === original) {
        delete next[colKey];
      } else {
        next[colKey] = trimmed;
      }
      return next;
    });
  }

  // ============================================================
  // RENAME KOLOM INLINE
  // ============================================================

  startEditingColumn(colKey: string | null | undefined, event?: Event): void {
    event?.stopPropagation();
    if (!colKey || colKey.startsWith('__')) return;
    this.editingColumnKey.set(colKey);
    this.editingColumnValue.set(this.getColumnDisplayName(colKey));
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(
        `.dataset-table-${this.key} .inline-column-rename-input`,
      );
      input?.focus();
      input?.select();
    }, 50);
  }

  saveInlineColumnRename(colKey: string | null | undefined, newName: string): void {
    if (!colKey || this.editingColumnKey() !== colKey) return;
    this.editingColumnKey.set(null);
    this.setColumnCustomName(colKey, newName);
  }

  cancelInlineColumnRename(): void {
    this.editingColumnKey.set(null);
  }

  // ============================================================
  // GESER KOLOM
  // ============================================================

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
    if (this.canMoveColumnLeft(index)) this.moveColumn(index, index - 1);
  }

  moveColumnRight(index: number): void {
    if (this.canMoveColumnRight(index)) this.moveColumn(index, index + 1);
  }

  canMoveColumnLeft(index: number): boolean {
    return index > 1;
  }

  canMoveColumnRight(index: number): boolean {
    return index >= 1 && index < this.resultColumns().length - 1;
  }

  selectColumnForMove(colKey: string | null | undefined): void {
    if (!colKey || colKey.startsWith('__') || colKey === this.resultColumns()[0]) {
      this.selectedColumnForMove.set(null);
      return;
    }
    this.selectedColumnForMove.set(
      this.selectedColumnForMove() === colKey ? null : colKey,
    );
  }

  clearSelectedColumnForMove(): void {
    this.selectedColumnForMove.set(null);
  }

  moveSelectedColumnLeft(): void {
    const idx = this.selectedColumnIndex();
    if (this.canMoveColumnLeft(idx)) this.moveColumnLeft(idx);
  }

  moveSelectedColumnRight(): void {
    const idx = this.selectedColumnIndex();
    if (this.canMoveColumnRight(idx)) this.moveColumnRight(idx);
  }

  resetColumnOrder(): void {
    const def = this.defaultResultColumns();
    if (def.length === 0) return;
    const metaMap = new Map(this.resultColumnsMeta().map((m) => [m.key, m]));
    const nextMeta: ColumnHeaderMeta[] = [];
    for (const col of def) {
      const m = metaMap.get(col);
      if (m) nextMeta.push(m);
    }
    this.resultColumns.set([...def]);
    this.resultColumnsMeta.set(nextMeta);
  }

  // ============================================================
  // BARIS
  // ============================================================

  deleteRow(index: number): void {
    this.resultRows.update((rows) => rows.filter((_, i) => i !== index));
  }

  restoreRows(): void {
    this.resultRows.set(this.originalResultRows());
  }

  // ============================================================
  // TARGET & CAPAIAN
  // ============================================================

  toggleColumnTarget(col: string): void {
    this.columnTargets.update((targets) => {
      const prev = targets[col] || { enabled: false, operator: '>=', value: null };
      const nextEnabled = !prev.enabled;
      let nextValue = prev.value;
      if (nextEnabled && (nextValue === null || isNaN(nextValue))) {
        const cfg = this.columnConfigs()[col];
        nextValue = cfg?.dataType === 'percentage' || col.includes('%') ? 80 : 0;
      }
      return { ...targets, [col]: { ...prev, enabled: nextEnabled, value: nextValue } };
    });
  }

  onTargetOperatorChange(col: string, event: Event): void {
    const operator = (event.target as HTMLSelectElement).value as TargetOperator;
    this.columnTargets.update((targets) => ({
      ...targets,
      [col]: {
        ...(targets[col] || { enabled: false, operator: '>=', value: null }),
        operator,
      },
    }));
  }

  onTargetValueChange(col: string, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const value = raw === '' ? null : Number(raw);
    this.columnTargets.update((targets) => ({
      ...targets,
      [col]: {
        ...(targets[col] || { enabled: false, operator: '>=', value: null }),
        enabled: value !== null && !isNaN(value),
        value: value !== null && !isNaN(value) ? value : null,
      },
    }));
  }

  startEditingTarget(colKey: string | null | undefined, event?: Event): void {
    event?.stopPropagation();
    if (!colKey || colKey === this.resultColumns()[0]) return;
    const cfg = this.columnConfigs()[colKey];
    if (cfg?.dataType === 'string') return;
    const currentTarget = this.columnTargets()[colKey];
    this.editingTargetColKey.set(colKey);
    this.editingTargetOperator.set(currentTarget?.operator || '>=');
    this.editingTargetValue.set(
      currentTarget?.enabled && currentTarget.value !== null && currentTarget.value !== undefined
        ? String(currentTarget.value)
        : cfg?.dataType === 'percentage' || colKey.includes('%')
          ? '80'
          : '0',
    );
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(
        `.dataset-table-${this.key} .inline-target-value-input`,
      );
      input?.focus();
      input?.select();
    }, 50);
  }

  saveInlineTargetEdit(colKey: string | null | undefined): void {
    if (!colKey || this.editingTargetColKey() !== colKey) return;
    const op = this.editingTargetOperator();
    const rawVal = this.editingTargetValue().trim();
    let numVal = rawVal === '' ? null : parseFloat(rawVal);
    if (numVal !== null && !isNaN(numVal)) numVal = Math.max(0, numVal);
    this.editingTargetColKey.set(null);
    this.columnTargets.update((targets) => ({
      ...targets,
      [colKey]: {
        operator: op,
        value: numVal,
        enabled: numVal !== null && !isNaN(numVal),
      },
    }));
  }

  cancelInlineTargetEdit(): void {
    this.editingTargetColKey.set(null);
  }

  getCapaianFormatClass(capaianValue: number): string {
    return IndicatorEvaluator.getCapaianFormatClass(capaianValue, this.capaianStats());
  }

  getRowCapaian(row: Record<string, unknown>): number {
    if (!this.enableTarget()) return 0;
    return IndicatorEvaluator.calculateRowCapaian(
      row,
      this.resultColumns(),
      this.columnTargets(),
      this.columnConfigs(),
    );
  }

  // ============================================================
  // JUMLAH & RATA-RATA
  // ============================================================

  toggleColumnSum(col: string): void {
    this.sumColumns.update((cols) => ({ ...cols, [col]: !cols[col] }));
  }

  getColumnSum(col: string): number | null {
    if (!this.sumColumns()[col]) return null;
    return IndicatorEvaluator.calculateColumnSum(this.resultRows(), col);
  }

  formatSumValue(sum: number | null): string {
    return IndicatorEvaluator.formatSumValue(sum);
  }

  toggleColumnAvg(col: string): void {
    this.avgColumns.update((cols) => ({ ...cols, [col]: !cols[col] }));
  }

  getColumnAverage(col: string): number | null {
    if (!this.avgColumns()[col]) return null;
    return IndicatorEvaluator.calculateColumnAverage(this.resultRows(), col);
  }

  formatAverageValue(avg: number | null): string {
    return IndicatorEvaluator.formatAverageValue(avg);
  }

  // ============================================================
  // FORMAT SEL
  // ============================================================

  formatCellValue(val: unknown, column: string): string {
    return IndicatorEvaluator.formatCellValue(val, this.columnConfigs()[column]);
  }

  getCellFormatClass(val: unknown, colKey: string): string {
    return IndicatorEvaluator.getCellFormatClass(
      val,
      this.columnConfigs()[colKey],
      this.columnTargets()[colKey],
      this.enableTarget(),
    );
  }
}
