import { describe, expect, it } from 'vitest';
import { ChartSeriesConfig } from './chart-layout-engine';
import {
  ChartVisualizationRequest,
  ChartVisualizationBundle,
  UnifiedChartVisualizationModule,
} from './unified-chart-visualization.module';

describe('UnifiedChartVisualizationModule', () => {
  const sampleSeries: ChartSeriesConfig[] = [
    { key: 'tw1', label: 'Triwulan 1', color: '#3B82F6' },
    { key: 'tw2', label: 'Triwulan 2', color: '#10B981' },
    { key: 'tw3', label: 'Triwulan 3', color: '#F59E0B' },
  ];

  const sampleRows = [
    { Wilayah: 'Cilacap', tw1: 80, tw2: 90, tw3: 100 },
    { Wilayah: 'Banyumas', tw1: 50, tw2: 0, tw3: '-' },
    { Wilayah: 'Purbalingga', tw1: null, tw2: null, tw3: null },
  ];

  const sampleCategories = ['Cilacap', 'Banyumas', 'Purbalingga'];

  const defaultRequest: ChartVisualizationRequest = {
    rows: sampleRows,
    categoryColumn: 'Wilayah',
    seriesKeys: ['tw1', 'tw2', 'tw3'],
    seriesList: sampleSeries,
    selectedCategories: sampleCategories,
    targets: { tw1: 80, tw2: 85, tw3: 90 },
    defaultTarget: 80,
    defaultTargetOperator: '>=',
  };

  describe('process', () => {
    it('should return bundle with indicator and region groups', () => {
      const bundle = UnifiedChartVisualizationModule.process(defaultRequest);

      expect(bundle.indicatorGroups).toBeDefined();
      expect(bundle.regionGroups).toBeDefined();
    });

    it('should produce same number of indicator groups as series count', () => {
      const bundle = UnifiedChartVisualizationModule.process(defaultRequest);
      expect(bundle.indicatorGroups).toHaveLength(sampleSeries.length);
    });

    it('should produce same number of region groups as categories count', () => {
      const bundle = UnifiedChartVisualizationModule.process(defaultRequest);
      expect(bundle.regionGroups).toHaveLength(sampleCategories.length);
    });

    it('should compute accurate region stats via unified interface', () => {
      const bundle = UnifiedChartVisualizationModule.process(defaultRequest);
      const cilacap = bundle.regionGroups.find((g) => g.regionName === 'Cilacap')!;
      expect(cilacap.stats.total).toBe(3);
      expect(cilacap.stats.validCount).toBe(3);
      expect(cilacap.stats.achievedCount).toBe(3);
    });

    it('should compute accurate indicator stats via unified interface', () => {
      const bundle = UnifiedChartVisualizationModule.process(defaultRequest);
      const tw1Group = bundle.indicatorGroups.find((g) => g.series.key === 'tw1')!;
      expect(tw1Group.stats.validCount).toBe(2); // Cilacap=80, Banyumas=50 valid; Purbalingga=null missing
      expect(tw1Group.stats.missingCount).toBe(1);
    });

    it('should filter groups when selected categories are empty', () => {
      const request: ChartVisualizationRequest = {
        ...defaultRequest,
        selectedCategories: [],
      };
      const bundle = UnifiedChartVisualizationModule.process(request);
      // Region groups depend on categories; indicator groups still exist per series but with no rows
      expect(bundle.regionGroups).toHaveLength(0);
      expect(bundle.indicatorGroups).toHaveLength(sampleSeries.length);
    });

    it('should return ChartVisualizationBundle shape', () => {
      const bundle: ChartVisualizationBundle = UnifiedChartVisualizationModule.process(defaultRequest);
      expect(bundle).toHaveProperty('indicatorGroups');
      expect(bundle).toHaveProperty('regionGroups');
    });
  });

  describe('generateHeatmap', () => {
    it('should produce heatmap result via unified interface', () => {
      const series: ChartSeriesConfig = { key: 'tw1', label: 'Triwulan 1', color: '#3B82F6' };
      const result = UnifiedChartVisualizationModule.generateHeatmap(
        sampleRows,
        'Wilayah',
        series,
        80,
        '>=',
        'red-yellow-green',
      );
      expect(result.series.key).toBe('tw1');
      expect(result.items).toBeDefined();
      expect(result.stats).toBeDefined();
    });
  });

  describe('generateCorrelationMatrix', () => {
    it('should produce correlation matrix via unified interface', () => {
      const result = UnifiedChartVisualizationModule.generateCorrelationMatrix(
        sampleRows,
        sampleSeries,
      );
      expect(result.matrix).toBeDefined();
    });
  });

  describe('generatePriorityQuadrant', () => {
    it('should produce quadrant result via unified interface', () => {
      const result = UnifiedChartVisualizationModule.generatePriorityQuadrant(
        sampleRows,
        'Wilayah',
        sampleSeries,
        'composite_hulu',
        'composite_hilir',
        'median',
      );
      expect(result.districts).toBeDefined();
    });
  });
});
