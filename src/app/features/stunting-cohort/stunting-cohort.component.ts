import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx-js-style';
import { ExcelEngine } from '../../shared/excel';
import {
  StuntingCohortEngine,
  CohortTransitionStatus,
  CohortIndicatorType,
  CohortColumnMapping,
  CohortEvaluatedChild,
  CohortComparisonResult,
} from '../../core/stunting-cohort/stunting-cohort-engine';
import {
  StuntingRekapEngine,
  RekapResult,
  RekapRowData,
  RekapTotalData,
  RekapSummary,
} from '../../core/stunting-cohort/stunting-rekap-engine';

export interface DonutArc {
  status: CohortTransitionStatus;
  label: string;
  count: number;
  percent: number;
  color: string;
  strokeDasharray: string;
  strokeDashoffset: number;
}

export interface WaterfallBar {
  label: string;
  subLabel: string;
  value: number;
  displayValue: string;
  type: 'base' | 'decrement' | 'increment' | 'result';
  color: string;
  heightPercent: number;
  barY: number;
  barHeight: number;
}

export interface IndicatorOption {
  id: CohortIndicatorType;
  label: string;
  subLabel: string;
  badge: string;
  color: string;
  activeClass: string;
}

export type CohortSortColumn =
  | 'nik'
  | 'nama'
  | 'tanggalLahir'
  | 'ageMonths'
  | 'puskesmas'
  | 'status'
  | 'p1'
  | 'p2'
  | 'delta';

export type CohortSortDirection = 'asc' | 'desc' | 'none';

@Component({
  selector: 'app-stunting-cohort',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stunting-cohort.component.html',
})
export class StuntingCohortComponent {
  // Expose engines and enums to template
  readonly CohortTransitionStatus = CohortTransitionStatus;
  readonly StuntingCohortEngine = StuntingCohortEngine;
  readonly StuntingRekapEngine = StuntingRekapEngine;

  // Active Sub-Menu (Tab)
  readonly activeSubMenu = signal<'rekap' | 'cohort'>('rekap');

  // ==========================================
  // MENU 1: REKAP STATUS GIZI (e-PPGBM / SIGIZI)
  // ==========================================
  readonly rekapRawData = signal<Record<string, unknown>[] | null>(null);
  readonly rekapFileName = signal<string>('');
  readonly rekapGroupingLevel = signal<string>('kabupaten_kota');
  readonly rekapSearchQuery = signal<string>('');
  readonly rekapCutoffDate = signal<string>(new Date().toISOString().replace('T', ' ').substring(0, 19));
  readonly isRekapProcessing = signal<boolean>(false);

  readonly rekapResult = computed<RekapResult | null>(() => {
    const raw = this.rekapRawData();
    if (!raw || raw.length === 0) return null;

    return StuntingRekapEngine.aggregate(raw, {
      cutoffDate: this.rekapCutoffDate(),
      groupingLevel: this.rekapGroupingLevel(),
    });
  });

  readonly filteredRekapRows = computed<RekapRowData[]>(() => {
    const res = this.rekapResult();
    if (!res) return [];

    const q = this.rekapSearchQuery().trim().toLowerCase();
    if (!q) return res.rows;

    return res.rows.filter((r) => r.wilayah.toLowerCase().includes(q));
  });

  // ==========================================
  // MENU 2: ANALISIS KOHORT BALITA (TRANSISI)
  // ==========================================
  // Active Indicator Selector
  readonly activeIndicator = signal<CohortIndicatorType>('stunting');

