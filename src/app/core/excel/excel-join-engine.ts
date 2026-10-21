import * as XLSX from 'xlsx-js-style';
import {
  ColumnHeaderMeta,
  ColumnInfo,
  ExcelEngine,
  HeaderGridCell,
  StyledExportSpec,
  SummaryRowSpec,
} from '../../shared/excel';
import { RegionNormalizer } from '../domain/region-normalizer';
import { ExcelResilientMatcher } from './excel-resilient-matcher';
import {
  CapaianSummary,
  ColumnConfig,
  ColumnDataType,
  ColumnTargetConfig,
  IndicatorEvaluator,
} from '../evaluation/indicator-evaluator';

export interface JoinPresetSheetInput {
  sheetName: string;
  headerStartRow?: number;
  headerEndRow?: number;
  dataStartRow?: number;
  joinColumn?: string;
  variables: string[];
}

export interface JoinPresetExecutionSpec {
  sheets: JoinPresetSheetInput[];
  joinBy?: string;
  stripKabupaten?: boolean;
  outputHeaderFormat?: 'full' | 'concat';
  includeSheetPrefix?: boolean;
  customColumnNames?: Record<string, string>;
  columnTargets?: Record<string, ColumnTargetConfig>;
  columnConfigs?: Record<string, ColumnConfig>;
  sumColumns?: Record<string, boolean>;
  avgColumns?: Record<string, boolean>;
  enableJumlah?: boolean;
  enableAverage?: boolean;
  enableTarget?: boolean;
}

export interface JoinedDatasetResult {
  rows: Record<string, unknown>[];
  columns: string[];
  keyCol: string;
  summaryRow: Record<string, unknown> | null;
  targetRow: Record<string, unknown> | null;
  totalRow: Record<string, unknown> | null;
}

export interface JoinSheetInput {
  name: string;
  columns: ColumnInfo[];
  headers: string[];
  selected: boolean;
  variables: string[];
  joinColumn?: string;
  dataStartRow: number;
}

export interface JoinExecutionSpec {
  workbook: XLSX.WorkBook;
  selectedSheets: JoinSheetInput[];
  joinBy?: string;
  stripKabupaten?: boolean;
  outputHeaderFormat?: 'full' | 'concat';
  includeSheetPrefix?: boolean;
  previousColumnOrder?: string[];
}

export interface JoinExecutionResult {
  rows: Record<string, unknown>[];
  columns: string[];
  columnsMeta: ColumnHeaderMeta[];
  defaultColumns: string[];
  defaultColumnsMeta: ColumnHeaderMeta[];
}

export interface JoinExportSpec {
  fileName?: string;
  sheetName?: string;
  resultRows: Record<string, unknown>[];
  resultColumns: string[];
  resultColumnsMeta: ColumnHeaderMeta[];
  customColumnNames?: Record<string, string>;
  outputHeaderFormat?: 'full' | 'concat';
  columnConfigs?: Record<string, ColumnConfig>;
  enableJumlah?: boolean;
  sumColumns?: Record<string, boolean>;
  enableAverage?: boolean;
  avgColumns?: Record<string, boolean>;
  enableTarget?: boolean;
  columnTargets?: Record<string, ColumnTargetConfig>;
  enableCapaian?: boolean;
}

/**
 * ExcelJoinEngine: Modul domain dalam (Deep Module) yang bertanggung jawab atas
 * eksekusi relasional Left Join multi-sheet, pemetaan metadata hierarki header,
 * normalisasi wilayah, dan pembuatan buku kerja Excel ber-styling untuk ekspor.
 */
export class ExcelJoinEngine {
  /**
   * Menormalkan string kunci untuk perbandingan insensitive spasi & huruf besar/kecil.
   */
  static normalizeKey(key: string): string {
    return key.trim().toLowerCase().replace(/\s+/g, '_');
  }

  /**
   * Menemukan nama header aktual yang cocok dengan kunci target.
   */
  static findHeader(headers: string[], key?: string): string | undefined {
    if (!key) return undefined;
    const normKey = this.normalizeKey(key);
    return headers.find((h) => this.normalizeKey(h) === normKey);
  }

