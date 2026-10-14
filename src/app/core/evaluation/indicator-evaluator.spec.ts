import { describe, expect, it } from 'vitest';
import { IndicatorEvaluator } from './indicator-evaluator';

describe('IndicatorEvaluator', () => {
  describe('calculateColumnAverage and formatAverageValue', () => {
    it('should calculate average correctly for numeric rows', () => {
      const rows = [
        { colA: 10, colB: 'Kota Semarang' },
        { colA: 20, colB: 'Kota Surakarta' },
        { colA: 30, colB: 'Kabupaten Boyolali' },
      ];

      const avg = IndicatorEvaluator.calculateColumnAverage(rows, 'colA');
      expect(avg).toBe(20);
      expect(IndicatorEvaluator.formatAverageValue(avg)).toBe('20');
    });

    it('should handle decimal and comma formatted numbers', () => {
      const rows = [
        { colA: '50,5' },
        { colA: '70,5' },
      ];

      const avg = IndicatorEvaluator.calculateColumnAverage(rows, 'colA');
      expect(avg).toBe(60.5);
      expect(IndicatorEvaluator.formatAverageValue(avg)).toBe('60,5');
    });

    it('should return null and dash for non-numeric or empty columns', () => {
      const rows = [
        { colA: 'Teks A' },
        { colA: '-' },
        { colA: null },
      ];

      const avg = IndicatorEvaluator.calculateColumnAverage(rows, 'colA');
      expect(avg).toBeNull();
      expect(IndicatorEvaluator.formatAverageValue(avg)).toBe('-');
    });

    it('should format decimals to 2 places in Indonesian locale', () => {
      const rows = [
        { colA: 10 },
        { colA: 20 },
        { colA: 25 },
      ];
      // 55 / 3 = 18.3333...
      const avg = IndicatorEvaluator.calculateColumnAverage(rows, 'colA');
      expect(avg).toBeCloseTo(18.3333, 2);
      expect(IndicatorEvaluator.formatAverageValue(avg)).toBe('18,33');
    });
  });

  describe('calculateColumnSum and formatSumValue', () => {
    it('should sum numbers correctly', () => {
      const rows = [{ val: 100 }, { val: 200 }, { val: 50 }];
      const sum = IndicatorEvaluator.calculateColumnSum(rows, 'val');
      expect(sum).toBe(350);
      expect(IndicatorEvaluator.formatSumValue(sum)).toBe('350');
    });

    it('should return null if no numbers are present', () => {
      const rows = [{ val: '-' }, { val: null }];
      expect(IndicatorEvaluator.calculateColumnSum(rows, 'val')).toBeNull();
      expect(IndicatorEvaluator.formatSumValue(null)).toBe('-');
    });
  });
});
