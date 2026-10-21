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

    it('should correctly calculate age when birth date is an Excel serial number', () => {
      // 44749.29180555556 is 2022-07-07. Eval date 2026-01-20 -> exactly 42 months
      const serial = '44749.29180555556';
      const evalDate = '2026-01-20';
      const months = StuntingCohortEngine.calculateAgeInMonths(serial, evalDate);
      expect(months).toBe(42);
    });

    it('should return null if birth date is invalid or missing', () => {
      expect(StuntingCohortEngine.calculateAgeInMonths(undefined, '2024-01-01')).toBeNull();
      expect(StuntingCohortEngine.calculateAgeInMonths('invalid-date', '2024-01-01')).toBeNull();
    });
  });

  describe('parseDate and formatDateString', () => {
    it('should parse Excel serial numbers to clean YYYY-MM-DD date strings', () => {
      expect(StuntingCohortEngine.formatDateString(44749.29180555556)).toBe('2022-07-07');
      expect(StuntingCohortEngine.formatDateString('44749.29180555556')).toBe('2022-07-07');
    });

    it('should parse Indonesian DD/MM/YYYY and DD-MM-YYYY dates', () => {
      expect(StuntingCohortEngine.formatDateString('15/08/2023')).toBe('2023-08-15');
      expect(StuntingCohortEngine.formatDateString('01-06-2024')).toBe('2024-06-01');
    });

    it('should preserve ISO date strings', () => {
      expect(StuntingCohortEngine.formatDateString('2023-05-20')).toBe('2023-05-20');
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

    it('should correctly classify 4 transition statuses and assign children >= 60 months to AGED_OUT', () => {
      const evalDate = '2024-01-01';
      const result = StuntingCohortEngine.evaluateCohort(period1Rows, period2Rows, {
        p1Mapping: { nikKey: 'NIK', nameKey: 'Nama Balita', dobKey: 'Tanggal Lahir' },
        p2Mapping: { nikKey: 'NIK', nameKey: 'Nama Balita', dobKey: 'Tanggal Lahir' },
        evaluationDate: evalDate,
        p1Label: 'TW1',
        p2Label: 'TW2',
      });

      // Deduplicated unique children: P1 has 4 unique, P2 has active balita stunting of 2
      expect(result.summary.totalPeriod1).toBe(4);
      expect(result.summary.totalPeriod2).toBe(2);
      expect(result.summary.duplicateNikPeriod1Count).toBe(1);
      expect(result.summary.duplicateNikPeriod2Count).toBe(0);

      // Status counts: Anak E (age 72 mos) is AGED_OUT rather than persistent
      expect(result.summary.persistentCount).toBe(1); // Anak A
      expect(result.summary.recoveredCount).toBe(1);  // Anak B (age ~18 mos)
      expect(result.summary.agedOutCount).toBe(2);    // Anak C (age 72 mos) and Anak E (age 72 mos)
      expect(result.summary.newCaseCount).toBe(1);    // Anak D

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
      expect(anakE?.status).toBe(CohortTransitionStatus.AGED_OUT);
      expect(anakE?.statusLabel).toBe('Lulus Usia Balita');
    });

    it('should classify children aged >= 60 months as AGED_OUT while calculating growth delta', () => {
      const evalDate = '2026-01-20';
      // Simulating child like Naura Kusumawati: born 2020-11-01 (62 mos), stunting in P1 and P2
      const p1 = [
        {
          nik: '3375014111200349',
          nama: 'Naura Kusumawati',
          tgl_lahir: '2020-11-01',
          tinggi_cm: 96.1,
          stunting: 'Ya',
          status_tbu: 'Pendek',
        },
      ];
      const p2 = [
        {
          nik: '3375014111200349',
          nama: 'Naura Kusumawati',
          tgl_lahir: '2020-11-01',
          tinggi_cm: 98.3,
          stunting: 'Ya',
          status_tbu: 'Pendek',
        },
      ];

      const res = StuntingCohortEngine.evaluateCohort(p1, p2, {
        p1Mapping: {
          nikKey: 'nik',
          nameKey: 'nama',
          dobKey: 'tgl_lahir',
          heightKey: 'tinggi_cm',
          stuntingKey: 'stunting',
          tbuKey: 'status_tbu',
        },
        p2Mapping: {
          nikKey: 'nik',
          nameKey: 'nama',
          dobKey: 'tgl_lahir',
          heightKey: 'tinggi_cm',
          stuntingKey: 'stunting',
          tbuKey: 'status_tbu',
        },
        evaluationDate: evalDate,
        p1Label: 'Periode Awal',
        p2Label: 'Periode Evaluasi',
      });

      expect(res.children.length).toBe(1);
      const child = res.children[0];
      expect(child.ageMonths).toBe(62);
      expect(child.status).toBe(CohortTransitionStatus.AGED_OUT);
      expect(child.statusLabel).toBe('Lulus Usia Balita');
      expect(child.p1Height).toBe(96.1);
      expect(child.p2Height).toBe(98.3);
      expect(child.heightGain).toBe(2.2); // Growth delta is still calculated!
      expect(res.summary.agedOutCount).toBe(1);
      expect(res.summary.persistentCount).toBe(0);
      expect(res.summary.totalPeriod1).toBe(1);
      expect(res.summary.totalPeriod2).toBe(0); // Exits active under-5 stunting
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

    it('should accurately evaluate raw individual data containing both normal and stunted children', () => {
      const p1Raw = [
        // Child 1: Stunted in P1 (Ya, 70.0cm), will stay stunted in P2 (Ya, 72.0cm) -> PERSISTENT (+2.0cm)
        {
          nik_anak: '3301010001',
          nama_anak: 'Anak Tetap',
          tanggal_lahir: '2023-01-01',
          tinggi_badan_cm: '70.0',
          stunting: 'Ya',
          status_tbu: 'Pendek',
        },
        // Child 2: Stunted in P1 (Ya, 71.0cm), will recover in P2 (Tidak, 77.5cm) -> RECOVERED (+6.5cm)
        {
          nik_anak: '3301010002',
          nama_anak: 'Anak Sembuh',
          tanggal_lahir: '2023-03-01',
          tinggi_badan_cm: 71.0,
          stunting: 'Ya',
          status_tbu: 'Pendek',
        },
        // Child 3: Normal in P1 (Tidak, 85.0cm), will stay normal in P2 (Tidak, 89.0cm) -> SKIPPED FROM STUNTING COHORT
        {
          nik_anak: '3301010003',
          nama_anak: 'Anak Normal',
          tanggal_lahir: '2022-01-01',
          tinggi_badan_cm: 85.0,
          stunting: 'Tidak',
          status_tbu: 'Normal',
        },
        // Child 4: Normal in P1 (Tidak, 78.0cm), will become stunted in P2 (Ya, 79.2cm) -> NEW_CASE (+1.2cm)
        {
          nik_anak: '3301010004',
          nama_anak: 'Anak Baru',
          tanggal_lahir: '2023-06-01',
          tinggi_badan_cm: 78.0,
          stunting: 'Tidak',
          status_tbu: 'Normal',
        },
        // Child 5: Stunted in P1 (Ya, 90.0cm), age >= 60 in P2, not in P2 -> AGED_OUT
        {
          nik_anak: '3301010005',
          nama_anak: 'Anak Lulus',
          tanggal_lahir: '2019-01-01',
          tinggi_badan_cm: 90.0,
          stunting: 'Ya',
          status_tbu: 'Pendek',
        },
      ];

      const p2Raw = [
        {
          nik_anak: '3301010001',
          nama_anak: 'Anak Tetap',
          tanggal_lahir: '2023-01-01',
          tinggi_badan_cm: '72.0',
          stunting: 'Ya',
          status_tbu: 'Pendek',
        },
        {
          nik_anak: '3301010002',
          nama_anak: 'Anak Sembuh',
          tanggal_lahir: '2023-03-01',
          tinggi_badan_cm: 77.5,
          stunting: 'Tidak',
          status_tbu: 'Normal',
        },
        {
          nik_anak: '3301010003',
          nama_anak: 'Anak Normal',
          tanggal_lahir: '2022-01-01',
          tinggi_badan_cm: 89.0,
          stunting: 'Tidak',
          status_tbu: 'Normal',
        },
        {
          nik_anak: '3301010004',
          nama_anak: 'Anak Baru',
          tanggal_lahir: '2023-06-01',
          tinggi_badan_cm: 79.2,
          stunting: 'Ya',
          status_tbu: 'Pendek',
        },
      ];

      const p1Mapping = StuntingCohortEngine.detectColumnKeys(Object.keys(p1Raw[0]));
      const p2Mapping = StuntingCohortEngine.detectColumnKeys(Object.keys(p2Raw[0]));

      expect(p1Mapping.nikKey).toBe('nik_anak');
      expect(p1Mapping.stuntingKey).toBe('stunting');
      expect(p1Mapping.heightKey).toBe('tinggi_badan_cm');

      const result = StuntingCohortEngine.evaluateCohort(p1Raw, p2Raw, {
        p1Mapping,
        p2Mapping,
        evaluationDate: '2024-07-01',
        p1Label: 'Baseline',
        p2Label: 'Evaluasi',
      });

      // Child 3 (Normal in both) must NOT be in stunting cohort list!
      expect(result.children.find((c) => c.nik === '3301010003')).toBeUndefined();
      expect(result.children.length).toBe(4);

      // Total stunting in P1: Anak Tetap (1), Anak Sembuh (2), Anak Lulus (5) = 3
      expect(result.summary.totalPeriod1).toBe(3);
      // Total stunting in P2: Anak Tetap (1), Anak Baru (4) = 2
      expect(result.summary.totalPeriod2).toBe(2);
      expect(result.summary.persistentCount).toBe(1);
      expect(result.summary.recoveredCount).toBe(1);
      expect(result.summary.newCaseCount).toBe(1);
      expect(result.summary.agedOutCount).toBe(1);
      expect(result.summary.netChange).toBe(-1); // 2 - 3 = -1

      // Verify anthropometric delta calculation
      const anakSembuh = result.children.find((c) => c.nik === '3301010002');
      expect(anakSembuh?.status).toBe(CohortTransitionStatus.RECOVERED);
      expect(anakSembuh?.p1Height).toBe(71.0);
      expect(anakSembuh?.p2Height).toBe(77.5);
      expect(anakSembuh?.heightGain).toBe(6.5);

      const anakBaru = result.children.find((c) => c.nik === '3301010004');
      expect(anakBaru?.status).toBe(CohortTransitionStatus.NEW_CASE);
      expect(anakBaru?.heightGain).toBe(1.2);
    });
  });

  describe('isChildStuntingInRow', () => {
    const mapping = {
      stuntingKey: 'stunting',
      tbuKey: 'status_tbu',
      zscoreTbuKey: 'zscore_tbu',
    };

    it('should return true for stunting = "Ya" and false for "Tidak"', () => {
      expect(StuntingCohortEngine.isChildStuntingInRow({ stunting: 'Ya' }, mapping, true)).toBe(true);
      expect(StuntingCohortEngine.isChildStuntingInRow({ stunting: 'Tidak' }, mapping, true)).toBe(false);
    });

    it('should check status_tbu if stunting key is not present', () => {
      const tbuMapping = { tbuKey: 'status_tbu' };
      expect(StuntingCohortEngine.isChildStuntingInRow({ status_tbu: 'Pendek' }, tbuMapping, true)).toBe(true);
      expect(StuntingCohortEngine.isChildStuntingInRow({ status_tbu: 'Sangat Pendek' }, tbuMapping, true)).toBe(true);
      expect(StuntingCohortEngine.isChildStuntingInRow({ status_tbu: 'Normal' }, tbuMapping, true)).toBe(false);
    });

    it('should evaluate zscore_tbu < -2.0 SD', () => {
      const zMapping = { zscoreTbuKey: 'zscore_tbu' };
      expect(StuntingCohortEngine.isChildStuntingInRow({ zscore_tbu: '-2.45' }, zMapping, true)).toBe(true);
      expect(StuntingCohortEngine.isChildStuntingInRow({ zscore_tbu: -1.5 }, zMapping, true)).toBe(false);
    });

    it('should return true when hasIndicator is false (legacy mode)', () => {
      expect(StuntingCohortEngine.isChildStuntingInRow({ anyCol: '123' }, {}, false)).toBe(true);
    });
  });
  describe('isChildConditionInRow', () => {
    const mapping = {
      stuntingKey: 'stunting',
      tbuKey: 'status_tbu',
      zscoreTbuKey: 'zscore_tbu',
      wastingKey: 'wasting',
      bbtbKey: 'status_bbtb',
      zscoreBbtbKey: 'zscore_bbtb',
      underweightKey: 'underweight',
      bbuKey: 'status_bbu',
      zscoreBbuKey: 'zscore_bbu',
      giziBurukKey: 'gizi_buruk',
      overweightKey: 'overweight',
    };

    it('should correctly evaluate wasting by direct key, BB/TB status, and Z-Score < -2.0 SD', () => {
      expect(StuntingCohortEngine.isChildConditionInRow({ wasting: 'Ya' }, mapping, 'wasting', true)).toBe(true);
      expect(StuntingCohortEngine.isChildConditionInRow({ wasting: 'Tidak' }, mapping, 'wasting', true)).toBe(false);
      expect(StuntingCohortEngine.isChildConditionInRow({ status_bbtb: 'Gizi Kurang' }, mapping, 'wasting', true)).toBe(true);
      expect(StuntingCohortEngine.isChildConditionInRow({ status_bbtb: 'Gizi Buruk' }, mapping, 'wasting', true)).toBe(true);
      expect(StuntingCohortEngine.isChildConditionInRow({ status_bbtb: 'Normal' }, mapping, 'wasting', true)).toBe(false);
      expect(StuntingCohortEngine.isChildConditionInRow({ zscore_bbtb: -2.35 }, mapping, 'wasting', true)).toBe(true);
      expect(StuntingCohortEngine.isChildConditionInRow({ zscore_bbtb: -1.2 }, mapping, 'wasting', true)).toBe(false);
    });

    it('should correctly evaluate underweight by direct key, BB/U status, and Z-Score < -2.0 SD', () => {
      expect(StuntingCohortEngine.isChildConditionInRow({ underweight: 'Ya' }, mapping, 'underweight', true)).toBe(true);
      expect(StuntingCohortEngine.isChildConditionInRow({ underweight: 'Tidak' }, mapping, 'underweight', true)).toBe(false);
      expect(StuntingCohortEngine.isChildConditionInRow({ status_bbu: 'Berat Badan Kurang' }, mapping, 'underweight', true)).toBe(true);
      expect(StuntingCohortEngine.isChildConditionInRow({ status_bbu: 'Sangat Kurang' }, mapping, 'underweight', true)).toBe(true);
      expect(StuntingCohortEngine.isChildConditionInRow({ status_bbu: 'Normal' }, mapping, 'underweight', true)).toBe(false);
      expect(StuntingCohortEngine.isChildConditionInRow({ zscore_bbu: -2.15 }, mapping, 'underweight', true)).toBe(true);
      expect(StuntingCohortEngine.isChildConditionInRow({ zscore_bbu: 0.5 }, mapping, 'underweight', true)).toBe(false);
    });

    it('should correctly evaluate gizi_buruk by direct key, BB/TB status, and Z-Score < -3.0 SD', () => {
      expect(StuntingCohortEngine.isChildConditionInRow({ gizi_buruk: 'Ya' }, mapping, 'gizi_buruk', true)).toBe(true);
      expect(StuntingCohortEngine.isChildConditionInRow({ gizi_buruk: 'Tidak' }, mapping, 'gizi_buruk', true)).toBe(false);
      expect(StuntingCohortEngine.isChildConditionInRow({ status_bbtb: 'Gizi Buruk (Severely Wasted)' }, mapping, 'gizi_buruk', true)).toBe(true);
      expect(StuntingCohortEngine.isChildConditionInRow({ status_bbtb: 'Gizi Kurang' }, mapping, 'gizi_buruk', true)).toBe(false);
      expect(StuntingCohortEngine.isChildConditionInRow({ zscore_bbtb: -3.25 }, mapping, 'gizi_buruk', true)).toBe(true);
      expect(StuntingCohortEngine.isChildConditionInRow({ zscore_bbtb: -2.5 }, mapping, 'gizi_buruk', true)).toBe(false);
    });

    it('should correctly evaluate overweight by direct key, BB/TB status, and Z-Score > +2.0 SD', () => {
      expect(StuntingCohortEngine.isChildConditionInRow({ overweight: 'Ya' }, mapping, 'overweight', true)).toBe(true);
      expect(StuntingCohortEngine.isChildConditionInRow({ overweight: 'Tidak' }, mapping, 'overweight', true)).toBe(false);
      expect(StuntingCohortEngine.isChildConditionInRow({ status_bbtb: 'Gizi Lebih' }, mapping, 'overweight', true)).toBe(true);
      expect(StuntingCohortEngine.isChildConditionInRow({ status_bbtb: 'Obesitas' }, mapping, 'overweight', true)).toBe(true);
      expect(StuntingCohortEngine.isChildConditionInRow({ status_bbtb: 'Normal' }, mapping, 'overweight', true)).toBe(false);
      expect(StuntingCohortEngine.isChildConditionInRow({ zscore_bbtb: 2.45 }, mapping, 'overweight', true)).toBe(true);
      expect(StuntingCohortEngine.isChildConditionInRow({ zscore_bbtb: 1.5 }, mapping, 'overweight', true)).toBe(false);
    });
  });

  describe('getStatusLabels', () => {
    it('should return authentic Indonesian labels for all 5 indicators', () => {
      const stuntingLabels = StuntingCohortEngine.getStatusLabels('stunting');
      expect(stuntingLabels[CohortTransitionStatus.PERSISTENT]).toBe('Tetap Stunting');
      expect(stuntingLabels[CohortTransitionStatus.RECOVERED]).toBe('Bebas Stunting');
      expect(stuntingLabels[CohortTransitionStatus.NEW_CASE]).toBe('Kasus Baru Stunting');
      expect(stuntingLabels[CohortTransitionStatus.AGED_OUT]).toBe('Lulus Usia Balita');

      const wastingLabels = StuntingCohortEngine.getStatusLabels('wasting');
      expect(wastingLabels[CohortTransitionStatus.PERSISTENT]).toBe('Tetap Wasting');
      expect(wastingLabels[CohortTransitionStatus.RECOVERED]).toBe('Bebas Wasting');

      const underweightLabels = StuntingCohortEngine.getStatusLabels('underweight');
      expect(underweightLabels[CohortTransitionStatus.PERSISTENT]).toBe('Tetap Underweight');
      expect(underweightLabels[CohortTransitionStatus.RECOVERED]).toBe('Bebas Underweight');

      const giziBurukLabels = StuntingCohortEngine.getStatusLabels('gizi_buruk');
      expect(giziBurukLabels[CohortTransitionStatus.PERSISTENT]).toBe('Tetap Gizi Buruk');

      const overweightLabels = StuntingCohortEngine.getStatusLabels('overweight');
      expect(overweightLabels[CohortTransitionStatus.PERSISTENT]).toBe('Tetap Overweight');
    });
  });

  describe('evaluateCohort across indicators', () => {
    const p1Rows = [
      {
        nik: '101',
        nama: 'Anak Wasting Tetap',
        tgl_lahir: '2023-01-01',
        bb_kg: 8.5,
        tb_cm: 80,
        status_bbtb: 'Gizi Kurang',
        status_bbu: 'Berat Normal',
      },
      {
        nik: '102',
        nama: 'Anak Sembuh Wasting',
        tgl_lahir: '2023-01-01',
        bb_kg: 8.0,
        tb_cm: 78,
        status_bbtb: 'Gizi Kurang',
        status_bbu: 'Berat Kurang',
      },
    ];

    const p2Rows = [
      {
        nik: '101',
        nama: 'Anak Wasting Tetap',
        tgl_lahir: '2023-01-01',
        bb_kg: 9.0,
        tb_cm: 84,
        status_bbtb: 'Gizi Kurang',
        status_bbu: 'Berat Normal',
      },
      {
        nik: '102',
        nama: 'Anak Sembuh Wasting',
        tgl_lahir: '2023-01-01',
        bb_kg: 10.5,
        tb_cm: 83,
        status_bbtb: 'Normal',
        status_bbu: 'Berat Normal',
      },
      {
        nik: '103',
        nama: 'Anak Kasus Baru Wasting',
        tgl_lahir: '2023-06-01',
        bb_kg: 7.2,
        tb_cm: 77,
        status_bbtb: 'Gizi Buruk',
        status_bbu: 'Berat Kurang',
      },
    ];

    it('should correctly evaluate wasting cohort', () => {
      const mapping = {
        nikKey: 'nik',
        nameKey: 'nama',
        dobKey: 'tgl_lahir',
        weightKey: 'bb_kg',
        heightKey: 'tb_cm',
        bbtbKey: 'status_bbtb',
        bbuKey: 'status_bbu',
      };

      const result = StuntingCohortEngine.evaluateCohort(p1Rows, p2Rows, {
        p1Mapping: mapping,
        p2Mapping: mapping,
        evaluationDate: '2024-06-01',
        indicator: 'wasting',
      });

      expect(result.indicator).toBe('wasting');
      expect(result.summary.totalPeriod1).toBe(2);
      expect(result.summary.totalPeriod2).toBe(2); // 101 (tetap) + 103 (baru)
      expect(result.summary.persistentCount).toBe(1);
      expect(result.summary.recoveredCount).toBe(1);
      expect(result.summary.newCaseCount).toBe(1);

      const recovered = result.children.find((c) => c.nik === '102');
      expect(recovered?.status).toBe(CohortTransitionStatus.RECOVERED);
      expect(recovered?.statusLabel).toBe('Bebas Wasting');
      expect(recovered?.weightGain).toBe(2.5);
    });

    it('should generate an authentic Excel workbook for non-stunting indicator', () => {
      const mapping = {
        nikKey: 'nik',
        nameKey: 'nama',
        dobKey: 'tgl_lahir',
        weightKey: 'bb_kg',
        heightKey: 'tb_cm',
        bbtbKey: 'status_bbtb',
      };

      const result = StuntingCohortEngine.evaluateCohort(p1Rows, p2Rows, {
        p1Mapping: mapping,
        p2Mapping: mapping,
        evaluationDate: '2024-06-01',
        indicator: 'wasting',
      });

      const wb = StuntingCohortEngine.generateExcelWorkbook(result);
      expect(wb.SheetNames).toContain('Ringkasan Eksekutif');
      expect(wb.SheetNames).toContain('Semua Balita');
      expect(wb.SheetNames).toContain('Tetap Wasting');
      expect(wb.SheetNames).toContain('Bebas Wasting');
    });

    it('should classify children missing in Period 2 as RECOVERED (lulus stunting) and track missingPeriod2Count', () => {
      const p1 = [
        {
          nik: '3301010099',
          nama: 'Anak Missing P2',
          tgl_lahir: '2023-05-01',
          tinggi_cm: 72.0,
          stunting: 'Ya',
          status_tbu: 'Pendek',
        },
      ];
      // Period 2 does not contain this child at all (missing / dropout / moved)
      const p2: Record<string, unknown>[] = [];

      const mapping = {
        nikKey: 'nik',
        nameKey: 'nama',
        dobKey: 'tgl_lahir',
        heightKey: 'tinggi_cm',
        stuntingKey: 'stunting',
        tbuKey: 'status_tbu',
      };

      const result = StuntingCohortEngine.evaluateCohort(p1, p2, {
        p1Mapping: mapping,
        p2Mapping: mapping,
        evaluationDate: '2024-06-01',
        indicator: 'stunting',
      });

      expect(result.summary.totalPeriod1).toBe(1);
      expect(result.summary.totalPeriod2).toBe(0);
      expect(result.summary.recoveredCount).toBe(1);
      expect(result.summary.missingPeriod2Count).toBe(1);

      const child = result.children[0];
      expect(child.nik).toBe('3301010099');
      expect(child.status).toBe(CohortTransitionStatus.RECOVERED);
      expect(child.statusLabel).toBe('Bebas Stunting');
      expect(child.inPeriod2).toBe(false);
      expect(child.heightGain).toBeNull();

      // Excel export should note missing P2
      const wb = StuntingCohortEngine.generateExcelWorkbook(result);
      const sheet = wb.Sheets['Semua Balita'];
      expect(sheet).toBeDefined();
    });

    it('should accurately evaluate gizi buruk cohort with severe acute malnutrition', () => {
      const p1Rows = [
        {
          nik: 'GB001',
          nama: 'Anak GB Tetap',
          tgl_lahir: '2023-01-01',
          bb_kg: 6.8,
          tb_cm: 78,
          status_bbtb: 'Gizi Buruk',
        },
        {
          nik: 'GB002',
          nama: 'Anak GB Sembuh',
          tgl_lahir: '2023-02-01',
          bb_kg: 6.9,
          tb_cm: 79,
          status_bbtb: 'Gizi Buruk',
        },
      ];

      const p2Rows = [
        {
          nik: 'GB001',
          nama: 'Anak GB Tetap',
          tgl_lahir: '2023-01-01',
          bb_kg: 7.2,
          tb_cm: 82,
          status_bbtb: 'Gizi Buruk',
        },
        {
          nik: 'GB002',
          nama: 'Anak GB Sembuh',
          tgl_lahir: '2023-02-01',
          bb_kg: 9.8,
          tb_cm: 83,
          status_bbtb: 'Normal',
        },
        {
          nik: 'GB003',
          nama: 'Anak GB Baru',
          tgl_lahir: '2023-04-01',
          bb_kg: 7.0,
          tb_cm: 80,
          status_bbtb: 'Gizi Buruk',
        },
      ];

      const mapping = {
        nikKey: 'nik',
        nameKey: 'nama',
        dobKey: 'tgl_lahir',
        weightKey: 'bb_kg',
        heightKey: 'tb_cm',
        bbtbKey: 'status_bbtb',
      };

      const result = StuntingCohortEngine.evaluateCohort(p1Rows, p2Rows, {
        p1Mapping: mapping,
        p2Mapping: mapping,
        evaluationDate: '2024-06-01',
        indicator: 'gizi_buruk',
      });

      expect(result.indicator).toBe('gizi_buruk');
      expect(result.summary.totalPeriod1).toBe(2);
      expect(result.summary.totalPeriod2).toBe(2); // GB001 + GB003
      expect(result.summary.persistentCount).toBe(1);
      expect(result.summary.recoveredCount).toBe(1);
      expect(result.summary.newCaseCount).toBe(1);

      const persistent = result.children.find((c) => c.nik === 'GB001');
      expect(persistent?.statusLabel).toBe('Tetap Gizi Buruk');

      const recovered = result.children.find((c) => c.nik === 'GB002');
      expect(recovered?.statusLabel).toBe('Bebas Gizi Buruk');
      expect(recovered?.weightGain).toBe(2.9);
    });
  });
});