  readonly indicatorOptions: IndicatorOption[] = [
    {
      id: 'stunting',
      label: 'Stunting',
      subLabel: 'TB/U (Pendek & Sangat Pendek)',
      badge: 'TB/U',
      color: '#e11d48',
      activeClass: 'bg-rose-600 text-white shadow-xs',
    },
    {
      id: 'wasting',
      label: 'Wasting',
      subLabel: 'BB/TB (Gizi Kurang & Buruk)',
      badge: 'BB/TB',
      color: '#d97706',
      activeClass: 'bg-amber-600 text-white shadow-xs',
    },
    {
      id: 'underweight',
      label: 'Underweight',
      subLabel: 'BB/U (Berat Kurang & Sangat Kurang)',
      badge: 'BB/U',
      color: '#ca8a04',
      activeClass: 'bg-yellow-600 text-white shadow-xs',
    },
    {
      id: 'gizi_buruk',
      label: 'Gizi Buruk',
      subLabel: 'BB/TB (Severely Wasted < -3 SD)',
      badge: 'Gizi Buruk',
      color: '#dc2626',
      activeClass: 'bg-red-700 text-white shadow-xs',
    },
    {
      id: 'overweight',
      label: 'Overweight',
      subLabel: 'BB/TB (Gizi Lebih & Obesitas)',
      badge: 'Lebih / Obes',
      color: '#7c3aed',
      activeClass: 'bg-purple-600 text-white shadow-xs',
    },
  ];

  readonly activeIndicatorConfig = computed<IndicatorOption>(() => {
    const id = this.activeIndicator();
    return this.indicatorOptions.find((opt) => opt.id === id) || this.indicatorOptions[0];
  });

  // Period 1 (Baseline) State
  readonly period1Data = signal<Record<string, unknown>[] | null>(null);
  readonly period1FileName = signal<string>('');
  readonly period1Label = signal<string>('Periode Awal (TW 1)');
  readonly period1Columns = signal<string[]>([]);
  readonly p1Mapping = signal<CohortColumnMapping>({});

  // Period 2 (Evaluasi) State
  readonly period2Data = signal<Record<string, unknown>[] | null>(null);
  readonly period2FileName = signal<string>('');
  readonly period2Label = signal<string>('Periode Evaluasi (TW 2)');
  readonly period2Columns = signal<string[]>([]);
  readonly p2Mapping = signal<CohortColumnMapping>({});

  // Evaluation Reference Date (default: today)
  readonly evaluationDate = signal<string>(new Date().toISOString().split('T')[0]);

  // UI State
  readonly isMappingOpen = signal<boolean>(false);
  readonly isCohortProcessing = signal<boolean>(false);
  readonly activeFilter = signal<'ALL' | CohortTransitionStatus>('ALL');
  readonly searchQuery = signal<string>('');
  readonly errorMessage = signal<string | null>(null);

  // Sorting State
  readonly sortColumn = signal<CohortSortColumn | null>(null);
  readonly sortDirection = signal<CohortSortDirection>('none');

  // Computed state
  readonly comparisonResult = computed<CohortComparisonResult | null>(() => {
    const p1 = this.period1Data();
    const p2 = this.period2Data();
    if (!p1 || !p2) return null;

    return StuntingCohortEngine.evaluateCohort(p1, p2, {
      p1Mapping: this.p1Mapping(),
      p2Mapping: this.p2Mapping(),
      evaluationDate: this.evaluationDate(),
      indicator: this.activeIndicator(),
      p1Label: this.period1Label(),
      p2Label: this.period2Label(),
    });
  });

  readonly filteredChildren = computed<CohortEvaluatedChild[]>(() => {
    const res = this.comparisonResult();
    if (!res) return [];

    let list = res.children;

    // Filter by transition status
    const filter = this.activeFilter();
    if (filter !== 'ALL') {
      list = list.filter((c) => c.status === filter);
    }

    // Filter by search query (NIK or Name)
    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.nik.toLowerCase().includes(q) ||
          c.nama.toLowerCase().includes(q) ||
          (c.puskesmas && c.puskesmas.toLowerCase().includes(q)) ||
          (c.desa && c.desa.toLowerCase().includes(q))
      );
    }

    // Apply Sorting
    const col = this.sortColumn();
    const dir = this.sortDirection();
    if (!col || dir === 'none') {
      return list;
    }

