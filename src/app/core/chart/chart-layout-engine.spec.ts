import { describe, expect, it } from 'vitest';
import {
  ChartLayoutEngine,
  ChartLayoutSpec,
} from './chart-layout-engine';

describe('ChartLayoutEngine', () => {
  const sampleSpec: ChartLayoutSpec = {
    categoryColumn: 'wilayah',
    categories: ['Kab. Magelang', 'Kota Magelang'],
    series: [
      { key: 'tw1', label: 'Triwulan 1', color: '#3b82f6' },
      { key: 'tw2', label: 'Triwulan 2', color: '#10b981' },
    ],
    rows: [
      { wilayah: 'Kab. Magelang', tw1: '75,5', tw2: 85 },
      { wilayah: 'Kota Magelang', tw1: 0, tw2: '-' },
    ],
  };

  it('computes layout geometry and groups', () => {
    const layout = ChartLayoutEngine.computeLayout(sampleSpec);

    expect(layout.categoryGroups.length).toBe(2);
    expect(layout.categoryGroups[0].categoryName).toBe('Kab. Magelang');
    expect(layout.categoryGroups[0].bars.length).toBe(2);
    expect(layout.categoryGroups[1].categoryName).toBe('Kota Magelang');
    expect(layout.categoryGroups[1].bars.length).toBe(2);
  });

  it('calculates proportional widths for numeric bars', () => {
    const layout = ChartLayoutEngine.computeLayout(sampleSpec);
    const magelangBars = layout.categoryGroups[0].bars;

    expect(magelangBars[0].numericVal).toBe(75.5);
    expect(magelangBars[1].numericVal).toBe(85);
    expect(magelangBars[1].width).toBeGreaterThan(magelangBars[0].width);
  });

  it('treats 0 as a valid numeric measurement and "-" as missing data N/A', () => {
    const layout = ChartLayoutEngine.computeLayout(sampleSpec);
    const kotaBars = layout.categoryGroups[1].bars;

    // tw1: 0 is valid numeric
    expect(kotaBars[0].numericVal).toBe(0);
    expect(kotaBars[0].isZero).toBe(true);
    expect(kotaBars[0].isMissing).toBe(false);
    expect(kotaBars[0].displayLabel).toBe('0');
    expect(kotaBars[0].width).toBe(0);

    // tw2: '-' is non-numeric missing
    expect(kotaBars[1].numericVal).toBeNull();
    expect(kotaBars[1].isMissing).toBe(true);
    expect(kotaBars[1].isZero).toBe(false);
    expect(kotaBars[1].displayLabel).toBe('N/A');
    expect(kotaBars[1].width).toBe(0);
  });

  it('computes targetLineX and expands max scale if target exceeds data maximum', () => {
    const specWithTarget: ChartLayoutSpec = {
      ...sampleSpec,
      targetValue: 100, // higher than max data (85)
    };

    const layout = ChartLayoutEngine.computeLayout(specWithTarget);
    expect(layout.maxValue).toBeGreaterThanOrEqual(100);
    expect(layout.targetLineX).toBeDefined();
    expect(layout.targetLineX!).toBeGreaterThan(layout.plotX);
    expect(layout.targetLineX!).toBeLessThanOrEqual(layout.plotX + layout.plotWidth);
  });
});
