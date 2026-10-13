import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import { ExcelEngine } from './excel';

describe('ExcelEngine', () => {
  describe('extractSheetColumns', () => {
    it('should assign correct colLetter for columns', () => {
      const ws: XLSX.WorkSheet = {
        '!ref': 'A1:C2',
        A1: { v: 'No' },
        B1: { v: 'Kabupaten/Kota' },
        C1: { v: 'Jumlah' },
      };

      const cols = ExcelEngine.extractSheetColumns(ws, 1, 1);
      expect(cols).toHaveLength(3);
      expect(cols[0].colLetter).toBe('A');
      expect(cols[1].colLetter).toBe('B');
      expect(cols[2].colLetter).toBe('C');
      expect(cols[1].header).toBe('Kabupaten/Kota');
    });

    it('should prevent cross-category merged cell spillovers across parent boundaries', () => {
      // Simulates Dinkes sheet 'gizi':
      // Parent Category 1 at row 3 (r=2): cols AW..BD (c=48..55)
      // Parent Category 2 at row 3 (r=2): cols BE..CA (c=56..78) with "Vitamin A"
      // Erroneous merge in Excel at row 4 (r=3): AW4:BE4 (c=48..56) with "Persentase MPASI"
      // Row 5 (r=4): BE5 has "%"
      const ws: XLSX.WorkSheet = {
        '!ref': 'AW1:BF10',
        '!merges': [
          { s: { r: 2, c: 56 }, e: { r: 2, c: 78 } }, // BE3:CA3 "Vitamin A"
          { s: { r: 3, c: 48 }, e: { r: 3, c: 56 } }, // AW4:BE4 "Persentase MPASI" (spillover into BE)
        ],
        BE3: { v: 'Cakupan pemberian suplementasi vitamin A' },
        AW4: { v: 'Persentase Anak 6-23 bulan mendapat MPASI' },
        BE5: { v: '%' },
      };

      const cols = ExcelEngine.extractSheetColumns(ws, 3, 5);
      const colBE = cols.find((c) => c.colLetter === 'BE');

      expect(colBE).toBeDefined();
      expect(colBE?.colIndex).toBe(56);
      expect(colBE?.colLetter).toBe('BE');
      // Should NOT include "Persentase Anak 6-23 bulan mendapat MPASI" in column BE
      expect(colBE?.header).toBe('Cakupan pemberian suplementasi vitamin A - %');
      expect(colBE?.leafHeader).toBe('%');
    });

    it('should encode large column indices correctly (e.g. index 56 -> BE)', () => {
      const ws: XLSX.WorkSheet = {
        '!ref': 'A1:BF2',
        BE1: { v: 'Indikator Vitamin A' },
      };

      const cols = ExcelEngine.extractSheetColumns(ws, 1, 1);
      const colBE = cols.find((c) => c.colIndex === 56);
      expect(colBE).toBeDefined();
      expect(colBE?.colLetter).toBe('BE');
    });
  });

  describe('getCellValue', () => {
    it('should respect ancestorStartCol to reject out-of-bounds merge bleed', () => {
      const ws: XLSX.WorkSheet = {
        '!merges': [
          { s: { r: 3, c: 48 }, e: { r: 3, c: 56 } },
        ],
        AW4: { v: 'Bleed Content' },
        BE4: undefined,
      };

      // When ancestor starts at col 56, merge starting at 48 is rejected
      const val = ExcelEngine.getCellValue(ws, 3, 56, 56);
      expect(val).toBe('');

      // When no ancestor constraint is provided, standard merge lookup occurs
      const valUnconstrained = ExcelEngine.getCellValue(ws, 3, 56);
      expect(valUnconstrained).toBe('Bleed Content');
    });
  });
});
