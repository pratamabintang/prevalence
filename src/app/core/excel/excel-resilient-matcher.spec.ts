import { describe, expect, it } from 'vitest';
import { ExcelResilientMatcher } from './excel-resilient-matcher';
import { ColumnInfo } from '../../shared/excel';

describe('ExcelResilientMatcher', () => {
  describe('normalizeKey and cleanAlphanumeric', () => {
    it('should normalize strings by lowercasing and replacing whitespace with underscore', () => {
      expect(ExcelResilientMatcher.normalizeKey('  Nama  Kabupaten / Kota  ')).toBe('nama_kabupaten_/_kota');
      expect(ExcelResilientMatcher.cleanAlphanumeric('  Nama  Kabupaten / Kota  ')).toBe('namakabupatenkota');
    });
  });

  describe('findMatchingSheet', () => {
    const sheets = ['Rekap Data Bulanan 2026', 'Data Kasus', 'Grafik Utama', 'MASALAH GIZI'];

    it('should match exact name', () => {
      expect(ExcelResilientMatcher.findMatchingSheet('Data Kasus', sheets)).toBe('Data Kasus');
    });

    it('should match case-insensitive and normalized name', () => {
      expect(ExcelResilientMatcher.findMatchingSheet('rekap data bulanan 2026', sheets)).toBe('Rekap Data Bulanan 2026');
      expect(ExcelResilientMatcher.findMatchingSheet('rekap_data_bulanan_2026', sheets)).toBe('Rekap Data Bulanan 2026');
    });

    it('should match loose substring', () => {
      expect(ExcelResilientMatcher.findMatchingSheet('Kasus', sheets)).toBe('Data Kasus');
    });

    it('should avoid matching conflict keywords like masalah and grafik when not present in preset', () => {
      const targetSheets = ['Data Anak', 'MASALAH GIZI', 'grafik anak'];
      expect(ExcelResilientMatcher.findMatchingSheet('anak', targetSheets)).toBe('Data Anak');
    });
  });

  describe('matchSheets (1-to-1 Mapping)', () => {
    it('should map preset sheets 1-to-1 and protect against conflicting sheets', () => {
      const available = ['anak', 'gizi', 'BUMIL', 'MASALAH GIZI', 'grafik bumil'];
      const presets = [
        { sheetName: 'anak' },
        { sheetName: 'gizi' },
        { sheetName: 'BUMIL' },
      ];

      const mapped = ExcelResilientMatcher.matchSheets(available, presets);

      expect(mapped.size).toBe(3);
      expect(mapped.get('anak')?.sheetName).toBe('anak');
      expect(mapped.get('gizi')?.sheetName).toBe('gizi');
      expect(mapped.get('BUMIL')?.sheetName).toBe('BUMIL');
      expect(mapped.has('MASALAH GIZI')).toBe(false);
      expect(mapped.has('grafik bumil')).toBe(false);
    });
  });

  describe('findMatchingHeader', () => {
    const cols: ColumnInfo[] = [
      { colIndex: 0, colLetter: 'A', header: 'Imunisasi Dasar - HB-0 - Target', leafHeader: 'Target', layers: ['Imunisasi Dasar', 'HB-0', 'Target'] },
      { colIndex: 1, colLetter: 'B', header: 'Nama Kabupaten / Kota', leafHeader: 'Nama Kabupaten / Kota', layers: ['Nama Kabupaten / Kota'] },
      { colIndex: 2, colLetter: 'AY', header: 'ASI Eksklusif - %', leafHeader: '%', layers: [] },
      { colIndex: 3, colLetter: 'BA', header: 'ASI Eksklusif - % (2)', leafHeader: '%', layers: [] },
      { colIndex: 4, colLetter: 'BC', header: 'ASI Eksklusif - % (3)', leafHeader: '%', layers: [] },
    ];

    it('should match exact and leaf sub-header', () => {
      expect(ExcelResilientMatcher.findMatchingHeader('Imunisasi Dasar - HB-0 - Target', cols)).toBe(
        'Imunisasi Dasar - HB-0 - Target',
      );
      expect(ExcelResilientMatcher.findMatchingHeader('Target', cols)).toBe('Imunisasi Dasar - HB-0 - Target');
    });

    it('should match clean alphanumeric format', () => {
      expect(ExcelResilientMatcher.findMatchingHeader('nama kabupaten kota', cols)).toBe('Nama Kabupaten / Kota');
    });

    it('should tolerate adjusted duplicate suffix numbers', () => {
      // Preset was saved with suffix (4), but current sheet only has suffix up to (3)
      const matched = ExcelResilientMatcher.findMatchingHeader('ASI Eksklusif - % (4)', cols);
      expect(matched).toBe('ASI Eksklusif - % (3)');
    });
  });

  describe('findMatchingJoinKey', () => {
    it('should match join key across casing and normalization', () => {
      const keys = ['No', 'Kabupaten/Kota', 'Puskesmas'];
      expect(ExcelResilientMatcher.findMatchingJoinKey('kabupaten kota', keys)).toBe('Kabupaten/Kota');
      expect(ExcelResilientMatcher.findMatchingJoinKey('Puskesmas', keys)).toBe('Puskesmas');
      expect(ExcelResilientMatcher.findMatchingJoinKey('unknown', keys)).toBeUndefined();
    });
  });
});
