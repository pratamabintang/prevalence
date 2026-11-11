import * as XLSX from 'xlsx-js-style';
import { ColumnHeaderMeta, ExcelEngine } from '../../shared/excel';
import { RegionNormalizer } from '../domain/region-normalizer';
import { JoinExecutionSpec, JoinSheetInput, JoinExecutionResult } from './excel-join-engine';

/**
 * RelationalEngine: Deep module for core relational join logic.
 * Isolates data manipulation from Excel formatting and orchestration.
 */
export class RelationalEngine {
  static normalizeKey(key: string): string {
    return key.trim().toLowerCase().replace(/\s+/g, '_');
  }

  static findHeader(headers: string[], key?: string): string | undefined {
    if (!key) return undefined;
    const normKey = this.normalizeKey(key);
    return headers.find((h) => this.normalizeKey(h) === normKey);
  }

  static isEmptyValue(value: unknown): boolean {
    return value === null || value === undefined || String(value).trim() === '';
  }

  static getOutputColumnName(
    sheet: JoinSheetInput,
    variable: string,
    includeSheetPrefix = false,
  ): string {
    return includeSheetPrefix ? `${sheet.name} - ${variable}` : variable;
  }

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
        const rawVal = row[actualHeader] ?? null;
        if (typeof rawVal === 'number' && !Number.isInteger(rawVal)) {
          result[outCol] = Math.round(rawVal * 100) / 100;
        } else {
          result[outCol] = rawVal;
        }
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
          const rawVal = row[actualHeader] ?? null;
          if (typeof rawVal === 'number' && !Number.isInteger(rawVal)) {
            existing[outCol] = Math.round(rawVal * 100) / 100;
          } else {
            existing[outCol] = rawVal;
          }
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
}
