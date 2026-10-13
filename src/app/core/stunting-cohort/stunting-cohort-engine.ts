import * as XLSX from 'xlsx-js-style';

export enum CohortTransitionStatus {
  PERSISTENT = 'PERSISTENT', // Tetap Stunting (Ada di P1 dan P2)
  RECOVERED = 'RECOVERED',   // Bebas Stunting (Ada di P1, tidak di P2, usia < 60 bln)
  NEW_CASE = 'NEW_CASE',     // Kasus Baru (Tidak ada di P1, baru muncul di P2)
  AGED_OUT = 'AGED_OUT',     // Lulus Usia Balita (Ada di P1, tidak di P2, usia >= 60 bln)
}

export interface CohortColumnMapping {
  nikKey?: string;
  nameKey?: string;
  dobKey?: string;
  puskesmasKey?: string;
  desaKey?: string;
  genderKey?: string;
}

export interface CohortConfig {
  p1Mapping: CohortColumnMapping;
  p2Mapping: CohortColumnMapping;
  evaluationDate: string;
  p1Label?: string;
  p2Label?: string;
}

export interface CohortEvaluatedChild {
  nik: string;
  nama: string;
  tanggalLahir?: string;
  ageMonths: number | null;
  status: CohortTransitionStatus;
  statusLabel: string;
  inPeriod1: boolean;
  inPeriod2: boolean;
  puskesmas?: string;
  desa?: string;
  gender?: string;
  p1Details?: Record<string, unknown>;
  p2Details?: Record<string, unknown>;
}

export interface CohortSummary {
  totalPeriod1: number;
  totalPeriod2: number;
  persistentCount: number;
  persistentPercent: number;
  recoveredCount: number;
  recoveredPercent: number;
  newCaseCount: number;
  newCasePercent: number;
  agedOutCount: number;
  agedOutPercent: number;
  netChange: number;
  duplicateNikPeriod1Count: number;
  duplicateNikPeriod2Count: number;
}

export interface CohortComparisonResult {
  summary: CohortSummary;
  children: CohortEvaluatedChild[];
  evaluationDate: string;
  p1Label: string;
  p2Label: string;
}

export class StuntingCohortEngine {
  /**
   * Status labels map adhering strictly to Dinkes GLOSSARY.md
   */
  public static readonly STATUS_LABELS: Record<CohortTransitionStatus, string> = {
    [CohortTransitionStatus.PERSISTENT]: 'Tetap Stunting',
    [CohortTransitionStatus.RECOVERED]: 'Bebas Stunting',
    [CohortTransitionStatus.NEW_CASE]: 'Kasus Baru Stunting',
    [CohortTransitionStatus.AGED_OUT]: 'Lulus Usia Balita',
  };

  /**
   * Sanitizes NIK: handles strings, numbers, whitespace, and scientific notation
   */
  public static sanitizeNik(raw: unknown): string {
    if (raw === null || raw === undefined) {
      return '';
    }

    if (typeof raw === 'number') {
      if (isNaN(raw)) return '';
      return BigInt(Math.round(raw)).toString();
    }

    const str = String(raw).trim();
    if (!str) return '';

    // Handle scientific notation e.g. "3.30101120422e+15"
    if (/[eE]/.test(str)) {
      const num = Number(str);
      if (!isNaN(num)) {
        return BigInt(Math.round(num)).toString();
      }
    }

    // Strip formatting dots or hyphens if present, keep only alphanumeric
    return str.replace(/[\s\t\r\n]/g, '');
  }

  /**
   * Validates whether NIK conforms to standard 16-digit numeric pattern
   */
  public static isValid16Digits(nik: string): boolean {
    return /^\d{16}$/.test(nik);
  }

  /**
   * Calculates pediatric age in full elapsed months between birth date and evaluation date
   * adhering to spec: floor((evalDate - birthDate) / (365.25 / 12))
   */
  public static calculateAgeInMonths(
    birthDateStr: string | undefined,
    evalDateStr: string
  ): number | null {
    if (!birthDateStr || !evalDateStr) return null;

    const birthDate = new Date(birthDateStr);
    const evalDate = new Date(evalDateStr);

    if (isNaN(birthDate.getTime()) || isNaN(evalDate.getTime())) {
      return null;
    }

    let months =
      (evalDate.getFullYear() - birthDate.getFullYear()) * 12 +
      (evalDate.getMonth() - birthDate.getMonth());

    if (evalDate.getDate() < birthDate.getDate()) {
      months--;
    }

    return months >= 0 ? months : 0;
  }

