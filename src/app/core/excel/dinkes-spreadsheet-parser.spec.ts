import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import { ExcelEngine } from '../../shared/excel';
import { DinkesSpreadsheetParser } from './dinkes-spreadsheet-parser';
import { DEFAULT_JOIN_CONFIG } from '../../features/excel-join/default-join-config';

describe('DinkesSpreadsheetParser', () => {
  describe('detectPreJoinedSheet', () => {
    it('harus mendeteksi sheet yang bernama persis "Hasil Join"', () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([['Kabupaten/Kota', 'Val']]);
      XLSX.utils.book_append_sheet(wb, ws, 'Hasil Join');

      expect(DinkesSpreadsheetParser.detectPreJoinedSheet(wb)).toBe('Hasil Join');
    });

    it('harus mendeteksi sheet yang mengandung kata "hasil join"', () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([['Kabupaten/Kota', 'Val']]);
      XLSX.utils.book_append_sheet(wb, ws, 'Arsip Hasil Join TW1');

      expect(DinkesSpreadsheetParser.detectPreJoinedSheet(wb)).toBe('Arsip Hasil Join TW1');
    });

    it('TIDAK boleh mendeteksi sheet mentah sebagai Hasil Join pada workbook multi-sheet meski ada baris Jumlah', () => {
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet([
        ['No', 'Kabupaten/Kota', 'Kasus'],
        [1, 'CILACAP', 10],
        ['-', 'Jumlah', 10],
      ]);
      XLSX.utils.book_append_sheet(wb, ws1, 'MASALAH GIZI');

      const ws2 = XLSX.utils.aoa_to_sheet([
        ['No', 'Kabupaten/Kota', 'Balita'],
        [1, 'CILACAP', 50],
      ]);
      XLSX.utils.book_append_sheet(wb, ws2, 'anak');

      expect(DinkesSpreadsheetParser.detectPreJoinedSheet(wb)).toBeNull();
    });

    it('harus mendeteksi sheet pre-joined pada single-sheet workbook yang memiliki ringkasan dan indikator %', () => {
      const wb = XLSX.utils.book_new();
      const rows = [
        ['No', 'Kabupaten/Kota', '% Konsumsi TTD', 'Capaian'],
        ...Array.from({ length: 35 }, (_, i) => [i + 1, `KABUPATEN ${i}`, 75, 1]),
        ['-', 'Jumlah', 2625, '-'],
        ['-', 'Target', '>= 67', 1],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

      expect(DinkesSpreadsheetParser.detectPreJoinedSheet(wb)).toBe('Sheet1');
    });
  });

  describe('parse - Format Pre-Joined', () => {
    it('harus mengekstrak baris wilayah, baris ringkasan, dan konfigurasi kolom dari sheet Hasil Join', () => {
      const wb = XLSX.utils.book_new();
      const headers = ['No', 'Kabupaten/Kota', 'Rematri Konsumsi TTD', '% Konsumsi TTD', 'Capaian'];
      const dataRows = [
        [1, 'KABUPATEN CILACAP', 17918, 64.35, 0],
        [2, 'KABUPATEN BANYUMAS', 15000, 72.1, 1],
      ];
      const summaryJumlah = ['-', 'Jumlah', 32918, '-', '-'];
      const summaryRataRata = ['-', 'Rata-rata', '-', 68.225, '-'];
      const summaryTarget = ['-', 'Target', '-', '>= 67', 1];

      const ws = XLSX.utils.aoa_to_sheet([
        headers,
        ...dataRows,
        summaryJumlah,
        summaryRataRata,
        summaryTarget,
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Hasil Join');

      const result = DinkesSpreadsheetParser.parse(wb, { stripKabupaten: true });

      expect(result.sourceType).toBe('pre-joined');
      expect(result.sheetName).toBe('Hasil Join');
      expect(result.keyCol).toBe('Kabupaten/Kota');
      expect(result.columns).toEqual(['Kabupaten/Kota', 'Rematri Konsumsi TTD', '% Konsumsi TTD']);
      expect(result.regionRows.length).toBe(2);

      // Verifikasi pembersihan prefiks kabupaten
      expect(result.regionRows[0]['Kabupaten/Kota']).toBe('CILACAP');
      expect(result.regionRows[0]['Rematri Konsumsi TTD']).toBe(17918);
      expect(result.regionRows[0]['% Konsumsi TTD']).toBe(64.35);

      // Verifikasi baris ringkasan terpisah secara tegas
      expect(result.totalRow).toBeTruthy();
      expect(result.totalRow!['Rematri Konsumsi TTD']).toBe(32918);

      expect(result.summaryRow).toBeTruthy();
      expect(result.summaryRow!['% Konsumsi TTD']).toBe(68.225);

      expect(result.targetRow).toBeTruthy();
      expect(result.columnTargets['% Konsumsi TTD']).toEqual({
        enabled: true,
        operator: '>=',
        value: 67,
      });

      // Verifikasi tipe data dan flag agregasi
      expect(result.columnConfigs['Rematri Konsumsi TTD']?.dataType).toBe('number');
      expect(result.columnConfigs['% Konsumsi TTD']?.dataType).toBe('percentage');
      expect(result.sums['Rematri Konsumsi TTD']).toBe(true);
      expect(result.averages['% Konsumsi TTD']).toBe(true);
    });

    it('harus menerima input berupa ArrayBuffer secara langsung', () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['No', 'Kabupaten/Kota', '% ASI'],
        [1, 'KUDUS', 80],
        ['-', 'Target', '>= 76'],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Hasil Join');
      const buffer = ExcelEngine.writeWorkbookToBuffer(wb);

      const result = DinkesSpreadsheetParser.parse(buffer);
      expect(result.sourceType).toBe('pre-joined');
      expect(result.regionRows.length).toBe(1);
      expect(result.regionRows[0]['Kabupaten/Kota']).toBe('KUDUS');
      expect(result.columnTargets['% ASI']?.value).toBe(76);
    });
  });

  describe('parse - Format Raw Multi-Sheet Standar', () => {
    it('harus otomatis menggabungkan sheet standar dengan DEFAULT_JOIN_CONFIG saat menerima file mentah', () => {
      const wb = XLSX.utils.book_new();

      // Sheet remaja (header baris 3-5, data baris 7)
      const remajaRows = [
        ['Header Tarik'],
        ['Update'],
        [
          'No',
          'Kabupaten/Kota',
          'Sasaran',
          'Persentase remaja putri mendapatkan dan mengonsumsi TTD',
          'Persentase remaja putri mendapatkan dan mengonsumsi TTD',
        ],
        [
          '',
          '',
          '',
          'Jumlah remaja putri di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) mengonsumsi TTD sesuai standar',
          '% (2)',
        ],
        ['', '', '', '', ''],
        ['[1]', '[2]', '[3]', '[4]', '[5]'],
        [1, 'KABUPATEN CILACAP', 78835, 17918, 64.35],
      ];
      const wsRemaja = XLSX.utils.aoa_to_sheet(remajaRows);
      wsRemaja['!merges'] = [{ s: { r: 2, c: 3 }, e: { r: 2, c: 4 } }];
      XLSX.utils.book_append_sheet(wb, wsRemaja, 'remaja');

      // Sheet anak (header baris 3-5, data baris 7)
      const anakRows = [
        ['Header Tarik'],
        ['Update'],
        [
          'No',
          'Kabupaten/Kota',
          'Sasaran',
          'Bayi baru lahir',
          'Pemantauan Pertumbuhan dan Perkembangan',
        ],
        ['', '', '', 'Bayi', '% (3)'],
        ['', '', '', '', ''],
        ['[1]', '[2]', '[3]', '[4]', '[5]'],
        [1, 'KABUPATEN CILACAP', 8738, 16130, 37.24],
      ];
      const wsAnak = XLSX.utils.aoa_to_sheet(anakRows);
      XLSX.utils.book_append_sheet(wb, wsAnak, 'anak');

      const result = DinkesSpreadsheetParser.parse(wb, {
        preset: DEFAULT_JOIN_CONFIG,
        stripKabupaten: true,
      });

      expect(result.sourceType).toBe('raw-joined');
      expect(result.regionRows.length).toBe(1);
      expect(result.regionRows[0]['Kabupaten/Kota']).toBe('CILACAP');

      // Memastikan alias diterapkan
      expect(result.columns).toContain('Rematri  Konsumsi TTD');
      expect(result.columns).toContain('% Konsumsi TTD');
      expect(result.regionRows[0]['Rematri  Konsumsi TTD']).toBe(17918);
      expect(result.regionRows[0]['% Konsumsi TTD']).toBe(64.35);

      // Memastikan baris ringkasan terhitung
      expect(result.totalRow).toBeTruthy();
      expect(result.summaryRow).toBeTruthy();
      expect(result.targetRow).toBeTruthy();
    });
  });
});
