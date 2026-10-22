import { inject, Injectable, signal, Signal } from '@angular/core';
import {
  GasPeriodItem,
  GasSaveResult,
  GasStorageService,
  QuarterSlot,
} from './gas-storage.service';
import { BackendStorageService } from './backend-storage.service';
import {
  DinkesSpreadsheetParser,
  ParsedDinkesDataset,
  ParseDinkesOptions,
} from '../excel/dinkes-spreadsheet-parser';
import { IndicatorEvaluator } from '../evaluation/indicator-evaluator';
import { JoinPresetExecutionSpec } from '../excel/excel-join-engine';

export interface QuarterDataset {
  year: number;
  quarter: QuarterSlot;
  source: 'local' | 'cloud';
  fileName: string;
  dataset: ParsedDinkesDataset;
  rawBuffer?: ArrayBuffer;
  resultBuffer?: ArrayBuffer;
}

export interface MultiQuarterResolutionResult {
  year: number;
  loadedQuarters: QuarterDataset[];
  missingQuarters: QuarterSlot[];
  primaryDataset?: ParsedDinkesDataset;
}

export interface LoadQuarterOptions {
  prefer?: 'raw' | 'result' | 'auto';
  parseOptions?: ParseDinkesOptions;
}

export interface SavePeriodPartitionSpec {
  year: number;
  quarter: QuarterSlot;
  rawExcelBuffer: ArrayBuffer;
  resultExcelBuffer?: ArrayBuffer;
  config?: unknown;
  preset?: JoinPresetExecutionSpec;
}

/**
 * PeriodPartitionWorkspace: Modul dalam (Deep Module) untuk orkestrasi partisi periode Google Drive.
 * Mengoordinasikan penemuan slot, pemuatan multi-kuartal, fallback prioritas (lokal menimpa cloud),
 * dan parsing otomatis ke dalam ParsedDinkesDataset di balik satu antarmuka terpadu.
 */
@Injectable({
  providedIn: 'root',
})
export class PeriodPartitionWorkspace {
  private readonly gasStorage: GasStorageService;
  private readonly backendStorage?: BackendStorageService;

