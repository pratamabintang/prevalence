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

  it('computes layout properly for single-series per-indicator comparison mode', () => {
    const singleSeriesSpec: ChartLayoutSpec = {
      categoryColumn: 'wilayah',
      categories: ['Kab. Magelang', 'Kota Magelang'],
      series: [{ key: 'tw1', label: 'Triwulan 1', color: '#3b82f6' }],
      rows: [
        { wilayah: 'Kab. Magelang', tw1: '75,5' },
        { wilayah: 'Kota Magelang', tw1: '90,0' },
      ],
      rowHeight: 38,
      targetValue: 80,
    };

    const layout = ChartLayoutEngine.computeLayout(singleSeriesSpec);
    expect(layout.categoryGroups.length).toBe(2);
    expect(layout.categoryGroups[0].bars.length).toBe(1);
    expect(layout.categoryGroups[0].bars[0].seriesKey).toBe('tw1');
    expect(layout.categoryGroups[0].bars[0].numericVal).toBe(75.5);
    expect(layout.categoryGroups[1].bars[0].numericVal).toBe(90);
    expect(layout.targetLineX).toBeDefined();
    expect(layout.categoryGroups[1].bars[0].width).toBeGreaterThan(layout.categoryGroups[0].bars[0].width);
  });

  it('computes side-by-side 2-column layout with 2 regions per row when columns = 2', () => {
    const multiRegionSpec: ChartLayoutSpec = {
      categoryColumn: 'wilayah',
      categories: ['Bantul', 'Sanden', 'Kretek', 'Pundong', 'Bambanglipuro'],
      series: [
        { key: 'tw1', label: 'Triwulan 1', color: '#3b82f6' },
        { key: 'tw2', label: 'Triwulan 2', color: '#10b981' },
      ],
      rows: [
        { wilayah: 'Bantul', tw1: 80, tw2: 90 },
        { wilayah: 'Sanden', tw1: 70, tw2: 75 },
        { wilayah: 'Kretek', tw1: 85, tw2: 60 },
        { wilayah: 'Pundong', tw1: 95, tw2: 88 },
        { wilayah: 'Bambanglipuro', tw1: 65, tw2: 70 },
      ],
      columns: 2,
      targetValue: 75,
    };

    const layout = ChartLayoutEngine.computeLayout(multiRegionSpec);

    expect(layout.columns).toBe(2);
    expect(layout.categoryGroups.length).toBe(5);

    // Row 0: Bantul (Col 0) and Sanden (Col 1)
    expect(layout.categoryGroups[0].categoryName).toBe('Bantul');
    expect(layout.categoryGroups[0].colIndex).toBe(0);
    expect(layout.categoryGroups[0].rowIdx).toBe(0);

    expect(layout.categoryGroups[1].categoryName).toBe('Sanden');
    expect(layout.categoryGroups[1].colIndex).toBe(1);
    expect(layout.categoryGroups[1].rowIdx).toBe(0);
    expect(layout.categoryGroups[1].y).toBe(layout.categoryGroups[0].y); // same vertical row!

    // Row 1: Kretek (Col 0) and Pundong (Col 1)
    expect(layout.categoryGroups[2].colIndex).toBe(0);
    expect(layout.categoryGroups[2].rowIdx).toBe(1);
    expect(layout.categoryGroups[3].colIndex).toBe(1);
    expect(layout.categoryGroups[3].rowIdx).toBe(1);
    expect(layout.categoryGroups[3].y).toBe(layout.categoryGroups[2].y);

    // Row 2: Bambanglipuro (Col 0)
    expect(layout.categoryGroups[4].colIndex).toBe(0);
    expect(layout.categoryGroups[4].rowIdx).toBe(2);

    // Column 1 plotX should be distinctly to the right of Column 0
    expect(layout.categoryGroups[1].plotX).toBeGreaterThan(
      layout.categoryGroups[0].plotX + layout.categoryGroups[0].plotWidth,
    );

    // Verify 2 target lines generated for both columns
    expect(layout.targetLines?.length).toBe(2);
    expect(layout.targetLines![1]).toBeGreaterThan(layout.targetLines![0]);

    // Divider line between the two columns
    expect(layout.dividerX).toBeDefined();
    expect(layout.dividerX!).toBeGreaterThan(layout.categoryGroups[0].plotX);
    expect(layout.dividerX!).toBeLessThan(layout.categoryGroups[1].plotX);
  });

  it('supports categoryTargets for individual targets per row (per-wilayah mode)', () => {
    const specWithCategoryTargets: ChartLayoutSpec = {
      categoryColumn: 'indikator',
      categories: ['% Gizi Kurang', '% BB Kurang', '% IDL'],
      series: [{ key: 'capaian', label: 'Capaian', color: '#525AFF' }],
      rows: [
        { indikator: '% Gizi Kurang', capaian: 82 },
        { indikator: '% BB Kurang', capaian: 70 },
        { indikator: '% IDL', capaian: 95 },
      ],
      categoryTargets: {
        '% Gizi Kurang': 80,
        '% BB Kurang': 85,
        '% IDL': 90,
      },
    };

    const layout = ChartLayoutEngine.computeLayout(specWithCategoryTargets);

    // Global targetLineX should be null when categoryTargets is provided
    expect(layout.targetLineX).toBeNull();
    expect(layout.hasCategoryTargets).toBe(true);

    const bars0 = layout.categoryGroups[0].bars[0];
    expect(bars0.numericVal).toBe(82);
    expect(bars0.targetVal).toBe(80);
    expect(bars0.targetX).toBeDefined();
    expect(bars0.isAchieved).toBe(true); // 82 >= 80

    const bars1 = layout.categoryGroups[1].bars[0];
    expect(bars1.numericVal).toBe(70);
    expect(bars1.targetVal).toBe(85);
    expect(bars1.targetX).toBeDefined();
    expect(bars1.isAchieved).toBe(false); // 70 < 85

    const bars2 = layout.categoryGroups[2].bars[0];
    expect(bars2.numericVal).toBe(95);
    expect(bars2.targetVal).toBe(90);
    expect(bars2.targetX).toBeDefined();
    expect(bars2.isAchieved).toBe(true); // 95 >= 90
  });

  it('expands maxValue when any category target exceeds the data maximum', () => {
    const specWithHighCategoryTarget: ChartLayoutSpec = {
      categoryColumn: 'indikator',
      categories: ['Indikator A', 'Indikator B'],
      series: [{ key: 'capaian', label: 'Capaian', color: '#525AFF' }],
      rows: [
        { indikator: 'Indikator A', capaian: 40 },
        { indikator: 'Indikator B', capaian: 50 },
      ],
      categoryTargets: {
        'Indikator A': 60,
        'Indikator B': 120, // exceeds data max (50)
      },
    };

    const layout = ChartLayoutEngine.computeLayout(specWithHighCategoryTarget);
    expect(layout.maxValue).toBeGreaterThanOrEqual(120);
  });
});

