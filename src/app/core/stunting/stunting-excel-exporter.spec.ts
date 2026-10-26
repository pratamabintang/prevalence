import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ExcelEngine } from '../../shared/excel';
import { StuntingEvaluationResult } from './stunting-evaluation-engine';
import { StuntingExcelExporter } from './stunting-excel-exporter';

describe('StuntingExcelExporter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockEvaluation = {
    summary: {
      totalIndicators: 1,
      onTrackCount: 1,
      perluPerhatianCount: 0,
      perluPercepatanCount: 0,
      belumDinilaiCount: 0,
      targetReachedCount: 1,
      improvedCount: 1,
      declinedCount: 0,
      patternCounts: {
        meningkat_on_track: 1,
        meningkat_belum_on_track: 0,
        menurun_on_track: 0,
        menurun_perlu_percepatan: 0,
        target_tercapai: 1,
      },
    },
    rows: [
      {
        id: 'sub-1',
        category: 'Intervensi Remaja',
        no: 1,
        name: 'Remaja Putri Dapat TTD',
        polarity: 'positive',
        targetCurrentYear: 85,
        targetPrevYear: 80,
        actualPrevYear: 78,
        calculationMode: 'percentage',
        quarters: {
          1: {
            quarter: 1,
            actualAchievement: 82.5,
            expectedAchievement: 42.5,
            gap: 40.0,
            sumNumerator: 500,
            sumDenominator: 606,
          },
        },
        activeQuarter: 1,
        activeActual: 82.5,
        activeExpected: 42.5,
        status: 'on_track',
      },
    ],
  } as unknown as StuntingEvaluationResult;

  it('should export multi-sheet monitoring report with styled status badges', () => {
    const multiSheetSpy = vi
      .spyOn(ExcelEngine, 'exportMultiSheetTable')
      .mockImplementation(() => {});

    const fileName = StuntingExcelExporter.exportMonitoringReport({
      evaluationResult: mockEvaluation,
      availableQuarters: [1],
      validJoinedRows: [
        { Puskesmas: 'Puskesmas A', 'Remaja Putri': 500 },
      ],
      primaryKeyColumn: 'Puskesmas',
      joinedColumns: ['Puskesmas', 'Remaja Putri'],
    });

    expect(fileName).toContain('Monitoring_Stunting_TW1_');
    expect(fileName.endsWith('.xlsx')).toBe(true);
    expect(multiSheetSpy).toHaveBeenCalledTimes(1);

    const callArgs = multiSheetSpy.mock.calls[0];
    expect(callArgs[0]).toBe(fileName);
    const sheets = callArgs[1];
    expect(sheets).toHaveLength(2);
    expect(sheets[0].sheetName).toBe('Rekap Kinerja');
    expect(sheets[1].sheetName).toBe('Data Riil Wilayah');
  });

  it('should export single recap sheet when validJoinedRows is empty', () => {
    const multiSheetSpy = vi
      .spyOn(ExcelEngine, 'exportMultiSheetTable')
      .mockImplementation(() => {});

    const fileName = StuntingExcelExporter.exportMonitoringReport({
      evaluationResult: mockEvaluation,
      availableQuarters: [1, 2],
      validJoinedRows: [],
    });

    expect(fileName).toContain('Monitoring_Stunting_TW1_TW2_');
    const sheets = multiSheetSpy.mock.calls[0][1];
    expect(sheets).toHaveLength(1);
    expect(sheets[0].sheetName).toBe('Rekap Kinerja');
  });

  it('should include "Komparasi Kab-Kota" sheet when regionalScorecards are provided', () => {
    const multiSheetSpy = vi
      .spyOn(ExcelEngine, 'exportMultiSheetTable')
      .mockImplementation(() => {});

    const mockScorecards = [
      {
        regionId: 'row-1',
        regionName: 'Kabupaten Banyumas',
        summary: {
          totalIndicators: 1,
          onTrackCount: 1,
          perluPerhatianCount: 0,
          perluPercepatanCount: 0,
          belumDinilaiCount: 0,
        },
        rows: [
          {
            id: 'sub-1',
            name: 'Remaja Putri Dapat TTD',
            status: 'on_track',
            activeActual: 85.0,
          },
        ],
        activeQuarter: 1,
      },
    ] as any;

    const fileName = StuntingExcelExporter.exportMonitoringReport({
      evaluationResult: mockEvaluation,
      availableQuarters: [1],
      regionalScorecards: mockScorecards,
      validJoinedRows: [{ Puskesmas: 'Puskesmas A' }],
    });

    const sheets = multiSheetSpy.mock.calls[0][1];
    const regionalSheet = sheets.find((s: any) => s.sheetName === 'Komparasi Kab-Kota');
    expect(regionalSheet).toBeDefined();
    expect(sheets.map((s: any) => s.sheetName)).toContain('Komparasi Kab-Kota');
  });

  it('should export joined data using ExcelEngine.exportStyledTable', () => {
    const styledTableSpy = vi
      .spyOn(ExcelEngine, 'exportStyledTable')
      .mockImplementation(() => {});

    const rows = [{ Wilayah: 'Kudus', Remaja: 100 }];
    const fileName = StuntingExcelExporter.exportJoinedData({
      rows,
      primaryKeyColumn: 'Wilayah',
      joinedColumns: ['Wilayah', 'Remaja'],
    });

    expect(fileName).toContain('Data_Gabungan_Stunting_');
    expect(styledTableSpy).toHaveBeenCalledTimes(1);
    const spec = styledTableSpy.mock.calls[0][0];
    expect(spec.sheetName).toBe('Data Gabungan');
    expect(spec.columns[0]).toEqual({ key: 'Wilayah', layers: ['Wilayah', 'Wilayah'] });
    expect(spec.columns[1]).toEqual({ key: 'Remaja', layers: ['Variabel / Indikator', 'Remaja'] });
    expect(spec.dataRows).toBe(rows);
  });

  it('should vertically merge consecutive identical category cells in column A', () => {
    const multiSheetSpy = vi
      .spyOn(ExcelEngine, 'exportMultiSheetTable')
      .mockImplementation(() => {});

    const multiRowsEvaluation = {
      ...mockEvaluation,
      rows: [
        { ...mockEvaluation.rows[0], id: 'sub-1', category: 'Intervensi Remaja' },
        { ...mockEvaluation.rows[0], id: 'sub-2', category: 'Intervensi Remaja' },
        { ...mockEvaluation.rows[0], id: 'sub-3', category: 'Intervensi Ibu Hamil' },
      ],
    } as unknown as StuntingEvaluationResult;

    StuntingExcelExporter.exportMonitoringReport({
      evaluationResult: multiRowsEvaluation,
      availableQuarters: [1],
    });

    const ws = multiSheetSpy.mock.calls[0][1][0].worksheet;
    expect(ws['!merges']).toBeDefined();
    // Header depth is 2 (rows 0 and 1). Data rows start at row 2.
    // 'Intervensi Remaja' spans rows 2-3 in column 0.
    const categoryMerge = ws['!merges']!.find(
      (m: any) => m.s.c === 0 && m.s.r === 2 && m.e.r === 3,
    );
    expect(categoryMerge).toBeDefined();
  });
});
