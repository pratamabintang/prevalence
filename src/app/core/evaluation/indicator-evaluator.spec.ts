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

  describe('formatCellValue', () => {
    it('should format percentage values with at most 2 decimal places without % symbol in UI', () => {
      expect(IndicatorEvaluator.formatCellValue(42.845907960830075, { dataType: 'percentage', anomalyEnabled: false, minAnomaly: null, maxAnomaly: null })).toBe('42.85');
      expect(IndicatorEvaluator.formatCellValue(6.5, { dataType: 'percentage', anomalyEnabled: false, minAnomaly: null, maxAnomaly: null })).toBe('6.5');
      expect(IndicatorEvaluator.formatCellValue(75, { dataType: 'percentage', anomalyEnabled: false, minAnomaly: null, maxAnomaly: null })).toBe('75');
      expect(IndicatorEvaluator.formatCellValue('42.845907960830075%')).toBe('42.85');
    });

    it('should format numeric values with at most 2 decimal places', () => {
      expect(IndicatorEvaluator.formatCellValue(42.845907960830075, { dataType: 'number', anomalyEnabled: false, minAnomaly: null, maxAnomaly: null })).toBe('42.85');
      expect(IndicatorEvaluator.formatCellValue(100, { dataType: 'number', anomalyEnabled: false, minAnomaly: null, maxAnomaly: null })).toBe('100');
    });

    it('should return dash for empty or null values', () => {
      expect(IndicatorEvaluator.formatCellValue(null)).toBe('-');
      expect(IndicatorEvaluator.formatCellValue('')).toBe('-');
    });
  });

  describe('getCapaianFormatClass', () => {
    it('should return empty string if min or max is null or min equals max', () => {
      expect(IndicatorEvaluator.getCapaianFormatClass(5, { min: null, max: null })).toBe('');
      expect(IndicatorEvaluator.getCapaianFormatClass(5, { min: 5, max: 5 })).toBe('');
    });

    it('should return blue highlight class for highest capaian value', () => {
      const cls = IndicatorEvaluator.getCapaianFormatClass(10, { min: 2, max: 10 });
      expect(cls).toContain('bg-blue-100');
      expect(cls).toContain('text-blue-900');
      expect(cls).toContain('border-blue-300');
    });

    it('should return red highlight class for lowest capaian value', () => {
      const cls = IndicatorEvaluator.getCapaianFormatClass(2, { min: 2, max: 10 });
      expect(cls).toContain('bg-red-100');
      expect(cls).toContain('text-red-900');
      expect(cls).toContain('border-red-300');
    });

    it('should return empty string for middle capaian values', () => {
      expect(IndicatorEvaluator.getCapaianFormatClass(6, { min: 2, max: 10 })).toBe('');
    });
  });
});