  /**
   * Memeriksa apakah nilai sel kosong atau tanda strip tanpa makna.
   */
  static isEmptyValue(value: unknown): boolean {
    return value === null || value === undefined || String(value).trim() === '';
  }

  /**
   * Mendapatkan nama kolom output untuk suatu variabel sheet.
   */
  static getOutputColumnName(
    sheet: JoinSheetInput,
    variable: string,
    includeSheetPrefix = false,
  ): string {
    return includeSheetPrefix ? `${sheet.name} - ${variable}` : variable;
  }

  /**
   * Mengeksekusi Left Join relasional di antara kumpulan sheet terpilih.
   */
  static executeJoin(spec: JoinExecutionSpec): JoinExecutionResult {
    const {
      workbook,
      selectedSheets,
      joinBy = '',
      stripKabupaten = true,
      outputHeaderFormat = 'full',
      includeSheetPrefix = false,
      previousColumnOrder = [],
    } = spec;

    if (!workbook || selectedSheets.length < 2) {
      return {
        rows: [],
        columns: [],
        columnsMeta: [],
        defaultColumns: [],
        defaultColumnsMeta: [],
      };
    }

    const masterSheet = selectedSheets[0];
    const masterWorksheet = workbook.Sheets[masterSheet.name];
    if (!masterWorksheet) {
      throw new Error(`Sheet utama "${masterSheet.name}" tidak ditemukan di file Excel.`);
    }

    const masterRows = ExcelEngine.readSheetRows(
      masterWorksheet,
      masterSheet.columns,
      masterSheet.dataStartRow,
    );

    const masterJoinColKey = masterSheet.joinColumn || joinBy;
    const masterJoinHeader =
      this.findHeader(masterSheet.headers, masterJoinColKey) || masterJoinColKey;

    if (!masterJoinHeader) {
      throw new Error(`Kolom join tidak ditentukan untuk sheet "${masterSheet.name}".`);
    }

    const outputColMap = new Map<string, string>();
    const outputMetaList: ColumnHeaderMeta[] = [];
    const usedOutputNames = new Map<string, number>();

    const joinByOutputName = masterJoinHeader;
    usedOutputNames.set(this.normalizeKey(joinByOutputName), 1);

    const masterJoinCol = masterSheet.columns.find((c) => c.header === masterJoinHeader);
    const joinKeyLayers =
      masterJoinCol && masterJoinCol.layers && masterJoinCol.layers.length > 0
        ? masterJoinCol.layers
        : [joinByOutputName];

    outputMetaList.push({
      key: joinByOutputName,
      layers: outputHeaderFormat === 'concat' ? [joinKeyLayers.join(' - ')] : joinKeyLayers,
    });

    // 1. Kolom dari Master Sheet
    for (const variable of masterSheet.variables) {
      const rawName = this.getOutputColumnName(masterSheet, variable, includeSheetPrefix);
      let finalName = rawName;
      const norm = this.normalizeKey(rawName);
      const count = usedOutputNames.get(norm) || 0;
      if (count > 0) {
        finalName = `${rawName} (${masterSheet.name})`;
      }
      usedOutputNames.set(norm, count + 1);
      outputColMap.set(`${masterSheet.name}:::${variable}`, finalName);

      const col = masterSheet.columns.find((c) => c.header === variable);
      let layers = col && col.layers && col.layers.length > 0 ? [...col.layers] : [variable];
      if (outputHeaderFormat === 'concat') {
        const fullConcat = layers.join(' - ');
        const finalConcat = includeSheetPrefix ? `${masterSheet.name} - ${fullConcat}` : fullConcat;
        layers = [count > 0 ? `${finalConcat} (${masterSheet.name})` : finalConcat];
      } else {
        if (includeSheetPrefix) {
          layers = [masterSheet.name, ...layers];
        }
        if (count > 0) {
          layers[layers.length - 1] = `${layers[layers.length - 1]} (${masterSheet.name})`;
        }
      }

      outputMetaList.push({
        key: finalName,
        layers,
      });
    }

    // 2. Kolom dari Sheet Sekunder
    for (let index = 1; index < selectedSheets.length; index++) {
      const sheet = selectedSheets[index];
      for (const variable of sheet.variables) {
        const rawName = this.getOutputColumnName(sheet, variable, includeSheetPrefix);
        let finalName = rawName;
        const norm = this.normalizeKey(rawName);
        const count = usedOutputNames.get(norm) || 0;
        if (count > 0) {
          finalName = `${rawName} (${sheet.name})`;
        }
        usedOutputNames.set(norm, count + 1);
        outputColMap.set(`${sheet.name}:::${variable}`, finalName);

        const col = sheet.columns.find((c) => c.header === variable);
        let layers = col && col.layers && col.layers.length > 0 ? [...col.layers] : [variable];
        if (outputHeaderFormat === 'concat') {
          const fullConcat = layers.join(' - ');
          const finalConcat = includeSheetPrefix ? `${sheet.name} - ${fullConcat}` : fullConcat;
          layers = [count > 0 ? `${finalConcat} (${sheet.name})` : finalConcat];
        } else {
          if (includeSheetPrefix) {
            layers = [sheet.name, ...layers];
          }
          if (count > 0) {
            layers[layers.length - 1] = `${layers[layers.length - 1]} (${sheet.name})`;
          }
        }

        outputMetaList.push({
          key: finalName,
          layers,
        });
      }
    }

    const allOutputCols = outputMetaList.map((m) => m.key);
    const joinedMap = new Map<string, Record<string, unknown>>();

    // 3. Baca Master Rows
    for (const row of masterRows) {
      const joinValue = row[masterJoinHeader];
      if (this.isEmptyValue(joinValue)) {
        continue;
      }

      const key = RegionNormalizer.normalizeJoinKey(joinValue, stripKabupaten);
      const displayJoinValue = stripKabupaten
        ? RegionNormalizer.cleanKabupatenPrefix(joinValue)
        : RegionNormalizer.cleanCodePrefix(joinValue);

      const result: Record<string, unknown> = {
        [joinByOutputName]: displayJoinValue,
      };

      for (const col of allOutputCols) {
        if (col !== joinByOutputName) {
          result[col] = null;
        }
      }

      for (const variable of masterSheet.variables) {
        const actualHeader = this.findHeader(masterSheet.headers, variable);
        if (!actualHeader) {
          continue;
        }
        const outCol = outputColMap.get(`${masterSheet.name}:::${variable}`) || variable;
        result[outCol] = row[actualHeader] ?? null;
      }

      joinedMap.set(key, result);
    }

    // 4. Left Join Sheet Sekunder
    for (let index = 1; index < selectedSheets.length; index++) {
      const sheet = selectedSheets[index];
      const worksheet = workbook.Sheets[sheet.name];
      if (!worksheet) continue;

      const rows = ExcelEngine.readSheetRows(worksheet, sheet.columns, sheet.dataStartRow);
      const sheetJoinColKey = sheet.joinColumn || joinBy;
      const joinHeader =
        this.findHeader(sheet.headers, sheetJoinColKey) || sheetJoinColKey;

      if (!joinHeader) {
        continue;
      }

      for (const row of rows) {
        const joinValue = row[joinHeader];
        if (this.isEmptyValue(joinValue)) {
          continue;
        }

        const key = RegionNormalizer.normalizeJoinKey(joinValue, stripKabupaten);
        const existing = joinedMap.get(key);
        if (!existing) {
          continue;
        }

        for (const variable of sheet.variables) {
          const actualHeader = this.findHeader(sheet.headers, variable);
          if (!actualHeader) {
            continue;
          }
          const outCol = outputColMap.get(`${sheet.name}:::${variable}`) || variable;
          existing[outCol] = row[actualHeader] ?? null;
        }
      }
    }

    const rows = Array.from(joinedMap.values());
    const naturalCols = [...allOutputCols];
    const defaultColumns = [...naturalCols];
    const defaultColumnsMeta = [...outputMetaList];

    let finalCols = naturalCols;
    let finalMeta = outputMetaList;

    // 5. Pertahankan urutan kolom yang sudah ada jika ada penambahan kolom baru
    if (previousColumnOrder.length > 0) {
      const metaMap = new Map(outputMetaList.map((m) => [m.key, m]));
      const orderedCols: string[] = [];
      const orderedMeta: ColumnHeaderMeta[] = [];

      for (const col of previousColumnOrder) {
        if (naturalCols.includes(col)) {
          orderedCols.push(col);
          const m = metaMap.get(col);
          if (m) orderedMeta.push(m);
        }
      }
      for (const col of naturalCols) {
        if (!orderedCols.includes(col)) {
          orderedCols.push(col);
          const m = metaMap.get(col);
          if (m) orderedMeta.push(m);
        }
      }

      if (orderedCols.length > 0) {
        finalCols = orderedCols;
        finalMeta = orderedMeta;
      }
    }

    return {
      rows,
      columns: finalCols,
      columnsMeta: finalMeta,
      defaultColumns,
      defaultColumnsMeta,
    };
  }

