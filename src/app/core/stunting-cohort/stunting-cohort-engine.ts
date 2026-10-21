import * as XLSX from 'xlsx-js-style';

export type CohortIndicatorType =
  | 'stunting'
  | 'wasting'
  | 'underweight'
  | 'gizi_buruk'
  | 'overweight';

export enum CohortTransitionStatus {
  PERSISTENT = 'PERSISTENT', // Tetap Kasus (Ada di P1 dan P2)
  RECOVERED = 'RECOVERED',   // Bebas Kasus / Sembuh (Ada di P1, tidak di P2 / normal, usia < 60 bln)
  NEW_CASE = 'NEW_CASE',     // Kasus Baru (Normal/tidak ada di P1, kasus di P2)
  AGED_OUT = 'AGED_OUT',     // Lulus Usia Balita (Usia >= 60 bln pada periode evaluasi)
}

export interface CohortColumnMapping {
  nikKey?: string;
  nameKey?: string;
  dobKey?: string;
  puskesmasKey?: string;
  desaKey?: string;
  genderKey?: string;
  heightKey?: string;
  weightKey?: string;
  // Specific indicator keys
  stuntingKey?: string;
  tbuKey?: string;
  zscoreTbuKey?: string;
  wastingKey?: string;
  bbtbKey?: string;
  zscoreBbtbKey?: string;
  underweightKey?: string;
  bbuKey?: string;
  zscoreBbuKey?: string;
  giziBurukKey?: string;
  overweightKey?: string;
}

export interface CohortConfig {
  p1Mapping: CohortColumnMapping;
  p2Mapping: CohortColumnMapping;
  evaluationDate: string;
  indicator?: CohortIndicatorType;
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
  indicator: CohortIndicatorType;
  inPeriod1: boolean;
  inPeriod2: boolean;
  isAgeOutlier: boolean;
  puskesmas?: string;
  desa?: string;
  gender?: string;
  p1Details?: Record<string, unknown>;
  p2Details?: Record<string, unknown>;
  p1Height?: number | null;
  p2Height?: number | null;
  heightGain?: number | null;
  p1Weight?: number | null;
  p2Weight?: number | null;
  weightGain?: number | null;
  p1StatusTbu?: string;
  p2StatusTbu?: string;
  p1ZscoreTbu?: number | null;
  p2ZscoreTbu?: number | null;
  p1StatusBbu?: string;
  p2StatusBbu?: string;
  p1ZscoreBbu?: number | null;
  p2ZscoreBbu?: number | null;
  p1StatusBbtb?: string;
  p2StatusBbtb?: string;
  p1ZscoreBbtb?: number | null;
  p2ZscoreBbtb?: number | null;
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
  ageOutlierPeriod2Count: number;
  missingPeriod2Count: number;
}

export interface CohortComparisonResult {
  indicator: CohortIndicatorType;
  summary: CohortSummary;
  children: CohortEvaluatedChild[];
  evaluationDate: string;
  p1Label: string;
  p2Label: string;
}

export class StuntingCohortEngine {
  /**
   * Returns human-readable Indonesian status labels per indicator
   */
  public static getStatusLabels(indicator: CohortIndicatorType = 'stunting'): Record<CohortTransitionStatus, string> {
    switch (indicator) {
      case 'wasting':
        return {
          [CohortTransitionStatus.PERSISTENT]: 'Tetap Wasting',
          [CohortTransitionStatus.RECOVERED]: 'Bebas Wasting',
          [CohortTransitionStatus.NEW_CASE]: 'Kasus Baru Wasting',
          [CohortTransitionStatus.AGED_OUT]: 'Lulus Usia Balita',
        };
      case 'underweight':
        return {
          [CohortTransitionStatus.PERSISTENT]: 'Tetap Underweight',
          [CohortTransitionStatus.RECOVERED]: 'Bebas Underweight',
          [CohortTransitionStatus.NEW_CASE]: 'Kasus Baru Underweight',
          [CohortTransitionStatus.AGED_OUT]: 'Lulus Usia Balita',
        };
      case 'gizi_buruk':
        return {
          [CohortTransitionStatus.PERSISTENT]: 'Tetap Gizi Buruk',
          [CohortTransitionStatus.RECOVERED]: 'Bebas Gizi Buruk',
          [CohortTransitionStatus.NEW_CASE]: 'Kasus Baru Gizi Buruk',
          [CohortTransitionStatus.AGED_OUT]: 'Lulus Usia Balita',
        };
      case 'overweight':
        return {
          [CohortTransitionStatus.PERSISTENT]: 'Tetap Overweight',
          [CohortTransitionStatus.RECOVERED]: 'Bebas Overweight',
          [CohortTransitionStatus.NEW_CASE]: 'Kasus Baru Overweight',
          [CohortTransitionStatus.AGED_OUT]: 'Lulus Usia Balita',
        };
      case 'stunting':
      default:
        return {
          [CohortTransitionStatus.PERSISTENT]: 'Tetap Stunting',
          [CohortTransitionStatus.RECOVERED]: 'Bebas Stunting',
          [CohortTransitionStatus.NEW_CASE]: 'Kasus Baru Stunting',
          [CohortTransitionStatus.AGED_OUT]: 'Lulus Usia Balita',
        };
    }
  }

