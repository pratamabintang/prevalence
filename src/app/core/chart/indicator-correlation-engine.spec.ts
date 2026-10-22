import { describe, expect, it } from 'vitest';
import { IndicatorCorrelationEngine } from './indicator-correlation-engine';

describe('IndicatorCorrelationEngine', () => {
  const dummyRows = [
    { 'Kabupaten/Kota': 'Cilacap', anc: 47.02, ttd_bumil: 11.25, gizi_kurang: 4.54, gibur: 15.31 },
    { 'Kabupaten/Kota': 'Banyumas', anc: 30.64, ttd_bumil: 8.63, gizi_kurang: 8.92, gibur: 22.10 },
    { 'Kabupaten/Kota': 'Purbalingga', anc: 55.10, ttd_bumil: 14.80, gizi_kurang: 3.20, gibur: 10.50 },
    { 'Kabupaten/Kota': 'Banjarnegara', anc: 25.40, ttd_bumil: 7.20, gizi_kurang: 12.40, gibur: 31.00 },
    { 'Kabupaten/Kota': 'Kebumen', anc: 62.80, ttd_bumil: 18.50, gizi_kurang: 2.10, gibur: 8.20 },
  ];

  const seriesList = [
    { key: 'anc', label: '% ANC 6x' },
    { key: 'ttd_bumil', label: '% TTD Bumil' },
    { key: 'gizi_kurang', label: '% Gizi Kurang' },
    { key: 'gibur', label: '% Talak Gibur' },
  ];

  describe('calculatePearson', () => {
    it('calculates perfect positive correlation (r = 1.0)', () => {
      const x = [10, 20, 30, 40, 50];
      const y = [2, 4, 6, 8, 10];
      const res = IndicatorCorrelationEngine.calculatePearson(x, y);
      expect(res.r).toBe(1.0);
      expect(res.r2).toBe(1.0);
      expect(res.count).toBe(5);
    });

    it('calculates perfect negative correlation (r = -1.0)', () => {
      const x = [10, 20, 30, 40, 50];
      const y = [50, 40, 30, 20, 10];
      const res = IndicatorCorrelationEngine.calculatePearson(x, y);
      expect(res.r).toBe(-1.0);
      expect(res.r2).toBe(1.0);
    });

    it('returns r = 0 for zero variance or insufficient data', () => {
      expect(IndicatorCorrelationEngine.calculatePearson([5, 5, 5], [1, 2, 3]).r).toBe(0);
      expect(IndicatorCorrelationEngine.calculatePearson([1], [2]).r).toBe(0);
      expect(IndicatorCorrelationEngine.calculatePearson([], []).r).toBe(0);
    });

    it('calculates strong positive correlation between ANC and TTD Bumil', () => {
      const anc = dummyRows.map((r) => r.anc);
      const ttd = dummyRows.map((r) => r.ttd_bumil);
      const res = IndicatorCorrelationEngine.calculatePearson(anc, ttd);
      expect(res.r).toBeGreaterThan(0.9); // in this dummy data, they move together strongly
      expect(res.r2).toBeCloseTo(res.r * res.r, 2);
    });
  });

  describe('calculateCorrelationMatrix', () => {
    it('computes full symmetrical correlation matrix for series list', () => {
      const result = IndicatorCorrelationEngine.calculateCorrelationMatrix(dummyRows, seriesList);

      expect(result.series.length).toBe(4);
      expect(result.matrix.length).toBe(4);
      expect(result.matrix[0].length).toBe(4);

      // Diagonal must be self-correlation (r = 1.0)
      for (let i = 0; i < 4; i++) {
        expect(result.matrix[i][i].r).toBe(1.0);
      }

      // Symmetrical property: matrix[i][j].r === matrix[j][i].r
      expect(result.matrix[0][1].r).toBe(result.matrix[1][0].r);
      expect(result.matrix[0][2].r).toBe(result.matrix[2][0].r);

      // Top pairs should be sorted and exclude self-correlation
      expect(result.topPositive.length).toBeGreaterThan(0);
      expect(result.topPositive[0].r).toBeLessThanOrEqual(1.0);
      expect(result.topPositive[0].key1).not.toBe(result.topPositive[0].key2);

      expect(result.topNegative.length).toBeGreaterThan(0);
      expect(result.topNegative[0].r).toBeLessThan(0);
    });

    it('assigns color and interpretation label based on correlation strength', () => {
      const cellStrongPos = IndicatorCorrelationEngine.formatCorrelationCell('a', 'A', 'b', 'B', 0.85, 5);
      expect(cellStrongPos.strength).toBe('very_strong_positive');
      expect(cellStrongPos.label).toContain('Sangat Kuat');

      const cellStrongNeg = IndicatorCorrelationEngine.formatCorrelationCell('a', 'A', 'b', 'B', -0.75, 5);
      expect(cellStrongNeg.strength).toBe('strong_negative');
      expect(cellStrongNeg.label).toContain('Kuat Negatif');

      const cellWeak = IndicatorCorrelationEngine.formatCorrelationCell('a', 'A', 'b', 'B', 0.12, 5);
      expect(cellWeak.strength).toBe('weak');
    });
  });

  describe('calculateScatterRegression', () => {
    it('computes OLS regression slope, intercept, and point coordinates', () => {
      const regression = IndicatorCorrelationEngine.calculateScatterRegression(
        dummyRows,
        'Kabupaten/Kota',
        { key: 'anc', label: '% ANC 6x' },
        { key: 'ttd_bumil', label: '% TTD Bumil' },
      );

      expect(regression.points.length).toBe(5);
      expect(regression.slope).toBeGreaterThan(0); // positive slope
      expect(regression.r).toBeGreaterThan(0.9);
      expect(regression.r2).toBeGreaterThan(0.8);
      expect(regression.formula).toContain('y = ');
      expect(regression.points[0].category).toBe('Cilacap');
      expect(regression.points[0].x).toBe(47.02);
      expect(regression.points[0].y).toBe(11.25);
    });

    it('handles negative slope for inverse relationships', () => {
      const regression = IndicatorCorrelationEngine.calculateScatterRegression(
        dummyRows,
        'Kabupaten/Kota',
        { key: 'anc', label: '% ANC 6x' },
        { key: 'gibur', label: '% Talak Gibur' },
      );

      expect(regression.slope).toBeLessThan(0); // negative slope
      expect(regression.r).toBeLessThan(0);
    });
  });
});
