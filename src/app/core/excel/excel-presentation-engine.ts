import * as XLSX from 'xlsx-js-style';
import { ExcelEngine, StyledExportSpec } from '../../shared/excel';
import { IndicatorEvaluator, CapaianSummary } from '../evaluation/indicator-evaluator';
import { JoinExportSpec } from './excel-join-engine';

/**
 * ExcelPresentationEngine: Deep module for Excel styling and export.
 * Responsible for visual transformation of raw dataset results.
 */
export class ExcelPresentationEngine {
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

    const processedMeta = resultColumnsMeta.map((m) => {
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
          return { ...m, layers: custom.split(' - ').map((s: string) => s.trim()) };
        } else {
          nextLayers[nextLayers.length - 1] = custom;
          return { ...m, layers: nextLayers };
        }
      }
    });

    const excelCols = [
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
            if (num !== null) {
              rowValues[col.key] = Number.isInteger(num) ? num : Math.round(num * 100) / 100;
            } else {
              rowValues[col.key] = rawVal ?? '';
            }
          }
        }
      }
      return rowValues;
    });

    const summaryRows: any[] = [];

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
            if (sum !== null) {
              jumlahValues[col.key] = Number.isInteger(sum) ? sum : Math.round(sum * 100) / 100;
            } else {
              jumlahValues[col.key] = '-';
            }
          } else {
            jumlahValues[col.key] = '-';
          }
        }
      }
      summaryRows.push({
        values: jumlahValues,
        styler: (_colKey: string, _val: unknown, colIdx: number) => ({
          font: { bold: true, color: { rgb: '065F46' }, sz: 10 },
          fill: { fgColor: { rgb: 'ECFDF5' } },
          alignment: {
            horizontal: colIdx === 1 ? 'left' : 'center',
            vertical: 'center',
          },
        }),
      });
    }

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
            if (avg !== null) {
              avgValues[col.key] = Number.isInteger(avg) ? avg : Math.round(avg * 100) / 100;
            } else {
              avgValues[col.key] = '-';
            }
          } else {
            avgValues[col.key] = '-';
          }
        }
      }
      summaryRows.push({
        values: avgValues,
        styler: (colKey: string, val: unknown, colIdx: number) => ({
          font: { bold: true, color: { rgb: '0369A1' }, sz: 10 },
          fill: { fgColor: { rgb: 'F0F9FF' } },
          alignment: {
            horizontal: colIdx === 1 ? 'left' : 'center',
            vertical: 'center',
          },
          numFmt: columnConfigs[colKey]?.dataType === 'percentage' && typeof val === 'number' ? '0.0"%"' : undefined,
        }),
      });
    }

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
        styler: (_colKey: string, _val: unknown, colIdx: number) => ({
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
      cellStyler: (_row: Record<string, unknown>, colKey: string, val: unknown, colIndex: number) => {
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

  static exportStyledTable(spec: JoinExportSpec): void {
    const styledSpec = this.buildJoinedStyledSpec(spec);
    if (!styledSpec) return;
    ExcelEngine.exportStyledTable(styledSpec);
  }

  static exportMultiSheetTable(fileName: string, sheets: { sheetName: string; worksheet: XLSX.WorkSheet }[]): void {
    ExcelEngine.exportMultiSheetTable(fileName, sheets);
  }

  static buildJoinedBuffer(spec: JoinExportSpec): ArrayBuffer | null {
    const styledSpec = this.buildJoinedStyledSpec(spec);
    if (!styledSpec) return null;
    const workbook = ExcelEngine.buildStyledWorkbook(styledSpec);
    return ExcelEngine.writeWorkbookToBuffer(workbook);
  }

  static buildMultiSheetJoinedBuffer(specs: JoinExportSpec[]): ArrayBuffer | null {
    if (!specs || specs.length === 0) return null;
    const workbook = XLSX.utils.book_new();
    let sheetCount = 0;
    for (const spec of specs) {
      const styledSpec = this.buildJoinedStyledSpec(spec);
      if (!styledSpec) continue;
      const worksheet = ExcelEngine.buildStyledWorksheet(styledSpec);
      XLSX.utils.book_append_sheet(workbook, worksheet, spec.sheetName || `Sheet${sheetCount + 1}`);
      sheetCount++;
    }
    if (sheetCount === 0) return null;
    return ExcelEngine.writeWorkbookToBuffer(workbook);
  }
}
