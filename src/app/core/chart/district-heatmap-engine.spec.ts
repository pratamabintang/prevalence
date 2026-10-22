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

  it('computes color for ratio with contrasting text color', () => {
    const low = DistrictHeatmapEngine.getColorForRatio(0.0, 228);
    expect(low.fill).toContain('hsl(228,');
    expect(low.text).toBe('#0f172a'); // dark text on light background

    const high = DistrictHeatmapEngine.getColorForRatio(1.0, 228);
    expect(high.fill).toContain('hsl(228,');
    expect(high.text).toBe('#ffffff'); // white text on dark background
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

  it('generates 5 color scale legend stops spanning min to max, continuous gradient CSS, and target position', () => {
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
    expect(result.colorStops[0].value).toBe(50);
    expect(result.colorStops[0].label).toContain('Min');
    expect(result.colorStops[4].value).toBe(90);
    expect(result.colorStops[4].label).toContain('Maks');
    expect(result.colorStops[2].value).toBe(70); // midpoint (50 + 90) / 2

    // Continuous gradient CSS
    expect(result.gradientCss).toContain('linear-gradient(to right,');
    expect(result.targetPositionPercent).toBe(50); // 70 is exactly at 50% between 50 and 90

    // Ratio percent on items
    const cilacap = result.items.find((i) => i.district.id === '33-01')!;
    expect(cilacap.ratioPercent).toBe(0);
    const banyumas = result.items.find((i) => i.district.id === '33-02')!;
    expect(banyumas.ratioPercent).toBe(100);
  });
});
