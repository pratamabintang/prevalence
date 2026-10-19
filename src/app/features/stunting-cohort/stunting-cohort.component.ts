import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx-js-style';
import { ExcelEngine } from '../../shared/excel';
import {
  StuntingCohortEngine,
  CohortTransitionStatus,
  CohortColumnMapping,
  CohortEvaluatedChild,
  CohortComparisonResult,
} from '../../core/stunting-cohort/stunting-cohort-engine';

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

@Component({
  selector: 'app-stunting-cohort',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stunting-cohort.component.html',
})
export class StuntingCohortComponent {
  // Expose enum to template
  readonly CohortTransitionStatus = CohortTransitionStatus;

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
  readonly activeFilter = signal<'ALL' | CohortTransitionStatus>('ALL');
  readonly searchQuery = signal<string>('');
  readonly errorMessage = signal<string | null>(null);

  // Computed state
  readonly comparisonResult = computed<CohortComparisonResult | null>(() => {
    const p1 = this.period1Data();
    const p2 = this.period2Data();
    if (!p1 || !p2) return null;

    return StuntingCohortEngine.evaluateCohort(p1, p2, {
      p1Mapping: this.p1Mapping(),
      p2Mapping: this.p2Mapping(),
      evaluationDate: this.evaluationDate(),
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

    return list;
  });

  // SVG Donut Chart Calculation
  readonly donutData = computed<DonutArc[]>(() => {
    const res = this.comparisonResult();
    if (!res) return [];

    const total = res.children.length;
    if (total === 0) return [];

    const radius = 60;
    const circumference = 2 * Math.PI * radius; // ~ 376.99

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
        label: StuntingCohortEngine.STATUS_LABELS[item.status],
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

    // 2. Bebas Stunting (Decrement)
    const hRec = scale(recovered);
    const bar2: WaterfallBar = {
      label: 'Bebas Stunting',
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
      label: 'Kasus Baru',
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
        const wb = XLSX.read(buffer, { type: 'array' });
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

  // Expose engine to template
  readonly StuntingCohortEngine = StuntingCohortEngine;

  /**
   * Exports multi-sheet styled Excel report
   */
  exportExcel(): void {
    const res = this.comparisonResult();
    if (!res) return;

    const wb = StuntingCohortEngine.generateExcelWorkbook(res);
    const dateStr = this.evaluationDate();
    const filename = `Laporan_Kohort_Stunting_${dateStr}.xlsx`;
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
}
