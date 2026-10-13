import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { StuntingDashboardStore } from './stunting-dashboard-store';

describe('StuntingDashboardStore', () => {
  let store: StuntingDashboardStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [StuntingDashboardStore],
    });
    store = TestBed.inject(StuntingDashboardStore);
  });

  it('should initialize dataset correctly with 35 wilayah, 5 periods, and 175 observations', () => {
    const meta = store.metadata();
    expect(meta.wilayah_count).toBe(35);
    expect(meta.period_count).toBe(5);
    expect(meta.observation_count).toBe(175);
    expect(store.dataset.observations.length).toBe(175);
    expect(store.wilayahList().length).toBe(35);
    expect(store.periods()).toEqual([
      'TW1 2025',
      'TW2 2025',
      'TW3 2025',
      'TW4 2025',
      'TW1 2026',
    ]);
  });

  it('should calculate summary cards accurately from actual data', () => {
    const cards = store.summaryCards();
    expect(cards.wilayah_count).toBe(35);
    expect(cards.period_count).toBe(5);
    expect(cards.median_latest).toBe(9.52);
    expect(cards.median_first).toBe(9.7);
    expect(cards.median_change).toBe(-0.18);
  });

  it('should provide correct median trendLineData by default', () => {
    const trend = store.trendLineData();
    expect(trend.wilayahName).toBe('Median Antarwilayah');
    expect(trend.points.length).toBe(5);
    expect(trend.points.map((p) => p.value)).toEqual([9.7, 9.82, 9.83, 9.58, 9.52]);
    expect(trend.overallDelta).toBe(-0.18);
    expect(trend.interpretationText).toContain('menurun');
    expect(trend.interpretationText).toContain('0,18 poin persentase');
  });

  it('should update trendLineData when a specific wilayah is selected', () => {
    store.setWilayah('KABUPATEN BANYUMAS');
    const trend = store.trendLineData();
    expect(trend.wilayahName).toBe('KABUPATEN BANYUMAS');
    expect(trend.points.length).toBe(5);
    expect(trend.points.every((p) => p.value > 0)).toBe(true);
  });

  it('should compute quarterly transitions for 4 intervals', () => {
    const trans = store.quarterlyTransitions();
    expect(trans.length).toBe(4);
    expect(trans[0].interval).toBe('TW1 2025 → TW2 2025');
    expect(trans[0].delta).toBe(0.12);
    expect(trans[1].delta).toBe(0.01);
    expect(trans[2].delta).toBe(-0.25);
    expect(trans[3].delta).toBe(-0.06);
  });

  it('should filter heatmap rows by search query', () => {
    expect(store.heatmapRows().length).toBe(35);
    store.setHeatmapSearch('Banyumas');
    expect(store.heatmapRows().length).toBe(1);
    expect(store.heatmapRows()[0].wilayah).toBe('KABUPATEN BANYUMAS');
    store.setHeatmapSearch('');
    expect(store.heatmapRows().length).toBe(35);
  });

  it('should supply boxplot stats for 5 periods with min <= median <= max', () => {
    const bp = store.boxplotData();
    expect(bp.length).toBe(5);
    for (const b of bp) {
      expect(b.stats.min).toBeLessThanOrEqual(b.stats.median);
      expect(b.stats.median).toBeLessThanOrEqual(b.stats.max);
      expect(b.allValues.length).toBe(35);
    }
  });

  it('should calculate scatter plot data and Pearson correlation', () => {
    store.setIndicator('x1_ttd_rematri');
    store.setScatterPeriod('ALL');
    const scAll = store.scatterData();
    expect(scAll.points.length).toBe(175);
    expect(typeof scAll.rPearson).toBe('number');

    store.setScatterPeriod('TW1 2026');
    const scPeriod = store.scatterData();
    expect(scPeriod.points.length).toBe(35);
  });

  it('should provide advanced econometric models from notebook audit', () => {
    const m = store.models();
    expect(m.fe9.length).toBe(9);
    expect(m.fd.length).toBe(9);
    expect(m.moran.length).toBe(10);
    expect(m.gwr.length).toBe(5);
    expect(m.pca_var.length).toBe(9);
    expect(m.audit_checks.every((c) => c.pass)).toBe(true);
  });
});
