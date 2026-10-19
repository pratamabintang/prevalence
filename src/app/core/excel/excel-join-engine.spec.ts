import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import { ExcelEngine } from '../../shared/excel';
import { ExcelJoinEngine, JoinExecutionSpec, JoinExportSpec, JoinSheetInput } from './excel-join-engine';

describe('ExcelJoinEngine (Deep Module)', () => {
  function createSampleWorkbook(): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Master
    const ws1Data = [
      ['Kabupaten/Kota', 'Puskesmas', 'Sasaran Balita'],
      ['3301 - KAB. CILACAP', 'Puskesmas Jeruklegi', 1200],
      ['3302 - KAB. BANYUMAS', 'Puskesmas Ajibarang', 950],
      ['3371 - KOTA MAGELANG', 'Puskesmas Magelang Utara', 400],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
    XLSX.utils.book_append_sheet(wb, ws1, 'MasterSheet');

    // Sheet 2: Data Pengukuran
    const ws2Data = [
      ['Wilayah', 'Puskesmas', 'Balita Ditimbang'],
      ['CILACAP', 'Puskesmas Jeruklegi', 1150],
      ['BANYUMAS', 'Puskesmas Ajibarang', 900],
      // KOTA MAGELANG sengaja tidak ada untuk menguji Left Join null-safety
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
    XLSX.utils.book_append_sheet(wb, ws2, 'TimbangSheet');

    return wb;
  }

  const sampleSheets: JoinSheetInput[] = [
    {
      name: 'MasterSheet',
      selected: true,
      joinColumn: 'Kabupaten/Kota',
      variables: ['Sasaran Balita'],
      headers: ['Kabupaten/Kota', 'Puskesmas', 'Sasaran Balita'],
      dataStartRow: 2,
      columns: [
        { colIndex: 0, colLetter: 'A', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Wilayah', 'Kabupaten/Kota'] },
        { colIndex: 1, colLetter: 'B', header: 'Puskesmas', leafHeader: 'Puskesmas', layers: ['Wilayah', 'Puskesmas'] },
        { colIndex: 2, colLetter: 'C', header: 'Sasaran Balita', leafHeader: 'Sasaran Balita', layers: ['Sasaran', 'Sasaran Balita'] },
      ],
    },
    {
      name: 'TimbangSheet',
      selected: true,
      joinColumn: 'Wilayah',
      variables: ['Balita Ditimbang'],
      headers: ['Wilayah', 'Puskesmas', 'Balita Ditimbang'],
      dataStartRow: 2,
      columns: [
        { colIndex: 0, colLetter: 'A', header: 'Wilayah', leafHeader: 'Wilayah', layers: ['Wilayah'] },
        { colIndex: 1, colLetter: 'B', header: 'Puskesmas', leafHeader: 'Puskesmas', layers: ['Wilayah', 'Puskesmas'] },
        { colIndex: 2, colLetter: 'C', header: 'Balita Ditimbang', leafHeader: 'Balita Ditimbang', layers: ['Capaian', 'Balita Ditimbang'] },
      ],
    },
  ];

  describe('executeJoin', () => {
    it('harus mengembalikan hasil kosong jika sheet terpilih kurang dari 2', () => {
      const wb = createSampleWorkbook();
      const res = ExcelJoinEngine.executeJoin({
        workbook: wb,
        selectedSheets: [sampleSheets[0]],
      });

      expect(res.rows).toEqual([]);
      expect(res.columns).toEqual([]);
    });

    it('harus menggabungkan data berbasis Left Join dengan normalisasi nama wilayah', () => {
      const wb = createSampleWorkbook();
      const spec: JoinExecutionSpec = {
        workbook: wb,
        selectedSheets: sampleSheets,
        stripKabupaten: true,
      };

      const res = ExcelJoinEngine.executeJoin(spec);

      // Harus ada 3 baris dari MasterSheet
      expect(res.rows.length).toBe(3);

      // Baris 1: CILACAP cocok dengan CILACAP
      expect(res.rows[0]['Kabupaten/Kota']).toBe('CILACAP');
      expect(res.rows[0]['Sasaran Balita']).toBe(1200);
      expect(res.rows[0]['Balita Ditimbang']).toBe(1150);

      // Baris 2: BANYUMAS cocok dengan BANYUMAS
      expect(res.rows[1]['Kabupaten/Kota']).toBe('BANYUMAS');
      expect(res.rows[1]['Sasaran Balita']).toBe(950);
      expect(res.rows[1]['Balita Ditimbang']).toBe(900);

      // Baris 3: KOTA MAGELANG tidak ada di TimbangSheet -> harus null
      expect(res.rows[2]['Kabupaten/Kota']).toBe('KOTA MAGELANG');
      expect(res.rows[2]['Sasaran Balita']).toBe(400);
      expect(res.rows[2]['Balita Ditimbang']).toBeNull();
    });

    it('harus mempertahankan prefiks KAB jika stripKabupaten bernilai false', () => {
      const wb = createSampleWorkbook();
      const spec: JoinExecutionSpec = {
        workbook: wb,
        selectedSheets: sampleSheets,
        stripKabupaten: false,
      };

      const res = ExcelJoinEngine.executeJoin(spec);
      expect(res.rows[0]['Kabupaten/Kota']).toBe('KAB. CILACAP');
    });

    it('harus mendukung mode header concat satu baris', () => {
      const wb = createSampleWorkbook();
      const spec: JoinExecutionSpec = {
        workbook: wb,
        selectedSheets: sampleSheets,
        outputHeaderFormat: 'concat',
      };

      const res = ExcelJoinEngine.executeJoin(spec);
      expect(res.columnsMeta[0].layers).toEqual(['Wilayah - Kabupaten/Kota']);
      expect(res.columnsMeta[1].layers).toEqual(['Sasaran - Sasaran Balita']);
    });

    it('harus menangani duplikasi nama kolom antar-sheet dengan suffix nama sheet', () => {
      const wb = createSampleWorkbook();
      const sheetsWithDuplicate: JoinSheetInput[] = [
        sampleSheets[0],
        {
          ...sampleSheets[1],
          variables: ['Sasaran Balita'], // nama variabel sama persis dengan master
          headers: ['Wilayah', 'Sasaran Balita'],
          columns: [
            { colIndex: 0, colLetter: 'A', header: 'Wilayah', leafHeader: 'Wilayah', layers: ['Wilayah'] },
            { colIndex: 1, colLetter: 'B', header: 'Sasaran Balita', leafHeader: 'Sasaran Balita', layers: ['Sasaran Balita'] },
          ],
        },
      ];

      const res = ExcelJoinEngine.executeJoin({
        workbook: wb,
        selectedSheets: sheetsWithDuplicate,
      });

      expect(res.columns).toContain('Sasaran Balita');
      expect(res.columns).toContain('Sasaran Balita (TimbangSheet)');
    });

    it('harus mempertahankan urutan kustom kolom jika diberikan', () => {
      const wb = createSampleWorkbook();
      const spec: JoinExecutionSpec = {
        workbook: wb,
        selectedSheets: sampleSheets,
        previousColumnOrder: ['Kabupaten/Kota', 'Balita Ditimbang', 'Sasaran Balita'],
      };

      const res = ExcelJoinEngine.executeJoin(spec);
      expect(res.columns).toEqual(['Kabupaten/Kota', 'Balita Ditimbang', 'Sasaran Balita']);
    });
  });

  describe('exportJoinedWorkbook', () => {
    it('harus memanggil ExcelEngine.exportStyledTable dengan data dan baris ringkasan yang sesuai', () => {
      const exportSpy = vi.spyOn(ExcelEngine, 'exportStyledTable').mockImplementation(() => {});

      const exportSpec: JoinExportSpec = {
        fileName: 'Test_Export.xlsx',
        sheetName: 'Hasil Test',
        resultRows: [
          { 'Kabupaten/Kota': 'Cilacap', 'Sasaran': 100, 'Realisasi': 80 },
          { 'Kabupaten/Kota': 'Banyumas', 'Sasaran': 200, 'Realisasi': 190 },
        ],
        resultColumns: ['Kabupaten/Kota', 'Sasaran', 'Realisasi'],
        resultColumnsMeta: [
          { key: 'Kabupaten/Kota', layers: ['Wilayah'] },
          { key: 'Sasaran', layers: ['Sasaran'] },
          { key: 'Realisasi', layers: ['Realisasi'] },
        ],
        enableJumlah: true,
        sumColumns: { 'Sasaran': true, 'Realisasi': true },
        enableAverage: true,
        avgColumns: { 'Sasaran': true },
        enableTarget: true,
        columnTargets: {
          'Realisasi': { enabled: true, operator: '>=', value: 85 },
        },
        enableCapaian: true,
      };

      ExcelJoinEngine.exportJoinedWorkbook(exportSpec);

      expect(exportSpy).toHaveBeenCalledTimes(1);
      const callArg = exportSpy.mock.calls[0][0];

      expect(callArg.fileName).toBe('Test_Export.xlsx');
      expect(callArg.sheetName).toBe('Hasil Test');
      // Kolom harus diawali No dan memuat Capaian
      expect(callArg.columns.map((c) => c.key)).toEqual(['No', 'Kabupaten/Kota', 'Sasaran', 'Realisasi', 'Capaian']);
      // Harus memiliki 3 baris ringkasan: Jumlah, Rata-rata, Target
      expect(callArg.summaryRows?.length).toBe(3);

      exportSpy.mockRestore();
    });

    it('harus tidak memanggil exportStyledTable jika baris data kosong', () => {
      const exportSpy = vi.spyOn(ExcelEngine, 'exportStyledTable').mockImplementation(() => {});

      ExcelJoinEngine.exportJoinedWorkbook({
        resultRows: [],
        resultColumns: [],
        resultColumnsMeta: [],
      });

      expect(exportSpy).not.toHaveBeenCalled();
      exportSpy.mockRestore();
    });
  });
});
