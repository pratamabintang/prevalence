import * as XLSX from 'xlsx';
import {
  StuntingDashboardDataset,
  StuntingObservation,
  PeriodSummaryStats,
  BoxPlotMetric,
} from './stunting-dashboard.types';

export interface ParseResult {
  success: boolean;
  dataset?: StuntingDashboardDataset;
  errors?: string[];
  filename?: string;
  observationsCount?: number;
  periodCount?: number;
}

export const REQUIRED_INDICATOR_SHEETS: { key: string; code: string; name: string; aliases: string[] }[] = [
  {
    key: 'x1_ttd_rematri',
    code: 'X1',
    name: 'TTD Remaja Putri',
    aliases: ['TTD REMATRI', 'ttd rematri', 'ttd rematri putri', 'rematri'],
  },
  {
    key: 'x2_ttd_ibu_hamil',
    code: 'X2',
    name: 'TTD Ibu Hamil',
    aliases: ['TTD IBU HAMIL', 'ttd ibu hamil', 'bumil ttd'],
  },
  {
    key: 'x3_pmt_bumil_kek',
    code: 'X3',
    name: 'PMT Bumil KEK',
    aliases: ['PMT bumil KEK mendapat PMT', 'pmt bumil kek', 'bumil kek'],
  },
  {
    key: 'x4_balita_ditimbang_ds',
    code: 'X4',
    name: 'Balita Ditimbang D/S',
    aliases: ['Balita ditimbang DS', 'balita ditimbang ds', 'balita ditimbang d/s', 'd/s'],
  },
  {
    key: 'x5_asi_eksklusif',
    code: 'X5',
    name: 'ASI Eksklusif',
    aliases: ['ASI eksklusif', 'asi eksklusif', 'asi'],
  },
  {
    key: 'x6_mpasi_beragam',
    code: 'X6',
    name: 'MP-ASI Beragam',
    aliases: ['MP-ASI Beragam', 'mp-asi beragam', 'mpasi beragam', 'mpasi'],
  },
  {
    key: 'x7_pmt_gizi_kurang',
    code: 'X7',
    name: 'PMT Balita Gizi Kurang',
    aliases: ['PMT gizi kurang', 'pmt gizi kurang', 'balita pmt gizi kurang'],
  },
  {
    key: 'x8_tatalaksana_gizi_buruk',
    code: 'X8',
    name: 'Tatalaksana Gizi Buruk',
    aliases: ['Tatalaksana gizi buruk', 'tatalaksana gizi buruk', 'gizi buruk'],
  },
  {
    key: 'x9_balita_idl',
    code: 'X9',
    name: 'Balita Imunisasi Lengkap',
    aliases: ['Balita IDL', 'balita idl', 'idl'],
  },
  {
    key: 'y_stunting',
    code: 'Y',
    name: 'Prevalensi Stunting',
    aliases: ['Stunting', 'stunting', 'prevalensi stunting'],
  },
];

export const VALID_DISTRICT_NAMES: string[] = [
  'KABUPATEN BANJARNEGARA',
  'KABUPATEN BANYUMAS',
  'KABUPATEN BATANG',
  'KABUPATEN BLORA',
  'KABUPATEN BOYOLALI',
  'KABUPATEN BREBES',
  'KABUPATEN CILACAP',
  'KABUPATEN DEMAK',
  'KABUPATEN GROBOGAN',
  'KABUPATEN JEPARA',
  'KABUPATEN KARANGANYAR',
  'KABUPATEN KEBUMEN',
  'KABUPATEN KENDAL',
  'KABUPATEN KLATEN',
  'KABUPATEN KUDUS',
  'KABUPATEN MAGELANG',
  'KABUPATEN PATI',
  'KABUPATEN PEKALONGAN',
  'KABUPATEN PEMALANG',
  'KABUPATEN PURBALINGGA',
  'KABUPATEN PURWOREJO',
  'KABUPATEN REMBANG',
  'KABUPATEN SEMARANG',
  'KABUPATEN SRAGEN',
  'KABUPATEN SUKOHARJO',
  'KABUPATEN TEGAL',
  'KABUPATEN TEMANGGUNG',
  'KABUPATEN WONOGIRI',
  'KABUPATEN WONOSOBO',
  'KOTA MAGELANG',
  'KOTA PEKALONGAN',
  'KOTA SALATIGA',
  'KOTA SEMARANG',
  'KOTA SURAKARTA',
  'KOTA TEGAL',
];