    const mult = dir === 'asc' ? 1 : -1;
    const ind = this.activeIndicator();

    return [...list].sort((a, b) => {
      let valA: string | number | null | undefined = null;
      let valB: string | number | null | undefined = null;

      switch (col) {
        case 'nik':
          valA = a.nik;
          valB = b.nik;
          break;
        case 'nama':
          valA = a.nama;
          valB = b.nama;
          break;
        case 'tanggalLahir':
          valA = a.tanggalLahir ?? null;
          valB = b.tanggalLahir ?? null;
          break;
        case 'ageMonths':
          valA = a.ageMonths ?? null;
          valB = b.ageMonths ?? null;
          break;
        case 'puskesmas':
          valA = (a.puskesmas ? a.puskesmas + (a.desa ? ' ' + a.desa : '') : '').trim();
          valB = (b.puskesmas ? b.puskesmas + (b.desa ? ' ' + b.desa : '') : '').trim();
          break;
        case 'status':
          valA = a.statusLabel || a.status;
          valB = b.statusLabel || b.status;
          break;
        case 'p1':
          valA = ind === 'stunting' ? a.p1Height : (a.p1Weight ?? a.p1Height);
          valB = ind === 'stunting' ? b.p1Height : (b.p1Weight ?? b.p1Height);
          break;
        case 'p2':
          valA = ind === 'stunting' ? a.p2Height : (a.p2Weight ?? a.p2Height);
          valB = ind === 'stunting' ? b.p2Height : (b.p2Weight ?? b.p2Height);
          break;
        case 'delta':
          valA = ind === 'stunting' ? a.heightGain : (a.weightGain ?? a.heightGain);
          valB = ind === 'stunting' ? b.heightGain : (b.weightGain ?? b.heightGain);
          break;
      }

      // Null values are placed at bottom in both asc and desc
      const isNullA = valA === null || valA === undefined || valA === '';
      const isNullB = valB === null || valB === undefined || valB === '';
      if (isNullA && isNullB) return 0;
      if (isNullA) return 1;
      if (isNullB) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * mult;
      }

      return String(valA).localeCompare(String(valB), 'id', { numeric: true, sensitivity: 'base' }) * mult;
    });
  });

  // SVG Donut Chart Calculation
  readonly donutData = computed<DonutArc[]>(() => {
    const res = this.comparisonResult();
    if (!res) return [];

    const total = res.children.length;
    if (total === 0) return [];

    const radius = 60;
    const circumference = 2 * Math.PI * radius; // ~ 376.99
    const labels = StuntingCohortEngine.getStatusLabels(res.indicator);

    const items: { status: CohortTransitionStatus; count: number; color: string }[] = [
      { status: CohortTransitionStatus.PERSISTENT, count: res.summary.persistentCount, color: '#f43f5e' },
      { status: CohortTransitionStatus.RECOVERED, count: res.summary.recoveredCount, color: '#10b981' },
      { status: CohortTransitionStatus.NEW_CASE, count: res.summary.newCaseCount, color: '#f97316' },
      { status: CohortTransitionStatus.AGED_OUT, count: res.summary.agedOutCount, color: '#64748b' },
    ];

    let currentOffset = 0;
    return items.map((item) => {
      const percent = (item.count / total) * 100;
      const arcLength = (item.count / total) * circumference;
      const strokeDasharray = `${arcLength.toFixed(2)} ${circumference.toFixed(2)}`;
      const strokeDashoffset = -currentOffset;
      currentOffset += arcLength;

      return {
        status: item.status,
        label: labels[item.status],
        count: item.count,
        percent,
        color: item.color,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  });

  // SVG Waterfall / Flow Bar Calculation
  readonly waterfallBars = computed<WaterfallBar[]>(() => {
    const res = this.comparisonResult();
    if (!res) return [];

    const p1 = res.summary.totalPeriod1;
    const recovered = res.summary.recoveredCount;
    const agedOut = res.summary.agedOutCount;
    const newCase = res.summary.newCaseCount;
    const p2 = res.summary.totalPeriod2;
    const labels = StuntingCohortEngine.getStatusLabels(res.indicator);

    const maxVal = Math.max(p1, p2, p1 + newCase, 10);
    const chartHeight = 160;

    const scale = (val: number) => (val / maxVal) * (chartHeight - 40);

    // 1. Baseline
    const h1 = scale(p1);
    const bar1: WaterfallBar = {
      label: 'Periode Awal',
      subLabel: `${p1} Anak`,
      value: p1,
      displayValue: `${p1}`,
      type: 'base',
      color: '#3b82f6',
      heightPercent: (p1 / maxVal) * 100,
      barY: chartHeight - h1 - 20,
      barHeight: h1,
    };

    // 2. Bebas Kasus (Decrement)
    const hRec = scale(recovered);
    const bar2: WaterfallBar = {
      label: labels[CohortTransitionStatus.RECOVERED],
      subLabel: `-${recovered}`,
      value: recovered,
      displayValue: `-${recovered}`,
      type: 'decrement',
      color: '#10b981',
      heightPercent: (recovered / maxVal) * 100,
      barY: chartHeight - scale(p1) - 20,
      barHeight: hRec,
    };

    // 3. Lulus Usia (Decrement)
    const hAged = scale(agedOut);
    const bar3: WaterfallBar = {
      label: 'Lulus Usia',
      subLabel: `-${agedOut}`,
      value: agedOut,
      displayValue: `-${agedOut}`,
      type: 'decrement',
      color: '#64748b',
      heightPercent: (agedOut / maxVal) * 100,
      barY: chartHeight - scale(p1 - recovered) - 20,
      barHeight: hAged,
    };

    // 4. Kasus Baru (Increment)
    const hNew = scale(newCase);
    const bar4: WaterfallBar = {
      label: labels[CohortTransitionStatus.NEW_CASE],
      subLabel: `+${newCase}`,
      value: newCase,
      displayValue: `+${newCase}`,
      type: 'increment',
      color: '#f97316',
      heightPercent: (newCase / maxVal) * 100,
      barY: chartHeight - scale(p1 - recovered - agedOut + newCase) - 20,
      barHeight: hNew,
    };

    // 5. Endline (Evaluasi)
    const h2 = scale(p2);
    const bar5: WaterfallBar = {
      label: 'Periode Evaluasi',
      subLabel: `${p2} Anak`,
      value: p2,
      displayValue: `${p2}`,
      type: 'result',
      color: '#059669',
      heightPercent: (p2 / maxVal) * 100,
      barY: chartHeight - h2 - 20,
      barHeight: h2,
    };

    return [bar1, bar2, bar3, bar4, bar5];
  });

  /**
   * Handle file upload for Period 1 or Period 2
   */
  onFileChange(period: 1 | 2, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

        if (jsonData.length === 0) {
          this.errorMessage.set(`File ${file.name} tidak memiliki baris data.`);
          return;
        }

        const columns = Object.keys(jsonData[0] || {});
        const detectedMapping = StuntingCohortEngine.detectColumnKeys(columns);

        if (period === 1) {
          this.period1Data.set(jsonData);
          this.period1FileName.set(file.name);
          this.period1Columns.set(columns);
          this.p1Mapping.set(detectedMapping);
        } else {
          this.period2Data.set(jsonData);
          this.period2FileName.set(file.name);
          this.period2Columns.set(columns);
          this.p2Mapping.set(detectedMapping);
        }

        this.errorMessage.set(null);
      } catch (err: unknown) {
        this.errorMessage.set(`Gagal membaca berkas Excel: ${String(err)}`);
      }
    };

    reader.readAsArrayBuffer(file);
    // Reset file input value so re-uploading same file works
    input.value = '';
  }

  /**
   * Switches the active cohort evaluation indicator and resets the table filter
   */
  switchIndicator(indicator: CohortIndicatorType): void {
    this.activeIndicator.set(indicator);
    this.activeFilter.set('ALL');
  }

  /**
   * Gets human-readable status label for the active indicator
   */
  getStatusLabel(status: CohortTransitionStatus): string {
    const labels = StuntingCohortEngine.getStatusLabels(this.activeIndicator());
    return labels[status] ?? status;
  }

  /**
   * Exports multi-sheet styled Excel report
   */
  exportExcel(): void {
    const res = this.comparisonResult();
    if (!res) return;

    const wb = StuntingCohortEngine.generateExcelWorkbook(res);
    const dateStr = this.evaluationDate();
    const indName = res.indicator.toUpperCase();
    const filename = `Laporan_Kohort_${indName}_${dateStr}.xlsx`;
    ExcelEngine.writeWorkbook(wb, filename);
  }

  /**
   * Resets all component state
   */
  resetAll(): void {
    this.period1Data.set(null);
    this.period1FileName.set('');
    this.period1Columns.set([]);
    this.p1Mapping.set({});

    this.period2Data.set(null);
    this.period2FileName.set('');
    this.period2Columns.set([]);
    this.p2Mapping.set({});

    this.activeFilter.set('ALL');
    this.searchQuery.set('');
    this.isMappingOpen.set(false);
    this.errorMessage.set(null);
  }

  /**
   * Helper to update specific mapping key
   */
  updateMapping(period: 1 | 2, key: keyof CohortColumnMapping, value: string): void {
    if (period === 1) {
      this.p1Mapping.update((curr) => ({ ...curr, [key]: value }));
    } else {
      this.p2Mapping.update((curr) => ({ ...curr, [key]: value }));
    }
  }

  // ==========================================
  // REKAP STATUS GIZI METHODS
  // ==========================================

  /**
   * Handle raw data file upload for Rekap Status Gizi (.xlsx, .xls, .csv)
   */
  onRekapFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

        if (jsonData.length === 0) {
          this.errorMessage.set(`File ${file.name} tidak memiliki baris data.`);
          return;
        }

        this.rekapRawData.set(jsonData);
        this.rekapFileName.set(file.name);
        this.errorMessage.set(null);
      } catch (err: unknown) {
        this.errorMessage.set(`Gagal membaca berkas: ${String(err)}`);
      }
    };

    reader.readAsArrayBuffer(file);
    input.value = '';
  }

  /**
   * Loads sample raw individual child data
   */
  async loadSyntheticSampleData(): Promise<void> {
    try {
      this.isRekapProcessing.set(true);
      const res = await fetch('sample_data_mentah.csv');
      if (!res.ok) {
        throw new Error(`Berkas contoh tidak dapat diakses (HTTP ${res.status})`);
      }
      const csvText = await res.text();
      const wb = XLSX.read(csvText, { type: 'string' });
      const firstSheet = wb.SheetNames[0];
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[firstSheet], { defval: '' });
      this.rekapRawData.set(records);
      this.rekapFileName.set('sample_data_mentah.csv');
      this.rekapCutoffDate.set('2026-02-02 16:05:11');
      this.errorMessage.set(null);
    } catch (err: unknown) {
      this.errorMessage.set(`Gagal memuat dataset: ${String(err)}`);
    } finally {
      this.isRekapProcessing.set(false);
    }
  }

  /**
   * Loads synthetic dual-period cohort tracking dataset (Baseline & Evaluasi)
   */
  async loadSyntheticCohortSampleData(): Promise<void> {
    try {
      this.isCohortProcessing.set(true);
      const [res1, res2] = await Promise.all([
        fetch('sample_kohort_periode_awal.csv'),
        fetch('sample_kohort_periode_evaluasi.csv'),
      ]);

      if (!res1.ok || !res2.ok) {
        throw new Error('Berkas contoh kohort tidak dapat diakses.');
      }

      const [text1, text2] = await Promise.all([res1.text(), res2.text()]);

      const wb1 = XLSX.read(text1, { type: 'string' });
      const ws1 = wb1.Sheets[wb1.SheetNames[0]];
      const rows1 = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws1, { defval: '' });

      const wb2 = XLSX.read(text2, { type: 'string' });
      const ws2 = wb2.Sheets[wb2.SheetNames[0]];
      const rows2 = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws2, { defval: '' });

      const cols1 = Object.keys(rows1[0] || {});
      const cols2 = Object.keys(rows2[0] || {});

      this.period1Data.set(rows1);
      this.period1FileName.set('sample_kohort_periode_awal.csv');
      this.period1Label.set('Juli 2025 (Baseline)');
      this.period1Columns.set(cols1);
      this.p1Mapping.set(StuntingCohortEngine.detectColumnKeys(cols1));

      this.period2Data.set(rows2);
      this.period2FileName.set('sample_kohort_periode_evaluasi.csv');
      this.period2Label.set('Januari 2026 (Evaluasi)');
      this.period2Columns.set(cols2);
      this.p2Mapping.set(StuntingCohortEngine.detectColumnKeys(cols2));

      this.evaluationDate.set('2026-01-20');
      this.errorMessage.set(null);
    } catch (err: unknown) {
      this.errorMessage.set(`Gagal memuat dataset contoh kohort: ${String(err)}`);
    } finally {
      this.isCohortProcessing.set(false);
    }
  }

  /**
   * Exports compiled status gizi rekap report in authentic Dinkes multi-sheet Excel format
   */
  exportRekapExcel(): void {
    const res = this.rekapResult();
    if (!res) return;

    const wb = StuntingRekapEngine.generateExcelWorkbook(res);
    const dateStr = res.cutoffDate.replace(/[: ]/g, '_');
    const filename = `REKAP_STATUS_GIZI_${dateStr}.xlsx`;
    ExcelEngine.writeWorkbook(wb, filename);
  }

  /**
   * Resets Rekap Status Gizi data
   */
  resetRekap(): void {
    this.rekapRawData.set(null);
    this.rekapFileName.set('');
    this.rekapSearchQuery.set('');
    this.errorMessage.set(null);
  }

  /**
   * Toggles column sorting order: asc -> desc -> none -> asc
   */
  toggleSort(column: CohortSortColumn): void {
    if (this.sortColumn() !== column) {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    } else {
      const current = this.sortDirection();
      if (current === 'asc') {
        this.sortDirection.set('desc');
      } else if (current === 'desc') {
        this.sortDirection.set('none');
        this.sortColumn.set(null);
      } else {
        this.sortDirection.set('asc');
      }
    }
  }

  /**
   * Resets table sorting to default order
   */
  resetSort(): void {
    this.sortColumn.set(null);
    this.sortDirection.set('none');
  }

  /**
   * Returns human-readable label for the currently sorted column
   */
  getSortColumnLabel(): string {
    const col = this.sortColumn();
    if (!col) return '';
    switch (col) {
      case 'nik':
        return 'NIK Balita';
      case 'nama':
        return 'Nama Balita';
      case 'tanggalLahir':
        return 'Tanggal Lahir';
      case 'ageMonths':
        return 'Usia';
      case 'puskesmas':
        return 'Puskesmas / Wilayah';
      case 'status':
        return 'Status Transisi';
      case 'p1':
        return this.activeIndicator() === 'stunting'
          ? 'TB Baseline'
          : this.activeIndicator() === 'underweight'
          ? 'BB Baseline'
          : 'Pengukuran P1';
      case 'p2':
        return this.activeIndicator() === 'stunting'
          ? 'TB Evaluasi'
          : this.activeIndicator() === 'underweight'
          ? 'BB Evaluasi'
          : 'Pengukuran P2';
      case 'delta':
        return this.activeIndicator() === 'stunting'
          ? 'Pertumbuhan (Δ TB)'
          : this.activeIndicator() === 'underweight'
          ? 'Perubahan (Δ BB)'
          : 'Dinamika Fisik';
    }
  }
}
