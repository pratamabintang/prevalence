import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseStuntingWorkbook,
  normalizeAreaName,
  computeBoxPlot,
  REQUIRED_INDICATOR_SHEETS,
  VALID_DISTRICT_NAMES,
} from './stunting-excel-parser';
import { StuntingDashboardDataset } from './stunting-dashboard.types';
import dashboardDataRaw from './stunting-dashboard-data.json';

describe('StuntingExcelParser', () => {
  const baseDataset = dashboardDataRaw as StuntingDashboardDataset;

  it('should normalize area names correctly', () => {
    expect(normalizeAreaName('Kab. Cilacap')).toBe('KABUPATEN CILACAP');
    expect(normalizeAreaName('kabupaten banyumas')).toBe('KABUPATEN BANYUMAS');
    expect(normalizeAreaName('Kota Semarang')).toBe('KOTA SEMARANG');
    expect(normalizeAreaName('Semarang')).toBe('KABUPATEN SEMARANG');
    expect(normalizeAreaName('3301 - KAB. CILACAP')).toBe('KABUPATEN CILACAP');
    expect(normalizeAreaName('3371 - KOTA MAGELANG')).toBe('KOTA MAGELANG');
    expect(normalizeAreaName('3308 - KAB. MAGELANG')).toBe('KABUPATEN MAGELANG');
  });

  it('should compute boxplot metrics correctly', () => {
    const data = [10, 20, 30, 40, 50];
    const box = computeBoxPlot(data);
    expect(box.min).toBe(10);
    expect(box.max).toBe(50);
    expect(box.median).toBe(30);
    expect(box.range).toBe(40);
  });

  it('should fail with meaningful error if sheets are missing', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['Kabupaten/Kota', 'TW1 2025']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const result = parseStuntingWorkbook(buf, baseDataset, 'test.xlsx');
    expect(result.success).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(result.errors?.[0]).toContain('Sheet wajib tidak ditemukan');
  });

  it('should successfully parse a valid multi-sheet workbook with 35 districts and periods', () => {
    const wb = XLSX.utils.book_new();
    const periods = ['TW1 2025', 'TW2 2025'];

    for (const ind of REQUIRED_INDICATOR_SHEETS) {
      const rows: (string | number)[][] = [['Kabupaten/Kota', ...periods]];
      for (const d of VALID_DISTRICT_NAMES) {
        rows.push([d, 15.5, 14.8]);
      }
      rows.push(['TARGET', 17, 17]); // target row should be ignored
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, ind.aliases[0]);
    }

    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const result = parseStuntingWorkbook(buf, baseDataset, 'custom-test.xlsx');

    expect(result.success).toBe(true);
    expect(result.dataset).toBeDefined();
    expect(result.dataset?.observations.length).toBe(35 * 2);
    expect(result.dataset?.metadata.period_count).toBe(2);
    expect(result.dataset?.metadata.periods).toEqual(periods);
    expect(result.dataset?.summary_cards.wilayah_count).toBe(35);
  });
});
