import { ChartDataRow, ChartSeriesConfig } from './chart-layout-engine';
import {
  ChartSlicingEngine,
  IndicatorChartGroup,
  RegionChartGroup,
  IndicatorSlicingSpec,
  RegionSlicingSpec,
} from './chart-slicing-engine';
import {
  DistrictHeatmapEngine,
  DistrictHeatmapResult,
  ComputeDistrictHeatmapOptions,
} from './district-heatmap-engine';
import {
  IndicatorCorrelationEngine,
  CorrelationMatrixResult,
} from './indicator-correlation-engine';
import {
  PriorityQuadrantEngine,
  PriorityQuadrantResult,
  ClassifyQuadrantsOptions,
  QuadrantThresholdMode,
} from './priority-quadrant-engine';

export interface ChartVisualizationRequest {
  rows: ChartDataRow[];
  categoryColumn: string;
  seriesKeys: string[];
  seriesList: ChartSeriesConfig[];
  targets?: Record<string, number | null>;
  targetOperators?: Record<string, string>;
  defaultTarget?: number | null;
  defaultTargetOperator?: string;
  selectedCategories?: string[];
}

export interface ChartVisualizationBundle {
  indicatorGroups: IndicatorChartGroup[];
  regionGroups: RegionChartGroup[];
  heatmap?: DistrictHeatmapResult;
  correlation?: CorrelationMatrixResult;
  quadrant?: PriorityQuadrantResult;
}

export class UnifiedChartVisualizationModule {
  static process(request: ChartVisualizationRequest): ChartVisualizationBundle {
    const targetOperators = request.targetOperators ?? {};
    const targets = request.targets ?? {};

    const indicatorSpec: IndicatorSlicingSpec = {
      categories: request.selectedCategories ?? [],
      series: request.seriesList,
      rows: request.rows,
      categoryColumn: request.categoryColumn,
      targetValue: request.defaultTarget ?? null,
      targetOperator: request.defaultTargetOperator ?? '>=',
      indicatorTargets: targets,
      indicatorTargetOperators: targetOperators,
      width: 780,
      rowHeight: 22,
      gapWidth: 5,
    };

    const regionSpec: RegionSlicingSpec = {
      categories: request.selectedCategories ?? [],
      series: request.seriesList,
      rows: request.rows,
      categoryColumn: request.categoryColumn,
      targetValue: request.defaultTarget ?? null,
      targetOperator: request.defaultTargetOperator ?? '>=',
      indicatorTargets: targets,
      indicatorTargetOperators: targetOperators,
      width: 780,
      rowHeight: 22,
      gapWidth: 5,
    };

    const indicatorGroups = ChartSlicingEngine.computeIndicatorGroups(indicatorSpec);
    const regionGroups = ChartSlicingEngine.computeRegionGroups(regionSpec);

    return {
      indicatorGroups,
      regionGroups,
    };
  }

  static generateHeatmap(
    rows: ChartDataRow[],
    categoryColumn: string,
    series: ChartSeriesConfig,
    targetValue: number | null = null,
    targetOperator: string = '>=',
    paletteId?: string
  ): DistrictHeatmapResult {
    const options: ComputeDistrictHeatmapOptions = {
      districts: [],
      rows,
      categoryColumn,
      series,
      targetValue,
      targetOperator,
      paletteId,
    };
    return DistrictHeatmapEngine.computeHeatmap(options);
  }

  static generateCorrelationMatrix(
    rows: ChartDataRow[],
    seriesList: ChartSeriesConfig[]
  ): CorrelationMatrixResult {
    return IndicatorCorrelationEngine.calculateCorrelationMatrix(rows, seriesList);
  }

  static generatePriorityQuadrant(
    rows: ChartDataRow[],
    categoryColumn: string,
    seriesList: ChartSeriesConfig[],
    metricX?: string,
    metricY?: string,
    thresholdMode: QuadrantThresholdMode = 'median',
    customThresholdX?: number,
    customThresholdY?: number
  ): PriorityQuadrantResult {
    const options: ClassifyQuadrantsOptions = {
      rows,
      categoryColumn,
      seriesList,
      metricX,
      metricY,
      thresholdMode,
      customThresholdX,
      customThresholdY,
    };
    return PriorityQuadrantEngine.classifyQuadrants(options);
  }
}
