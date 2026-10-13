import { describe, it, expect } from 'vitest';
import {
  StuntingCohortEngine,
  CohortTransitionStatus,
} from './stunting-cohort-engine';

describe('StuntingCohortEngine', () => {
  describe('sanitizeNik', () => {
    it('should strip leading and trailing whitespace from string NIK', () => {
      expect(StuntingCohortEngine.sanitizeNik('  3301011204220001  ')).toBe('3301011204220001');
    });

    it('should handle numeric input without losing precision', () => {
      expect(StuntingCohortEngine.sanitizeNik(3301011204220001)).toBe('3301011204220001');
    });

    it('should parse scientific notation string from Excel export', () => {
      // 3.30101120422e+15 or similar
      const sci = '3.301011204220001e+15';
      const sanitized = StuntingCohortEngine.sanitizeNik(sci);
      expect(sanitized).toBe('3301011204220001');
    });

    it('should handle empty or null input gracefully', () => {
      expect(StuntingCohortEngine.sanitizeNik('')).toBe('');
      expect(StuntingCohortEngine.sanitizeNik(null)).toBe('');
      expect(StuntingCohortEngine.sanitizeNik(undefined)).toBe('');
    });
  });

  describe('isValid16Digits', () => {
    it('should validate exact 16-digit numeric strings', () => {
      expect(StuntingCohortEngine.isValid16Digits('3301011204220001')).toBe(true);
      expect(StuntingCohortEngine.isValid16Digits('12345')).toBe(false);
      expect(StuntingCohortEngine.isValid16Digits('330101120422000A')).toBe(false);
      expect(StuntingCohortEngine.isValid16Digits('')).toBe(false);
    });
  });

  describe('calculateAgeInMonths', () => {
    it('should accurately calculate age in months between birth date and evaluation date', () => {
      const birth = '2023-01-15';
      const evalDate = '2024-01-15';
      // Exactly 365 days -> ~11 or 12 months
      const months = StuntingCohortEngine.calculateAgeInMonths(birth, evalDate);
      expect(months).toBe(12);
    });

    it('should correctly determine age for child older than 5 years (60+ months)', () => {
      const birth = '2019-01-01';
      const evalDate = '2024-02-01';
      const months = StuntingCohortEngine.calculateAgeInMonths(birth, evalDate);
      expect(months).toBeGreaterThanOrEqual(60);
    });

    it('should return null if birth date is invalid or missing', () => {
      expect(StuntingCohortEngine.calculateAgeInMonths(undefined, '2024-01-01')).toBeNull();
      expect(StuntingCohortEngine.calculateAgeInMonths('invalid-date', '2024-01-01')).toBeNull();
    });
  });

  describe('detectColumnKeys', () => {
    it('should auto-detect standard column headers', () => {
      const columns = ['No', 'NIK', 'Nama Balita', 'Tanggal Lahir', 'Puskesmas', 'Desa/Kelurahan'];
      const mapping = StuntingCohortEngine.detectColumnKeys(columns);

      expect(mapping.nikKey).toBe('NIK');
      expect(mapping.nameKey).toBe('Nama Balita');
      expect(mapping.dobKey).toBe('Tanggal Lahir');
      expect(mapping.puskesmasKey).toBe('Puskesmas');
    });

    it('should detect case-insensitive variations and aliases', () => {
      const columns = ['id', 'nik_anak', 'nama_lengkap', 'tgl_lahir', 'faskes'];
      const mapping = StuntingCohortEngine.detectColumnKeys(columns);

      expect(mapping.nikKey).toBe('nik_anak');
      expect(mapping.nameKey).toBe('nama_lengkap');
      expect(mapping.dobKey).toBe('tgl_lahir');
    });
  });

  describe('evaluateCohort', () => {
    const period1Rows = [
      // 1. Will persist in P2
      { NIK: '3301010001', 'Nama Balita': 'Anak A', 'Tanggal Lahir': '2023-01-01' },
      // 2. Will exit P2 (<60 mos -> Bebas Stunting)
      { NIK: '3301010002', 'Nama Balita': 'Anak B', 'Tanggal Lahir': '2022-06-01' },
      // 3. Will exit P2 (>=60 mos -> Lulus Usia Balita)
      { NIK: '3301010003', 'Nama Balita': 'Anak C', 'Tanggal Lahir': '2018-01-01' },
      // Duplicate NIK row in P1
      { NIK: '3301010001', 'Nama Balita': 'Anak A Duplikat', 'Tanggal Lahir': '2023-01-01' },
      // 5. Outlier child: >= 60 months and persists in P2
      { NIK: '3301010005', 'Nama Balita': 'Anak E (Outlier)', 'Tanggal Lahir': '2018-01-01' },
    ];

    const period2Rows = [
      // 1. Persistent
      { NIK: '3301010001', 'Nama Balita': 'Anak A', 'Tanggal Lahir': '2023-01-01' },
      // 4. New Case
      { NIK: '3301010004', 'Nama Balita': 'Anak D', 'Tanggal Lahir': '2023-08-01' },
      // 5. Outlier child persisting in P2
      { NIK: '3301010005', 'Nama Balita': 'Anak E (Outlier)', 'Tanggal Lahir': '2018-01-01' },
    ];

    it('should correctly classify 4 transition statuses and aggregate KPIs including age outliers', () => {
      const evalDate = '2024-01-01';
      const result = StuntingCohortEngine.evaluateCohort(period1Rows, period2Rows, {
        p1Mapping: { nikKey: 'NIK', nameKey: 'Nama Balita', dobKey: 'Tanggal Lahir' },
        p2Mapping: { nikKey: 'NIK', nameKey: 'Nama Balita', dobKey: 'Tanggal Lahir' },
        evaluationDate: evalDate,
        p1Label: 'TW1',
        p2Label: 'TW2',
      });

      // Deduplicated unique children: P1 has 4 unique, P2 has 3 unique
      expect(result.summary.totalPeriod1).toBe(4);
      expect(result.summary.totalPeriod2).toBe(3);
      expect(result.summary.duplicateNikPeriod1Count).toBe(1);
      expect(result.summary.duplicateNikPeriod2Count).toBe(0);

      // Status counts
      expect(result.summary.persistentCount).toBe(2); // Anak A and Anak E
      expect(result.summary.recoveredCount).toBe(1);  // Anak B (age ~18 mos)
      expect(result.summary.agedOutCount).toBe(1);    // Anak C (age 72 mos)
      expect(result.summary.newCaseCount).toBe(1);    // Anak D
      expect(result.summary.ageOutlierPeriod2Count).toBe(1); // Anak E in P2 with age 72 mos

      // Verify individual records
      const anakA = result.children.find((c) => c.nik === '3301010001');
      expect(anakA?.status).toBe(CohortTransitionStatus.PERSISTENT);
      expect(anakA?.isAgeOutlier).toBe(false);

      const anakB = result.children.find((c) => c.nik === '3301010002');
      expect(anakB?.status).toBe(CohortTransitionStatus.RECOVERED);

      const anakC = result.children.find((c) => c.nik === '3301010003');
      expect(anakC?.status).toBe(CohortTransitionStatus.AGED_OUT);

      const anakD = result.children.find((c) => c.nik === '3301010004');
      expect(anakD?.status).toBe(CohortTransitionStatus.NEW_CASE);
      expect(anakD?.statusLabel).toBe('Kasus Baru Stunting');

      const anakE = result.children.find((c) => c.nik === '3301010005');
      expect(anakE?.status).toBe(CohortTransitionStatus.PERSISTENT);
      expect(anakE?.isAgeOutlier).toBe(true);
    });

    it('should generate a 6-sheet Excel workbook with correct sheet names and data rows', () => {
      const evalDate = '2024-01-01';
      const result = StuntingCohortEngine.evaluateCohort(period1Rows, period2Rows, {
        p1Mapping: { nikKey: 'NIK', nameKey: 'Nama Balita', dobKey: 'Tanggal Lahir' },
        p2Mapping: { nikKey: 'NIK', nameKey: 'Nama Balita', dobKey: 'Tanggal Lahir' },
        evaluationDate: evalDate,
        p1Label: 'TW1',
        p2Label: 'TW2',
      });

      const wb = StuntingCohortEngine.generateExcelWorkbook(result);
      expect(wb.SheetNames).toEqual([
        'Ringkasan Eksekutif',
        'Semua Balita',
        'Tetap Stunting',
        'Bebas Stunting',
        'Kasus Baru',
        'Lulus Usia Balita',
      ]);
      expect(wb.Sheets['Ringkasan Eksekutif']).toBeDefined();
      expect(wb.Sheets['Semua Balita']).toBeDefined();
    });
  });
});