  /**
   * Automatically detects standard Indonesian health/Dinkes column headers
   */
  public static detectColumnKeys(columns: string[]): CohortColumnMapping {
    const mapping: CohortColumnMapping = {};

    const findMatch = (patterns: RegExp[]): string | undefined => {
      for (const pattern of patterns) {
        const found = columns.find((col) => pattern.test(col.trim()));
        if (found) return found;
      }
      return undefined;
    };

    mapping.nikKey = findMatch([
      /^nik$/i,
      /^nik_anak$/i,
      /^nik_balita$/i,
      /nomor.*induk/i,
      /no.*ktp/i,
      /id.*anak/i,
      /nik/i,
    ]);

    mapping.nameKey = findMatch([
      /^nama$/i,
      /^nama_balita$/i,
      /^nama_anak$/i,
      /^nama_lengkap$/i,
      /nama.*balita/i,
      /nama.*anak/i,
      /nama/i,
    ]);

    mapping.dobKey = findMatch([
      /^tanggal_lahir$/i,
      /^tgl_lahir$/i,
      /tanggal.*lahir/i,
      /tgl.*lahir/i,
      /tgl_lhr/i,
      /dob/i,
      /birth/i,
    ]);

    mapping.puskesmasKey = findMatch([
      /^puskesmas$/i,
      /^pkm$/i,
      /nama.*puskesmas/i,
      /puskesmas/i,
      /faskes/i,
    ]);

    mapping.desaKey = findMatch([
      /^desa$/i,
      /^kelurahan$/i,
      /desa.*kelurahan/i,
      /kelurahan/i,
      /desa/i,
    ]);

    mapping.genderKey = findMatch([
      /^jk$/i,
      /^jenis_kelamin$/i,
      /jenis.*kelamin/i,
      /gender/i,
      /sex/i,
    ]);

    return mapping;
  }

  /**
   * Helper to build deduplicated NIK records map and count duplicate occurrences
   */
  private static buildPeriodRecordMap(
    rows: Record<string, unknown>[],
    nikKey: string
  ): { map: Map<string, Record<string, unknown>>; duplicateCount: number } {
    const map = new Map<string, Record<string, unknown>>();
    let duplicateCount = 0;
    for (const row of rows) {
      const rawNik = row[nikKey];
      const nik = this.sanitizeNik(rawNik);
      if (!nik) continue;
      if (map.has(nik)) {
        duplicateCount++;
      }
      map.set(nik, row);
    }
    return { map, duplicateCount };
  }

