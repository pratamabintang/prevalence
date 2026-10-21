import { describe, expect, it } from 'vitest';
import {
  EvaluatedStuntingRow,
  StuntingEvaluationEngine,
  StuntingIndicatorInput,
} from './stunting-evaluation-engine';

describe('StuntingEvaluationEngine', () => {
  const sampleIndicators: StuntingIndicatorInput[] = [
    {
      category: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
      no: 1,
      name: 'Remaja putri menerima TTD',
      targetPrevYear: '80%',
      actualPrevYear: '20%', // Baseline perbandingan TW1 tahun lalu
      targetCurrentYear: '85%',
      tw1Actual: '22%', // Expected TW1 = 25% * 85% = 21.25%, Gap = +0.75% -> On Track
      tw2Actual: '45%', // Expected TW2 = 50% * 85% = 42.5%, Gap = +2.5% -> On Track
      tw3Actual: '65%', // Expected TW3 = 75% * 85% = 63.75%, Gap = +1.25% -> On Track
    },
    {
      category: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
      no: 2,
      name: 'Ibu hamil KEK mendapatkan makanan tambahan (MT)',
      targetPrevYear: 80,
      actualPrevYear: 16, // Baseline perbandingan TW1 tahun lalu
      targetCurrentYear: 80,
      tw1Actual: 18, // Expected TW1 = 20, Gap = -2 -> Perlu Perhatian (toleransi -5, tren naik dari 16)
      tw2Actual: 36, // Expected TW2 = 40, Gap = -4 -> Perlu Perhatian
      tw3Actual: 50, // Expected TW3 = 60, Gap = -10 -> Perlu Percepatan (< -5)
    },
    {
      category: 'Intervensi untuk balita (setelah kelahiran)',
      no: 3,
      name: 'Balita gizi kurang mendapat makanan tambahan (MT)',
      targetPrevYear: 90,
      actualPrevYear: 18,
      targetCurrentYear: 90,
      tw1Actual: 15, // Expected TW1 = 22.5, Gap = -7.5 -> Perlu Percepatan
      tw2Actual: 30, // Expected TW2 = 45, Gap = -15 -> Perlu Percepatan
      tw3Actual: 45, // Expected TW3 = 67.5, Gap = -22.5 -> Perlu Percepatan
    },
    {
      category: 'Intervensi untuk balita (setelah kelahiran)',
      no: 4,
      name: 'Balita wasting (prevalensi kasus - lebih rendah lebih baik)',
      polarity: 'negative', // Negatif: Semakin kecil semakin baik
      targetPrevYear: 7.0,
      actualPrevYear: 6.5,
      targetCurrentYear: 6.0,
      tw1Target: 6.0, // Target khusus prevalensi triwulan (bukan kumulatif)
      tw2Target: 6.0,
      tw3Target: 6.0,
      tw1Actual: 5.8, // Expected = 6.0, Gap = 6.0 - 5.8 = +0.2 -> On Track
      tw2Actual: 5.5,
      tw3Actual: 6.5, // Expected = 6.0, Gap = 6.0 - 6.5 = -0.5 -> Perlu Perhatian
    },
    {
      category: 'Intervensi lainnya',
      no: 5,
      name: 'Keluarga berisiko stunting memperoleh pendampingan',
      targetPrevYear: '-',
      actualPrevYear: '-',
      targetCurrentYear: 90,
      tw1Actual: '-', // Data tidak tersedia -> Belum Dapat Dinilai
      tw2Actual: null,
      tw3Actual: '',
    },
  ];

  it('should calculate proportional expected achievement when specific quarter target is absent', () => {
    const expectedTw1 = StuntingEvaluationEngine.calculateExpectedAchievement(80, 1, null);
    const expectedTw2 = StuntingEvaluationEngine.calculateExpectedAchievement(80, 2, null);
    const expectedTw3 = StuntingEvaluationEngine.calculateExpectedAchievement(80, 3, null);
    const expectedTw4 = StuntingEvaluationEngine.calculateExpectedAchievement(80, 4, null);

    expect(expectedTw1).toBe(20); // 25% of 80
    expect(expectedTw2).toBe(40); // 50% of 80
    expect(expectedTw3).toBe(60); // 75% of 80
    expect(expectedTw4).toBe(80); // 100% of 80
  });

  it('should prioritize specific quarter target over proportional distribution', () => {
    // Specific target for TW2 is 35 (instead of 40)
    const expected = StuntingEvaluationEngine.calculateExpectedAchievement(80, 2, 35);
    expect(expected).toBe(35);
  });

  it('should calculate directional gap correctly based on indicator polarity', () => {
    // Positive indicator (higher is better)
    const posGap1 = StuntingEvaluationEngine.calculateGap(25, 20, 'positive');
    const posGap2 = StuntingEvaluationEngine.calculateGap(18, 20, 'positive');
    expect(posGap1).toBe(5);
    expect(posGap2).toBe(-2);

    // Negative indicator (lower is better, e.g. prevalence/wasting)
    const negGap1 = StuntingEvaluationEngine.calculateGap(5.5, 6.0, 'negative'); // 5.5 is better than 6.0 -> Gap +0.5
    const negGap2 = StuntingEvaluationEngine.calculateGap(6.5, 6.0, 'negative'); // 6.5 is worse than 6.0 -> Gap -0.5
    expect(negGap1).toBe(0.5);
    expect(negGap2).toBe(-0.5);
  });

  it('should calculate Year-over-Year change correctly', () => {
    expect(StuntingEvaluationEngine.calculateYoYChange(82, 75)).toBe(7); // Meningkat
    expect(StuntingEvaluationEngine.calculateYoYChange(70, 75)).toBe(-5); // Menurun
    expect(StuntingEvaluationEngine.calculateYoYChange(75, 75)).toBe(0); // Tetap
    expect(StuntingEvaluationEngine.calculateYoYChange(null, 75)).toBeNull();
    expect(StuntingEvaluationEngine.calculateYoYChange(80, null)).toBeNull();
  });

  it('should classify 4-tier status accurately according to gap, tolerance, and trend', () => {
    // 1. Missing data -> belum_dinilai
    const sMissing = StuntingEvaluationEngine.evaluateStatus(null, 20, 5, -5, 'positive');
    expect(sMissing.status).toBe('belum_dinilai');

    // 2. Gap >= 0 -> on_track
    const sOnTrack = StuntingEvaluationEngine.evaluateStatus(22, 20, 2, -5, 'positive');
    expect(sOnTrack.status).toBe('on_track');

    // 3. Gap between -5 and 0 with positive YoY trend -> perlu_perhatian
    const sAttention = StuntingEvaluationEngine.evaluateStatus(18, 20, 2, -5, 'positive');
    expect(sAttention.status).toBe('perlu_perhatian');

    // 4. Gap < -5 -> perlu_percepatan
    const sAccelerateGap = StuntingEvaluationEngine.evaluateStatus(12, 20, 1, -5, 'positive');
    expect(sAccelerateGap.status).toBe('perlu_percepatan');

    // 5. Gap negative with negative YoY trend -> perlu_percepatan
    const sAccelerateTrend = StuntingEvaluationEngine.evaluateStatus(19, 20, -3, -5, 'positive');
    expect(sAccelerateTrend.status).toBe('perlu_percepatan');
  });

  it('should classify the 5 pattern categories accurately', () => {
    // E: Target Sudah Tercapai (Aktual 86 >= Target 85)
    const patTarget = StuntingEvaluationEngine.classifyPattern(86, 85, 80, 'on_track', 'positive');
    expect(patTarget).toBe('target_tercapai');

    // A: Meningkat dan On Track (YoY +5 > 0 and on_track)
    const patA = StuntingEvaluationEngine.classifyPattern(45, 85, 40, 'on_track', 'positive');
    expect(patA).toBe('meningkat_on_track');

    // B: Meningkat tetapi Belum On Track (YoY +2 > 0 and perlu_perhatian)
    const patB = StuntingEvaluationEngine.classifyPattern(38, 80, 36, 'perlu_perhatian', 'positive');
    expect(patB).toBe('meningkat_belum_on_track');

    // C: Menurun tetapi Masih On Track (YoY -2 < 0 and on_track)
    const patC = StuntingEvaluationEngine.classifyPattern(50, 60, 52, 'on_track', 'positive');
    expect(patC).toBe('menurun_on_track');

    // D: Menurun dan Perlu Percepatan (YoY -5 < 0 and perlu_percepatan)
    const patD = StuntingEvaluationEngine.classifyPattern(30, 80, 35, 'perlu_percepatan', 'positive');
    expect(patD).toBe('menurun_perlu_percepatan');
  });

  it('should evaluate full stunting dataset with group headers, summary counts, and ranked priority lists', () => {
    const result = StuntingEvaluationEngine.evaluateDataset(sampleIndicators, {
      activeQuarter: 1,
      toleranceThresholdPercent: -5,
    });

    expect(result.rows.length).toBe(5);
    expect(result.activeQuarter).toBe(1);

    // Row 1: Remaja putri -> Expected TW1: 21.25%, Actual: 22%, Gap: +0.75 -> on_track
    const row1 = result.rows[0];
    expect(row1.activeActual).toBe(22);
    expect(row1.activeExpected).toBeCloseTo(21.25, 2);
    expect(row1.activeGap).toBeCloseTo(0.75, 2);
    expect(row1.status).toBe('on_track');

    // Row 2: Ibu hamil KEK -> Expected TW1: 20, Actual: 18, Gap: -2 -> perlu_perhatian
    const row2 = result.rows[1];
    expect(row2.activeActual).toBe(18);
    expect(row2.activeExpected).toBe(20);
    expect(row2.activeGap).toBe(-2);
    expect(row2.status).toBe('perlu_perhatian');

    // Row 3: Balita gizi kurang -> Expected TW1: 22.5, Actual: 15, Gap: -7.5 -> perlu_percepatan
    const row3 = result.rows[2];
    expect(row3.activeActual).toBe(15);
    expect(row3.activeExpected).toBe(22.5);
    expect(row3.activeGap).toBe(-7.5);
    expect(row3.status).toBe('perlu_percepatan');

    // Row 4: Balita wasting (negative polarity) -> Expected TW1: 6.0, Actual: 5.8, Gap: 6.0 - 5.8 = +0.2 -> on_track
    const row4 = result.rows[3];
    expect(row4.polarity).toBe('negative');
    expect(row4.activeActual).toBe(5.8);
    expect(row4.activeGap).toBeCloseTo(0.2, 2);
    expect(row4.status).toBe('on_track');

    // Row 5: Keluarga berisiko -> Missing data -> belum_dinilai
    const row5 = result.rows[4];
    expect(row5.status).toBe('belum_dinilai');

    // KPI Summary
    expect(result.summary.totalIndicators).toBe(5);
    expect(result.summary.onTrackCount).toBe(2); // row 1 & row 4
    expect(result.summary.perluPerhatianCount).toBe(1); // row 2
    expect(result.summary.perluPercepatanCount).toBe(1); // row 3
    expect(result.summary.belumDinilaiCount).toBe(1); // row 5

    // Acceleration List: harus terurut dari gap terburuk ke terkecil
    expect(result.accelerationList.length).toBeGreaterThan(0);
    expect(result.accelerationList[0].name).toBe('Balita gizi kurang mendapat makanan tambahan (MT)');
    expect(result.accelerationList[0].activeGap).toBe(-7.5);

    // Lifecycle Grouping: 3 grup
    expect(result.groupedRows.length).toBe(3);
    expect(result.groupedRows[0].canonicalCategory).toBe('sebelum_kelahiran');
    expect(result.groupedRows[0].rows.length).toBe(2);
    expect(result.groupedRows[1].canonicalCategory).toBe('setelah_kelahiran');
    expect(result.groupedRows[1].rows.length).toBe(2);
    expect(result.groupedRows[2].canonicalCategory).toBe('lainnya');
    expect(result.groupedRows[2].rows.length).toBe(1);
  });

  it('should dynamically re-evaluate when active quarter changes', () => {
    // Evaluasi TW 3:
    // Row 2 (Ibu hamil KEK): Actual TW3 = 50, Expected TW3 = 60, Gap = -10 -> berubah jadi perlu_percepatan!
    const resultTw3 = StuntingEvaluationEngine.evaluateDataset(sampleIndicators, {
      activeQuarter: 3,
      toleranceThresholdPercent: -5,
    });

    const row2Tw3 = resultTw3.rows[1];
    expect(row2Tw3.activeQuarter).toBe(3);
    expect(row2Tw3.activeExpected).toBe(60);
    expect(row2Tw3.activeActual).toBe(50);
    expect(row2Tw3.activeGap).toBe(-10);
    expect(row2Tw3.status).toBe('perlu_percepatan');
    expect(resultTw3.summary.perluPercepatanCount).toBe(2); // row 2 and row 3
  });

  it('should sum column values correctly across joined rows', () => {
    const mockRows = [
      { wilayah: 'Puskesmas A', jumlah: 100, persen: '80%' },
      { wilayah: 'Puskesmas B', jumlah: '150', persen: '75,5%' },
      { wilayah: 'Puskesmas C', jumlah: null, persen: '-' },
    ];

    expect(StuntingEvaluationEngine.sumColumnValues(mockRows, 'jumlah')).toBe(250);
    expect(StuntingEvaluationEngine.sumColumnValues(mockRows, 'persen')).toBe(155.5);
    expect(StuntingEvaluationEngine.sumColumnValues(mockRows, 'tidak_ada')).toBeNull();
  });

  it('should evaluate aggregated dataset from joined multi-sheet rows', () => {
    const joinedRows = [
      {
        wilayah: 'Puskesmas A',
        sasaran_remaja: 1000,
        realisasi_remaja_ttd: 820,
        sasaran_balita: 500,
        realisasi_balita_gizi: 90,
      },
      {
        wilayah: 'Puskesmas B',
        sasaran_remaja: 2000,
        realisasi_remaja_ttd: 1700,
        sasaran_balita: 500,
        realisasi_balita_gizi: 80,
      },
      {
        wilayah: 'Puskesmas C',
        sasaran_remaja: 1000,
        realisasi_remaja_ttd: 840,
        sasaran_balita: 1000,
        realisasi_balita_gizi: 180,
      },
    ];

    const categories = [
      {
        id: 'cat-1',
        name: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
        subCategories: [
          {
            id: 'sub-1',
            name: 'Remaja putri menerima TTD',
            numeratorCol: 'realisasi_remaja_ttd',
            denominatorCol: 'sasaran_remaja',
            targetCurrentYear: 85,
            targetPrevYear: 80,
            actualPrevYear: 80, // Manual input capaian tahun lalu
            calculationMode: 'percentage' as const,
          },
        ],
      },
      {
        id: 'cat-2',
        name: 'Intervensi untuk balita (setelah kelahiran)',
        subCategories: [
          {
            id: 'sub-2',
            name: 'Balita gizi kurang menerima MT',
            numeratorCol: 'realisasi_balita_gizi',
            denominatorCol: 'sasaran_balita',
            targetCurrentYear: 90,
            targetPrevYear: 85,
            actualPrevYear: 25,
            calculationMode: 'percentage' as const,
          },
        ],
      },
    ];

    // Evaluasi TW 1 (bobot 25%)
    const result = StuntingEvaluationEngine.evaluateAggregatedDataset(categories, joinedRows, {
      activeQuarter: 1,
    });

    expect(result.rows.length).toBe(2);

    // Indikator 1: Remaja putri
    // Sasaran total = 1000 + 2000 + 1000 = 4000
    // Realisasi total = 820 + 1700 + 840 = 3360
    // Capaian (%) = (3360 / 4000) * 100 = 84%
    // Target 2026 = 85%, Expected TW1 = 25% * 85% = 21.25%
    // Gap = 84 - 21.25 = +62.75% -> On Track!
    const row1 = result.rows[0];
    expect(row1.sumDenominator).toBe(4000);
    expect(row1.sumNumerator).toBe(3360);
    expect(row1.activeActual).toBe(84);
    expect(row1.activeExpected).toBe(21.25);
    expect(row1.activeGap).toBe(62.75);
    expect(row1.status).toBe('on_track');

    // Indikator 2: Balita gizi kurang
    // Sasaran total = 500 + 500 + 1000 = 2000
    // Realisasi total = 90 + 80 + 180 = 350
    // Capaian (%) = (350 / 2000) * 100 = 17.5%
    // Target 2026 = 90%, Expected TW1 = 25% * 90% = 22.5%
    // Gap = 17.5 - 22.5 = -5% (pada batas toleransi -5%)
    const row2 = result.rows[1];
    expect(row2.sumDenominator).toBe(2000);
    expect(row2.sumNumerator).toBe(350);
    expect(row2.activeActual).toBe(17.5);
    expect(row2.activeExpected).toBe(22.5);
    expect(row2.activeGap).toBe(-5);
  });

  it('should support multi-quarter columns (TW1-TW4) with Jumlah (sumNumerator) and availableQuarters detection', () => {
    const joinedRows = [
      {
        Puskesmas: 'Puskesmas A',
        Sasaran: 1000,
        TW1_Realisasi: 200,
        TW2_Realisasi: 450,
        TW3_Realisasi: 700,
      },
      {
        Puskesmas: 'Puskesmas B',
        Sasaran: 1000,
        TW1_Realisasi: 300,
        TW2_Realisasi: 550,
        TW3_Realisasi: 800,
      },
    ];

    const categories = [
      {
        id: 'cat-1',
        name: 'Intervensi Gizi',
        subCategories: [
          {
            id: 'sub-1',
            name: 'Pemberian TTD',
            numeratorCol: 'TW1_Realisasi',
            denominatorCol: 'Sasaran',
            quarterColumns: {
              1: { numeratorCol: 'TW1_Realisasi' },
              2: { numeratorCol: 'TW2_Realisasi' },
              3: { numeratorCol: 'TW3_Realisasi' },
            },
            targetCurrentYear: 100,
            calculationMode: 'percentage' as const,
          },
        ],
      },
    ];

    const result = StuntingEvaluationEngine.evaluateAggregatedDataset(categories, joinedRows, {
      activeQuarter: 3,
    });

    // Detected availableQuarters should be [1, 2, 3] because TW4 is not configured
    expect(result.availableQuarters).toEqual([1, 2, 3]);

    const row = result.rows[0];

    // TW 1: Sasaran = 2000; Jumlah (Realisasi) = 500; Capaian = 25%
    expect(row.quarters[1].hasData).toBe(true);
    expect(row.quarters[1].sumNumerator).toBe(500);
    expect(row.quarters[1].actualAchievement).toBe(25);

    // TW 2: Sasaran = 2000; Jumlah (Realisasi) = 1000; Capaian = 50%
    expect(row.quarters[2].hasData).toBe(true);
    expect(row.quarters[2].sumNumerator).toBe(1000);
    expect(row.quarters[2].actualAchievement).toBe(50);

    // TW 3: Sasaran = 2000; Jumlah (Realisasi) = 1500; Capaian = 75%
    expect(row.quarters[3].hasData).toBe(true);
    expect(row.quarters[3].sumNumerator).toBe(1500);
    expect(row.quarters[3].actualAchievement).toBe(75);

    // TW 4: Belum ada data
    expect(row.quarters[4].hasData).toBe(false);
    expect(row.quarters[4].sumNumerator).toBeNull();
    expect(row.quarters[4].actualAchievement).toBeNull();
  });

  it('should not duplicate single-quarter column config to other unconfigured quarters', () => {
    const joinedRows = [
      { Puskesmas: 'Puskesmas A', Kasus_TW3: 150, Capaian_TW3: 75 },
      { Puskesmas: 'Puskesmas B', Kasus_TW3: 250, Capaian_TW3: 85 },
    ];

    const categories = [
      {
        id: 'cat-1',
        name: 'Intervensi Khusus',
        subCategories: [
          {
            id: 'sub-single',
            name: 'Pemberian Makanan Tambahan',
            sumCol: 'Kasus_TW3',
            meanCol: 'Capaian_TW3',
            numeratorCol: 'Capaian_TW3',
            targetCurrentYear: 80,
            calculationMode: 'percentage' as const,
          },
        ],
      },
    ];

    // Evaluasi dataset hanya untuk TW 3
    const result = StuntingEvaluationEngine.evaluateAggregatedDataset(categories, joinedRows, {
      activeQuarter: 3,
    });

    // Available quarters should ONLY be [3], NOT [1, 2, 3, 4]
    expect(result.availableQuarters).toEqual([3]);

    const row = result.rows[0];

    // TW 3 has the actual data
    expect(row.quarters[3].hasData).toBe(true);
    expect(row.quarters[3].sumNumerator).toBe(400); // 150 + 250
    expect(row.quarters[3].actualAchievement).toBe(80); // (75 + 85) / 2

    // Quarters 1, 2, and 4 must NOT have duplicated data
    expect(row.quarters[1].hasData).toBe(false);
    expect(row.quarters[1].sumNumerator).toBeNull();
    expect(row.quarters[1].actualAchievement).toBeNull();

    expect(row.quarters[2].hasData).toBe(false);
    expect(row.quarters[2].sumNumerator).toBeNull();
    expect(row.quarters[2].actualAchievement).toBeNull();

    expect(row.quarters[4].hasData).toBe(false);
    expect(row.quarters[4].sumNumerator).toBeNull();
    expect(row.quarters[4].actualAchievement).toBeNull();
  });

  it('should support partial quarter selection (e.g. TW 1 & TW 2 only) with independent columns', () => {
    const joinedRows = [
      {
        Puskesmas: 'Puskesmas A',
        TW1_Jml: 100,
        TW1_Prc: 50,
        TW2_Jml: 200,
        TW2_Prc: 70,
      },
    ];

    const categories = [
      {
        id: 'cat-1',
        name: 'Gizi',
        subCategories: [
          {
            id: 'sub-partial',
            name: 'Skrining Anemia',
            numeratorCol: '',
            quarterColumns: {
              1: { sumCol: 'TW1_Jml', meanCol: 'TW1_Prc' },
              2: { sumCol: 'TW2_Jml', meanCol: 'TW2_Prc' },
            },
            targetCurrentYear: 90,
            calculationMode: 'percentage' as const,
          },
        ],
      },
    ];

    const result = StuntingEvaluationEngine.evaluateAggregatedDataset(categories, joinedRows, {
      activeQuarter: 2,
    });

    expect(result.availableQuarters).toEqual([1, 2]);

    const row = result.rows[0];
    expect(row.quarters[1].hasData).toBe(true);
    expect(row.quarters[1].sumNumerator).toBe(100);
    expect(row.quarters[1].actualAchievement).toBe(50);

    expect(row.quarters[2].hasData).toBe(true);
    expect(row.quarters[2].sumNumerator).toBe(200);
    expect(row.quarters[2].actualAchievement).toBe(70);

    expect(row.quarters[3].hasData).toBe(false);
    expect(row.quarters[3].sumNumerator).toBeNull();
    expect(row.quarters[3].actualAchievement).toBeNull();

    expect(row.quarters[4].hasData).toBe(false);
    expect(row.quarters[4].sumNumerator).toBeNull();
    expect(row.quarters[4].actualAchievement).toBeNull();
  });

  describe('cleanTargetValue', () => {
    it('should parse mixed target string prefixes and clean decimal commas', () => {
      expect(StuntingEvaluationEngine.cleanTargetValue('tw3: 60')).toEqual({
        value: 60,
        polarity: 'positive',
      });

      expect(StuntingEvaluationEngine.cleanTargetValue('TW3: 56,25')).toEqual({
        value: 56.25,
        polarity: 'positive',
      });

      expect(StuntingEvaluationEngine.cleanTargetValue('85%')).toEqual({
        value: 85,
        polarity: 'positive',
      });

      expect(StuntingEvaluationEngine.cleanTargetValue(85)).toEqual({
        value: 85,
        polarity: 'positive',
      });
    });

    it('should detect negative polarity from <= or < symbols', () => {
      expect(StuntingEvaluationEngine.cleanTargetValue('≤23')).toEqual({
        value: 23,
        polarity: 'negative',
      });

      expect(StuntingEvaluationEngine.cleanTargetValue('≤13%')).toEqual({
        value: 13,
        polarity: 'negative',
      });

      expect(StuntingEvaluationEngine.cleanTargetValue('<= 25')).toEqual({
        value: 25,
        polarity: 'negative',
      });
    });

    it('should return null value for dash or empty target values', () => {
      expect(StuntingEvaluationEngine.cleanTargetValue('-')).toEqual({
        value: null,
        polarity: 'positive',
      });

      expect(StuntingEvaluationEngine.cleanTargetValue('')).toEqual({
        value: null,
        polarity: 'positive',
      });

      expect(StuntingEvaluationEngine.cleanTargetValue(null)).toEqual({
        value: null,
        polarity: 'positive',
      });
    });
  });

  it('should evaluate pre-calculated indicators directly without denominator or SUM division', () => {
    // Mode tanpa input kolom sasaran (langsung dari row summary / JAWA TENGAH)
    const summaryRow = {
      'Kabupaten/Kota': 'JAWA TENGAH',
      'Rematri  Konsumsi TTD': 1483925,
      '% Konsumsi TTD': 93.64,
      'Rematri anemia ': 88202,
      '% Rematri anemia ': 15.21,
    };

    const categories = [
      {
        id: 'cat-1',
        name: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
        subCategories: [
          {
            id: 'sub-1',
            name: '% Konsumsi TTD',
            numeratorCol: '% Konsumsi TTD',
            dataCol: '% Konsumsi TTD',
            actualValue: 93.64,
            countValue: 1483925,
            calculationMode: 'percentage' as const,
            targetCurrentYear: 67,
            actualPrevYear: 80,
            targetPrevYear: 65,
            polarity: 'positive' as const,
          },
          {
            id: 'sub-2',
            name: '% Rematri anemia',
            numeratorCol: '% Rematri anemia ',
            dataCol: '% Rematri anemia ',
            actualValue: 15.21,
            countValue: 88202,
            calculationMode: 'percentage' as const,
            targetCurrentYear: 23,
            actualPrevYear: 18,
            targetPrevYear: 24,
            polarity: 'negative' as const,
          },
        ],
      },
    ];

    const result = StuntingEvaluationEngine.evaluateAggregatedDataset(categories, [summaryRow], {
      activeQuarter: 3,
    });

    expect(result.rows.length).toBe(2);

    // Indikator 1: Positif, Realisasi = 93.64%, Target TW3 = 75% * 67 = 50.25%, Gap = +43.39% -> on_track
    const row1 = result.rows[0];
    expect(row1.activeActual).toBe(93.64);
    expect(row1.activeExpected).toBe(50.25);
    expect(row1.activeGap).toBe(43.39);
    expect(row1.status).toBe('on_track');
    expect(row1.quarters[3].sumNumerator).toBe(1483925);
    expect(row1.quarters[3].sumDenominator).toBeNull(); // Tidak ada denominator

    // Indikator 2: Negatif (Kasus Anemia), Realisasi = 15.21%, Target = 23%, Expected TW3 = 75% * 23 = 17.25%
    // Gap = 17.25 - 15.21 = +2.04% -> on_track (karena lebih rendah dari target kasus)
    const row2 = result.rows[1];
    expect(row2.activeActual).toBe(15.21);
    expect(row2.activeGap).toBe(2.04);
    expect(row2.status).toBe('on_track');
    expect(row2.quarters[3].sumNumerator).toBe(88202);
    expect(row2.quarters[3].sumDenominator).toBeNull();
  });
});