export function normalizeAreaName(x: unknown): string {
  let s = String(x ?? '').trim().toUpperCase();
  s = s.replace(/^\s*\d+(?:[.\-_/]\d+)*(?:\s*[-–—.:)]\s*|\s+)/, '').trim();
  s = s.replace(/^KAB\.\s*/, 'KABUPATEN ');
  s = s.replace(/^KAB\s+/, 'KABUPATEN ');
  if (!s.startsWith('KABUPATEN ') && !s.startsWith('KOTA ')) {
    s = 'KABUPATEN ' + s;
  }
  return s;
}

function computeQuantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function computeBoxPlot(rawVals: number[]): BoxPlotMetric {
  const vals = rawVals.filter((v) => !isNaN(v) && isFinite(v)).sort((a, b) => a - b);
  if (vals.length === 0) {
    return {
      min: 0,
      q1: 0,
      median: 0,
      q3: 0,
      max: 0,
      mean: 0,
      std: 0,
      range: 0,
      iqr: 0,
    };
  }

  const min = Number(vals[0].toFixed(2));
  const max = Number(vals[vals.length - 1].toFixed(2));
  const q1 = Number(computeQuantile(vals, 0.25).toFixed(2));
  const median = Number(computeQuantile(vals, 0.5).toFixed(2));
  const q3 = Number(computeQuantile(vals, 0.75).toFixed(2));
  const range = Number((max - min).toFixed(2));
  const iqr = Number((q3 - q1).toFixed(2));

  const sum = vals.reduce((acc, v) => acc + v, 0);
  const mean = Number((sum / vals.length).toFixed(2));
  const variance = vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (vals.length - 1 || 1);
  const std = Number(Math.sqrt(variance).toFixed(2));

  return { min, q1, median, q3, max, mean, std, range, iqr };
}

function findSheet(wb: XLSX.WorkBook, aliases: string[]): string | null {
  const sheetNames = wb.SheetNames;
  for (const alias of aliases) {
    const target = alias.trim().toLowerCase();
    const found = sheetNames.find((s) => s.trim().toLowerCase() === target);
    if (found) return found;
  }
  return null;
}

export function sortPeriodsChronologically(periods: string[]): string[] {
  function getScore(p: string): number {
    const s = String(p).toUpperCase();
    const yearMatch = s.match(/\b(20\d\d)\b/);
    const twMatch = s.match(/(?:TW|Q|TRIWULAN)\s*([1-4])/i);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 9999;
    const tw = twMatch ? parseInt(twMatch[1], 10) : 0;
    return year * 10 + tw;
  }
  return periods.slice().sort((a, b) => {
    const scoreA = getScore(a);
    const scoreB = getScore(b);
    if (scoreA !== scoreB) return scoreA - scoreB;
    return a.localeCompare(b);
  });
}