  /**
   * Main evaluation engine: classifies cohort into 4 statuses & generates KPI summary
   */
  public static evaluateCohort(
    period1Rows: Record<string, unknown>[],
    period2Rows: Record<string, unknown>[],
    config: CohortConfig
  ): CohortComparisonResult {
    const nik1Key = config.p1Mapping.nikKey || 'NIK';
    const name1Key = config.p1Mapping.nameKey || 'Nama Balita';
    const dob1Key = config.p1Mapping.dobKey || 'Tanggal Lahir';
    const pkm1Key = config.p1Mapping.puskesmasKey || 'Puskesmas';
    const desa1Key = config.p1Mapping.desaKey || 'Desa/Kelurahan';
    const gender1Key = config.p1Mapping.genderKey || 'Jenis Kelamin';

    const nik2Key = config.p2Mapping.nikKey || 'NIK';
    const name2Key = config.p2Mapping.nameKey || 'Nama Balita';
    const dob2Key = config.p2Mapping.dobKey || 'Tanggal Lahir';
    const pkm2Key = config.p2Mapping.puskesmasKey || 'Puskesmas';
    const desa2Key = config.p2Mapping.desaKey || 'Desa/Kelurahan';
    const gender2Key = config.p2Mapping.genderKey || 'Jenis Kelamin';

    // Ingest Period 1 & Period 2 via shared helper
    const { map: p1Map, duplicateCount: dupP1 } = this.buildPeriodRecordMap(period1Rows, nik1Key);
    const { map: p2Map, duplicateCount: dupP2 } = this.buildPeriodRecordMap(period2Rows, nik2Key);

    const allNiks = new Set<string>([...p1Map.keys(), ...p2Map.keys()]);
    const evaluatedChildren: CohortEvaluatedChild[] = [];

    let persistentCount = 0;
    let recoveredCount = 0;
    let agedOutCount = 0;
    let newCaseCount = 0;

    for (const nik of allNiks) {
      const inP1 = p1Map.has(nik);
      const inP2 = p2Map.has(nik);
      const row1 = p1Map.get(nik);
      const row2 = p2Map.get(nik);

      // Prioritize period 2 active data for name, dob, puskesmas, desa
      const activeRow = row2 || row1 || {};
      const nama = String(
        row2 ? row2[name2Key] || row1?.[name1Key] || 'Tanpa Nama' : row1?.[name1Key] || 'Tanpa Nama'
      );
      const tglLahir = String(
        row2 ? row2[dob2Key] || row1?.[dob1Key] || '' : row1?.[dob1Key] || ''
      );
      const puskesmas = String(
        row2 ? row2[pkm2Key] || row1?.[pkm1Key] || '' : row1?.[pkm1Key] || ''
      );
      const desa = String(
        row2 ? row2[desa2Key] || row1?.[desa1Key] || '' : row1?.[desa1Key] || ''
      );
      const gender = String(
        row2 ? row2[gender2Key] || row1?.[gender1Key] || '' : row1?.[gender1Key] || ''
      );

      const ageMonths = this.calculateAgeInMonths(tglLahir, config.evaluationDate);

      let status: CohortTransitionStatus;

      if (inP1 && inP2) {
        status = CohortTransitionStatus.PERSISTENT;
        persistentCount++;
      } else if (inP1 && !inP2) {
        if (ageMonths !== null && ageMonths >= 60) {
          status = CohortTransitionStatus.AGED_OUT;
          agedOutCount++;
        } else {
          status = CohortTransitionStatus.RECOVERED;
          recoveredCount++;
        }
      } else {
        // !inP1 && inP2
        status = CohortTransitionStatus.NEW_CASE;
        newCaseCount++;
      }

      evaluatedChildren.push({
        nik,
        nama,
        tanggalLahir: tglLahir || undefined,
        ageMonths,
        status,
        statusLabel: this.STATUS_LABELS[status],
        inPeriod1: inP1,
        inPeriod2: inP2,
        puskesmas: puskesmas || undefined,
        desa: desa || undefined,
        gender: gender || undefined,
        p1Details: row1,
        p2Details: row2,
      });
    }

    // Sort: PERSISTENT first, then NEW_CASE, RECOVERED, AGED_OUT; then by nama
    const statusPriority: Record<CohortTransitionStatus, number> = {
      [CohortTransitionStatus.PERSISTENT]: 1,
      [CohortTransitionStatus.NEW_CASE]: 2,
      [CohortTransitionStatus.RECOVERED]: 3,
      [CohortTransitionStatus.AGED_OUT]: 4,
    };

    evaluatedChildren.sort((a, b) => {
      const pDiff = statusPriority[a.status] - statusPriority[b.status];
      if (pDiff !== 0) return pDiff;
      return a.nama.localeCompare(b.nama);
    });

    const totalP1 = p1Map.size;
    const totalP2 = p2Map.size;
    const totalEvaluated = evaluatedChildren.length;

    const summary: CohortSummary = {
      totalPeriod1: totalP1,
      totalPeriod2: totalP2,
      persistentCount,
      persistentPercent: totalEvaluated > 0 ? (persistentCount / totalEvaluated) * 100 : 0,
      recoveredCount,
      recoveredPercent: totalEvaluated > 0 ? (recoveredCount / totalEvaluated) * 100 : 0,
      newCaseCount,
      newCasePercent: totalEvaluated > 0 ? (newCaseCount / totalEvaluated) * 100 : 0,
      agedOutCount,
      agedOutPercent: totalEvaluated > 0 ? (agedOutCount / totalEvaluated) * 100 : 0,
      netChange: totalP2 - totalP1,
      duplicateNikPeriod1Count: dupP1,
      duplicateNikPeriod2Count: dupP2,
    };

    return {
      summary,
      children: evaluatedChildren,
      evaluationDate: config.evaluationDate,
      p1Label: config.p1Label || 'Periode Awal',
      p2Label: config.p2Label || 'Periode Evaluasi',
    };
  }

  /**
   * Generates a structured multi-sheet Excel workbook with Dinkes styling
   */
  public static generateExcelWorkbook(result: CohortComparisonResult): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();

    // 1. Executive Summary Sheet
    const summaryRows: (string | number)[][] = [
      ['LAPORAN KOMPARASI KOHORT BALITA STUNTING'],
      ['Dinas Kesehatan Provinsi Jawa Tengah'],
      [''],
      ['Parameter Komparasi', 'Nilai'],
      ['Periode Awal (Baseline)', result.p1Label],
      ['Periode Evaluasi (Terkini)', result.p2Label],
      ['Tanggal Acuan Evaluasi Usia', result.evaluationDate],
      [''],
      ['Indikator / Metrik Kohort', 'Jumlah Balita', 'Persentase (%)'],
      ['Total Balita Terdata Periode 1', result.summary.totalPeriod1, '-'],
      ['Total Balita Terdata Periode 2', result.summary.totalPeriod2, '-'],
      [
        'Tetap Stunting (Persistent)',
        result.summary.persistentCount,
        `${result.summary.persistentPercent.toFixed(1)}%`,
      ],
      [
        'Bebas Stunting (Recovered)',
        result.summary.recoveredCount,
        `${result.summary.recoveredPercent.toFixed(1)}%`,
      ],
      [
        'Kasus Baru Stunting (New Incidence)',
        result.summary.newCaseCount,
        `${result.summary.newCasePercent.toFixed(1)}%`,
      ],
      [
        'Lulus Usia Balita (>= 60 Bulan)',
        result.summary.agedOutCount,
        `${result.summary.agedOutPercent.toFixed(1)}%`,
      ],
      ['Net Change Beban Kasus', result.summary.netChange, '-'],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);

