import { Injectable, signal, InjectionToken, Optional, Inject } from '@angular/core';

export interface TransferredChartData {
  title?: string;
  source: 'join' | 'upload';
  categoryColumn: string;
  columns: string[];
  rows: Record<string, unknown>[];
  targetValue?: number | null;
  targetOperator?: string;
  indicatorTargets?: Record<string, number | null>;
  indicatorTargetOperators?: Record<string, string>;
  defaultViewMode?: 'overview' | 'by-region' | 'by-indicator';
  percentageColumns?: string[];
  nonNumericColumns?: string[];
}

export interface TransferredStuntingData {
  title?: string;
  source: 'join';
  keyColumn: string;
  columns: string[];
  rows: Record<string, unknown>[];
  summaryRow?: Record<string, unknown>;
  targetRow?: Record<string, unknown>;
  averageRow?: Record<string, unknown>;
}

export interface ExchangeColumnTarget {
  enabled?: boolean;
  operator?: string;
  value?: number | null;
}

export interface PublishJoinedChartSpec {
  title?: string;
  rows: Record<string, unknown>[];
  columns: string[];
  categoryColumn?: string;
  customColumnNames?: Record<string, string>;
  columnTargets?: Record<string, ExchangeColumnTarget>;
  columnConfigs?: Record<
    string,
    {
      dataType?: string;
      anomalyEnabled?: boolean;
      minAnomaly?: number | null;
      maxAnomaly?: number | null;
    }
  >;
  indicatorTargets?: Record<string, number | null>;
  indicatorTargetOperators?: Record<string, string>;
  targetValue?: number | null;
  targetOperator?: string;
  defaultViewMode?: 'overview' | 'by-region' | 'by-indicator';
}

export interface PublishJoinedStuntingSpec {
  title?: string;
  rows: Record<string, unknown>[];
  columns: string[];
  keyColumn?: string;
  customColumnNames?: Record<string, string>;
  columnTargets?: Record<string, { enabled?: boolean; operator?: string; value?: number | null }>;
  enableJumlah?: boolean;
  sumColumns?: Record<string, boolean>;
  columnSums?: Record<string, number | null>;
  enableAverage?: boolean;
  avgColumns?: Record<string, boolean>;
  columnAverages?: Record<string, number | null>;
}

export interface StuntingEvaluationRow {
  name: string;
  targetCurrentYear?: number | null;
  activeActual?: number | null;
  activeExpected?: number | null;
}

export interface PublishStuntingEvaluationSpec {
  title?: string;
  activeQuarter: number;
  rows: StuntingEvaluationRow[];
}

export interface SessionStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class BrowserSessionStorageAdapter implements SessionStorageAdapter {
  getItem(key: string): string | null {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return null;
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn(`[BrowserSessionStorageAdapter] Gagal menyimpan "${key}":`, e);
    }
  }

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
  }
}

export class InMemorySessionStorageAdapter implements SessionStorageAdapter {
  private store = new Map<string, string>();

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

export const SESSION_STORAGE_ADAPTER = new InjectionToken<SessionStorageAdapter>(
  'SESSION_STORAGE_ADAPTER',
  {
    providedIn: 'root',
    factory: () => new BrowserSessionStorageAdapter(),
  },
);

/**
 * HealthDataExchange: Modul domain yang mendalam (Deep Module) yang bertanggung jawab atas
 * pertukaran data lintas fitur (Excel Join -> Visualisasi Grafik, Excel Join -> Monitoring Stunting,
 * dan Monitoring Stunting -> Visualisasi Grafik), mengisolasi transformasi format dan persistensi sesi.
 */
@Injectable({
  providedIn: 'root',
})
export class HealthDataExchange {
  static readonly CHART_STORAGE_KEY = 'dinkes_chart_bridge_data';
  static readonly STUNTING_STORAGE_KEY = 'dinkes_stunting_bridge_data';

  private storage: SessionStorageAdapter;