export function parseStuntingWorkbook(
  buffer: ArrayBuffer | Uint8Array,
  baseDataset: StuntingDashboardDataset,
  filename = 'data-triwulan.xlsx'
): ParseResult {
  const errors: string[] = [];

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array' });
  } catch (err) {
    return {
      success: false,
      errors: [`Gagal membaca berkas Excel: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  // 1. Validate Sheet Existence
  const sheetMap = new Map<string, string>(); // varKey -> sheetName
  for (const ind of REQUIRED_INDICATOR_SHEETS) {
    const matchedSheet = findSheet(wb, ind.aliases);
    if (!matchedSheet) {
      errors.push(
        `Sheet wajib tidak ditemukan untuk indikator [${ind.code} — ${ind.name}]. Diperlukan nama sheet seperti "${ind.aliases[0]}".`
      );
    } else {
      sheetMap.set(ind.key, matchedSheet);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // 2. Detect and Validate Periods across sheets (Supports ANY arbitrary range of quarters)
  const stuntingSheetName = sheetMap.get('y_stunting')!;
  const stuntingWs = wb.Sheets[stuntingSheetName];
  const stuntingRows: unknown[][] = XLSX.utils.sheet_to_json(stuntingWs, { header: 1 });

  if (stuntingRows.length < 2) {
    return {
      success: false,
      errors: [`Sheet "${stuntingSheetName}" kosong atau tidak memiliki baris data.`],
    };
  }

  const stuntingHeader = (stuntingRows[0] as unknown[]).map((c) => String(c ?? '').trim());
  const IGNORED_COL_PATTERNS = [
    /TARGET/i,
    /TOTAL/i,
    /JUMLAH/i,
    /SASARAN/i,
    /^NO$/i,
    /^ID$/i,
    /KAB/i,
    /KOTA/i,
    /WILAYAH/i,
    /DAERAH/i,
  ];

  const candidatePeriods = stuntingHeader.filter((colName, idx) => {
    if (idx === 0 || !colName) return false;
    return !IGNORED_COL_PATTERNS.some((pat) => pat.test(colName));
  });

  if (candidatePeriods.length === 0) {
    return {
      success: false,
      errors: [
        `Tidak ada kolom periode triwulan yang terdeteksi pada baris header sheet "${stuntingSheetName}". Kolom harus memuat nama periode triwulan (contoh: "TW1 2024", "TW2 2024", "TW1 2025", dst.).`,
      ],
    };
  }

  // Check which candidate periods exist across ALL 10 sheets
  const commonPeriods: string[] = [];
  const missingBySheet = new Map<string, string[]>();

  for (const period of candidatePeriods) {
    let presentInAll = true;
    for (const ind of REQUIRED_INDICATOR_SHEETS) {
      const sName = sheetMap.get(ind.key)!;
      const ws = wb.Sheets[sName];
      const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const header = (rows[0] as unknown[]).map((c) => String(c ?? '').trim());
      if (!header.includes(period)) {
        presentInAll = false;
        if (!missingBySheet.has(sName)) missingBySheet.set(sName, []);
        missingBySheet.get(sName)!.push(period);
      }
    }
    if (presentInAll) {
      commonPeriods.push(period);
    }
  }

  if (commonPeriods.length === 0) {
    const errorDetails: string[] = [
      `Tidak ditemukan kolom periode triwulan yang seragam di seluruh 10 sheet.`,
      `Periode yang terdeteksi di sheet "${stuntingSheetName}": ${candidatePeriods.join(', ')}.`,
    ];
    missingBySheet.forEach((missing, sName) => {
      errorDetails.push(`Sheet "${sName}" tidak memiliki kolom: ${missing.join(', ')}.`);
    });
    return { success: false, errors: errorDetails };
  }

  // Sort periods in true chronological order
  const detectedPeriods = sortPeriodsChronologically(commonPeriods);

  // 3. Extract and Validate All 10 Sheets
  // Map: district -> period -> varKey -> number
  const dataMatrix = new Map<string, Map<string, Map<string, number>>>();
  const validDistrictsSet = new Set(VALID_DISTRICT_NAMES);

  for (const ind of REQUIRED_INDICATOR_SHEETS) {
    const sName = sheetMap.get(ind.key)!;
    const ws = wb.Sheets[sName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const header = (rows[0] as unknown[]).map((c) => String(c ?? '').trim());

    // Verify all detected periods exist
    for (const period of detectedPeriods) {
      const colIdx = header.indexOf(period);
      if (colIdx === -1) {
        errors.push(
          `Sheet "${sName}" (${ind.name}) tidak memiliki kolom periode "${period}". Seluruh 10 sheet harus memiliki kolom periode yang seragam.`
        );
      }
    }

    if (errors.length > 0) continue;

    // Parse district rows
    const seenDistrictsInSheet = new Set<string>();

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const rawName = row[0];
      if (!rawName) continue;
      const strName = String(rawName).trim().toUpperCase();
      if (strName === 'TARGET' || strName === 'TOTAL' || strName === 'JUMLAH' || strName.includes('PROVINSI')) {
        continue;
      }

      const district = normalizeAreaName(rawName);
      if (!validDistrictsSet.has(district)) {
        // Warning or error if unexpected district
        continue;
      }

      seenDistrictsInSheet.add(district);

      if (!dataMatrix.has(district)) {
        dataMatrix.set(district, new Map());
      }
      const distMap = dataMatrix.get(district)!;

      for (const period of detectedPeriods) {
        if (!distMap.has(period)) {
          distMap.set(period, new Map());
        }
        const perMap = distMap.get(period)!;

        const colIdx = header.indexOf(period);
        const cellVal = row[colIdx];
        const numVal = typeof cellVal === 'number' ? cellVal : parseFloat(String(cellVal ?? '').replace(',', '.'));

        if (isNaN(numVal) || !isFinite(numVal)) {
          errors.push(
            `Nilai tidak valid pada sheet "${sName}", baris "${rawName}", kolom "${period}": "${cellVal}". Seluruh nilai harus angka numerik.`
          );
        } else {
          perMap.set(ind.key, Number(numVal.toFixed(2)));
        }
      }
    }

    // Check that all 35 districts are present
    const missingDistricts = VALID_DISTRICT_NAMES.filter((d) => !seenDistrictsInSheet.has(d));
    if (missingDistricts.length > 0) {
      errors.push(
        `Sheet "${sName}" (${ind.name}) kekurangan ${missingDistricts.length} wilayah: ${missingDistricts.slice(0, 3).join(', ')}${missingDistricts.length > 3 ? '...' : ''}. Harus memuat ke-35 kabupaten/kota.`
      );
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // 4. Build Observations and Compute Statistics
  const coordsMap = new Map(baseDataset.coordinates.map((c) => [c.kabupaten_kota, { lon: c.lon, lat: c.lat }]));

  const newObservations: StuntingObservation[] = [];

  for (const district of VALID_DISTRICT_NAMES) {
    const distMap = dataMatrix.get(district);
    if (!distMap) continue;

    const coords = coordsMap.get(district) ?? { lon: 110.0, lat: -7.0 };

    for (const period of detectedPeriods) {
      const perMap = distMap.get(period);
      if (!perMap) continue;

      const obs: StuntingObservation = {
        kabupaten_kota: district,
        triwulan: period,
        y_stunting: perMap.get('y_stunting') ?? 0,
        latitude: coords.lat,
        longitude: coords.lon,
        x1_ttd_rematri: perMap.get('x1_ttd_rematri') ?? 0,
        x2_ttd_ibu_hamil: perMap.get('x2_ttd_ibu_hamil') ?? 0,
        x3_pmt_bumil_kek: perMap.get('x3_pmt_bumil_kek') ?? 0,
        x4_balita_ditimbang_ds: perMap.get('x4_balita_ditimbang_ds') ?? 0,
        x5_asi_eksklusif: perMap.get('x5_asi_eksklusif') ?? 0,
        x6_mpasi_beragam: perMap.get('x6_mpasi_beragam') ?? 0,
        x7_pmt_gizi_kurang: perMap.get('x7_pmt_gizi_kurang') ?? 0,
        x8_tatalaksana_gizi_buruk: perMap.get('x8_tatalaksana_gizi_buruk') ?? 0,
        x9_balita_idl: perMap.get('x9_balita_idl') ?? 0,
      };

      newObservations.push(obs);
    }
  }

  // 5. Compute Period Stats
  const newPeriodStats: Record<string, PeriodSummaryStats> = {};

  for (const period of detectedPeriods) {
    const periodObs = newObservations.filter((o) => o.triwulan === period);
    const yVals = periodObs.map((o) => o.y_stunting);
    const yBox = computeBoxPlot(yVals);

    const indStats: Record<string, { mean: number; median: number; min: number; max: number; std: number }> = {};
    for (const ind of REQUIRED_INDICATOR_SHEETS) {
      if (ind.key === 'y_stunting') continue;
      const vals = periodObs.map((o) => Number(o[ind.key] ?? 0));
      const box = computeBoxPlot(vals);
      indStats[ind.key] = {
        mean: box.mean,
        median: box.median,
        min: box.min,
        max: box.max,
        std: box.std,
      };
    }

    newPeriodStats[period] = {
      triwulan: period,
      y_stunting: yBox,
      indicators: indStats,
    };
  }

  // 6. Compute Summary Cards
  const firstPeriod = detectedPeriods[0];
  const latestPeriod = detectedPeriods[detectedPeriods.length - 1];
  const medFirst = newPeriodStats[firstPeriod]?.y_stunting.median ?? 0;
  const medLatest = newPeriodStats[latestPeriod]?.y_stunting.median ?? 0;
  const medChange = Number((medLatest - medFirst).toFixed(2));

  const updatedDataset: StuntingDashboardDataset = {
    ...baseDataset,
    metadata: {
      ...baseDataset.metadata,
      periods: detectedPeriods,
      wilayah_count: VALID_DISTRICT_NAMES.length,
      period_count: detectedPeriods.length,
      observation_count: newObservations.length,
      source: `Berkas Pengguna: ${filename} (Divalidasi ${newObservations.length} observasi)`,
    },
    summary_cards: {
      wilayah_count: VALID_DISTRICT_NAMES.length,
      period_count: detectedPeriods.length,
      median_first: medFirst,
      median_latest: medLatest,
      median_change: medChange,
    },
    period_stats: newPeriodStats,
    observations: newObservations,
  };

  return {
    success: true,
    dataset: updatedDataset,
    filename,
    observationsCount: newObservations.length,
    periodCount: detectedPeriods.length,
  };
}

export const PYTHON_TEMPLATE_SCRIPT = `# =====================================================================
# Skrip Validasi & Template Otomatis Excel Stunting Jawa Tengah
# Mendukung rentang triwulan dinamis (tidak terbatas pada 2025-2026)
# =====================================================================
import pandas as pd
import numpy as np

REQUIRED_SHEETS = [
    'TTD REMATRI', 'TTD IBU HAMIL', 'PMT bumil KEK mendapat PMT',
    'Balita ditimbang DS', 'ASI eksklusif', 'MP-ASI Beragam',
    'PMT gizi kurang', 'Tatalaksana gizi buruk', 'Balita IDL', 'Stunting'
]

DISTRICTS = [
    'Kab. Cilacap', 'Kab. Banyumas', 'Kab. Purbalingga', 'Kab. Banjarnegara',
    'Kab. Kebumen', 'Kab. Purworejo', 'Kab. Wonosobo', 'Kab. Magelang',
    'Kab. Boyolali', 'Kab. Klaten', 'Kab. Sukoharjo', 'Kab. Wonogiri',
    'Kab. Karanganyar', 'Kab. Sragen', 'Kab. Grobogan', 'Kab. Blora',
    'Kab. Rembang', 'Kab. Pati', 'Kab. Kudus', 'Kab. Jepara',
    'Kab. Demak', 'Kab. Semarang', 'Kab. Temanggung', 'Kab. Kendal',
    'Kab. Batang', 'Kab. Pekalongan', 'Kab. Pemalang', 'Kab. Tegal',
    'Kab. Brebes', 'Kota Magelang', 'Kota Surakarta', 'Kota Salatiga',
    'Kota Semarang', 'Kota Pekalongan', 'Kota Tegal'
]

def validate_excel(file_path):
    print(f"Memeriksa berkas: {file_path}")
    excel = pd.ExcelFile(file_path)
    
    # 1. Cek Sheet Wajib
    missing_sheets = [s for s in REQUIRED_SHEETS if s not in excel.sheet_names]
    if missing_sheets:
        raise ValueError(f"Sheet hilang: {missing_sheets}")
    print("✓ 10 Sheet wajib lengkap.")
    
    # 2. Deteksi Periode Dinamis dari sheet Stunting
    stunting_df = pd.read_excel(excel, sheet_name='Stunting')
    ignored = ['KABUPATEN/KOTA', 'TARGET', 'TOTAL', 'JUMLAH', 'SASARAN', 'NO']
    periods = [c for c in stunting_df.columns if str(c).upper() not in ignored]
    print(f"✓ Terdeteksi {len(periods)} periode triwulan: {periods}")
    
    # 3. Verifikasi Keseragaman Kolom di 9 Sheet Lainnya
    for sheet in REQUIRED_SHEETS:
        df = pd.read_excel(excel, sheet_name=sheet)
        for p in periods:
            if p not in df.columns:
                raise ValueError(f"Kolom periode '{p}' tidak ditemukan pada sheet '{sheet}'")
        print(f"✓ Sheet '{sheet}' valid ({len(df)} baris).")
    
    print(f"\\nBerkas valid! Total observasi yang akan dimuat: {len(DISTRICTS) * len(periods)} (35 wilayah × {len(periods)} periode).")

if __name__ == '__main__':
    validate_excel('data-triwulan.xlsx')
`;
