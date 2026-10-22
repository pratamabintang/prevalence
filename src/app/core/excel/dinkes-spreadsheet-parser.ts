import * as XLSX from 'xlsx-js-style';
import { ColumnHeaderMeta, ColumnInfo, ExcelEngine } from '../../shared/excel';
import { RegionNormalizer } from '../domain/region-normalizer';
import {
  ColumnConfig,
  ColumnTargetConfig,
  IndicatorEvaluator,
  TargetOperator,
} from '../evaluation/indicator-evaluator';
import { ExcelJoinEngine, JoinPresetExecutionSpec } from './excel-join-engine';
import { DEFAULT_JOIN_CONFIG } from '../../features/excel-join/default-join-config';

export interface ParseDinkesOptions {
  preset?: JoinPresetExecutionSpec;
  stripKabupaten?: boolean;
}

export interface ParsedDinkesDataset {
  sourceType: 'pre-joined' | 'raw-joined' | 'generic';
  sheetName: string;
  keyCol: string;
  columns: string[];
  columnsMeta: ColumnHeaderMeta[];
  regionRows: Record<string, unknown>[];
  summaryRow: Record<string, unknown> | null;
  totalRow: Record<string, unknown> | null;
  targetRow: Record<string, unknown> | null;
  columnConfigs: Record<string, ColumnConfig>;
  columnTargets: Record<string, ColumnTargetConfig>;
  sums: Record<string, boolean>;
  averages: Record<string, boolean>;
  rawWorkbook: XLSX.WorkBook;
}

/**
 * DinkesSpreadsheetParser: Modul dalam (Deep Module) untuk ingesti terpadu buku kerja Dinkes.
 * Mampu menerima ArrayBuffer maupun XLSX.WorkBook dan otomatis mengidentifikasi apakah
 * berkas berupa lembar hasil penggabungan jadi (pre-joined) atau berkas mentah multi-sheet.
 */
export class DinkesSpreadsheetParser {
  /**
   * Mendeteksi nama sheet pre-joined standar Dinkes pada workbook.
   * Hanya memeriksa ringkasan baris jika workbook memiliki tepat 1 sheet untuk mencegah
   * salah deteksi sheet mentah multi-sheet yang memiliki baris Jumlah.
   */
  static detectPreJoinedSheet(workbook: XLSX.WorkBook): string | null {
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      return null;
    }

    // 1. Cek nama sheet persis "Hasil Join" (case-insensitive)
    const exactMatch = workbook.SheetNames.find(
      (name) => name.trim().toLowerCase() === 'hasil join',
    );
    if (exactMatch) {
      return exactMatch;
    }

    // 2. Cek nama sheet yang mengandung "hasil join"
    const partialMatch = workbook.SheetNames.find((name) =>
      name.trim().toLowerCase().includes('hasil join'),
    );
    if (partialMatch) {
      return partialMatch;
    }

    // 3. Fallback HANYA untuk workbook single-sheet (misal berkas ekspor hasil rename)
    if (workbook.SheetNames.length === 1) {
      const name = workbook.SheetNames[0];
      const ws = workbook.Sheets[name];
      if (!ws) return null;
      const rawData = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
      if (!rawData || rawData.length < 10) return null;

      const headerIdx = rawData.findIndex(
        (r) =>
          Array.isArray(r) &&
          r.some((cell) => {
            const s = String(cell || '')
              .trim()
              .toLowerCase();
            return (
              s === 'kabupaten/kota' ||
              s === 'kab/kota' ||
              s === 'kabupaten' ||
              s === 'kota' ||
              s === 'wilayah' ||
              s === 'puskesmas'
            );
          }),
      );

      if (headerIdx !== -1 && headerIdx < 10) {
        const headerRow = rawData[headerIdx];
        const regionColIdx = headerRow.findIndex((cell) => {
          const s = String(cell || '')
            .trim()
            .toLowerCase();
          return (
            s === 'kabupaten/kota' ||
            s === 'kab/kota' ||
            s === 'kabupaten' ||
            s === 'kota' ||
            s === 'wilayah' ||
            s === 'puskesmas'
          );
        });

        let hasSummaryRow = false;
        for (let r = headerIdx + 1; r < rawData.length; r++) {
          const row = rawData[r];
          if (!row) continue;
          const regVal = String(row[regionColIdx] || '')
            .trim()
            .toLowerCase();
          const firstVal = String(row[0] || '')
            .trim()
            .toLowerCase();
          if (
            regVal === 'jumlah' ||
            regVal === 'total' ||
            regVal === 'rata-rata' ||
            regVal === 'rata rata' ||
            regVal === 'target' ||
            firstVal === 'jumlah' ||
            firstVal === 'total' ||
            firstVal === 'rata-rata' ||
            firstVal === 'rata rata' ||
            firstVal === 'target'
          ) {
            hasSummaryRow = true;
            break;
          }
        }

        const hasPercentIndicator = headerRow.some((col) => String(col || '').includes('%'));
        if (hasSummaryRow && hasPercentIndicator && rawData.length >= 20) {
          return name;
        }
      }
    }