    // Style summary headers
    wsSummary['!cols'] = [{ wch: 36 }, { wch: 22 }, { wch: 18 }];
    if (wsSummary['A1']) {
      wsSummary['A1'].s = {
        font: { bold: true, sz: 14, color: { rgb: '065F46' } },
      };
    }
    if (wsSummary['A9'] && wsSummary['B9'] && wsSummary['C9']) {
      const headerStyle = {
        fill: { fgColor: { rgb: '059669' } },
        font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center' },
      };
      wsSummary['A9'].s = headerStyle;
      wsSummary['B9'].s = headerStyle;
      wsSummary['C9'].s = headerStyle;
    }

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Eksekutif');

    // Helper to generate child data sheet
    const createChildSheet = (
      children: CohortEvaluatedChild[],
      sheetColor: string
    ): XLSX.WorkSheet => {
      const headers = [
        'No',
        'NIK',
        'Nama Balita',
        'Tanggal Lahir',
        'Usia (Bulan)',
        'Puskesmas',
        'Desa/Kelurahan',
        'Jenis Kelamin',
        'Status Transisi Kohort',
        `Tercatat di ${result.p1Label}`,
        `Tercatat di ${result.p2Label}`,
      ];

      const rows: (string | number)[][] = [headers];

      children.forEach((c, idx) => {
        rows.push([
          idx + 1,
          c.nik,
          c.nama,
          c.tanggalLahir || '-',
          c.ageMonths !== null ? c.ageMonths : '-',
          c.puskesmas || '-',
          c.desa || '-',
          c.gender || '-',
          c.statusLabel,
          c.inPeriod1 ? 'Ya' : 'Tidak',
          c.inPeriod2 ? 'Ya' : 'Tidak',
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);

      // Force NIK column to string type
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
      for (let R = 1; R <= range.e.r; ++R) {
        const cellRef = XLSX.utils.encode_cell({ c: 1, r: R });
        if (ws[cellRef]) {
          ws[cellRef].t = 's';
        }
      }

      // Header styling
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[addr]) {
          ws[addr].s = {
            fill: { fgColor: { rgb: sheetColor } },
            font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
            alignment: { horizontal: c <= 2 ? 'left' : 'center' },
          };
        }
      }

      // Column widths
      ws['!cols'] = [
        { wch: 6 },  // No
        { wch: 20 }, // NIK
        { wch: 25 }, // Nama
        { wch: 14 }, // Tgl Lahir
        { wch: 13 }, // Usia
        { wch: 24 }, // Puskesmas
        { wch: 20 }, // Desa
        { wch: 14 }, // JK
        { wch: 22 }, // Status
        { wch: 18 }, // P1
        { wch: 18 }, // P2
      ];

      return ws;
    };

    // 2. Semua Balita (Slate / Dark Header)
    const wsAll = createChildSheet(result.children, '1E293B');
    XLSX.utils.book_append_sheet(wb, wsAll, 'Semua Balita');

    // 3. Tetap Stunting (Rose / Merah)
    const persistent = result.children.filter(
      (c) => c.status === CohortTransitionStatus.PERSISTENT
    );
    const wsPersistent = createChildSheet(persistent, 'E11D48');
    XLSX.utils.book_append_sheet(wb, wsPersistent, 'Tetap Stunting');

    // 4. Bebas Stunting (Emerald / Hijau)
    const recovered = result.children.filter(
      (c) => c.status === CohortTransitionStatus.RECOVERED
    );
    const wsRecovered = createChildSheet(recovered, '059669');
    XLSX.utils.book_append_sheet(wb, wsRecovered, 'Bebas Stunting');

    // 5. Kasus Baru (Orange)
    const newCases = result.children.filter(
      (c) => c.status === CohortTransitionStatus.NEW_CASE
    );
    const wsNewCases = createChildSheet(newCases, 'EA580C');
    XLSX.utils.book_append_sheet(wb, wsNewCases, 'Kasus Baru');

    // 6. Lulus Usia Balita (Gray / Slate)
    const agedOut = result.children.filter(
      (c) => c.status === CohortTransitionStatus.AGED_OUT
    );
    const wsAgedOut = createChildSheet(agedOut, '475569');
    XLSX.utils.book_append_sheet(wb, wsAgedOut, 'Lulus Usia Balita');

    return wb;
  }
}

