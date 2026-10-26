import { ColumnHeaderMeta, ExcelEngine } from '../../shared/excel';
import {
  EvaluatedRegionalScorecard,
  EvaluatedStuntingRow,
  StuntingEvaluationResult,
} from './stunting-evaluation-engine';

export interface StuntingExportReportSpec {
  evaluationResult: StuntingEvaluationResult;
  availableQuarters: number[];
  regionalScorecards?: EvaluatedRegionalScorecard[];
  validJoinedRows?: Record<string, unknown>[];
  primaryKeyColumn?: string;
  joinedColumns?: string[];
  fileName?: string;
}

export interface StuntingExportJoinedDataSpec {
  rows: Record<string, unknown>[];
  primaryKeyColumn?: string;
  joinedColumns: string[];
  fileName?: string;
}

/**
 * StuntingExcelExporter: Modul domain mendalam (Deep Module) yang bertanggung jawab atas
 * penyusunan, styling visual (status badge palette), dan ekspor buku kerja multi-sheet
 * laporan pemantauan stunting Dinkes.
 */
export class StuntingExcelExporter {
  /**
   * Menghasilkan dan mengunduh buku kerja Excel laporan evaluasi kinerja stunting multi-sheet.
   * Sheet 1: Rekap Kinerja Triwulanan (dengan sel status berwarna)
   * Sheet 2: Data Riil Wilayah (jika data baris aktif tersedia)
   * @returns nama berkas yang diekspor
   */
  static exportMonitoringReport(spec: StuntingExportReportSpec): string {
    const {
      evaluationResult,
      availableQuarters,
      regionalScorecards = [],
      validJoinedRows = [],
      primaryKeyColumn = 'Wilayah',
      joinedColumns = [],
    } = spec;

    const dateStr = new Date().toISOString().slice(0, 10);
    const qStr = availableQuarters.map((q) => `TW${q}`).join('_');
    const fileName = spec.fileName || `Monitoring_Stunting_${qStr}_${dateStr}.xlsx`;

    const wsRekap = this.buildEvaluationWorksheet('Rekap Kinerja', evaluationResult.rows, availableQuarters);

    // Sheet Komparasi Antar-Wilayah (Kabupaten/Kota)
    let wsKomparasi: ReturnType<typeof ExcelEngine.buildStyledWorksheet> | null = null;
    if (regionalScorecards.length > 0) {
      const columnsKomparasi: ColumnHeaderMeta[] = [
        { key: 'Wilayah', layers: ['Wilayah Administratif', primaryKeyColumn] },
        { key: 'OnTrack', layers: ['Ringkasan Status', 'Total On Track'] },
        { key: 'Percepatan', layers: ['Ringkasan Status', 'Total Percepatan'] },
      ];

      for (const r of evaluationResult.rows) {
        columnsKomparasi.push({
          key: `Ind_${r.id}_Actual`,
          layers: [r.name, `Capaian TW ${evaluationResult.activeQuarter} (%)`],
        });
        columnsKomparasi.push({
          key: `Ind_${r.id}_Status`,
          layers: [r.name, 'Status Evaluasi'],
        });
      }

      const komparasiRows = regionalScorecards.map((sc) => {
        const rowObj: Record<string, unknown> = {
          Wilayah: sc.regionName,
          OnTrack: sc.summary.onTrackCount,
          Percepatan: sc.summary.perluPercepatanCount,
        };
        for (const r of sc.rows) {
          rowObj[`Ind_${r.id}_Actual`] =
            r.activeActual !== null && r.activeActual !== undefined
              ? `${r.activeActual}${r.calculationMode === 'absolute' ? '' : '%'}`
              : '-';
          rowObj[`Ind_${r.id}_Status`] = this.formatStatusLabel(r.status);
        }
        return rowObj;
      });

      wsKomparasi = ExcelEngine.buildStyledWorksheet({
        sheetName: 'Komparasi Kab-Kota',
        columns: columnsKomparasi,
        dataRows: komparasiRows,
        cellStyler: (_row, colKey, val) => {
          if (colKey === 'Wilayah') {
            return { font: { bold: true } };
          }
          if (colKey.endsWith('_Status')) {
            const s = String(val);
            if (s === 'On Track') {
              return {
                fill: { fgColor: { rgb: 'D1FAE5' } },
                font: { color: { rgb: '065F46' }, bold: true },
              };
            }
            if (s === 'Perlu Percepatan') {
              return {
                fill: { fgColor: { rgb: 'FFE4E6' } },
                font: { color: { rgb: '9F1239' }, bold: true },
              };
            }
            return {
              fill: { fgColor: { rgb: 'F1F5F9' } },
              font: { color: { rgb: '475569' } },
            };
          }
          return undefined;
        },
      });
    }

    let wsWilayah: ReturnType<typeof ExcelEngine.buildStyledWorksheet> | null = null;
    if (validJoinedRows.length > 0) {
      const columnsWilayah: ColumnHeaderMeta[] = [];
      if (primaryKeyColumn) {
        columnsWilayah.push({ key: primaryKeyColumn, layers: ['Wilayah', primaryKeyColumn] });
      }
      for (const col of joinedColumns) {
        if (col !== primaryKeyColumn) {
          columnsWilayah.push({ key: col, layers: ['Indikator / Variabel', col] });
        }
      }

      wsWilayah = ExcelEngine.buildStyledWorksheet({
        sheetName: 'Data Riil Wilayah',
        columns: columnsWilayah,
        dataRows: validJoinedRows,
      });
    }

    const sheetsToExport: Parameters<typeof ExcelEngine.exportMultiSheetTable>[1] = [
      { sheetName: 'Rekap Kinerja', worksheet: wsRekap },
    ];
    if (wsKomparasi) {
      sheetsToExport.push({ sheetName: 'Komparasi Kab-Kota', worksheet: wsKomparasi });
    }

    // Add individual worksheet for each Kabupaten/Kota with the identical 14-indicator format
    const usedSheetNames = new Set<string>(['Rekap Kinerja', 'Komparasi Kab-Kota']);
    for (const sc of regionalScorecards) {
      let cleanName = sc.regionName
        .replace(/[:\\/?*\[\]]/g, '')
        .trim();
      if (cleanName.length > 28) {
        cleanName = cleanName.slice(0, 28);
      }
      let finalName = cleanName;
      let counter = 1;
      while (usedSheetNames.has(finalName)) {
        finalName = `${cleanName.slice(0, 25)}_${counter++}`;
      }
      usedSheetNames.add(finalName);

      const wsDistrict = this.buildEvaluationWorksheet(finalName, sc.rows, availableQuarters);
      sheetsToExport.push({ sheetName: finalName, worksheet: wsDistrict });
    }

    if (wsWilayah) {
      sheetsToExport.push({ sheetName: 'Data Riil Wilayah', worksheet: wsWilayah });
    }

    ExcelEngine.exportMultiSheetTable(fileName, sheetsToExport);

    return fileName;
  }