  /**
   * Default status labels map (stunting) for backward compatibility
   */
  public static readonly STATUS_LABELS: Record<CohortTransitionStatus, string> =
    StuntingCohortEngine.getStatusLabels('stunting');

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
   * Robust date parser that handles:
   * 1. Date instances
   * 2. Excel serial numbers (e.g. 44749.29180555556)
   * 3. ISO date strings (YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss)
   * 4. Indonesian formatted date strings (DD/MM/YYYY, DD-MM-YYYY)
   */
  public static parseDate(raw: unknown): Date | null {
    if (raw === null || raw === undefined || raw === '') return null;

    if (raw instanceof Date) {
      return isNaN(raw.getTime()) ? null : raw;
    }

    // Number or numeric string
    const num =
      typeof raw === 'number'
        ? raw
        : !isNaN(Number(raw)) && String(raw).trim() !== ''
        ? Number(raw)
        : NaN;

    if (!isNaN(num)) {
      // Excel date serial number: between 1 (1900-01-01) and 100000 (~2173)
      if (num >= 1 && num <= 100000) {
        const utcDays = num - 25569;
        const utcValue = utcDays * 86400;
        const dateInfo = new Date(utcValue * 1000);
        const fractionalDay = num - Math.floor(num) + 0.0000001;
        const totalSeconds = Math.floor(86400 * fractionalDay);
        const seconds = totalSeconds % 60;
        const hours = Math.floor(totalSeconds / (60 * 60));
        const minutes = Math.floor(totalSeconds / 60) % 60;

        const d = new Date(
          dateInfo.getFullYear(),
          dateInfo.getMonth(),
          dateInfo.getDate(),
          hours,
          minutes,
          seconds
        );
        return isNaN(d.getTime()) ? null : d;
      }
    }

    const str = String(raw).trim();
    if (!str) return null;

    // Check DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }

    // Fallback standard Date parsing
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Formats a date value cleanly into standard 'YYYY-MM-DD'
   */
  public static formatDateString(raw: unknown): string {
    const d = this.parseDate(raw);
    if (!d) return String(raw ?? '');
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Calculates pediatric age in full elapsed months between birth date and evaluation date
   * adhering to spec: floor((evalDate - birthDate) / (365.25 / 12))
   */
  public static calculateAgeInMonths(
    birthDateRaw: unknown,
    evalDateRaw: unknown
  ): number | null {
    if (!birthDateRaw || !evalDateRaw) return null;

    const birthDate = this.parseDate(birthDateRaw);
    const evalDate = this.parseDate(evalDateRaw);

    if (!birthDate || !evalDate) {
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

    mapping.stuntingKey = findMatch([
      /^stunting$/i,
      /^status.*stunting$/i,
      /^is.*stunting$/i,
      /^indikator.*stunting/i,
    ]);

    mapping.wastingKey = findMatch([
      /^wasting$/i,
      /^status.*wasting$/i,
      /^is.*wasting$/i,
      /^indikator.*wasting/i,
    ]);

    mapping.underweightKey = findMatch([
      /^underweight$/i,
      /^status.*underweight$/i,
      /^is.*underweight$/i,
      /^indikator.*underweight/i,
      /^berat.*kurang$/i,
    ]);

    mapping.giziBurukKey = findMatch([
      /^gizi_buruk$/i,
      /^gizi.*buruk$/i,
      /^is.*gizi.*buruk$/i,
      /^status.*gizi.*buruk/i,
      /^severely.*wasted/i,
    ]);

    mapping.overweightKey = findMatch([
      /^overweight$/i,
      /^gizi_lebih$/i,
      /^obesitas$/i,
      /^is.*overweight$/i,
      /^status.*overweight/i,
      /^status.*gizi.*lebih/i,
    ]);

    mapping.tbuKey = findMatch([
      /^status_tbu$/i,
      /^status.*tb.*u$/i,
      /^tb_u$/i,
      /^tbu$/i,
      /^status.*tinggi/i,
    ]);

    mapping.zscoreTbuKey = findMatch([
      /^zscore_tbu$/i,
      /^zs.*tb.*u$/i,
      /^z.*score.*tbu$/i,
      /^z_tbu$/i,
    ]);

    mapping.bbuKey = findMatch([
      /^status_bbu$/i,
      /^status.*bb.*u$/i,
      /^bb_u$/i,
      /^bbu$/i,
      /^status.*berat/i,
    ]);

    mapping.zscoreBbuKey = findMatch([
      /^zscore_bbu$/i,
      /^zs.*bb.*u$/i,
      /^z.*score.*bbu$/i,
      /^z_bbu$/i,
    ]);

    mapping.bbtbKey = findMatch([
      /^status_bbtb$/i,
      /^status.*bb.*tb$/i,
      /^status.*bb.*pb$/i,
      /^bb_tb$/i,
      /^bbtb$/i,
      /^status.*gizi/i,
    ]);

    mapping.zscoreBbtbKey = findMatch([
      /^zscore_bbtb$/i,
      /^zs.*bb.*tb$/i,
      /^zs.*bb.*pb$/i,
      /^z.*score.*bbtb$/i,
      /^z_bbtb$/i,
    ]);

    mapping.heightKey = findMatch([
      /^tinggi_badan_cm$/i,
      /^tb_cm$/i,
      /^tinggi.*badan/i,
      /^panjang.*badan/i,
      /^tb$/i,
      /^pb$/i,
    ]);

    mapping.weightKey = findMatch([
      /^berat_badan_kg$/i,
      /^bb_kg$/i,
      /^berat.*badan/i,
      /^bb$/i,
    ]);

    return mapping;
  }

  /**
   * Helper to parse numeric values from rows (handles comma as decimal separator)
   */
  public static parseNumeric(val: unknown): number | null {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    const str = String(val).trim().replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  /**
   * Evaluates whether an individual record represents a health condition
   * for the given indicator type (stunting, wasting, underweight, gizi_buruk, overweight).
   */
  public static isChildConditionInRow(
    row: Record<string, unknown> | undefined,
    mapping: CohortColumnMapping,
    indicator: CohortIndicatorType = 'stunting',
    hasIndicator: boolean = true
  ): boolean {
    if (!row) return false;
    if (!hasIndicator) return true;

    switch (indicator) {
      case 'wasting': {
        // 1. Direct wasting flag e.g. "Ya" / "Tidak"
        if (mapping.wastingKey && row[mapping.wastingKey] !== undefined && row[mapping.wastingKey] !== null) {
          const val = String(row[mapping.wastingKey]).trim().toLowerCase();
          if (['ya', 'y', 'true', '1', 'wasted', 'wasting'].includes(val)) return true;
          if (['tidak', 't', 'false', '0', 'normal'].includes(val)) return false;
        }
        // 2. BB/TB status category e.g. "Gizi Kurang", "Gizi Buruk", "Wasted"
        if (mapping.bbtbKey && row[mapping.bbtbKey] !== undefined && row[mapping.bbtbKey] !== null) {
          const val = String(row[mapping.bbtbKey]).trim().toLowerCase();
          if (val.includes('kurang') || val.includes('buruk') || val.includes('wasted')) return true;
          if (val.includes('normal') || val.includes('baik') || val.includes('lebih') || val.includes('obes')) return false;
        }
        // 3. Z-Score BB/TB < -2.0 SD (WHO/Kemenkes standard)
        if (mapping.zscoreBbtbKey && row[mapping.zscoreBbtbKey] !== undefined && row[mapping.zscoreBbtbKey] !== null) {
          const num = this.parseNumeric(row[mapping.zscoreBbtbKey]);
          if (num !== null) return num < -2.0;
        }
        return false;
      }

      case 'underweight': {
        // 1. Direct underweight flag e.g. "Ya" / "Tidak"
        if (mapping.underweightKey && row[mapping.underweightKey] !== undefined && row[mapping.underweightKey] !== null) {
          const val = String(row[mapping.underweightKey]).trim().toLowerCase();
          if (['ya', 'y', 'true', '1', 'underweight'].includes(val)) return true;
          if (['tidak', 't', 'false', '0', 'normal'].includes(val)) return false;
        }
        // 2. BB/U status category e.g. "Kurang", "Sangat Kurang", "Underweight"
        if (mapping.bbuKey && row[mapping.bbuKey] !== undefined && row[mapping.bbuKey] !== null) {
          const val = String(row[mapping.bbuKey]).trim().toLowerCase();
          if (val.includes('kurang') || val.includes('underweight')) return true;
          if (val.includes('normal') || val.includes('baik')) return false;
        }
        // 3. Z-Score BB/U < -2.0 SD (WHO/Kemenkes standard)
        if (mapping.zscoreBbuKey && row[mapping.zscoreBbuKey] !== undefined && row[mapping.zscoreBbuKey] !== null) {
          const num = this.parseNumeric(row[mapping.zscoreBbuKey]);
          if (num !== null) return num < -2.0;
        }
        return false;
      }

      case 'gizi_buruk': {
        // 1. Direct gizi buruk flag e.g. "Ya" / "Tidak"
        if (mapping.giziBurukKey && row[mapping.giziBurukKey] !== undefined && row[mapping.giziBurukKey] !== null) {
          const val = String(row[mapping.giziBurukKey]).trim().toLowerCase();
          if (['ya', 'y', 'true', '1', 'buruk'].includes(val)) return true;
          if (['tidak', 't', 'false', '0', 'normal'].includes(val)) return false;
        }
        // 2. BB/TB status category e.g. "Gizi Buruk", "Severely Wasted"
        if (mapping.bbtbKey && row[mapping.bbtbKey] !== undefined && row[mapping.bbtbKey] !== null) {
          const val = String(row[mapping.bbtbKey]).trim().toLowerCase();
          if (val.includes('buruk') || val.includes('severely')) return true;
          if (val.includes('kurang') || val.includes('normal') || val.includes('baik') || val.includes('lebih')) return false;
        }
        // 3. Z-Score BB/TB < -3.0 SD (WHO/Kemenkes severe acute malnutrition)
        if (mapping.zscoreBbtbKey && row[mapping.zscoreBbtbKey] !== undefined && row[mapping.zscoreBbtbKey] !== null) {
          const num = this.parseNumeric(row[mapping.zscoreBbtbKey]);
          if (num !== null) return num < -3.0;
        }
        return false;
      }

      case 'overweight': {
        // 1. Direct overweight flag e.g. "Ya" / "Tidak"
        if (mapping.overweightKey && row[mapping.overweightKey] !== undefined && row[mapping.overweightKey] !== null) {
          const val = String(row[mapping.overweightKey]).trim().toLowerCase();
          if (['ya', 'y', 'true', '1', 'overweight', 'lebih', 'obesitas'].includes(val)) return true;
          if (['tidak', 't', 'false', '0', 'normal'].includes(val)) return false;
        }
        // 2. BB/TB status category e.g. "Gizi Lebih", "Obesitas", "Overweight"
        if (mapping.bbtbKey && row[mapping.bbtbKey] !== undefined && row[mapping.bbtbKey] !== null) {
          const val = String(row[mapping.bbtbKey]).trim().toLowerCase();
          if (val.includes('gizi lebih') || val.includes('obesitas') || val.includes('obese') || val.includes('overweight')) return true;
          if (val.includes('normal') || val.includes('baik') || val.includes('kurang') || val.includes('buruk')) return false;
        }
        // 3. Z-Score BB/TB > +2.0 SD (WHO/Kemenkes overweight/obesity standard)
        if (mapping.zscoreBbtbKey && row[mapping.zscoreBbtbKey] !== undefined && row[mapping.zscoreBbtbKey] !== null) {
          const num = this.parseNumeric(row[mapping.zscoreBbtbKey]);
          if (num !== null) return num > 2.0;
        }
        return false;
      }

      case 'stunting':
      default: {
        // 1. Direct stunting flag e.g. "Ya" / "Tidak"
        if (mapping.stuntingKey && row[mapping.stuntingKey] !== undefined && row[mapping.stuntingKey] !== null) {
          const val = String(row[mapping.stuntingKey]).trim().toLowerCase();
          if (['ya', 'y', 'true', '1', 'stunted', 'stunting'].includes(val)) return true;
          if (['tidak', 't', 'false', '0', 'normal', 'tinggi'].includes(val)) return false;
        }
        // 2. TB/U status category e.g. "Pendek", "Sangat Pendek"
        if (mapping.tbuKey && row[mapping.tbuKey] !== undefined && row[mapping.tbuKey] !== null) {
          const val = String(row[mapping.tbuKey]).trim().toLowerCase();
          if (val.includes('pendek') || val.includes('stunted')) return true;
          if (val.includes('normal') || val.includes('tinggi')) return false;
        }
        // 3. Z-Score TB/U < -2.0 SD (WHO/Kemenkes standard)
        if (mapping.zscoreTbuKey && row[mapping.zscoreTbuKey] !== undefined && row[mapping.zscoreTbuKey] !== null) {
          const num = this.parseNumeric(row[mapping.zscoreTbuKey]);
          if (num !== null) return num < -2.0;
        }
        return false;
      }
    }
  }

  /**
   * Evaluates whether an individual record represents a stunting condition.
   * Backward-compatible wrapper delegating to isChildConditionInRow with indicator 'stunting'.
   */
  public static isChildStuntingInRow(
    row: Record<string, unknown> | undefined,
    mapping: CohortColumnMapping,
    hasIndicator: boolean
  ): boolean {
    return this.isChildConditionInRow(row, mapping, 'stunting', hasIndicator);
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

    const indicator: CohortIndicatorType = config.indicator || 'stunting';
    const statusLabels = this.getStatusLabels(indicator);

    const hasIndicatorP1 = Boolean(
      (indicator === 'stunting' && (config.p1Mapping.stuntingKey || config.p1Mapping.tbuKey || config.p1Mapping.zscoreTbuKey)) ||
      (indicator === 'wasting' && (config.p1Mapping.wastingKey || config.p1Mapping.bbtbKey || config.p1Mapping.zscoreBbtbKey)) ||
      (indicator === 'underweight' && (config.p1Mapping.underweightKey || config.p1Mapping.bbuKey || config.p1Mapping.zscoreBbuKey)) ||
      (indicator === 'gizi_buruk' && (config.p1Mapping.giziBurukKey || config.p1Mapping.bbtbKey || config.p1Mapping.zscoreBbtbKey)) ||
      (indicator === 'overweight' && (config.p1Mapping.overweightKey || config.p1Mapping.bbtbKey || config.p1Mapping.zscoreBbtbKey))
    );
    const hasIndicatorP2 = Boolean(
      (indicator === 'stunting' && (config.p2Mapping.stuntingKey || config.p2Mapping.tbuKey || config.p2Mapping.zscoreTbuKey)) ||
      (indicator === 'wasting' && (config.p2Mapping.wastingKey || config.p2Mapping.bbtbKey || config.p2Mapping.zscoreBbtbKey)) ||
      (indicator === 'underweight' && (config.p2Mapping.underweightKey || config.p2Mapping.bbuKey || config.p2Mapping.zscoreBbuKey)) ||
      (indicator === 'gizi_buruk' && (config.p2Mapping.giziBurukKey || config.p2Mapping.bbtbKey || config.p2Mapping.zscoreBbtbKey)) ||
      (indicator === 'overweight' && (config.p2Mapping.overweightKey || config.p2Mapping.bbtbKey || config.p2Mapping.zscoreBbtbKey))
    );
    const hasIndicator = hasIndicatorP1 || hasIndicatorP2;

    const allNiks = new Set<string>([...p1Map.keys(), ...p2Map.keys()]);
    const evaluatedChildren: CohortEvaluatedChild[] = [];

    let persistentCount = 0;
    let recoveredCount = 0;
    let agedOutCount = 0;
    let newCaseCount = 0;
    let totalP1Count = 0;
    let ageOutlierPeriod2Count = 0;
    let missingPeriod2Count = 0;

    for (const nik of allNiks) {
      const inP1 = p1Map.has(nik);
      const inP2 = p2Map.has(nik);
      const row1 = p1Map.get(nik);
      const row2 = p2Map.get(nik);

      const isConditionP1 = row1
        ? this.isChildConditionInRow(row1, config.p1Mapping, indicator, hasIndicatorP1)
        : false;
      const isConditionP2 = row2
        ? this.isChildConditionInRow(row2, config.p2Mapping, indicator, hasIndicatorP2)
        : false;

      // When explicit indicator columns exist, skip children who never met this condition in either period
      if (hasIndicator && !isConditionP1 && !isConditionP2) {
        continue;
      }

      if (isConditionP1) {
        totalP1Count++;
      }

      // Prioritize period 2 active data for name, dob, puskesmas, desa
      const nama = String(
        row2 ? row2[name2Key] || row1?.[name1Key] || 'Tanpa Nama' : row1?.[name1Key] || 'Tanpa Nama'
      );
      const rawDob = row2 ? row2[dob2Key] ?? row1?.[dob1Key] : row1?.[dob1Key];
      const tglLahir =
        rawDob !== undefined && rawDob !== null && rawDob !== ''
          ? this.formatDateString(rawDob)
          : '';
      const puskesmas = String(
        row2 ? row2[pkm2Key] || row1?.[pkm1Key] || '' : row1?.[pkm1Key] || ''
      );
      const desa = String(
        row2 ? row2[desa2Key] || row1?.[desa1Key] || '' : row1?.[desa1Key] || ''
      );
      const gender = String(
        row2 ? row2[gender2Key] || row1?.[gender1Key] || '' : row1?.[gender1Key] || ''
      );

      const ageMonths = this.calculateAgeInMonths(rawDob ?? tglLahir, config.evaluationDate);

      // Children reaching age >= 60 months are categorized directly into AGED_OUT (Lulus Usia Balita),
      // even if they remain in condition in Period 2. Growth delta is still calculated.
      let status: CohortTransitionStatus;

      if (ageMonths !== null && ageMonths >= 60) {
        status = CohortTransitionStatus.AGED_OUT;
        agedOutCount++;
      } else if (isConditionP1 && isConditionP2) {
        status = CohortTransitionStatus.PERSISTENT;
        persistentCount++;
      } else if (isConditionP1 && !isConditionP2) {
        status = CohortTransitionStatus.RECOVERED;
        recoveredCount++;
        // If child was in Period 1 but missing from Period 2, consider them as lulus stunting / bebas
        if (!inP2) {
          missingPeriod2Count++;
        }
      } else {
        // !isConditionP1 && isConditionP2
        status = CohortTransitionStatus.NEW_CASE;
        newCaseCount++;
      }

      const isAgeOutlier = false;

      // Extract anthropometric metrics & growth
      const h1Key = config.p1Mapping.heightKey;
      const h2Key = config.p2Mapping.heightKey;
      const w1Key = config.p1Mapping.weightKey;
      const w2Key = config.p2Mapping.weightKey;
      const tbu1Key = config.p1Mapping.tbuKey;
      const tbu2Key = config.p2Mapping.tbuKey;
      const ztbu1Key = config.p1Mapping.zscoreTbuKey;
      const ztbu2Key = config.p2Mapping.zscoreTbuKey;
      const bbu1Key = config.p1Mapping.bbuKey;
      const bbu2Key = config.p2Mapping.bbuKey;
      const zbbu1Key = config.p1Mapping.zscoreBbuKey;
      const zbbu2Key = config.p2Mapping.zscoreBbuKey;
      const bbtb1Key = config.p1Mapping.bbtbKey;
      const bbtb2Key = config.p2Mapping.bbtbKey;
      const zbbtb1Key = config.p1Mapping.zscoreBbtbKey;
      const zbbtb2Key = config.p2Mapping.zscoreBbtbKey;

      const p1Height = h1Key && row1 ? this.parseNumeric(row1[h1Key]) : null;
      const p2Height = h2Key && row2 ? this.parseNumeric(row2[h2Key]) : null;
      const heightGain =
        p1Height !== null && p2Height !== null
          ? Number((p2Height - p1Height).toFixed(1))
          : null;

      const p1Weight = w1Key && row1 ? this.parseNumeric(row1[w1Key]) : null;
      const p2Weight = w2Key && row2 ? this.parseNumeric(row2[w2Key]) : null;
      const weightGain =
        p1Weight !== null && p2Weight !== null
          ? Number((p2Weight - p1Weight).toFixed(2))
          : null;

      const p1StatusTbu = tbu1Key && row1 ? String(row1[tbu1Key] || '').trim() || undefined : undefined;
      const p2StatusTbu = tbu2Key && row2 ? String(row2[tbu2Key] || '').trim() || undefined : undefined;
      const p1ZscoreTbu = ztbu1Key && row1 ? this.parseNumeric(row1[ztbu1Key]) : null;
      const p2ZscoreTbu = ztbu2Key && row2 ? this.parseNumeric(row2[ztbu2Key]) : null;

      const p1StatusBbu = bbu1Key && row1 ? String(row1[bbu1Key] || '').trim() || undefined : undefined;
      const p2StatusBbu = bbu2Key && row2 ? String(row2[bbu2Key] || '').trim() || undefined : undefined;
      const p1ZscoreBbu = zbbu1Key && row1 ? this.parseNumeric(row1[zbbu1Key]) : null;
      const p2ZscoreBbu = zbbu2Key && row2 ? this.parseNumeric(row2[zbbu2Key]) : null;

      const p1StatusBbtb = bbtb1Key && row1 ? String(row1[bbtb1Key] || '').trim() || undefined : undefined;
      const p2StatusBbtb = bbtb2Key && row2 ? String(row2[bbtb2Key] || '').trim() || undefined : undefined;
      const p1ZscoreBbtb = zbbtb1Key && row1 ? this.parseNumeric(row1[zbbtb1Key]) : null;
      const p2ZscoreBbtb = zbbtb2Key && row2 ? this.parseNumeric(row2[zbbtb2Key]) : null;

      evaluatedChildren.push({
        nik,
        nama,
        tanggalLahir: tglLahir || undefined,
        ageMonths,
        status,
        statusLabel: statusLabels[status],
        indicator,
        inPeriod1: inP1,
        inPeriod2: inP2,
        isAgeOutlier,
        puskesmas: puskesmas || undefined,
        desa: desa || undefined,
        gender: gender || undefined,
        p1Details: row1,
        p2Details: row2,
        p1Height,
        p2Height,
        heightGain,
        p1Weight,
        p2Weight,
        weightGain,
        p1StatusTbu,
        p2StatusTbu,
        p1ZscoreTbu,
        p2ZscoreTbu,
        p1StatusBbu,
        p2StatusBbu,
        p1ZscoreBbu,
        p2ZscoreBbu,
        p1StatusBbtb,
        p2StatusBbtb,
        p1ZscoreBbtb,
        p2ZscoreBbtb,
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

    const totalP1 = totalP1Count;
    const totalP2 = persistentCount + newCaseCount;
    const totalEvaluated = evaluatedChildren.length;

    const summary: CohortSummary = {
      totalPeriod1: totalP1,
      totalPeriod2: totalP2,
      persistentCount,
      persistentPercent: totalEvaluated > 0 ? Number(((persistentCount / totalEvaluated) * 100).toFixed(2)) : 0,
      recoveredCount,
      recoveredPercent: totalEvaluated > 0 ? Number(((recoveredCount / totalEvaluated) * 100).toFixed(2)) : 0,
      newCaseCount,
      newCasePercent: totalEvaluated > 0 ? Number(((newCaseCount / totalEvaluated) * 100).toFixed(2)) : 0,
      agedOutCount,
      agedOutPercent: totalEvaluated > 0 ? Number(((agedOutCount / totalEvaluated) * 100).toFixed(2)) : 0,
      netChange: totalP2 - totalP1,
      duplicateNikPeriod1Count: dupP1,
      duplicateNikPeriod2Count: dupP2,
      ageOutlierPeriod2Count,
      missingPeriod2Count,
    };

    return {
      indicator,
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
    const indicator = result.indicator || 'stunting';
    const indicatorName = indicator.replace('_', ' ').toUpperCase();
    const statusLabels = this.getStatusLabels(indicator);

    // 1. Executive Summary Sheet
    const summaryRows: (string | number)[][] = [
      [`LAPORAN KOMPARASI KOHORT BALITA ${indicatorName}`],
      ['Dinas Kesehatan Provinsi Jawa Tengah'],
      [''],
      ['Parameter Komparasi', 'Nilai'],
      ['Indikator Kesehatan', indicatorName],
      ['Periode Awal (Baseline)', result.p1Label],
      ['Periode Evaluasi (Terkini)', result.p2Label],
      ['Tanggal Acuan Evaluasi Usia', result.evaluationDate],
      [''],
      ['Indikator / Metrik Kohort', 'Jumlah Balita', 'Persentase (%)'],
      ['Total Balita Terdata Periode 1', result.summary.totalPeriod1, '-'],
      ['Total Balita Terdata Periode 2', result.summary.totalPeriod2, '-'],
      [
        `${statusLabels[CohortTransitionStatus.PERSISTENT]} (Persistent)`,
        result.summary.persistentCount,
        `${result.summary.persistentPercent.toFixed(2)}%`,
      ],
      [
        `${statusLabels[CohortTransitionStatus.RECOVERED]} (Recovered)`,
        result.summary.recoveredCount,
        `${result.summary.recoveredPercent.toFixed(2)}%`,
      ],
      [
        `${statusLabels[CohortTransitionStatus.NEW_CASE]} (New Incidence)`,
        result.summary.newCaseCount,
        `${result.summary.newCasePercent.toFixed(2)}%`,
      ],
      [
        'Lulus Usia Balita (>= 60 Bulan)',
        result.summary.agedOutCount,
        `${result.summary.agedOutPercent.toFixed(2)}%`,
      ],
      ['Net Change Beban Kasus', result.summary.netChange, '-'],
      ['Outlier Usia di Periode Evaluasi (>= 60 Bulan)', result.summary.ageOutlierPeriod2Count, '-'],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);

    // Style summary headers
    wsSummary['!cols'] = [{ wch: 42 }, { wch: 22 }, { wch: 18 }];
    if (wsSummary['A1']) {
      wsSummary['A1'].s = {
        font: { bold: true, sz: 14, color: { rgb: '065F46' } },
      };
    }
    if (wsSummary['A10'] && wsSummary['B10'] && wsSummary['C10']) {
      const headerStyle = {
        fill: { fgColor: { rgb: '059669' } },
        font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center' },
      };
      wsSummary['A10'].s = headerStyle;
      wsSummary['B10'].s = headerStyle;
      wsSummary['C10'].s = headerStyle;
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
        `TB ${result.p1Label} (cm)`,
        `BB ${result.p1Label} (kg)`,
        `Status TB/U ${result.p1Label}`,
        `Status BB/U ${result.p1Label}`,
        `Status BB/TB ${result.p1Label}`,
        `TB ${result.p2Label} (cm)`,
        `BB ${result.p2Label} (kg)`,
        `Status TB/U ${result.p2Label}`,
        `Status BB/U ${result.p2Label}`,
        `Status BB/TB ${result.p2Label}`,
        'Pertumbuhan TB (cm)',
        'Perubahan BB (kg)',
        'Catatan Outlier',
      ];

      const rows: (string | number)[][] = [headers];

      children.forEach((c, idx) => {
        const heightGainStr =
          c.heightGain !== null && c.heightGain !== undefined
            ? c.heightGain > 0
              ? `+${c.heightGain}`
              : `${c.heightGain}`
            : '-';

        const weightGainStr =
          c.weightGain !== null && c.weightGain !== undefined
            ? c.weightGain > 0
              ? `+${c.weightGain}`
              : `${c.weightGain}`
            : '-';

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
          c.p1Height !== null && c.p1Height !== undefined ? c.p1Height : '-',
          c.p1Weight !== null && c.p1Weight !== undefined ? c.p1Weight : '-',
          c.p1StatusTbu || '-',
          c.p1StatusBbu || '-',
          c.p1StatusBbtb || '-',
          c.p2Height !== null && c.p2Height !== undefined ? c.p2Height : '-',
          c.p2Weight !== null && c.p2Weight !== undefined ? c.p2Weight : '-',
          c.p2StatusTbu || '-',
          c.p2StatusBbu || '-',
          c.p2StatusBbtb || '-',
          heightGainStr,
          weightGainStr,
          c.isAgeOutlier
            ? 'Outlier Usia (>=60 Bulan)'
            : !c.inPeriod2 && c.status === CohortTransitionStatus.RECOVERED
            ? 'Tidak Terdata di P2 (Lulus Stunting)'
            : '-',
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
        { wch: 24 }, // Status
        { wch: 16 }, // P1
        { wch: 16 }, // P2
        { wch: 16 }, // TB P1
        { wch: 16 }, // BB P1
        { wch: 16 }, // Status TB/U P1
        { wch: 16 }, // Status BB/U P1
        { wch: 16 }, // Status BB/TB P1
        { wch: 16 }, // TB P2
        { wch: 16 }, // BB P2
        { wch: 16 }, // Status TB/U P2
        { wch: 16 }, // Status BB/U P2
        { wch: 16 }, // Status BB/TB P2
        { wch: 18 }, // Pertumbuhan TB
        { wch: 18 }, // Perubahan BB
        { wch: 22 }, // Catatan Outlier
      ];

      return ws;
    };

    // 2. Semua Balita (Slate / Dark Header)
    const wsAll = createChildSheet(result.children, '1E293B');
    XLSX.utils.book_append_sheet(wb, wsAll, 'Semua Balita');

    // 3. Tetap Kasus (Rose / Merah)
    const persistent = result.children.filter(
      (c) => c.status === CohortTransitionStatus.PERSISTENT
    );
    const wsPersistent = createChildSheet(persistent, 'E11D48');
    XLSX.utils.book_append_sheet(wb, wsPersistent, statusLabels[CohortTransitionStatus.PERSISTENT]);

    // 4. Bebas Kasus (Emerald / Hijau)
    const recovered = result.children.filter(
      (c) => c.status === CohortTransitionStatus.RECOVERED
    );
    const wsRecovered = createChildSheet(recovered, '059669');
    XLSX.utils.book_append_sheet(wb, wsRecovered, statusLabels[CohortTransitionStatus.RECOVERED]);

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

