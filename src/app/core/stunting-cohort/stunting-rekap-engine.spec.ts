import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import { StuntingRekapEngine, JATENG_SASARAN_MAP } from './stunting-rekap-engine';

describe('StuntingRekapEngine', () => {
  it('should normalize category strings correctly', () => {
    // BB/U
    expect(StuntingRekapEngine.normalizeBBU('Sangat Kurang')).toBe('Sangat Kurang');
    expect(StuntingRekapEngine.normalizeBBU('kurang')).toBe('Kurang');
    expect(StuntingRekapEngine.normalizeBBU('Berat Badan Normal')).toBe('Berat Badan Normal');
    expect(StuntingRekapEngine.normalizeBBU('risiko lebih')).toBe('Risiko Lebih');
    expect(StuntingRekapEngine.normalizeBBU('Outlier')).toBe('Outlier');

    // TB/U
    expect(StuntingRekapEngine.normalizeTBU('Sangat Pendek')).toBe('Sangat Pendek');
    expect(StuntingRekapEngine.normalizeTBU('pendek')).toBe('Pendek');
    expect(StuntingRekapEngine.normalizeTBU('Normal')).toBe('Normal');
    expect(StuntingRekapEngine.normalizeTBU('tinggi')).toBe('Tinggi');
    expect(StuntingRekapEngine.normalizeTBU('Outlier')).toBe('Outlier');

    // BB/TB
    expect(StuntingRekapEngine.normalizeBBTB('Gizi Buruk')).toBe('Gizi Buruk');
    expect(StuntingRekapEngine.normalizeBBTB('gizi kurang')).toBe('Gizi Kurang');
    expect(StuntingRekapEngine.normalizeBBTB('Normal')).toBe('Normal');
    expect(StuntingRekapEngine.normalizeBBTB('Risiko Gizi Lebih')).toBe('Risiko Gizi Lebih');
    expect(StuntingRekapEngine.normalizeBBTB('Gizi Lebih')).toBe('Gizi Lebih');
    expect(StuntingRekapEngine.normalizeBBTB('Obesitas')).toBe('Obesitas');
    expect(StuntingRekapEngine.normalizeBBTB('Outlier')).toBe('Outlier');
  });

  it('should resiliently find column keys', () => {
    const cols = ['No', 'Kabupaten/Kota', 'Status BB/U', 'Status TB/U', 'Status BB/TB', 'Target Sasaran'];
    expect(StuntingRekapEngine.findColumnKey(cols, ['kabupaten_kota', 'kabupaten'])).toBe('Kabupaten/Kota');
    expect(StuntingRekapEngine.findColumnKey(cols, ['status_bbu', 'bbu'])).toBe('Status BB/U');
    expect(StuntingRekapEngine.findColumnKey(cols, ['status_tbu', 'tbu'])).toBe('Status TB/U');
    expect(StuntingRekapEngine.findColumnKey(cols, ['status_bbtb', 'bbtb'])).toBe('Status BB/TB');
    expect(StuntingRekapEngine.findColumnKey(cols, ['sasaran', 'target'])).toBe('Target Sasaran');
  });

  it('should aggregate simple records by region and compute all indicators', () => {
    const rawData = [
      {
        kabupaten_kota: 'KABUPATEN BANYUMAS',
        status_bbu: 'Berat Badan Normal',
        status_tbu: 'Normal',
        status_bbtb: 'Normal',
      },
      {
        kabupaten_kota: 'KABUPATEN BANYUMAS',
        status_bbu: 'Kurang',
        status_tbu: 'Pendek',
        status_bbtb: 'Gizi Kurang',
      },
      {
        kabupaten_kota: 'KABUPATEN BANYUMAS',
        status_bbu: 'Sangat Kurang',
        status_tbu: 'Sangat Pendek',
        status_bbtb: 'Gizi Buruk',
      },
      {
        kabupaten_kota: 'KABUPATEN CILACAP',
        status_bbu: 'Risiko Lebih',
        status_tbu: 'Normal',
        status_bbtb: 'Gizi Lebih',
      },
    ];

    const result = StuntingRekapEngine.aggregate(rawData);

    expect(result.rows.length).toBe(2);

    const banyumas = result.rows.find((r) => r.wilayah === 'KABUPATEN BANYUMAS');
    expect(banyumas).toBeDefined();
    expect(banyumas!.jumlahDitimbangDiukur).toBe(3);
    expect(banyumas!.stuntingCount).toBe(2); // 1 Pendek + 1 Sangat Pendek
    expect(banyumas!.stuntingPercent).toBe(66.67); // 2/3 * 100
    expect(banyumas!.wastingCount).toBe(2); // 1 Gizi Kurang + 1 Gizi Buruk
    expect(banyumas!.underweightCount).toBe(2); // 1 Kurang + 1 Sangat Kurang
    expect(banyumas!.giziBurukCount).toBe(1);

    const cilacap = result.rows.find((r) => r.wilayah === 'KABUPATEN CILACAP');
    expect(cilacap).toBeDefined();
    expect(cilacap!.jumlahDitimbangDiukur).toBe(1);
    expect(cilacap!.overweightCount).toBe(1);

    // Provincial / Overall Totals
    expect(result.totals.jumlahDitimbangDiukur).toBe(4);
    expect(result.totals.stuntingCount).toBe(2);
    expect(result.totals.stuntingPercent).toBe(50);
    expect(result.totals.wastingCount).toBe(2);
    expect(result.totals.wastingPercent).toBe(50);
  });

  it('should fall back to raw measurement evaluation when status columns are missing', () => {
    const rawData = [
      {
        kabupaten_kota: 'KOTA SEMARANG',
        berat_badan_kg: 12.0,
        tinggi_badan_cm: 85.0,
        umur_bulan: 24,
        jenis_kelamin: 'L',
      },
      {
        kabupaten_kota: 'KOTA SEMARANG',
        berat_badan_kg: 6.5,
        tinggi_badan_cm: 65.0,
        umur_bulan: 24,
        jenis_kelamin: 'P',
      },
    ];

    const result = StuntingRekapEngine.aggregate(rawData);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].jumlahDitimbangDiukur).toBe(2);
    expect(result.totals.jumlahDitimbangDiukur).toBe(2);
  });

  it('should correctly process raw multi-region child records', () => {
    const records = Object.keys(JATENG_SASARAN_MAP).map((kab, idx) => ({
      kabupaten_kota: kab,
      status_bbu: idx % 3 === 0 ? 'Kurang' : 'Berat Badan Normal',
      status_tbu: idx % 4 === 0 ? 'Pendek' : 'Normal',
      status_bbtb: idx % 5 === 0 ? 'Gizi Kurang' : 'Normal',
    }));

    const result = StuntingRekapEngine.aggregate(records);

    // All 35 Kabupaten/Kota should be represented
    expect(result.rows.length).toBe(35);
    expect(result.totals.jumlahDitimbangDiukur).toBe(35);

    // Stunting, Wasting, Underweight cases should exist
    expect(result.summary.totalStunting).toBeGreaterThan(0);
    expect(result.summary.totalWasting).toBeGreaterThan(0);
    expect(result.summary.totalUnderweight).toBeGreaterThan(0);

    // Verify Jateng Sasaran Map is linked
    expect(result.summary.totalSasaran).toBe(1984484);
  });

  it('should generate a valid styled Excel workbook replicating REKAP STATUS GIZI format', () => {
    const rawData = [
      {
        kabupaten_kota: 'KABUPATEN CILACAP',
        status_bbu: 'Berat Badan Normal',
        status_tbu: 'Normal',
        status_bbtb: 'Normal',
      },
      {
        kabupaten_kota: 'KABUPATEN BANYUMAS',
        status_bbu: 'Kurang',
        status_tbu: 'Pendek',
        status_bbtb: 'Gizi Kurang',
      },
    ];

    const result = StuntingRekapEngine.aggregate(rawData, { cutoffDate: '2026-02-02 16:05:11' });
    const wb = StuntingRekapEngine.generateExcelWorkbook(result);

    expect(wb.SheetNames).toContain('Application List');
    const ws = wb.Sheets['Application List'];
    expect(ws).toBeDefined();

    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    expect(data[0][0]).toBe('Data Tanggal : 2026-02-02 16:05:11');
    expect(data[1][0]).toBe('No');
    expect(data[1][1]).toBe('Kabupaten/Kota');
    expect(data[1][2]).toBe('BB/U');
    expect(data[1][7]).toBe('TB/U');
    expect(data[1][12]).toBe('BB/TB');

    // Last row is JUMLAH
    const lastRow = data[data.length - 1];
    expect(lastRow[0]).toBe('JUMLAH');

    // Merges should be present
    expect(ws['!merges']).toBeDefined();
    expect(ws['!merges']!.length).toBeGreaterThan(5);
  });
});