  /**
   * Membangun worksheet standar Dinkes Jateng (14 indikator) untuk satu wilayah (Provinsi atau Kabupaten/Kota).
   */
  static buildEvaluationWorksheet(
    sheetName: string,
    rows: EvaluatedStuntingRow[],
    availableQuarters: number[],
  ): ReturnType<typeof ExcelEngine.buildStyledWorksheet> {
    const columnsRekap: ColumnHeaderMeta[] = [
      { key: 'Kategori', layers: ['Kategori Intervensi', 'Kategori Intervensi'] },
      { key: 'No', layers: ['No', 'No'] },
      { key: 'Intervensi', layers: ['Intervensi Percepatan Penurunan Stunting', 'Intervensi Percepatan Penurunan Stunting'] },
      { key: 'TargetPrev', layers: ['Target Tahun Lalu', 'Target Tahun Lalu'] },
      { key: 'CapaianPrev', layers: ['Capaian Tahun Lalu', 'Capaian Tahun Lalu'] },
      { key: 'TargetCurr', layers: ['Target Tahun Ini', 'Target Tahun Ini'] },
    ];

    for (const q of availableQuarters) {
      columnsRekap.push({ key: `JumlahTW${q}`, layers: [`Triwulan ${q}`, 'Jumlah (SUM)'] });
      columnsRekap.push({ key: `CapaianTW${q}`, layers: [`Triwulan ${q}`, 'Capaian (MEAN %)'] });
    }

    columnsRekap.push({ key: 'Status', layers: ['Status Evaluasi', 'Status Evaluasi'] });

    const exportRows = rows.map((r: EvaluatedStuntingRow) => {
      const rowObj: Record<string, any> = {
        Kategori: r.category,
        No: r.no,
        Intervensi: r.name,
        TargetPrev: r.targetPrevYear !== null && r.targetPrevYear !== undefined ? `${r.targetPrevYear}%` : '-',
        CapaianPrev: r.actualPrevYear !== null && r.actualPrevYear !== undefined ? `${r.actualPrevYear}%` : '-',
        TargetCurr: r.targetCurrentYear !== null && r.targetCurrentYear !== undefined ? `${r.targetCurrentYear}%` : '-',
      };

      for (const q of availableQuarters) {
        const qData = r.quarters?.[q as 1 | 2 | 3 | 4];
        const actualVal =
          qData?.actualAchievement !== null && qData?.actualAchievement !== undefined
            ? qData.actualAchievement
            : r.activeActual !== undefined
              ? r.activeActual
              : null;

        rowObj[`JumlahTW${q}`] =
          qData?.sumNumerator !== null && qData?.sumNumerator !== undefined
            ? qData.sumNumerator
            : '-';
        rowObj[`CapaianTW${q}`] =
          actualVal !== null
            ? `${actualVal}${r.calculationMode === 'absolute' ? '' : '%'}`
            : '-';
      }

      rowObj['Status'] = this.formatStatusLabel(r.status);
      return rowObj;
    });

    const wsRekap = ExcelEngine.buildStyledWorksheet({
      sheetName,
      columns: columnsRekap,
      dataRows: exportRows,
      cellStyler: (_row, colKey, val) => {
        if (colKey === 'Kategori') {
          return {
            alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
          };
        }
        if (colKey === 'Status') {
          const s = String(val);
          if (s === 'On Track') {
            return {
              fill: { fgColor: { rgb: 'D1FAE5' } },
              font: { color: { rgb: '065F46' }, bold: true },
            };
          }
          if (s === 'Perlu Percepatan') {
            return {
              fill: { fgColor: { rgb: 'FFE4E6' } },
              font: { color: { rgb: '9F1239' }, bold: true },
            };
          }
          return {
            fill: { fgColor: { rgb: 'F1F5F9' } },
            font: { color: { rgb: '475569' } },
          };
        }
        return undefined;
      },
    });

    // Merge consecutive identical Category cells in column A (index 0)
    const merges: any[] = wsRekap['!merges'] || [];
    let startRow = 2; // Data rows start at index 2 (after 2-row multi-layer header)
    let currentCategory = exportRows.length > 0 ? exportRows[0]['Kategori'] : null;
    let count = 0;

    for (let i = 0; i < exportRows.length; i++) {
      const cat = exportRows[i]['Kategori'];
      if (cat === currentCategory) {
        count++;
      } else {
        if (count > 1) {
          merges.push({
            s: { r: startRow, c: 0 },
            e: { r: startRow + count - 1, c: 0 },
          });
        }
        startRow = startRow + count;
        currentCategory = cat;
        count = 1;
      }
    }
    if (count > 1) {
      merges.push({
        s: { r: startRow, c: 0 },
        e: { r: startRow + count - 1, c: 0 },
      });
    }
    wsRekap['!merges'] = merges;

    return wsRekap;
  }

