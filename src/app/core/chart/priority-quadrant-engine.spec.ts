import { describe, expect, it } from 'vitest';
import { PriorityQuadrantEngine } from './priority-quadrant-engine';

describe('PriorityQuadrantEngine', () => {
  const dummyRows = [
    { 'Kabupaten/Kota': 'Kabupaten Cilacap', anc: 75, ttd_bumil: 65, ds: 82, tumbang: 78 },
    { 'Kabupaten/Kota': 'Kabupaten Banyumas', anc: 40, ttd_bumil: 35, ds: 85, tumbang: 80 },
    { 'Kabupaten/Kota': 'Kabupaten Purbalingga', anc: 80, ttd_bumil: 70, ds: 45, tumbang: 40 },
    { 'Kabupaten/Kota': 'Kabupaten Banjarnegara', anc: 30, ttd_bumil: 25, ds: 35, tumbang: 30 },
  ];

  const seriesList = [
    { key: 'anc', label: '% ANC 6x' },
    { key: 'ttd_bumil', label: '% TTD Bumil' },
    { key: 'ds', label: '% D/S Balita' },
    { key: 'tumbang', label: '% Tumbang Balita' },
  ];

  it('correctly classifies indicators into Hulu (Pencegahan) vs Hilir (Penanganan Balita)', () => {
    const hulu = PriorityQuadrantEngine.getHuluSeries(seriesList);
    const hilir = PriorityQuadrantEngine.getHilirSeries(seriesList);

    expect(hulu.map((s) => s.key)).toEqual(['anc', 'ttd_bumil']);
    expect(hilir.map((s) => s.key)).toEqual(['ds', 'tumbang']);
  });

  it('computes composite scores for Hulu and Hilir per district', () => {
    const composite = PriorityQuadrantEngine.computeCompositeScores(dummyRows, 'Kabupaten/Kota', seriesList);

    expect(composite.length).toBe(4);
    // Cilacap: Hulu = (75 + 65) / 2 = 70; Hilir = (82 + 78) / 2 = 80
    expect(composite[0].category).toBe('Kabupaten Cilacap');
    expect(composite[0].huluScore).toBe(70);
    expect(composite[0].hilirScore).toBe(80);

    // Banyumas: Hulu = (40 + 35) / 2 = 37.5; Hilir = (85 + 80) / 2 = 82.5
    expect(composite[1].huluScore).toBe(37.5);
    expect(composite[1].hilirScore).toBe(82.5);
  });

  it('classifies districts accurately into the 4 Policy Quadrants based on thresholds', () => {
    const result = PriorityQuadrantEngine.classifyQuadrants({
      rows: dummyRows,
      categoryColumn: 'Kabupaten/Kota',
      seriesList,
      metricX: 'composite_hulu',
      metricY: 'composite_hilir',
      thresholdMode: 'custom',
      customThresholdX: 50,
      customThresholdY: 50,
    });

    expect(result.thresholdX).toBe(50);
    expect(result.thresholdY).toBe(50);

    // Cilacap (70, 80) -> Quadrant I (Hulu >= 50, Hilir >= 50)
    expect(result.districts[0].quadrant).toBe(1);
    expect(result.districts[0].quadrantTitle).toContain('Kuadran I');

    // Banyumas (37.5, 82.5) -> Quadrant II (Hulu < 50, Hilir >= 50)
    expect(result.districts[1].quadrant).toBe(2);
    expect(result.districts[1].quadrantTitle).toContain('Kuadran II');

    // Purbalingga (75, 42.5) -> Quadrant III (Hulu >= 50, Hilir < 50)
    expect(result.districts[2].quadrant).toBe(3);
    expect(result.districts[2].quadrantTitle).toContain('Kuadran III');

    // Banjarnegara (27.5, 32.5) -> Quadrant IV (Hulu < 50, Hilir < 50)
    expect(result.districts[3].quadrant).toBe(4);
    expect(result.districts[3].quadrantTitle).toContain('Kuadran IV');

    // Summary counts: each quadrant has 1 district
    expect(result.quadrantSummaries.q1.count).toBe(1);
    expect(result.quadrantSummaries.q2.count).toBe(1);
    expect(result.quadrantSummaries.q3.count).toBe(1);
    expect(result.quadrantSummaries.q4.count).toBe(1);
  });

  it('supports median threshold mode calculated dynamically from the dataset', () => {
    const result = PriorityQuadrantEngine.classifyQuadrants({
      rows: dummyRows,
      categoryColumn: 'Kabupaten/Kota',
      seriesList,
      metricX: 'composite_hulu',
      metricY: 'composite_hilir',
      thresholdMode: 'median',
    });

    // Hulu scores: 70, 37.5, 75, 27.5 -> sorted: 27.5, 37.5, 70, 75 -> median = (37.5 + 70)/2 = 53.75
    expect(result.thresholdX).toBeCloseTo(53.75, 1);
    expect(result.thresholdMode).toBe('median');
  });

  it('supports selecting single indicators for X and Y axes instead of composite', () => {
    const result = PriorityQuadrantEngine.classifyQuadrants({
      rows: dummyRows,
      categoryColumn: 'Kabupaten/Kota',
      seriesList,
      metricX: 'anc',
      metricY: 'ds',
      thresholdMode: 'custom',
      customThresholdX: 50,
      customThresholdY: 50,
    });

    expect(result.metricXLabel).toBe('% ANC 6x');
    expect(result.metricYLabel).toBe('% D/S Balita');
    expect(result.districts[0].xVal).toBe(75);
    expect(result.districts[0].yVal).toBe(82);
  });
});