  readonly currentYear = new Date().getFullYear();
  private readonly _availableYears = signal<number[]>(
    Array.from({ length: 6 }, (_, i) => this.currentYear - i),
  );
  private readonly _periodSlots = signal<GasPeriodItem[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _selectedYear = signal<number>(this.currentYear);

  readonly availableYears: Signal<number[]> = this._availableYears.asReadonly();
  readonly periodSlots: Signal<GasPeriodItem[]> = this._periodSlots.asReadonly();
  readonly isLoading: Signal<boolean> = this._isLoading.asReadonly();
  readonly selectedYear: Signal<number> = this._selectedYear.asReadonly();

  constructor(gasStorage?: GasStorageService, backendStorage?: BackendStorageService) {
    this.gasStorage = gasStorage ?? inject(GasStorageService);
    if (backendStorage !== undefined) {
      this.backendStorage = backendStorage;
    } else if (!gasStorage) {
      this.backendStorage = inject(BackendStorageService, { optional: true }) ?? undefined;
    }
  }

  setSelectedYear(year: number): void {
    this._selectedYear.set(year);
  }

  private applyRemotePeriods(periods: GasPeriodItem[]): GasPeriodItem[] {
    this._periodSlots.set(periods);

    const yearsFromRemote = Array.from(new Set(periods.map((p) => p.year)));
    const fallbackYears = Array.from({ length: 6 }, (_, i) => this.currentYear - i);
    const mergedYears = Array.from(new Set([...yearsFromRemote, ...fallbackYears])).sort(
      (a, b) => b - a,
    );

    this._availableYears.set(mergedYears);
    if (!mergedYears.includes(this._selectedYear())) {
      this._selectedYear.set(mergedYears[0]);
    }
    return periods;
  }

  /**
   * Memperbarui daftar slot periode dari Server Backend (utama) atau Google Drive (fallback)
   * dan menyinkronkan daftar tahun.
   */
  async refreshPeriods(customUrl?: string): Promise<GasPeriodItem[]> {
    this._isLoading.set(true);
    try {
      if (!customUrl && this.backendStorage?.isConfigured()) {
        const backendRes = await this.backendStorage.listPeriods();
        if (backendRes.success && Array.isArray(backendRes.periods)) {
          const mapped: GasPeriodItem[] = backendRes.periods.map((p) => ({
            year: p.year,
            quarter: p.quarter,
            hasRaw: p.hasRaw,
            hasResult: p.hasResult,
            hasConfig: Boolean(p.hasConfig),
            rawFileName: p.rawFileName,
            resultFileName: p.resultFileName,
            updatedAt: p.updatedAt,
            fileSize: p.fileSize,
          }));
          return this.applyRemotePeriods(mapped);
        }
      }

      const res = await this.gasStorage.listPeriods(customUrl);
      if (res.success && Array.isArray(res.periods)) {
        return this.applyRemotePeriods(res.periods);
      }
      return this._periodSlots();
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Mengecek apakah slot periode tertentu memiliki berkas mentah atau hasil di cloud.
   */
  isQuarterAvailable(year: number, quarter: QuarterSlot): boolean {
    return this._periodSlots().some(
      (p) => p.year === year && p.quarter === quarter && (p.hasRaw || p.hasResult),
    );
  }

  /**
   * Mengambil item metadata slot periode.
   */
  getQuarterSlotItem(year: number, quarter: QuarterSlot): GasPeriodItem | undefined {
    return this._periodSlots().find((p) => p.year === year && p.quarter === quarter);
  }

  /**
   * Memuat data single quarter dari Server Backend (utama) atau Google Drive (fallback)
   * dengan preferensi varian berkas ('raw' vs 'result').
   */
  async loadSingleQuarter(
    year: number,
    quarter: QuarterSlot,
    options?: LoadQuarterOptions,
    customUrl?: string,
  ): Promise<QuarterDataset | null> {
    const preferResult = options?.prefer !== 'raw';

    if (!customUrl && this.backendStorage?.isConfigured()) {
      const backendRes = await this.backendStorage.loadPeriod(year, quarter);
      if (backendRes.success) {
        if (!backendRes.hasData) {
          return null;
        }
        const backendBuffer =
          preferResult && backendRes.resultExcelBuffer
            ? backendRes.resultExcelBuffer
            : (backendRes.rawExcelBuffer ?? backendRes.resultExcelBuffer);

        if (backendBuffer) {
          const preset = (backendRes.config as JoinPresetExecutionSpec) ?? options?.parseOptions?.preset;
          const dataset = DinkesSpreadsheetParser.parse(backendBuffer, {
            ...options?.parseOptions,
            preset,
          });
          return {
            year,
            quarter,
            source: 'cloud',
            fileName: preferResult && backendRes.resultExcelBuffer ? 'joined-result.xlsx' : 'raw-data.xlsx',
            dataset,
            rawBuffer: backendRes.rawExcelBuffer,
            resultBuffer: backendRes.resultExcelBuffer,
          };
        }
      }
    }

    const res = await this.gasStorage.loadPeriod(year, quarter, { preferResult, customUrl });

    if (!res.success || !res.hasData) {
      return null;
    }

    const buffer =
      preferResult && res.resultExcelBuffer
        ? res.resultExcelBuffer
        : (res.rawExcelBuffer ?? res.resultExcelBuffer);

    if (!buffer) {
      return null;
    }

    const preset = (res.config as JoinPresetExecutionSpec) ?? options?.parseOptions?.preset;
    const parseOptions: ParseDinkesOptions = {
      ...options?.parseOptions,
      preset,
    };
    const dataset = DinkesSpreadsheetParser.parse(buffer, parseOptions);
    return {
      year,
      quarter,
      source: 'cloud',
      fileName: res.fileName || (preferResult ? 'joined-result.xlsx' : 'raw-data.xlsx'),
      dataset,
      rawBuffer: res.rawExcelBuffer,
      resultBuffer: res.resultExcelBuffer,
    };
  }

  /**
   * Memuat batch multi-kuartal dengan rantai prioritas ketat:
   * 1. Berkas lokal pengguna (menimpa cloud).
   * 2. Slot Server Backend / Google Drive (cloud).
   * 3. Slot hilang non-fatal (missingQuarters).
   */
  async loadMultiQuarters(
    year: number,
    selectedSlots: QuarterSlot[],
    localFiles?: Partial<Record<QuarterSlot, File>>,
    options?: LoadQuarterOptions,
    customUrl?: string,
  ): Promise<MultiQuarterResolutionResult> {
    const loadedQuarters: QuarterDataset[] = [];
    const missingQuarters: QuarterSlot[] = [];

    for (const slot of selectedSlots) {
      const localFile = localFiles?.[slot];
      if (localFile) {
        try {
          const buf = await localFile.arrayBuffer();
          let slotPreset: JoinPresetExecutionSpec | undefined = options?.parseOptions?.preset;
          const slotItem = this.getQuarterSlotItem(year, slot);
          if (slotItem?.hasConfig || this.isQuarterAvailable(year, slot)) {
            try {
              const cloudRes = await this.gasStorage.loadPeriod(year, slot, {
                preferResult: true,
                customUrl,
              });
              if (cloudRes.config) {
                slotPreset = cloudRes.config as JoinPresetExecutionSpec;
              }
            } catch {
              // ignore
            }
          }
          const dataset = DinkesSpreadsheetParser.parse(buf, {
            ...options?.parseOptions,
            preset: slotPreset,
          });
          loadedQuarters.push({
            year,
            quarter: slot,
            source: 'local',
            fileName: localFile.name,
            dataset,
            rawBuffer: buf,
          });
          continue;
        } catch (err) {
          console.warn(
            `[PeriodPartitionWorkspace] Gagal mem-parsing berkas lokal untuk ${slot}:`,
            err,
          );
        }
      }

      // Cek ketersediaan di cloud
      const cloudQuarter = await this.loadSingleQuarter(year, slot, options, customUrl);
      if (cloudQuarter) {
        loadedQuarters.push(cloudQuarter);
      } else {
        missingQuarters.push(slot);
      }
    }

    // Urutkan kuartal berdasarkan urutan kronologis standar
    const slotOrder: Record<QuarterSlot, number> = { TW1: 1, TW2: 2, TW3: 3, TW4: 4 };
    loadedQuarters.sort((a, b) => slotOrder[a.quarter] - slotOrder[b.quarter]);

    const primaryDataset =
      loadedQuarters.length > 0 ? loadedQuarters[loadedQuarters.length - 1].dataset : undefined;

    return {
      year,
      loadedQuarters,
      missingQuarters,
      primaryDataset,
    };
  }

  private extractObservationsFromSpec(
    spec: SavePeriodPartitionSpec,
  ): Array<{ districtName: string; indicatorKey: string; numericValue: number | null; displayText?: string }> {
    const primaryBuffer = spec.resultExcelBuffer ?? spec.rawExcelBuffer;
    if (!primaryBuffer || primaryBuffer.byteLength === 0) {
      return [];
    }

    try {
      const preset = spec.preset ?? (spec.config as JoinPresetExecutionSpec | undefined);
      const parsed = DinkesSpreadsheetParser.parse(primaryBuffer, { preset });
      const observations: Array<{
        districtName: string;
        indicatorKey: string;
        numericValue: number | null;
        displayText?: string;
      }> = [];

      for (const row of parsed.regionRows) {
        const districtName = String(row[parsed.keyCol] ?? '').trim();
        if (!districtName) continue;

        for (const col of parsed.columns) {
          if (col === parsed.keyCol) continue;
          const rawVal = row[col];
          const numVal = IndicatorEvaluator.parseSmartNumber(rawVal);
          if (numVal !== null) {
            observations.push({
              districtName,
              indicatorKey: col,
              numericValue: numVal,
              displayText: rawVal !== undefined && rawVal !== null ? String(rawVal) : undefined,
            });
          }
        }
      }
      return observations;
    } catch {
      return [];
    }
  }

  /**
   * Menyimpan partisi periode secara atomik ke Server Backend (utama) atau Google Drive (fallback).
   * Me-refresh daftar periode otomatis saat penyimpanan berhasil.
   */
  async savePeriodPartition(
    spec: SavePeriodPartitionSpec,
    customUrl?: string,
  ): Promise<GasSaveResult> {
    if (!customUrl && this.backendStorage?.isConfigured()) {
      const observations = this.extractObservationsFromSpec(spec);
      const backendSave = await this.backendStorage.savePeriod({
        year: spec.year,
        quarter: spec.quarter,
        rawExcelBuffer: spec.rawExcelBuffer,
        resultExcelBuffer: spec.resultExcelBuffer,
        config: spec.config,
        observations,
      });

      if (backendSave.success) {
        await this.refreshPeriods(customUrl);
        return {
          success: true,
          message: backendSave.message,
          updatedAt: backendSave.updatedAt,
        };
      }
    }

    const res = await this.gasStorage.savePeriod(
      {
        year: spec.year,
        quarter: spec.quarter,
        rawExcelBuffer: spec.rawExcelBuffer,
        resultExcelBuffer: spec.resultExcelBuffer,
        config: spec.config,
      },
      customUrl,
    );

    if (res.success) {
      await this.refreshPeriods(customUrl);
    }

    return res;
  }
}
