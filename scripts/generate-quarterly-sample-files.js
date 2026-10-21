/**
 * Generate 4 Realistic Quarterly Variation Excel files from Hasil_Join_Excel_2026-10-15.xlsx
 * Output:
 *  - public/Hasil_Join_TW1.xlsx
 *  - public/Hasil_Join_TW2.xlsx
 *  - public/Hasil_Join_TW3.xlsx
 *  - public/Hasil_Join_TW4.xlsx
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx-js-style');

const sourceFile = path.resolve(__dirname, '../public/Hasil_Join_Excel_2026-10-15.xlsx');
if (!fs.existsSync(sourceFile)) {
  console.error('Source file not found:', sourceFile);
  process.exit(1);
}

const baseWb = XLSX.readFile(sourceFile, { cellStyles: true });
const baseWs = baseWb.Sheets['Hasil Join'];
const baseData = XLSX.utils.sheet_to_json(baseWs, { header: 1 });

const headers = baseData[0];
// Data rows: index 1 to 35 (35 regions)
const regionRows = baseData.slice(1, 36);
// Summary rows
const rawJumlahRow = baseData[36];
const rawRataRataRow = baseData[37];
const rawTargetRow = baseData[38];

// Target definition per column index
// index 3: % Konsumsi TTD >= 67
// index 5: % Skrining Anemia >= 77
// index 7: % ANC 6x >= 60
// index 9: % TTD/MMS >= 39
// index 11: % Bumil PMT >= 85
// index 13: % D/S >= 90
// index 15: % Tumbang >= 55
// index 17: % ASI >= 76
// index 19: % MPASI >= 76
// index 21: % Gizi Kurang dapat MT >= 70
// index 23: % BB Kurang dapat MT >= 70
// index 25: % BB Tidak Naik (T) dapat MT >= 70
// index 27: % Talak Gibur >= 92
// index 29: % IDL >= 56.25
const indicatorIndices = [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29];
const targets = {
  3: 67,
  5: 77,
  7: 60,
  9: 39,
  11: 85,
  13: 90,
  15: 55,
  17: 76,
  19: 76,
  21: 70,
  23: 70,
  25: 70,
  27: 92,
  29: 56.25,
};

// Seeded pseudorandom generator for deterministic, realistic variations
function createSeededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Styling definitions matching professional Excel theme
const headerStyle = {
  font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '1E293B' } },
  fill: { fgColor: { rgb: 'F1F5F9' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'medium', color: { rgb: '94A3B8' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } },
  },
};

const regionNameStyle = {
  font: { name: 'Calibri', sz: 10, bold: false, color: { rgb: '0F172A' } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: {
    top: { style: 'thin', color: { rgb: 'E2E8F0' } },
    bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
    left: { style: 'thin', color: { rgb: 'E2E8F0' } },
    right: { style: 'thin', color: { rgb: 'E2E8F0' } },
  },
};

const numberStyle = {
  font: { name: 'Calibri', sz: 10, color: { rgb: '0F172A' } },
  alignment: { horizontal: 'right', vertical: 'center' },
  border: {
    top: { style: 'thin', color: { rgb: 'E2E8F0' } },
    bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
    left: { style: 'thin', color: { rgb: 'E2E8F0' } },
    right: { style: 'thin', color: { rgb: 'E2E8F0' } },
  },
};

const jumlahStyle = {
  font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '065F46' } },
  fill: { fgColor: { rgb: 'ECFDF5' } },
  alignment: { horizontal: 'right', vertical: 'center' },
  border: {
    top: { style: 'thin', color: { rgb: 'A7F3D0' } },
    bottom: { style: 'thin', color: { rgb: 'A7F3D0' } },
    left: { style: 'thin', color: { rgb: 'A7F3D0' } },
    right: { style: 'thin', color: { rgb: 'A7F3D0' } },
  },
};

const rataRataStyle = {
  font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0369A1' } },
  fill: { fgColor: { rgb: 'F0F9FF' } },
  alignment: { horizontal: 'right', vertical: 'center' },
  border: {
    top: { style: 'thin', color: { rgb: 'BAE6FD' } },
    bottom: { style: 'thin', color: { rgb: 'BAE6FD' } },
    left: { style: 'thin', color: { rgb: 'BAE6FD' } },
    right: { style: 'thin', color: { rgb: 'BAE6FD' } },
  },
};

const targetStyle = {
  font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '3730A3' } },
  fill: { fgColor: { rgb: 'EEF2FF' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: {
    top: { style: 'thin', color: { rgb: 'C7D2FE' } },
    bottom: { style: 'medium', color: { rgb: '818CF8' } },
    left: { style: 'thin', color: { rgb: 'C7D2FE' } },
    right: { style: 'thin', color: { rgb: 'C7D2FE' } },
  },
};

// Multipliers and shift curves across Quarters
const quarterConfig = {
  1: {
    label: 'Triwulan 1',
    code: 'TW1',
    countFactor: 0.28, // ~28% cumulative annual cases
    // Shift factors for percentage indicators: TW1 is early-stage baseline
    pctFactor: 0.65,
    variationSeed: 101,
  },
  2: {
    label: 'Triwulan 2',
    code: 'TW2',
    countFactor: 0.55, // ~55% cumulative annual cases
    pctFactor: 0.85,
    variationSeed: 202,
  },
  3: {
    label: 'Triwulan 3',
    code: 'TW3',
    countFactor: 0.82, // ~82% cumulative annual cases (close to original base data)
    pctFactor: 1.0,
    variationSeed: 303,
  },
  4: {
    label: 'Triwulan 4',
    code: 'TW4',
    countFactor: 1.05, // ~105% full year cumulative cases
    pctFactor: 1.15,
    variationSeed: 404,
  },
};

const outputFiles = [];

for (const q of [1, 2, 3, 4]) {
  const cfg = quarterConfig[q];
  const rng = createSeededRandom(cfg.variationSeed);

  const sheetData = [];
  // Row 0: Headers
  sheetData.push(headers);

  // Rows 1..35: Regions
  for (let rIdx = 0; rIdx < regionRows.length; rIdx++) {
    const origRow = regionRows[rIdx];
    const newRow = new Array(headers.length);

    newRow[0] = origRow[0]; // No
    newRow[1] = origRow[1]; // Kabupaten/Kota

    let targetsAchieved = 0;

    for (let cIdx = 2; cIdx < headers.length - 1; cIdx++) {
      const origVal = origRow[cIdx];
      const isPercentage = indicatorIndices.includes(cIdx);

      if (isPercentage) {
        // Percentage indicator
        let basePct = typeof origVal === 'number' ? origVal : parseFloat(origVal) || 50;
        
        // Apply quarter progress factor + slight regional variance (-3% to +3%)
        let regionalJitter = (rng() - 0.48) * 6.0;
        let val;

        if (q === 3) {
          // Keep TW3 very close to the genuine base data with minimal natural variance
          val = Math.max(0.1, Math.min(100, +(basePct + (rng() - 0.5) * 1.5).toFixed(2)));
        } else if (q === 1) {
          // TW1: typically lower coverage (programs starting)
          // Scale from 55% to 80% of TW3 level
          val = +(basePct * (0.60 + rng() * 0.20) + regionalJitter).toFixed(2);
        } else if (q === 2) {
          // TW2: solid mid-year progression
          val = +(basePct * (0.80 + rng() * 0.15) + regionalJitter).toFixed(2);
        } else {
          // TW4: end of year peak
          val = +(basePct * (1.05 + rng() * 0.12) + regionalJitter).toFixed(2);
        }

        // Clamp between 0.1% and 99.8%
        val = Math.max(0.1, Math.min(99.8, val));
        newRow[cIdx] = val;

        // Check against target
        const tgt = targets[cIdx];
        if (tgt !== undefined && val >= tgt) {
          targetsAchieved++;
        }
      } else {
        // Raw count / SUM column
        let baseCount = typeof origVal === 'number' ? origVal : parseInt(origVal, 10) || 100;
        let countVariance = (rng() - 0.5) * 0.1; // +/- 5%
        let factor = cfg.countFactor + countVariance;
        let newCount = Math.max(1, Math.round(baseCount * factor));
        newRow[cIdx] = newCount;
      }
    }

    // Last column: Capaian (Jumlah indikator tercapai)
    newRow[headers.length - 1] = targetsAchieved;
    sheetData.push(newRow);
  }

  // Row 36: Jumlah (SUM for count columns, '-' for percentage columns)
  const jumlahRow = new Array(headers.length).fill('-');
  jumlahRow[0] = '-';
  jumlahRow[1] = 'Jumlah';

  for (let cIdx = 2; cIdx < headers.length - 1; cIdx++) {
    if (!indicatorIndices.includes(cIdx)) {
      // Sum the column
      let colSum = 0;
      for (let r = 1; r <= 35; r++) {
        const v = sheetData[r][cIdx];
        if (typeof v === 'number') colSum += v;
      }
      jumlahRow[cIdx] = colSum;
    }
  }
  jumlahRow[headers.length - 1] = '-';
  sheetData.push(jumlahRow);

  // Row 37: Rata-rata (MEAN for percentage columns, '-' for count columns)
  const rataRataRow = new Array(headers.length).fill('-');
  rataRataRow[0] = '-';
  rataRataRow[1] = 'Rata-rata';

  for (let cIdx = 2; cIdx < headers.length - 1; cIdx++) {
    if (indicatorIndices.includes(cIdx)) {
      let sum = 0;
      let count = 0;
      for (let r = 1; r <= 35; r++) {
        const v = sheetData[r][cIdx];
        if (typeof v === 'number') {
          sum += v;
          count++;
        }
      }
      rataRataRow[cIdx] = count > 0 ? +(sum / count).toFixed(2) : '-';
    }
  }
  rataRataRow[headers.length - 1] = '-';
  sheetData.push(rataRataRow);

  // Row 38: Target (Same across all 4 quarters)
  const targetRow = [...rawTargetRow];
  sheetData.push(targetRow);

  // Build styled worksheet
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Apply column widths
  ws['!cols'] = baseWs['!cols'] || headers.map((_, i) => ({ wch: i === 1 ? 24 : 18 }));

  // Apply cell styling across all cells
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellAddress];
      if (!cell) continue;

      if (R === 0) {
        cell.s = headerStyle;
      } else if (R >= 1 && R <= 35) {
        if (C === 0) {
          cell.s = { ...numberStyle, alignment: { horizontal: 'center', vertical: 'center' } };
        } else if (C === 1) {
          cell.s = regionNameStyle;
        } else if (C === range.e.c) {
          // Capaian column
          cell.s = {
            ...numberStyle,
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '1E293B' } },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        } else {
          cell.s = numberStyle;
          if (typeof cell.v === 'number') {
            cell.z = indicatorIndices.includes(C) ? '0.00' : '#,##0';
          }
        }
      } else if (R === 36) {
        // Jumlah row
        cell.s = jumlahStyle;
        if (typeof cell.v === 'number') cell.z = '#,##0';
        if (C === 1) cell.s = { ...jumlahStyle, alignment: { horizontal: 'left', vertical: 'center' } };
      } else if (R === 37) {
        // Rata-rata row
        cell.s = rataRataRowStyle = {
          ...rataRataStyle,
          alignment: C === 1 ? { horizontal: 'left', vertical: 'center' } : { horizontal: 'right', vertical: 'center' },
        };
        if (typeof cell.v === 'number') cell.z = '0.00';
      } else if (R === 38) {
        // Target row
        cell.s = targetStyle;
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hasil Join');

  const outFileName = `Hasil_Join_TW${q}.xlsx`;
  const outPath = path.resolve(__dirname, `../public/${outFileName}`);
  XLSX.writeFile(wb, outPath, { cellStyles: true });

  const fileSize = fs.statSync(outPath).size;
  console.log(`Generated: ${outFileName} (${(fileSize / 1024).toFixed(1)} KB)`);
  outputFiles.push({ quarter: q, fileName: outFileName, path: outPath, size: fileSize });
}

console.log('Successfully generated all 4 quarterly files in public/ directory.');