  private chartDataSignal = signal<TransferredChartData | null>(null);
  private stuntingDataSignal = signal<TransferredStuntingData | null>(null);

  chartData = this.chartDataSignal.asReadonly();
  stuntingData = this.stuntingDataSignal.asReadonly();

  constructor(
    @Optional()
    @Inject(SESSION_STORAGE_ADAPTER)
    customAdapter?: SessionStorageAdapter,
  ) {
    this.storage = customAdapter ?? new BrowserSessionStorageAdapter();
    this.chartDataSignal.set(this.readChartInitialData());
    this.stuntingDataSignal.set(this.readStuntingInitialData());
  }

  // ============================================================
  // CHART CHANNEL
  // ============================================================

  setChartData(data: TransferredChartData): void {
    this.chartDataSignal.set(data);
    try {
      this.storage.setItem(HealthDataExchange.CHART_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Gagal menyimpan chart data ke storage:', e);
    }
  }

  clearChartData(): void {
    this.chartDataSignal.set(null);
    try {
      this.storage.removeItem(HealthDataExchange.CHART_STORAGE_KEY);
    } catch {}
  }

  // ============================================================
  // STUNTING CHANNEL
  // ============================================================

  setStuntingData(data: TransferredStuntingData): void {
    this.stuntingDataSignal.set(data);
    try {
      this.storage.setItem(HealthDataExchange.STUNTING_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Gagal menyimpan stunting data ke storage:', e);
    }
  }

  clearStuntingData(): void {
    this.stuntingDataSignal.set(null);
    try {
      this.storage.removeItem(HealthDataExchange.STUNTING_STORAGE_KEY);
    } catch {}
  }

  // ============================================================
  // DOMAIN PROJECTIONS & PUBLISHING
  // ============================================================

  /**
   * Memproyeksikan dataset hasil join ke format grafik dan mempublikasikannya ke kanal Chart.
   */
  publishJoinedToChart(spec: PublishJoinedChartSpec): TransferredChartData {
    const {
      title = 'Grafik Hasil Join Excel',
      rows,
      columns,
      categoryColumn,
      customColumnNames = {},
      columnTargets = {},
      columnConfigs = {},
    } = spec;

    const catCol = categoryColumn || columns[0] || 'Wilayah';
    const displayCatCol = this.resolveDisplayName(catCol, customColumnNames);
    const displayCols = columns.map((c) => this.resolveDisplayName(c, customColumnNames));

    // Target acuan: gunakan spec.targetValue jika diberikan, atau target pertama yang tersedia dari columnTargets, atau fallback default 50
    let resolvedTarget = spec.targetValue;
    let resolvedOperator = spec.targetOperator;
    if (resolvedTarget === undefined || resolvedTarget === null) {
      for (const c of columns) {
        if (c === catCol) continue;
        const displayName = this.resolveDisplayName(c, customColumnNames);
        const tgt = this.findMatchingColumnTarget(columnTargets, c, displayName);
        if (tgt && tgt.enabled !== false && tgt.value !== null && tgt.value !== undefined) {
          resolvedTarget = tgt.value;
          if (!resolvedOperator && tgt.operator) {
            resolvedOperator = tgt.operator;
          }
          break;
        }
      }
    }
    const targetValue = resolvedTarget !== undefined && resolvedTarget !== null ? resolvedTarget : 50;
    const targetOperator = resolvedOperator || '>=';

    // Target khusus per indikator (mengikuti nilai target tiap kolom indikator bila tersedia, bila tidak kembalikan ke default 50)
    const indicatorTargets: Record<string, number | null> = { ...(spec.indicatorTargets || {}) };
    const indicatorTargetOperators: Record<string, string> = { ...(spec.indicatorTargetOperators || {}) };
    const percentageColumns: string[] = [];
    const nonNumericColumns: string[] = [];

    for (const c of columns) {
      const displayName = this.resolveDisplayName(c, customColumnNames);
      const tgt = this.findMatchingColumnTarget(columnTargets, c, displayName);

      if (c === catCol) {
        continue;
      }

      if (tgt && tgt.enabled !== false && tgt.value !== null && tgt.value !== undefined) {
        indicatorTargets[displayName] = tgt.value;
        indicatorTargets[c] = tgt.value;
        if (tgt.operator) {
          indicatorTargetOperators[displayName] = tgt.operator;
          indicatorTargetOperators[c] = tgt.operator;
        }
      } else {
        // Bila target tidak tersedia di excel join, kembalikan ke nilai default 50
        if (indicatorTargets[displayName] === undefined) {
          indicatorTargets[displayName] = 50;
        }
        if (indicatorTargets[c] === undefined) {
          indicatorTargets[c] = 50;
        }
      }

      const cfg = columnConfigs[c] || columnConfigs[displayName];
      if (cfg?.dataType === 'string') {
        nonNumericColumns.push(displayName);
        continue;
      }

      if (cfg?.dataType === 'number') {
        continue;
      }

      const isPct =
        cfg?.dataType === 'percentage' ||
        HealthDataExchange.isPercentageColumnName(c) ||
        HealthDataExchange.isPercentageColumnName(displayName) ||
        (cfg?.anomalyEnabled === true && cfg?.maxAnomaly === 100);

      if (isPct) {
        percentageColumns.push(displayName);
      }
    }

    const mappedRows = rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const c of columns) {
        out[this.resolveDisplayName(c, customColumnNames)] = r[c];
      }
      return out;
    });

