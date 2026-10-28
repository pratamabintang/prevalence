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

    it('harus mendeteksi sheet MASALAH GIZI pre-joined dengan indikator % dan jumlah kolom memadai', () => {
      const wb = XLSX.utils.book_new();
      const giziCols = [
        'No',
        'Kabupaten/Kota',
        'BBLR - Jumlah',
        'BBLR - %',
        'BB Tidak Naik - Jumlah',
        'BB Tidak Naik - %',
        'BB Kurang - Jumlah',
        'BB Kurang - %',
        'Gizi Kurang - Jumlah',
        'Gizi Kurang - %',
        'Stunting - Jumlah',
        'Stunting - %',
      ];
      const rows = [
        giziCols,
        [1, 'CILACAP', 571, 6.53, 33778, 42.85, 6263, 7.93, 3380, 4.29, 4027, 5.11],
        ['-', 'Jumlah', 571, '-', 33778, '-', 6263, '-', 3380, '-', 4027, '-'],
        ['-', 'Rata-rata', '-', 6.53, '-', 42.85, '-', 7.93, '-', 4.29, '-', 5.11],
        ['-', 'Target', '-', '<= 5.5', '-', '<= 40', '-', '<= 14', '-', '<= 7.5', '-', '<= 14'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'MASALAH GIZI');

      expect(DinkesSpreadsheetParser.detectPreJoinedSheet(wb)).toBe('MASALAH GIZI');
      expect(DinkesSpreadsheetParser.detectMasalahGiziPreJoinedSheet(wb)).toBe('MASALAH GIZI');
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

    it('harus mengekstrak sheet MASALAH GIZI pre-joined dengan indikator persentase dan target operator <=', () => {
      const wb = XLSX.utils.book_new();
      const headers = [
        'No',
        'Kabupaten/Kota',
        'BBLR - Jumlah',
        'BBLR - %',
        'BB Tidak Naik - Jumlah',
        'BB Tidak Naik - %',
        'Stunting - Jumlah',
        'Stunting - %',
      ];
      const rows = [
        headers,
        [1, 'CILACAP', 571, 6.53, 33778, 42.85, 4027, 5.11],
        [2, 'BANYUMAS', 796, 9.39, 33490, 47.42, 9044, 12.81],
        ['-', 'Jumlah', 1367, '-', 67268, '-', 13071, '-'],
        ['-', 'Rata-rata', '-', 7.96, '-', 45.135, '-', 8.96],
        ['-', 'Target', '-', '<= 5.5', '-', '<= 40', '-', '<= 14'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'MASALAH GIZI');

      const result = DinkesSpreadsheetParser.parse(wb, { preferredSheetName: 'MASALAH GIZI' });
      expect(result.sourceType).toBe('pre-joined');
      expect(result.sheetName).toBe('MASALAH GIZI');
      expect(result.regionRows.length).toBe(2);
      expect(result.columns).toEqual([
        'Kabupaten/Kota',
        'BBLR - Jumlah',
        'BBLR - %',
        'BB Tidak Naik - Jumlah',
        'BB Tidak Naik - %',
        'Stunting - Jumlah',
        'Stunting - %',
      ]);
      expect(result.columnConfigs['BBLR - Jumlah']?.dataType).toBe('number');
      expect(result.columnConfigs['BBLR - %']?.dataType).toBe('percentage');
      expect(result.columnTargets['BBLR - %']?.operator).toBe('<=');
      expect(result.columnTargets['BBLR - %']?.value).toBe(5.5);
      expect(result.totalRow!['BBLR - Jumlah']).toBe(1367);
      expect(result.summaryRow!['BBLR - %']).toBe(7.96);
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

  describe('extractDataFetchTimestamp & formatTimestampForFilename', () => {
    it('harus mengekstrak stempel waktu dari sheet anak sel A1', () => {
      const wb = XLSX.utils.book_new();
      const wsAnak = XLSX.utils.aoa_to_sheet([
        ['Data Tarik : 2026-10-01 04:32:23'],
        ['Penarikan Data (Update) dilakukan secara rutin 8 jam sekali'],
        ['No', 'Kabupaten/Kota'],
      ]);
      XLSX.utils.book_append_sheet(wb, wsAnak, 'anak');

      const timestamp = DinkesSpreadsheetParser.extractDataFetchTimestamp(wb);
      expect(timestamp).toBe('2026-10-01 04:32:23');

      const safeFilename = DinkesSpreadsheetParser.formatTimestampForFilename(timestamp!);
      expect(safeFilename).toBe('2026-10-01 04-32-23');
    });

    it('harus mengekstrak stempel waktu dari format sel Dinkes asli yang umum', () => {
      const wb = XLSX.utils.book_new();
      const wsGizi = XLSX.utils.aoa_to_sheet([
        ['Penarikan Data (Update) dilakukan secara rutin 8 jam sekali'],
        ['Data Tarik : 2026-10-01 04:43:44'],
      ]);
      XLSX.utils.book_append_sheet(wb, wsGizi, 'MASALAH GIZI');
      const timestamp = DinkesSpreadsheetParser.extractDataFetchTimestamp(wb);
      expect(timestamp).toBe('2026-10-01 04:43:44');
      expect(DinkesSpreadsheetParser.formatTimestampForFilename(timestamp!)).toBe('2026-10-01 04-43-44');
    });

    it('harus mengembalikan null jika tidak ada sel Data Tarik', () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([['No', 'Kabupaten/Kota']]);
      XLSX.utils.book_append_sheet(wb, ws, 'anak');
      expect(DinkesSpreadsheetParser.extractDataFetchTimestamp(wb)).toBeNull();
      expect(DinkesSpreadsheetParser.extractDataFetchTimestamp(null)).toBeNull();
    });
  });
});
