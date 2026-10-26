import { describe, expect, it } from 'vitest';
import { DivergingBarEngine, DivergingBarSpec } from './diverging-bar-engine';

describe('DivergingBarEngine', () => {
  const dummyRows = [
    { wilayah: 'Cilacap', imunisasi: 85, stunting: 12 },
    { wilayah: 'Banyumas', imunisasi: 75, stunting: 16 },
  ];

  const dummySeries = [
    { key: 'imunisasi', label: 'Cakupan Imunisasi %' },
    { key: 'stunting', label: 'Prevalensi Stunting %' },
  ];

  it('computes provincial averages, performance gaps, and colors correctly for mixed operators', () => {
    const spec: DivergingBarSpec = {
      seriesList: dummySeries,
      rows: dummyRows,
      categoryColumn: 'wilayah',
      indicatorTargets: {
        imunisasi: 80,
        stunting: 14,
      },
      indicatorTargetOperators: {
        imunisasi: '>=',
        stunting: '<=',
      },
      sortMode: 'default',
    };

    const result = DivergingBarEngine.computeDivergingBars(spec);

    expect(result.items).toHaveLength(2);

    // Imunisasi: avg = (85 + 75) / 2 = 80. Target >= 80.
    // performanceGap = 80 - 80 = 0. Achieved!
    const imuItem = result.items.find((i) => i.key === 'imunisasi')!;
    expect(imuItem.actualValue).toBe(80);
    expect(imuItem.targetValue).toBe(80);
    expect(imuItem.performanceGap).toBe(0);
    expect(imuItem.isAchieved).toBe(true);

    // Stunting: avg = (12 + 16) / 2 = 14. Target <= 14.
    // performanceGap = 14 - 14 = 0. Achieved!
    const stuntingItem = result.items.find((i) => i.key === 'stunting')!;
    expect(stuntingItem.actualValue).toBe(14);
    expect(stuntingItem.targetValue).toBe(14);
    expect(stuntingItem.isAchieved).toBe(true);
  });

  it('marks positive gap as green (right) and negative gap as red (left)', () => {
    const rows = [
      { wilayah: 'Cilacap', imunisasi: 90, stunting: 18 },
      { wilayah: 'Banyumas', imunisasi: 90, stunting: 18 },
    ];

    const spec: DivergingBarSpec = {
      seriesList: dummySeries,
      rows,
      categoryColumn: 'wilayah',
      indicatorTargets: {
        imunisasi: 80, // Actual 90 > 80 (performanceGap = +10) -> Achieved!
        stunting: 14,  // Actual 18 > 14 (performanceGap = -4) -> Deficit!
      },
      indicatorTargetOperators: {
        imunisasi: '>=',
        stunting: '<=',
      },
      sortMode: 'default',
    };

    const result = DivergingBarEngine.computeDivergingBars(spec);

    const imuItem = result.items.find((i) => i.key === 'imunisasi')!;
    expect(imuItem.performanceGap).toBe(10);
    expect(imuItem.isAchieved).toBe(true);
    expect(imuItem.color).toBe(DivergingBarEngine.COLOR_ACHIEVED);
    expect(imuItem.barX).toBe(result.zeroX); // Extends right from zeroX

    const stuntingItem = result.items.find((i) => i.key === 'stunting')!;
    expect(stuntingItem.performanceGap).toBe(-4);
    expect(stuntingItem.isAchieved).toBe(false);
    expect(stuntingItem.color).toBe(DivergingBarEngine.COLOR_DEFICIT);
    expect(stuntingItem.barX).toBeLessThan(result.zeroX); // Extends left from zeroX
  });

  it('identifies topPerformer and mostCriticalDeficit', () => {
    const rows = [
      { wilayah: 'Jateng', a: 95, b: 60, c: 50 },
    ];
    const series = [
      { key: 'a', label: 'Indikator A' },
      { key: 'b', label: 'Indikator B' },
      { key: 'c', label: 'Indikator C' },
    ];

    const spec: DivergingBarSpec = {
      seriesList: series,
      rows,
      categoryColumn: 'wilayah',
      indicatorTargets: { a: 80, b: 80, c: 50 }, // A: +15, B: -20, C: 0
      indicatorTargetOperators: { a: '>=', b: '>=', c: '>=' },
    };

    const result = DivergingBarEngine.computeDivergingBars(spec);

    expect(result.topPerformer?.key).toBe('a');
    expect(result.mostCriticalDeficit?.key).toBe('b');
    expect(result.achievedCount).toBe(2); // A (+15) and C (0) are achieved
    expect(result.deficitCount).toBe(1); // B is deficit
  });

  it('supports sorting by deficit-first and achieved-first', () => {
    const rows = [{ wilayah: 'Jateng', a: 95, b: 60, c: 70 }];
    const series = [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B' },
      { key: 'c', label: 'C' },
    ];

    // Deficit first
    const resDeficit = DivergingBarEngine.computeDivergingBars({
      seriesList: series,
      rows,
      categoryColumn: 'wilayah',
      indicatorTargets: { a: 80, b: 80, c: 80 }, // gaps: A +15, B -20, C -10
      sortMode: 'deficit-first',
    });
    expect(resDeficit.items[0].key).toBe('b'); // -20 first
    expect(resDeficit.items[1].key).toBe('c'); // -10 second
    expect(resDeficit.items[2].key).toBe('a'); // +15 last

    // Achieved first
    const resAchieved = DivergingBarEngine.computeDivergingBars({
      seriesList: series,
      rows,
      categoryColumn: 'wilayah',
      indicatorTargets: { a: 80, b: 80, c: 80 },
      sortMode: 'achieved-first',
    });
    expect(resAchieved.items[0].key).toBe('a'); // +15 first
    expect(resAchieved.items[2].key).toBe('b'); // -20 last
  });

  it('supports filtering by deficit-only and achieved-only', () => {
    const rows = [{ wilayah: 'Jateng', a: 95, b: 60 }];
    const series = [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B' },
    ];

    const resDeficit = DivergingBarEngine.computeDivergingBars({
      seriesList: series,
      rows,
      categoryColumn: 'wilayah',
      indicatorTargets: { a: 80, b: 80 },
      filterMode: 'deficit-only',
    });
    expect(resDeficit.items).toHaveLength(1);
    expect(resDeficit.items[0].key).toBe('b');

    const resAchieved = DivergingBarEngine.computeDivergingBars({
      seriesList: series,
      rows,
      categoryColumn: 'wilayah',
      indicatorTargets: { a: 80, b: 80 },
      filterMode: 'achieved-only',
    });
    expect(resAchieved.items).toHaveLength(1);
    expect(resAchieved.items[0].key).toBe('a');
  });
});
