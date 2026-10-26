import { describe, it, expect } from 'vitest';
import { DistrictHeatmapEngine } from './district-heatmap-engine';
import { DistrictMapFeature } from '../stunting-dashboard/stunting-map-data';
import { ChartSeriesConfig } from './chart-layout-engine';

describe('DistrictHeatmapEngine', () => {
  const dummyDistricts: DistrictMapFeature[] = [
    {
      id: '33-01',
      kabupatenKota: 'KABUPATEN CILACAP',
      displayName: 'Cilacap',
      isKota: false,
      pathD: 'M 10 10 L 20 20 Z',
      centroidLon: 109.0,
      centroidLat: -7.5,
      svgCenterX: 15,
      svgCenterY: 15,
    },
    {
      id: '33-02',
      kabupatenKota: 'KABUPATEN BANYUMAS',
      displayName: 'Banyumas',
      isKota: false,
      pathD: 'M 20 20 L 30 30 Z',
      centroidLon: 109.2,
      centroidLat: -7.4,
      svgCenterX: 25,
      svgCenterY: 25,
    },
    {
      id: '33-08',
      kabupatenKota: 'KABUPATEN MAGELANG',
      displayName: 'Magelang',
      isKota: false,
      pathD: 'M 30 30 L 40 40 Z',
      centroidLon: 110.1,
      centroidLat: -7.5,
      svgCenterX: 35,
      svgCenterY: 35,
    },
    {
      id: '33-71',
      kabupatenKota: 'KOTA MAGELANG',
      displayName: 'Kota Magelang',
      isKota: true,
      pathD: 'M 40 40 L 50 50 Z',
      centroidLon: 110.2,
      centroidLat: -7.48,
      svgCenterX: 45,
      svgCenterY: 45,
    },
    {
      id: '33-74',
      kabupatenKota: 'KOTA SEMARANG',
      displayName: 'Kota Semarang',
      isKota: true,
      pathD: 'M 50 50 L 60 60 Z',
      centroidLon: 110.4,
      centroidLat: -7.0,
      svgCenterX: 55,
      svgCenterY: 55,
    },
  ];

  const series: ChartSeriesConfig = {
    key: 'cakupan',
    label: 'Cakupan Imunisasi',
    color: '#525AFF',
  };

  it('extracts hue correctly from hex codes', () => {
    // #525AFF (blue/indigo) ~ 237 deg
    const blueHue = DistrictHeatmapEngine.extractHueFromHex('#525AFF');
    expect(blueHue).toBeGreaterThanOrEqual(230);
    expect(blueHue).toBeLessThanOrEqual(245);

    // #10B981 (emerald) ~ 160 deg
    const emeraldHue = DistrictHeatmapEngine.extractHueFromHex('#10B981');
    expect(emeraldHue).toBeGreaterThanOrEqual(150);
    expect(emeraldHue).toBeLessThanOrEqual(170);

    // Fallback on invalid hex
    expect(DistrictHeatmapEngine.extractHueFromHex('')).toBe(
      DistrictHeatmapEngine.DEFAULT_BASE_HUE,
    );
    expect(DistrictHeatmapEngine.extractHueFromHex('invalid')).toBe(
      DistrictHeatmapEngine.DEFAULT_BASE_HUE,
    );
  });

  it('computes color for ratio with contrasting text color and 2-color gradient', () => {
    const low = DistrictHeatmapEngine.getColorForRatio(0.0);
    expect(low.fill).toBe('rgb(254, 240, 138)');
    expect(low.text).toBe('#0f172a'); // dark text on light background

    const high = DistrictHeatmapEngine.getColorForRatio(1.0);
    expect(high.fill).toBe('rgb(185, 28, 28)');
    expect(high.text).toBe('#ffffff'); // white text on dark background

    const mid = DistrictHeatmapEngine.getColorForRatio(0.5);
    expect(mid.fill).toBe('rgb(220, 134, 83)'); // smooth warm orange midpoint
  });

  it('matches district names with various prefixes and keeps Kota distinct from Kabupaten', () => {
    const rows = [
      { 'Kabupaten/Kota': '3301 - KAB. CILACAP', cakupan: 85 },
      { 'Kabupaten/Kota': 'Banyumas', cakupan: '92.5%' },
      { 'Kabupaten/Kota': '3308 - KAB. MAGELANG', cakupan: 70 },
      { 'Kabupaten/Kota': '3371 - KOTA MAGELANG', cakupan: 95 },
      // Kota Semarang omitted to test missing handling
    ];

    const result = DistrictHeatmapEngine.computeHeatmap({
      districts: dummyDistricts,
      rows,
      categoryColumn: 'Kabupaten/Kota',
      series,
      targetValue: 80,
    });

    expect(result.items.length).toBe(5);

    // 1. Cilacap
    const cilacap = result.items.find((i) => i.district.id === '33-01')!;
    expect(cilacap.value).toBe(85);
    expect(cilacap.status).toBe('achieved');
    expect(cilacap.diffFromTarget).toBe(5);
    expect(cilacap.rank).toBe(3); // 95 (Kota Magelang), 92.5 (Banyumas), 85 (Cilacap), 70 (Kab Magelang)

    // 2. Banyumas
    const banyumas = result.items.find((i) => i.district.id === '33-02')!;
    expect(banyumas.value).toBe(92.5);
    expect(banyumas.status).toBe('achieved');
    expect(banyumas.rank).toBe(2);

    // 3. Kab Magelang vs Kota Magelang (must NOT collide!)
    const kabMagelang = result.items.find((i) => i.district.id === '33-08')!;
    const kotaMagelang = result.items.find((i) => i.district.id === '33-71')!;
    expect(kabMagelang.value).toBe(70);
    expect(kabMagelang.status).toBe('unachieved');
    expect(kabMagelang.diffFromTarget).toBe(-10);
    expect(kabMagelang.rank).toBe(4);

    expect(kotaMagelang.value).toBe(95);
    expect(kotaMagelang.status).toBe('achieved');
    expect(kotaMagelang.rank).toBe(1); // Highest!

    // 4. Missing district (Kota Semarang)
    const semarang = result.items.find((i) => i.district.id === '33-74')!;
    expect(semarang.value).toBeNull();
    expect(semarang.status).toBe('missing');
    expect(semarang.fillColor).toBe(DistrictHeatmapEngine.MISSING_FILL);
    expect(semarang.rank).toBeNull();
  });

  it('calculates aggregate statistics correctly', () => {
    const rows = [
      { Daerah: 'Cilacap', val: 60 },
      { Daerah: 'Banyumas', val: 80 },
      { Daerah: 'Kabupaten Magelang', val: 100 },
    ];

    const result = DistrictHeatmapEngine.computeHeatmap({
      districts: dummyDistricts,
      rows,
      categoryColumn: 'Daerah',
      series: { key: 'val', label: 'Nilai', color: '#10B981' },
      targetValue: 75,
    });

    const { stats } = result;
    expect(stats.totalDistricts).toBe(5);
    expect(stats.validCount).toBe(3);
    expect(stats.missingCount).toBe(2);
    expect(stats.min).toBe(60);
    expect(stats.max).toBe(100);
    expect(stats.avg).toBe(80); // (60 + 80 + 100) / 3 = 80
    expect(stats.achievedCount).toBe(2); // 80 and 100 >= 75
    expect(stats.highest).toEqual({ name: 'Magelang', value: 100 });
    expect(stats.lowest).toEqual({ name: 'Cilacap', value: 60 });
  });

  it('generates 5 color scale legend stops spanning 0 to 100, continuous gradient CSS, and target position', () => {
    const rows = [
      { Daerah: 'Cilacap', val: 50 },
      { Daerah: 'Banyumas', val: 90 },
    ];

    const result = DistrictHeatmapEngine.computeHeatmap({
      districts: dummyDistricts,
      rows,
      categoryColumn: 'Daerah',
      series: { key: 'val', label: 'Nilai', color: '#525AFF' },
      targetValue: 70,
    });

    expect(result.colorStops.length).toBe(5);
    expect(result.colorStops[0].value).toBe(0);
    expect(result.colorStops[0].label).toContain('Min');
    expect(result.colorStops[4].value).toBe(100);
    expect(result.colorStops[4].label).toContain('Maks');
    expect(result.colorStops[2].value).toBe(50); // midpoint on 0-100 scale

    // Continuous gradient CSS
    expect(result.gradientCss).toContain('linear-gradient(to right,');
    expect(result.targetPositionPercent).toBe(70); // 70 is at 70% on 0-100 scale

    // Ratio percent on items (relative to 0-100 scale)
    const cilacap = result.items.find((i) => i.district.id === '33-01')!;
    expect(cilacap.ratioPercent).toBe(50);
    const banyumas = result.items.find((i) => i.district.id === '33-02')!;
    expect(banyumas.ratioPercent).toBe(90);
  });

  it('applies red-yellow-green scheme where below target is red, at target is yellow, and above target is green', () => {
    // Test getColorForValue directly on 0-100 scale
    const below = DistrictHeatmapEngine.getColorForValue(0, 0, 100, 80);
    expect(below.fill).toBe('rgb(220, 38, 38)'); // pure Red at scale min (0)

    const atTarget = DistrictHeatmapEngine.getColorForValue(80, 0, 100, 80);
    expect(atTarget.fill).toBe('rgb(234, 179, 8)'); // pure Yellow at target level (80)

    const above = DistrictHeatmapEngine.getColorForValue(100, 0, 100, 80);
    expect(above.fill).toBe('rgb(22, 163, 74)'); // pure Green at scale max (100)

    // Test computeHeatmap item colors
    const rows = [
      { Daerah: 'Cilacap', val: 0 },   // Scale min (red)
      { Daerah: 'Banyumas', val: 80 }, // Exactly at target (yellow)
      { Daerah: 'Kabupaten Magelang', val: 100 }, // Scale max (green)
    ];

    const result = DistrictHeatmapEngine.computeHeatmap({
      districts: dummyDistricts,
      rows,
      categoryColumn: 'Daerah',
      series: { key: 'val', label: 'Nilai', color: '#525AFF' },
      targetValue: 80,
    });

    const cilacap = result.items.find((i) => i.district.id === '33-01')!;
    const banyumas = result.items.find((i) => i.district.id === '33-02')!;
    const magelang = result.items.find((i) => i.district.id === '33-08')!;

    expect(cilacap.fillColor).toBe('rgb(220, 38, 38)'); // Red (scale min)
    expect(banyumas.fillColor).toBe('rgb(234, 179, 8)'); // Yellow (at target)
    expect(magelang.fillColor).toBe('rgb(22, 163, 74)'); // Green (at max 100)

    // Check gradient CSS anchors target at 80% on 0-100 scale
    expect(result.gradientCss).toContain('rgb(220,38,38) 0%');
    expect(result.gradientCss).toContain('rgb(234,179,8) 80%');
    expect(result.gradientCss).toContain('rgb(22,163,74) 100%');
  });

  it('caps indicator values exceeding 100 at maximum value 100', () => {
    const rows = [
      { Daerah: 'Cilacap', val: 115.5 },
      { Daerah: 'Banyumas', val: 80 },
    ];

    const result = DistrictHeatmapEngine.computeHeatmap({
      districts: dummyDistricts,
      rows,
      categoryColumn: 'Daerah',
      series: { key: 'val', label: 'Nilai', color: '#525AFF' },
      targetValue: 80,
    });

    const cilacap = result.items.find((i) => i.district.id === '33-01')!;
    expect(cilacap.value).toBe(100);
    expect(cilacap.formattedValue).toBe('100');
    expect(cilacap.ratioPercent).toBe(100);
    expect(cilacap.fillColor).toBe('rgb(22, 163, 74)'); // Pure green
    expect(result.stats.max).toBe(100);
  });

  it('inverts color palette and marks achieved when value <= targetValue for targetOperator "<=" (Masalah Gizi)', () => {
    // For Masalah Gizi: at scale min 0% prevalence is ideal (green), at target 14% is yellow, at max 100% is red
    const atMin = DistrictHeatmapEngine.getColorForValue(0, 0, 100, 14, undefined, '<=');
    expect(atMin.fill).toBe('rgb(22, 163, 74)'); // Green at 0% prevalence

    const atTarget = DistrictHeatmapEngine.getColorForValue(14, 0, 100, 14, undefined, '<=');
    expect(atTarget.fill).toBe('rgb(234, 179, 8)'); // Yellow at target

    const atMax = DistrictHeatmapEngine.getColorForValue(100, 0, 100, 14, undefined, '<=');
    expect(atMax.fill).toBe('rgb(220, 38, 38)'); // Red at 100% prevalence

    const rows = [
      { Daerah: 'Cilacap', val: 10 }, // 10 <= 14 -> achieved!
      { Daerah: 'Banyumas', val: 20 }, // 20 > 14 -> unachieved!
    ];

    const result = DistrictHeatmapEngine.computeHeatmap({
      districts: dummyDistricts,
      rows,
      categoryColumn: 'Daerah',
      series: { key: 'val', label: 'Stunting %', color: '#ef4444' },
      targetValue: 14,
      targetOperator: '<=',
    });

    const cilacap = result.items.find((i) => i.district.id === '33-01')!;
    const banyumas = result.items.find((i) => i.district.id === '33-02')!;

    expect(cilacap.status).toBe('achieved');
    expect(banyumas.status).toBe('unachieved');
    expect(result.stats.achievedCount).toBe(1);

    // Gradient bar starts green at 0% and ends red at 100%
    expect(result.gradientCss).toContain('rgb(22,163,74) 0%');
    expect(result.gradientCss).toContain('rgb(234,179,8) 14%');
    expect(result.gradientCss).toContain('rgb(220,38,38) 100%');

    // Color stops follow green to red
    expect(result.colorStops[0].color).toBe('rgb(22, 163, 74)'); // Green at 0%
    expect(result.colorStops[4].color).toBe('rgb(220, 38, 38)'); // Red at 100%

    // Rank 1 is Cilacap (prevalence terendah = 10%)
    expect(cilacap.rank).toBe(1);
    expect(banyumas.rank).toBe(2);
    expect(result.rankedItems[0].district.id).toBe('33-01');
  });
});