  /**
   * Menghasilkan dan mengunduh berkas Excel dari data gabungan (joined dataset).
   * @returns nama berkas yang diekspor
   */
  static exportJoinedData(spec: StuntingExportJoinedDataSpec): string {
    const { rows, primaryKeyColumn, joinedColumns, fileName: customFileName } = spec;

    const pKey = primaryKeyColumn || (joinedColumns.length > 0 ? joinedColumns[0] : 'Wilayah');
    const columns: ColumnHeaderMeta[] = [];

    if (pKey) {
      columns.push({ key: pKey, layers: ['Wilayah', pKey] });
    }
    for (const c of joinedColumns) {
      if (c !== pKey) {
        columns.push({ key: c, layers: ['Variabel / Indikator', c] });
      }
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = customFileName || `Data_Gabungan_Stunting_${dateStr}.xlsx`;

    ExcelEngine.exportStyledTable({
      sheetName: 'Data Gabungan',
      columns,
      dataRows: rows,
      fileName,
    });

    return fileName;
  }

  private static formatStatusLabel(status: string): string {
    switch (status) {
      case 'on_track':
        return 'On Track';
      case 'perlu_percepatan':
        return 'Perlu Percepatan';
      default:
        return 'Belum Dapat Dinilai';
    }
  }
}