    return null;
  }

  /**
   * Parsing terpadu buku kerja Excel Dinkes (baik ArrayBuffer maupun WorkBook).
   */
  static parse(
    input: XLSX.WorkBook | ArrayBuffer | Uint8Array | ArrayBufferLike,
    options?: ParseDinkesOptions,
  ): ParsedDinkesDataset {
    let workbook: XLSX.WorkBook;
    if (input instanceof ArrayBuffer) {
      workbook = ExcelEngine.readWorkbook(input);
    } else if (input instanceof Uint8Array) {
      const copy = new Uint8Array(input);
      workbook = ExcelEngine.readWorkbook(copy.buffer as ArrayBuffer);
    } else if (input && typeof input === 'object' && 'SheetNames' in input && 'Sheets' in input) {
      workbook = input as XLSX.WorkBook;
    } else {
      workbook = ExcelEngine.readWorkbook(input as unknown as ArrayBuffer);
    }

    const stripKab = options?.stripKabupaten ?? true;
    const preJoinedSheet = this.detectPreJoinedSheet(workbook);

    if (preJoinedSheet) {
      return this.extractPreJoinedSheet(workbook, preJoinedSheet, stripKab, options);
    }

    // Cek apakah buku kerja memiliki struktur raw multi-sheet Dinkes
    const isStandardRaw =
      ['remaja', 'bumil', 'gizi', 'anak', 'idl'].filter((s) =>
        workbook.SheetNames.some((sn) => sn.toLowerCase().includes(s)),
      ).length >= 2;

    if (isStandardRaw || options?.preset) {
      const preset = (options?.preset || DEFAULT_JOIN_CONFIG) as unknown as JoinPresetExecutionSpec;
      return this.executeRawMultiSheetJoin(workbook, preset, stripKab);
    }

    // Berkas generik tak dikenal
    return this.createGenericDataset(workbook);
  }

  /**
   * Ekstraksi lembar kerja hasil penggabungan standar (pre-joined).
   */
  private static extractPreJoinedSheet(
    workbook: XLSX.WorkBook,
    sheetName: string,
    stripKabupaten: boolean,
    options?: ParseDinkesOptions,
  ): ParsedDinkesDataset {
    const ws = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

    let headerRowIdx = rawData.findIndex(
      (r) =>
        Array.isArray(r) &&
        r.some((cell) => {
          const s = String(cell || '')
            .trim()
            .toLowerCase();
          return (
            s === 'kabupaten/kota' ||
            s === 'kab/kota' ||
            s === 'kabupaten' ||
            s === 'kota' ||
            s === 'wilayah' ||
            s === 'puskesmas'
          );
        }),
    );

    if (headerRowIdx === -1) headerRowIdx = 0;

    const headerRow = rawData[headerRowIdx] || [];
    let regionColIdx = headerRow.findIndex((cell) => {
      const s = String(cell || '')
        .trim()
        .toLowerCase();
      return (
        s === 'kabupaten/kota' ||
        s === 'kab/kota' ||
        s === 'kabupaten' ||
        s === 'kota' ||
        s === 'wilayah' ||
        s === 'puskesmas'
      );
    });

    if (regionColIdx === -1) regionColIdx = 1;

    const validCols: string[] = [];
    const validColIndices: number[] = [];
    const primaryRegionHeader = String(headerRow[regionColIdx] || 'Kabupaten/Kota').trim();
    validCols.push(primaryRegionHeader);
    validColIndices.push(regionColIdx);

    headerRow.forEach((col, idx) => {
      const colName = String(col || '').trim();
      if (idx !== regionColIdx && colName && !/^(no|nomor|no\.|capaian)$/i.test(colName)) {
        validCols.push(colName);
        validColIndices.push(idx);
      }
    });

    const regionRows: Record<string, unknown>[] = [];
    let rawJumlahRow: unknown[] | null = null;
    let rawRataRataRow: unknown[] | null = null;
    let rawTargetRow: unknown[] | null = null;

    for (let r = headerRowIdx + 1; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || row.length === 0) continue;

      const regVal = String(row[regionColIdx] || '')
        .trim()
        .toLowerCase();
      const firstVal = String(row[0] || '')
        .trim()
        .toLowerCase();

      if (
        regVal.includes('jumlah') ||
        regVal.includes('total') ||
        firstVal.includes('jumlah') ||
        firstVal.includes('total')
      ) {
        rawJumlahRow = row;
      } else if (
        regVal.includes('rata') ||
        regVal.includes('average') ||
        regVal.includes('mean') ||
        regVal.includes('jawa tengah') ||
        regVal.includes('provinsi') ||
        regVal.startsWith('prov') ||
        firstVal.includes('rata') ||
        firstVal.includes('average') ||
        firstVal.includes('mean') ||
        firstVal.includes('jawa tengah') ||
        firstVal.includes('provinsi') ||
        firstVal.startsWith('prov')
      ) {
        rawRataRataRow = row;
      } else if (regVal.includes('target') || firstVal.includes('target')) {
        rawTargetRow = row;
      } else {
        if (!regVal || regVal === '-') continue;

        const rowObj: Record<string, unknown> = {
          __id: `row-${r - (headerRowIdx + 1)}`,
        };
        validCols.forEach((colName, cIdx) => {
          const cellVal = row[validColIndices[cIdx]];
          if (cIdx === 0) {
            const rawStr = String(cellVal ?? '').trim();
            rowObj[colName] = stripKabupaten
              ? RegionNormalizer.cleanKabupatenPrefix(rawStr)
              : RegionNormalizer.cleanCodePrefix(rawStr);
          } else {
            if (cellVal !== undefined && cellVal !== null && cellVal !== '-' && cellVal !== '') {
              if (typeof cellVal === 'number') {
                rowObj[colName] = cellVal;
              } else {
                const parsed = IndicatorEvaluator.parseSmartNumber(cellVal);
                rowObj[colName] = parsed !== null ? parsed : cellVal;
              }
            } else {
              rowObj[colName] = null;
            }
          }
        });
        regionRows.push(rowObj);
      }
    }

    const configs: Record<string, ColumnConfig> = {};
    const targets: Record<string, ColumnTargetConfig> = {};
    const sums: Record<string, boolean> = {};
    const avgs: Record<string, boolean> = {};
    const totalRow: Record<string, unknown> = { [primaryRegionHeader]: 'Jumlah' };
    const summaryRow: Record<string, unknown> = { [primaryRegionHeader]: 'Rata-rata' };
    const targetRow: Record<string, unknown> = { [primaryRegionHeader]: 'Target' };

    validCols.forEach((colName, cIdx) => {
      if (cIdx === 0) {
        configs[colName] = {
          dataType: 'string',
          anomalyEnabled: false,
          minAnomaly: null,
          maxAnomaly: null,
        };
        sums[colName] = false;
        avgs[colName] = false;
        targets[colName] = { operator: '>=', value: null, enabled: false };
      } else {
        const isPercent = colName.includes('%');
        configs[colName] = {
          dataType: isPercent ? 'percentage' : 'number',
          anomalyEnabled: false,
          minAnomaly: null,
          maxAnomaly: null,
        };
        sums[colName] = !isPercent;
        avgs[colName] = isPercent;

        let targetParsed: ColumnTargetConfig = { operator: '>=', value: null, enabled: false };
        if (rawTargetRow) {
          const targetCell = String(rawTargetRow[validColIndices[cIdx]] ?? '').trim();
          targetRow[colName] = targetCell || null;
          const targetMatch = targetCell.match(/^([><]=?|=)?\s*([0-9]+(?:[.,][0-9]+)?)$/);
          if (targetMatch) {
            let op: TargetOperator = '>=';
            if (
              targetMatch[1] === '<=' ||
              targetMatch[1] === '>=' ||
              targetMatch[1] === '<' ||
              targetMatch[1] === '>'
            ) {
              op = targetMatch[1];
            } else if (targetMatch[1] === '=' || targetMatch[1] === '==') {
              op = '==';
            }
            const numStr = targetMatch[2].replace(',', '.');
            targetParsed = {
              operator: op,
              value: parseFloat(numStr),
              enabled: true,
            };
          }
        }

        if (!targetParsed.enabled && options?.preset?.columnTargets) {
          const cfgTarget =
            options.preset.columnTargets[colName] ??
            Object.entries(options.preset.columnTargets).find(
              ([k]) => ExcelJoinEngine.normalizeKey(k) === ExcelJoinEngine.normalizeKey(colName),
            )?.[1];
          if (cfgTarget && cfgTarget.enabled !== false && cfgTarget.value !== null) {
            targetParsed = cfgTarget;
            if (!targetRow[colName]) {
              targetRow[colName] = cfgTarget.operator
                ? `${cfgTarget.operator} ${cfgTarget.value}`
                : String(cfgTarget.value);
            }
          }
        }

        targets[colName] = targetParsed;

        if (rawJumlahRow) {
          const jVal = rawJumlahRow[validColIndices[cIdx]];
          totalRow[colName] =
            typeof jVal === 'number' ? jVal : IndicatorEvaluator.parseSmartNumber(jVal);
        }
        if (rawRataRataRow) {
          const rVal = rawRataRataRow[validColIndices[cIdx]];
          summaryRow[colName] =
            typeof rVal === 'number' ? rVal : IndicatorEvaluator.parseSmartNumber(rVal);
        }
      }
    });

    const columnsMeta: ColumnHeaderMeta[] = validCols.map((c) => ({
      key: c,
      layers: [c],
    }));

    return {
      sourceType: 'pre-joined',
      sheetName,
      keyCol: primaryRegionHeader,
      columns: validCols,
      columnsMeta,
      regionRows,
      summaryRow: rawRataRataRow ? summaryRow : null,
      totalRow: rawJumlahRow ? totalRow : null,
      targetRow: rawTargetRow ? targetRow : null,
      columnConfigs: configs,
      columnTargets: targets,
      sums,
      averages: avgs,
      rawWorkbook: workbook,
    };
  }

  /**
   * Eksekusi penggabungan otomatis untuk berkas mentah multi-sheet standar Dinkes.
   */
  private static executeRawMultiSheetJoin(
    workbook: XLSX.WorkBook,
    preset: JoinPresetExecutionSpec,
    stripKabupaten: boolean,
  ): ParsedDinkesDataset {
    const joined = ExcelJoinEngine.executeJoinFromPreset(workbook, {
      ...preset,
      stripKabupaten,
    });

    const keyCol = joined.keyCol || 'Kabupaten/Kota';
    const columns = joined.columns;
    const columnsMeta: ColumnHeaderMeta[] = columns.map((c) => ({ key: c, layers: [c] }));

    const configs: Record<string, ColumnConfig> = {};
    const targets: Record<string, ColumnTargetConfig> = {};
    const sums: Record<string, boolean> = {};
    const avgs: Record<string, boolean> = {};

    columns.forEach((col, idx) => {
      if (idx === 0 || col === keyCol) {
        configs[col] = {
          dataType: 'string',
          anomalyEnabled: false,
          minAnomaly: null,
          maxAnomaly: null,
        };
        sums[col] = false;
        avgs[col] = false;
        targets[col] = { operator: '>=', value: null, enabled: false };
      } else {
        const isPercent = col.includes('%');
        configs[col] = {
          dataType: isPercent ? 'percentage' : 'number',
          anomalyEnabled: false,
          minAnomaly: null,
          maxAnomaly: null,
        };
        sums[col] = preset.sumColumns?.[col] ?? !isPercent;
        avgs[col] = preset.avgColumns?.[col] ?? isPercent;
        targets[col] = preset.columnTargets?.[col] ?? {
          operator: '>=',
          value: null,
          enabled: false,
        };
      }
    });

    // Hitung baris ringkasan sintetis jika belum ada dari hasil join
    const totalRow: Record<string, unknown> = joined.totalRow || { [keyCol]: 'Jumlah' };
    const summaryRow: Record<string, unknown> = joined.summaryRow || { [keyCol]: 'Rata-rata' };
    const targetRow: Record<string, unknown> = joined.targetRow || { [keyCol]: 'Target' };

    for (const col of columns) {
      if (col === keyCol) continue;
      if (sums[col] && totalRow[col] === undefined) {
        const sumVal = IndicatorEvaluator.calculateColumnSum(joined.rows, col);
        totalRow[col] = sumVal !== null ? sumVal : null;
      }
      if (avgs[col] && summaryRow[col] === undefined) {
        const avgVal = IndicatorEvaluator.calculateColumnAverage(joined.rows, col);
        summaryRow[col] = avgVal !== null ? avgVal : null;
      }
      if (targetRow[col] === undefined && targets[col]?.enabled && targets[col]?.value !== null) {
        targetRow[col] = `${targets[col].operator} ${targets[col].value}`;
      }
    }

    return {
      sourceType: 'raw-joined',
      sheetName: 'Hasil Join',
      keyCol,
      columns,
      columnsMeta,
      regionRows: joined.rows,
      summaryRow,
      totalRow,
      targetRow,
      columnConfigs: configs,
      columnTargets: targets,
      sums,
      averages: avgs,
      rawWorkbook: workbook,
    };
  }

  private static createGenericDataset(workbook: XLSX.WorkBook): ParsedDinkesDataset {
    const sheetName = workbook.SheetNames[0] || 'Sheet1';
    return {
      sourceType: 'generic',
      sheetName,
      keyCol: 'Kabupaten/Kota',
      columns: [],
      columnsMeta: [],
      regionRows: [],
      summaryRow: null,
      totalRow: null,
      targetRow: null,
      columnConfigs: {},
      columnTargets: {},
      sums: {},
      averages: {},
      rawWorkbook: workbook,
    };
  }
}