  /**
   * Menyusun StyledExportSpec lengkap dari data hasil penggabungan tabel.
   */
  static buildJoinedStyledSpec(spec: JoinExportSpec): StyledExportSpec | null {
    const {
      fileName = `Hasil_Join_Excel_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName = 'Hasil Join',
      resultRows,
      resultColumns,
      resultColumnsMeta,
      customColumnNames = {},
      outputHeaderFormat = 'full',
      columnConfigs = {},
      enableJumlah = false,
      sumColumns = {},
      enableAverage = false,
      avgColumns = {},
      enableTarget = false,
      columnTargets = {},
      enableCapaian = false,
    } = spec;

    if (resultRows.length === 0 || resultColumns.length === 0) {
      return null;
    }

    const isConcat = outputHeaderFormat === 'concat';

    const processedMeta: ColumnHeaderMeta[] = resultColumnsMeta.map((m) => {
      const custom = customColumnNames[m.key]?.trim();
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

    const excelCols: ColumnHeaderMeta[] = [
      { key: 'No', layers: ['No'] },
      ...processedMeta,
    ];

    if (enableTarget && enableCapaian) {
      excelCols.push({ key: 'Capaian', layers: ['Capaian'] });
    }

    const dataRows = resultRows.map((row, i) => {
      const rowValues: Record<string, unknown> = {};
      for (const col of excelCols) {
        if (col.key === 'No') {
          rowValues['No'] = i + 1;
        } else if (col.key === 'Capaian') {
          rowValues['Capaian'] = IndicatorEvaluator.calculateRowCapaian(
            row,
            resultColumns,
            columnTargets,
            columnConfigs,
          );
        } else {
          const cfg = columnConfigs[col.key];
          const rawVal = row[col.key];
          if (cfg?.dataType === 'string') {
            rowValues[col.key] = rawVal !== null && rawVal !== undefined ? String(rawVal) : '';
          } else {
            const num = IndicatorEvaluator.parseSmartNumber(rawVal);
            rowValues[col.key] = num !== null ? num : (rawVal ?? '');
          }
        }
      }
      return rowValues;
    });

    const summaryRows: SummaryRowSpec[] = [];

    // 1. Baris Ringkasan: Jumlah
    if (enableJumlah) {
      const jumlahValues: Record<string, unknown> = {};
      for (let c = 0; c < excelCols.length; c++) {
        const col = excelCols[c];
        if (col.key === 'No') {
          jumlahValues['No'] = '-';
        } else if (c === 1) {
          jumlahValues[col.key] = 'Jumlah';
        } else if (col.key === 'Capaian') {
          jumlahValues['Capaian'] = '-';
        } else {
          if (sumColumns[col.key]) {
            const sum = IndicatorEvaluator.calculateColumnSum(resultRows, col.key);
            jumlahValues[col.key] = sum !== null ? sum : '-';
          } else {
            jumlahValues[col.key] = '-';
          }
        }
      }
      summaryRows.push({
        values: jumlahValues,
        styler: (_colKey, _val, colIdx) => ({
          font: { bold: true, color: { rgb: '065F46' }, sz: 10 },
          fill: { fgColor: { rgb: 'ECFDF5' } },
          alignment: {
            horizontal: colIdx === 1 ? 'left' : 'center',
            vertical: 'center',
          },
        }),
      });
    }

    // 2. Baris Ringkasan: Rata-rata
    if (enableAverage) {
      const avgValues: Record<string, unknown> = {};
      for (let c = 0; c < excelCols.length; c++) {
        const col = excelCols[c];
        if (col.key === 'No') {
          avgValues['No'] = '-';
        } else if (c === 1) {
          avgValues[col.key] = 'Rata-rata';
        } else if (col.key === 'Capaian') {
          avgValues['Capaian'] = '-';
        } else {
          if (avgColumns[col.key]) {
            const avg = IndicatorEvaluator.calculateColumnAverage(resultRows, col.key);
            avgValues[col.key] = avg !== null ? avg : '-';
          } else {
            avgValues[col.key] = '-';
          }
        }
      }
      summaryRows.push({
        values: avgValues,
        styler: (_colKey, _val, colIdx) => ({
          font: { bold: true, color: { rgb: '0369A1' }, sz: 10 },
          fill: { fgColor: { rgb: 'F0F9FF' } },
          alignment: {
            horizontal: colIdx === 1 ? 'left' : 'center',
            vertical: 'center',
          },
        }),
      });
    }

    // 3. Baris Ringkasan: Target
    if (enableTarget) {
      const targetValues: Record<string, unknown> = {};
      let activeTargetCount = 0;

      for (const col of resultColumns) {
        if (columnConfigs[col]?.dataType !== 'string' && columnTargets[col]?.enabled && columnTargets[col]?.value !== null) {
          activeTargetCount++;
        }
      }

      for (let c = 0; c < excelCols.length; c++) {
        const col = excelCols[c];
        if (col.key === 'No') {
          targetValues['No'] = '-';
        } else if (c === 1) {
          targetValues[col.key] = 'Target';
        } else if (col.key === 'Capaian') {
          targetValues['Capaian'] = activeTargetCount;
        } else {
          const cfg = columnConfigs[col.key];
          if (cfg?.dataType === 'string') {
            targetValues[col.key] = '-';
          } else {
            const t = columnTargets[col.key];
            if (t && t.enabled && t.value !== null) {
              targetValues[col.key] = `${t.operator} ${t.value}`;
            } else {
              targetValues[col.key] = '-';
            }
          }
        }
      }

      summaryRows.push({
        values: targetValues,
        styler: (_colKey, _val, colIdx) => ({
          font: { bold: true, color: { rgb: '3730A3' }, sz: 10 },
          fill: { fgColor: { rgb: 'EEF2FF' } },
          alignment: {
            horizontal: colIdx === 1 ? 'left' : 'center',
            vertical: 'center',
          },
        }),
      });
    }

    const stats: CapaianSummary = IndicatorEvaluator.calculateCapaianStats(
      resultRows,
      resultColumns,
      columnTargets,
      columnConfigs,
      enableTarget,
      enableCapaian,
    );

    return {
      fileName,
      sheetName,
      columns: excelCols,
      dataRows,
      summaryRows,
      cellStyler: (_row, colKey, val, colIndex) => {
        if (colKey === 'No') {
          return {
            font: { color: { rgb: '475569' }, sz: 10, bold: true },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }

        if (colKey === 'Capaian') {
          const valNum = typeof val === 'number' ? val : parseFloat(String(val));
          let fillRgb = '';
          let fontRgb = '334155';

          if (!isNaN(valNum) && stats.min !== null && stats.max !== null && stats.min !== stats.max) {
            if (valNum === stats.max) {
              fillRgb = 'DBEAFE';
              fontRgb = '1E40AF';
            } else if (valNum === stats.min) {
              fillRgb = 'FEE2E2';
              fontRgb = '991B1B';
            }
          }

          return {
            font: { color: { rgb: fontRgb }, sz: 10, bold: true },
            fill: fillRgb ? { fgColor: { rgb: fillRgb } } : undefined,
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }

        const cfg = columnConfigs[colKey];
        const isStringCol = cfg?.dataType === 'string';
        const num = IndicatorEvaluator.parseSmartNumber(val);
        let fillRgb = '';
        let fontRgb = '334155';

        if (!isStringCol && num !== null) {
          if (cfg?.anomalyEnabled) {
            const min = cfg.minAnomaly ?? 0;
            const max = cfg.maxAnomaly ?? 100;
            if (num < min || num > max) {
              fillRgb = 'FEE2E2';
              fontRgb = '991B1B';
            }
          }

          if (!fillRgb && enableTarget) {
            const target = columnTargets[colKey];
            if (target && target.enabled && target.value !== null) {
              if (IndicatorEvaluator.isTargetAchieved(val, target)) {
                fillRgb = 'D1FAE5';
                fontRgb = '065F46';
              } else {
                fillRgb = 'FEF3C7';
                fontRgb = '92400E';
              }
            }
          }
        }

        let numFmt: string | undefined = undefined;
        if (cfg?.dataType === 'percentage' && typeof val === 'number') {
          numFmt = '0.0"%"';
        }

        const isTextCol = colIndex === 1 || isStringCol;

        return {
          font: { color: { rgb: fontRgb }, sz: 10, bold: fillRgb !== '' },
          fill: fillRgb ? { fgColor: { rgb: fillRgb } } : undefined,
          alignment: {
            horizontal: isTextCol ? 'left' : 'center',
            vertical: 'center',
          },
          numFmt,
        };
      },
    };
  }

  /**
   * Menghasilkan WorkBook Excel ber-styling lengkap dari hasil penggabungan tabel (tanpa memicu unduh file).
   */
  static buildJoinedWorkbook(spec: JoinExportSpec): XLSX.WorkBook | null {
    const styledSpec = this.buildJoinedStyledSpec(spec);
    if (!styledSpec) return null;
    return ExcelEngine.buildStyledWorkbook(styledSpec);
  }

  /**
   * Mengonversi hasil penggabungan tabel ber-styling menjadi ArrayBuffer biner.
   */
  static buildJoinedBuffer(spec: JoinExportSpec): ArrayBuffer | null {
    const styledSpec = this.buildJoinedStyledSpec(spec);
    if (!styledSpec) return null;
    const workbook = ExcelEngine.buildStyledWorkbook(styledSpec);
    return ExcelEngine.writeWorkbookToBuffer(workbook);
  }

  /**
   * Menghasilkan buku kerja Excel ber-styling lengkap dengan baris ringkasan dan unduh.
   */
  static exportJoinedWorkbook(spec: JoinExportSpec): void {
    const styledSpec = this.buildJoinedStyledSpec(spec);
    if (!styledSpec) return;
    ExcelEngine.exportStyledTable(styledSpec);
  }

  /**
   * Mengeksekusi left join pada workbook menggunakan konfigurasi preset secara otomatis,
   * menerapkan kustomisasi nama kolom (customColumnNames), dan menghasilkan baris ringkasan
   * (Jumlah / totalRow, Rata-rata / summaryRow, Target / targetRow).
   */
  static executeJoinFromPreset(
    workbook: XLSX.WorkBook,
    preset: JoinPresetExecutionSpec,
  ): JoinedDatasetResult {
    if (!workbook || !preset || !Array.isArray(preset.sheets) || preset.sheets.length === 0) {
      return {
        rows: [],
        columns: [],
        keyCol: 'Kabupaten/Kota',
        summaryRow: null,
        targetRow: null,
        totalRow: null,
      };
    }

    const availableSheetNames = [...workbook.SheetNames];
    const matchedSheetMap = ExcelResilientMatcher.matchSheets(
      availableSheetNames,
      preset.sheets,
    );

    const selectedSheets: JoinSheetInput[] = [];

    for (const ps of preset.sheets) {
      const matchedName = availableSheetNames.find(
        (name) => matchedSheetMap.get(name) === ps,
      );
      if (!matchedName) continue;

      const ws = workbook.Sheets[matchedName];
      if (!ws) continue;

      const struct = ExcelEngine.detectSheetStructure(ws);
      const hStart = ps.headerStartRow ?? struct.headerStartRow;
      const hEnd = ps.headerEndRow ?? struct.headerEndRow;
      const dStart = ps.dataStartRow ?? struct.dataStartRow;

      const cols = ExcelEngine.extractSheetColumns(ws, hStart, hEnd);
      const selectedVars: string[] = [];

      if (ps.variables && ps.variables.length > 0) {
        for (const pv of ps.variables) {
          const m = ExcelResilientMatcher.findMatchingHeader(pv, cols);
          if (m) selectedVars.push(m);
        }
      }

      const defaultJoin =
        cols.find((c) => /kabupaten|kota|wilayah|puskesmas/i.test(c.header))?.header ||
        cols[0]?.header ||
        'Kabupaten/Kota';
      let joinCol = defaultJoin;
      if (ps.joinColumn) {
        joinCol = ExcelResilientMatcher.findMatchingHeader(ps.joinColumn, cols) || ps.joinColumn;
      } else if (preset.joinBy) {
        joinCol = ExcelResilientMatcher.findMatchingHeader(preset.joinBy, cols) || defaultJoin;
      }

      selectedSheets.push({
        name: matchedName,
        columns: cols,
        headers: cols.map((c) => c.header),
        selected: true,
        variables:
          selectedVars.length > 0
            ? selectedVars
            : cols.map((c) => c.header).filter((h) => h !== joinCol),
        joinColumn: joinCol,
        dataStartRow: dStart,
      });
    }

    if (selectedSheets.length === 0) {
      return {
        rows: [],
        columns: [],
        keyCol: 'Kabupaten/Kota',
        summaryRow: null,
        targetRow: null,
        totalRow: null,
      };
    }

    let rawRows: Record<string, unknown>[] = [];
    let rawCols: string[] = [];

    if (selectedSheets.length === 1) {
      const single = selectedSheets[0];
      const ws = workbook.Sheets[single.name];
      rawRows = ExcelEngine.readSheetRows(ws, single.columns, single.dataStartRow);
      rawCols = single.columns.map((c) => c.header);
    } else {
      const joinResult = this.executeJoin({
        workbook,
        selectedSheets,
        joinBy: preset.joinBy || 'Kabupaten/Kota',
        stripKabupaten: preset.stripKabupaten ?? true,
        outputHeaderFormat: preset.outputHeaderFormat ?? 'full',
        includeSheetPrefix: preset.includeSheetPrefix ?? false,
      });
      rawRows = joinResult.rows;
      rawCols = joinResult.columns;
    }

    const rawKeyCol =
      rawCols.find((c) => /kabupaten|kota|wilayah|puskesmas/i.test(c)) ||
      rawCols[0] ||
      'Kabupaten/Kota';

    const resolveName = (col: string): string => {
      if (preset.customColumnNames && preset.customColumnNames[col]) {
        return preset.customColumnNames[col];
      }
      return col;
    };

    const finalKeyCol = resolveName(rawKeyCol);
    const finalCols = rawCols.map((c) => resolveName(c));

    const finalRows: Record<string, unknown>[] = rawRows.map((r, idx) => {
      const rowObj: Record<string, unknown> = {
        __id: String(r['__id'] ?? `row-${idx}`),
      };
      for (const col of rawCols) {
        rowObj[resolveName(col)] = r[col];
      }
      if (
        preset.stripKabupaten !== false &&
        rowObj[finalKeyCol] &&
        typeof rowObj[finalKeyCol] === 'string'
      ) {
        rowObj[finalKeyCol] = RegionNormalizer.cleanKabupatenPrefix(
          rowObj[finalKeyCol] as string,
        );
      }
      return rowObj;
    });

    const regionRows: Record<string, unknown>[] = [];
    let detectedSummaryRow: Record<string, unknown> | null = null;
    let detectedTargetRow: Record<string, unknown> | null = null;
    let detectedTotalRow: Record<string, unknown> | null = null;

    for (const r of finalRows) {
      const keyVal = String(r[finalKeyCol] ?? '').trim().toUpperCase();
      if (!keyVal) continue;

      if (keyVal.includes('TARGET')) {
        detectedTargetRow = r;
      } else if (
        keyVal.includes('RATA') ||
        keyVal.includes('AVERAGE') ||
        keyVal.includes('JAWA TENGAH') ||
        keyVal.includes('PROVINSI') ||
        keyVal.startsWith('PROV')
      ) {
        detectedSummaryRow = r;
      } else if (keyVal.includes('TOTAL') || keyVal.includes('JUMLAH')) {
        detectedTotalRow = r;
      } else {
        regionRows.push(r);
      }
    }

    // Bangun Total Row jika belum ada
    if (!detectedTotalRow && (preset.enableJumlah !== false || preset.sumColumns)) {
      const sumObj: Record<string, unknown> = {
        __id: 'row-total-preset',
        [finalKeyCol]: 'Jumlah',
      };
      let hasAnySum = false;
      for (const col of rawCols) {
        const finalC = resolveName(col);
        if (finalC === finalKeyCol) continue;
        const isSum =
          preset.sumColumns?.[col] ??
          preset.sumColumns?.[finalC] ??
          (!finalC.includes('%') && /kasus|jumlah|rematri|bumil|balita|bayi/i.test(finalC));
        if (isSum) {
          const nums = regionRows
            .map((r) => IndicatorEvaluator.parseSmartNumber(r[finalC]))
            .filter((n): n is number => n !== null);
          if (nums.length > 0) {
            sumObj[finalC] = nums.reduce((a, b) => a + b, 0);
            hasAnySum = true;
          }
        }
      }
      if (hasAnySum) detectedTotalRow = sumObj;
    }

    // Bangun Summary Row (Rata-rata) jika belum ada
    if (!detectedSummaryRow && (preset.enableAverage !== false || preset.avgColumns)) {
      const avgObj: Record<string, unknown> = {
        __id: 'row-avg-preset',
        [finalKeyCol]: 'Rata-rata',
      };
      let hasAnyAvg = false;
      for (const col of rawCols) {
        const finalC = resolveName(col);
        if (finalC === finalKeyCol) continue;
        const isAvg =
          preset.avgColumns?.[col] ??
          preset.avgColumns?.[finalC] ??
          (finalC.includes('%') || /persen|cakupan/i.test(finalC));
        if (isAvg) {
          const nums = regionRows
            .map((r) => IndicatorEvaluator.parseSmartNumber(r[finalC]))
            .filter((n): n is number => n !== null);
          if (nums.length > 0) {
            const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
            avgObj[finalC] = Math.round(avg * 100) / 100;
            hasAnyAvg = true;
          }
        }
      }
      if (hasAnyAvg) detectedSummaryRow = avgObj;
    }

    // Bangun Target Row jika belum ada
    if (!detectedTargetRow && (preset.enableTarget !== false || preset.columnTargets)) {
      const tgtObj: Record<string, unknown> = {
        __id: 'row-target-preset',
        [finalKeyCol]: 'Target Dinkes',
      };
      let hasAnyTgt = false;
      for (const col of rawCols) {
        const finalC = resolveName(col);
        if (finalC === finalKeyCol) continue;
        const tgt = preset.columnTargets?.[col] ?? preset.columnTargets?.[finalC];
        if (tgt && tgt.enabled !== false && tgt.value !== null && tgt.value !== undefined) {
          tgtObj[finalC] = tgt.operator ? `${tgt.operator} ${tgt.value}` : String(tgt.value);
          hasAnyTgt = true;
        }
      }
      if (hasAnyTgt) detectedTargetRow = tgtObj;
    }

    return {
      rows: regionRows,
      columns: finalCols,
      keyCol: finalKeyCol,
      summaryRow: detectedSummaryRow,
      targetRow: detectedTargetRow,
      totalRow: detectedTotalRow,
    };
  }
}
