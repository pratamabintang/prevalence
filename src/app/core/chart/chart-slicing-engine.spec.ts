import { describe, expect, it } from 'vitest';
import { ChartSeriesConfig } from './chart-layout-engine';
import {
  ChartSlicingEngine,
  IndicatorSlicingSpec,
  RegionSlicingSpec,
} from './chart-slicing-engine';

describe('ChartSlicingEngine', () => {
  const sampleSeries: ChartSeriesConfig[] = [
    { key: 'tw1', label: 'Triwulan 1', color: '#3B82F6' },
    { key: 'tw2', label: 'Triwulan 2', color: '#10B981' },
    { key: 'tw3', label: 'Triwulan 3', color: '#F59E0B' },
  ];

  const sampleRows = [
    { Wilayah: 'Cilacap', tw1: 80, tw2: 90, tw3: 100 },
    { Wilayah: 'Banyumas', tw1: 50, tw2: 0, tw3: '-' }, // 0 is valid zero, '-' is missing
    { Wilayah: 'Purbalingga', tw1: null, tw2: null, tw3: null }, // all missing
  ];

  const sampleCategories = ['Cilacap', 'Banyumas', 'Purbalingga'];

  describe('computeRegionGroups', () => {
    it('should compute region groups with accurate statistical summaries and layout', () => {
      const spec: RegionSlicingSpec = {
        categories: sampleCategories,
        series: sampleSeries,
        rows: sampleRows,
        categoryColumn: 'Wilayah',
        sortMode: 'default',
        targetValue: 80,
        indicatorTargets: { tw1: 80, tw2: 85, tw3: 90 },
      };

      const groups = ChartSlicingEngine.computeRegionGroups(spec);

      expect(groups).toHaveLength(3);

      // Check Cilacap: tw1=80, tw2=90, tw3=100
      const cilacap = groups.find((g) => g.regionName === 'Cilacap')!;
      expect(cilacap).toBeDefined();
      expect(cilacap.stats.total).toBe(3);
      expect(cilacap.stats.totalTargeted).toBe(3);
      expect(cilacap.stats.validCount).toBe(3);
      expect(cilacap.stats.missingCount).toBe(0);
      expect(cilacap.stats.zeroCount).toBe(0);
      expect(cilacap.stats.achievedCount).toBe(3); // 80>=80, 90>=85, 100>=90
      expect(cilacap.stats.avgValue).toBe(90);
      expect(cilacap.stats.highest).toEqual({ label: 'Triwulan 3', value: 100 });
      expect(cilacap.stats.lowest).toEqual({ label: 'Triwulan 1', value: 80 });
      expect(cilacap.layout).toBeDefined();
      expect(cilacap.layout.categoryGroups).toHaveLength(3); // 3 indicators

      // Check Banyumas: tw1=50, tw2=0, tw3='-'
      const banyumas = groups.find((g) => g.regionName === 'Banyumas')!;
      expect(banyumas).toBeDefined();
      expect(banyumas.stats.validCount).toBe(2);
      expect(banyumas.stats.missingCount).toBe(1); // '-' is missing
      expect(banyumas.stats.zeroCount).toBe(1); // 0 is zero
      expect(banyumas.stats.achievedCount).toBe(0); // 50<80, 0<85
      expect(banyumas.stats.avgValue).toBe(25); // (50 + 0) / 2
      expect(banyumas.stats.highest).toEqual({ label: 'Triwulan 1', value: 50 });
      expect(banyumas.stats.lowest).toEqual({ label: 'Triwulan 2', value: 0 });

      // Check Purbalingga: all null
      const purbalingga = groups.find((g) => g.regionName === 'Purbalingga')!;
      expect(purbalingga).toBeDefined();
      expect(purbalingga.stats.validCount).toBe(0);
      expect(purbalingga.stats.missingCount).toBe(3);
      expect(purbalingga.stats.avgValue).toBeNull();
      expect(purbalingga.stats.highest).toBeNull();
      expect(purbalingga.stats.lowest).toBeNull();
    });

    it('should sort region groups descending by avgValue with null values at the end', () => {
      const spec: RegionSlicingSpec = {
        categories: sampleCategories,
        series: sampleSeries,
        rows: sampleRows,
        categoryColumn: 'Wilayah',
        sortMode: 'desc',
      };

      const groups = ChartSlicingEngine.computeRegionGroups(spec);
      const names = groups.map((g) => g.regionName);

      expect(names).toEqual(['Cilacap', 'Banyumas', 'Purbalingga']);
    });

    it('should sort region groups ascending by avgValue with null values at the end', () => {
      const spec: RegionSlicingSpec = {
        categories: sampleCategories,
        series: sampleSeries,
        rows: sampleRows,
        categoryColumn: 'Wilayah',
        sortMode: 'asc',
      };

      const groups = ChartSlicingEngine.computeRegionGroups(spec);
      const names = groups.map((g) => g.regionName);

      expect(names).toEqual(['Banyumas', 'Cilacap', 'Purbalingga']);
    });
  });

  describe('computeIndicatorGroups', () => {
    it('should compute indicator groups with accurate statistical summaries and layout', () => {
      const spec: IndicatorSlicingSpec = {
        categories: sampleCategories,
        series: sampleSeries,
        rows: sampleRows,
        categoryColumn: 'Wilayah',
        sortMode: 'default',
        indicatorTargets: { tw1: 60, tw2: 80 },
      };

      const groups = ChartSlicingEngine.computeIndicatorGroups(spec);

      expect(groups).toHaveLength(3);

      // Check Triwulan 1: Cilacap=80, Banyumas=50, Purbalingga=null
      const tw1 = groups.find((g) => g.series.key === 'tw1')!;
      expect(tw1).toBeDefined();
      expect(tw1.stats.total).toBe(3);
      expect(tw1.stats.validCount).toBe(2);
      expect(tw1.stats.missingCount).toBe(1);
      expect(tw1.stats.zeroCount).toBe(0);
      expect(tw1.stats.achievedCount).toBe(1); // 80 >= 60, 50 < 60
      expect(tw1.stats.avgValue).toBe(65); // (80 + 50) / 2
      expect(tw1.stats.highest).toEqual({ name: 'Cilacap', value: 80 });
      expect(tw1.stats.lowest).toEqual({ name: 'Banyumas', value: 50 });
      expect(tw1.stats.targetValue).toBe(60);
      expect(tw1.layout).toBeDefined();

      // Check Triwulan 2: Cilacap=90, Banyumas=0, Purbalingga=null
      const tw2 = groups.find((g) => g.series.key === 'tw2')!;
      expect(tw2).toBeDefined();
      expect(tw2.stats.validCount).toBe(2);
      expect(tw2.stats.zeroCount).toBe(1);
      expect(tw2.stats.achievedCount).toBe(1); // 90 >= 80, 0 < 80
      expect(tw2.stats.avgValue).toBe(45); // (90 + 0) / 2
      expect(tw2.stats.highest).toEqual({ name: 'Cilacap', value: 90 });
      expect(tw2.stats.lowest).toEqual({ name: 'Banyumas', value: 0 });
    });

    it('should sort categories within indicator groups descending and ascending', () => {
      const specDesc: IndicatorSlicingSpec = {
        categories: sampleCategories,
        series: [sampleSeries[0]], // tw1: Cilacap 80, Banyumas 50, Purbalingga null
        rows: sampleRows,
        categoryColumn: 'Wilayah',
        sortMode: 'desc',
      };

      const groupDesc = ChartSlicingEngine.computeIndicatorGroups(specDesc)[0];
      const categoriesInDesc = groupDesc.layout.categoryGroups.map((cg) => cg.categoryName);
      expect(categoriesInDesc).toEqual(['Cilacap', 'Banyumas', 'Purbalingga']);

      const specAsc: IndicatorSlicingSpec = {
        categories: sampleCategories,
        series: [sampleSeries[0]],
        rows: sampleRows,
        categoryColumn: 'Wilayah',
        sortMode: 'asc',
      };

      const groupAsc = ChartSlicingEngine.computeIndicatorGroups(specAsc)[0];
      const categoriesInAsc = groupAsc.layout.categoryGroups.map((cg) => cg.categoryName);
      expect(categoriesInAsc).toEqual(['Banyumas', 'Cilacap', 'Purbalingga']);
    });

    it('should set slender bar height (~20px with rowHeight 22) and tight 1–2 px gap by default', () => {
      const regionGroups = ChartSlicingEngine.computeRegionGroups({
        categories: sampleCategories,
        series: sampleSeries,
        rows: sampleRows,
        categoryColumn: 'Wilayah',
      });
      const regionLayout = regionGroups[0].layout;
      expect(regionLayout.gapWidth).toBe(5);
      expect(regionLayout.viewBoxWidth).toBe(780);
      expect(regionLayout.categoryGroups[0].height).toBe(22);
      expect(regionLayout.categoryGroups[0].bars[0].height).toBeCloseTo(20.5, 0);
      const r0Bottom = regionLayout.categoryGroups[0].bars[0].y + regionLayout.categoryGroups[0].bars[0].height;
      const regionGap = regionLayout.categoryGroups[1].bars[0].y - r0Bottom;
      expect(regionGap).toBeGreaterThanOrEqual(1.0);
      expect(regionGap).toBeLessThanOrEqual(2.0);

      const indicatorGroups = ChartSlicingEngine.computeIndicatorGroups({
        categories: sampleCategories,
        series: [sampleSeries[0]],
        rows: sampleRows,
        categoryColumn: 'Wilayah',
      });
      const indLayout = indicatorGroups[0].layout;
      expect(indLayout.gapWidth).toBe(5);
      expect(indLayout.viewBoxWidth).toBe(780);
      expect(indLayout.categoryGroups[0].height).toBe(22);
      expect(indLayout.categoryGroups[0].bars[0].height).toBeCloseTo(20.5, 0);
      const i0Bottom = indLayout.categoryGroups[0].bars[0].y + indLayout.categoryGroups[0].bars[0].height;
      const indGap = indLayout.categoryGroups[1].bars[0].y - i0Bottom;
      expect(indGap).toBeGreaterThanOrEqual(1.0);
      expect(indGap).toBeLessThanOrEqual(2.0);
    });
  });
});