    const chartData: TransferredChartData = {
      title,
      source: 'join',
      categoryColumn: displayCatCol,
      columns: displayCols,
      rows: mappedRows,
      targetValue,
      targetOperator,
      indicatorTargets,
      indicatorTargetOperators,
      defaultViewMode: spec.defaultViewMode ?? 'by-indicator',
      percentageColumns,
      nonNumericColumns: nonNumericColumns.length > 0 ? nonNumericColumns : undefined,
    };

    this.setChartData(chartData);
    return chartData;
  }

  /**
   * Memproyeksikan dataset hasil join ke format pemantauan stunting (beserta ringkasan TOTAL, TARGET, RATA-RATA).
   */
  publishJoinedToStunting(spec: PublishJoinedStuntingSpec): TransferredStuntingData {
    const {
      title = 'Hasil Join Excel',
      rows,
      columns,
      keyColumn,
      customColumnNames = {},
      columnTargets,
      enableJumlah = false,
      sumColumns = {},
      columnSums = {},
      enableAverage = false,
      avgColumns = {},
      columnAverages = {},
    } = spec;

    const pKey = keyColumn || columns[0] || 'Wilayah';
    const displayPKey = this.resolveDisplayName(pKey, customColumnNames);
    const displayCols = columns.map((c) => this.resolveDisplayName(c, customColumnNames));

    const mappedRows = rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const c of columns) {
        out[this.resolveDisplayName(c, customColumnNames)] = r[c];
      }
      return out;
    });

    // Baris Jumlah (TOTAL)
    let summaryRow: Record<string, unknown> | undefined = undefined;
    if (enableJumlah) {
      const sumObj: Record<string, unknown> = { [displayPKey]: 'TOTAL' };
      for (const col of columns) {
        if (col !== pKey && sumColumns[col]) {
          const sum = columnSums[col];
          if (sum !== null && sum !== undefined) {
            sumObj[this.resolveDisplayName(col, customColumnNames)] = sum;
          }
        }
      }
      summaryRow = sumObj;
    }

    // Baris Target (TARGET)
    let targetRow: Record<string, unknown> | undefined = undefined;
    if (columnTargets) {
      const tgtObj: Record<string, unknown> = { [displayPKey]: 'TARGET' };
      for (const col of columns) {
        const tgt = columnTargets[col];
        if (col !== pKey && tgt?.enabled && tgt.value !== null && tgt.value !== undefined) {
          tgtObj[this.resolveDisplayName(col, customColumnNames)] = tgt.operator
            ? `${tgt.operator} ${tgt.value}`
            : String(tgt.value);
        }
      }
      targetRow = tgtObj;
    }

    // Baris Rata-rata (RATA-RATA)
    let averageRow: Record<string, unknown> | undefined = undefined;
    if (enableAverage) {
      const avgObj: Record<string, unknown> = { [displayPKey]: 'RATA-RATA' };
      for (const col of columns) {
        if (col !== pKey && avgColumns[col]) {
          const avg = columnAverages[col];
          if (avg !== null && avg !== undefined) {
            avgObj[this.resolveDisplayName(col, customColumnNames)] = avg;
          }
        }
      }
      averageRow = avgObj;
    }

    const stuntingData: TransferredStuntingData = {
      title,
      source: 'join',
      keyColumn: displayPKey,
      columns: displayCols,
      rows: mappedRows,
      summaryRow,
      targetRow,
      averageRow,
    };

    this.setStuntingData(stuntingData);
    return stuntingData;
  }

  /**
   * Memproyeksikan hasil evaluasi triwulanan stunting menjadi baris grafik dan mempublikasikannya ke Chart.
   */
  publishStuntingEvaluationToChart(spec: PublishStuntingEvaluationSpec): TransferredChartData {
    const { title, activeQuarter, rows } = spec;

    const chartTitle = title || `Grafik Pemantauan Stunting TW ${activeQuarter}`;
    const capaianCol = `Capaian TW ${activeQuarter}`;
    const expectedCol = `Expected TW ${activeQuarter}`;
    const columns = ['Indikator', 'Target', capaianCol, expectedCol];

    const chartRows = rows.map((r) => ({
      Indikator: r.name,
      Target: r.targetCurrentYear ?? 0,
      [capaianCol]: r.activeActual ?? 0,
      [expectedCol]: r.activeExpected ?? 0,
    }));

    const chartData: TransferredChartData = {
      title: chartTitle,
      source: 'join',
      categoryColumn: 'Indikator',
      columns,
      rows: chartRows,
      targetValue: null,
      defaultViewMode: 'by-region',
    };

    this.setChartData(chartData);
    return chartData;
  }

  // ============================================================
  // INTERNAL HELPERS
  // ============================================================

  static isPercentageColumnName(name: string): boolean {
    if (!name) return false;
    return name.includes('%') || /\b(persen|persentase|cakupan|prevalensi|proporsi)\b/i.test(name);
  }

  private resolveDisplayName(col: string, customNames: Record<string, string>): string {
    const custom = customNames[col]?.trim();
    return custom || col;
  }

  private findMatchingColumnTarget(
    columnTargets: Record<string, ExchangeColumnTarget> | undefined,
    colKey: string,
    displayName: string,
  ): ExchangeColumnTarget | undefined {
    if (!columnTargets) return undefined;
    if (columnTargets[colKey]) return columnTargets[colKey];
    if (columnTargets[displayName]) return columnTargets[displayName];

    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    const normKey = norm(colKey);
    const normDisplay = norm(displayName);

    const stripPrefix = (s: string) => {
      const idx = s.indexOf(' - ');
      return idx >= 0 ? s.slice(idx + 3).trim().toLowerCase() : s.trim().toLowerCase();
    };
    const baseKey = stripPrefix(colKey);
    const baseDisplay = stripPrefix(displayName);

    for (const [k, v] of Object.entries(columnTargets)) {
      const nk = norm(k);
      if (nk === normKey || nk === normDisplay) return v;
      const baseK = stripPrefix(k);
      if (baseK === baseKey || baseK === baseDisplay) return v;
    }
    return undefined;
  }

  private readChartInitialData(): TransferredChartData | null {
    try {
      const raw = this.storage.getItem(HealthDataExchange.CHART_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as TransferredChartData) : null;
    } catch {
      return null;
    }
  }

  private readStuntingInitialData(): TransferredStuntingData | null {
    try {
      const raw = this.storage.getItem(HealthDataExchange.STUNTING_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as TransferredStuntingData) : null;
    } catch {
      return null;
    }
  }
}
