import { ColumnInfo } from '../../shared/excel';

/**
 * ExcelResilientMatcher: Modul domain yang mendalam (Deep Module) untuk mencocokkan nama sheet
 * dan header kolom preset secara tangguh (resilient fuzzy matching) terhadap berbagai variasi
 * penamaan berkas Dinas Kesehatan dari waktu ke waktu.
 */
export class ExcelResilientMatcher {
  /**
   * Menormalisasi string menjadi huruf kecil dengan spasi majemuk diubah menjadi garis bawah.
   */
  static normalizeKey(value: string): string {
    if (!value) return '';
    return value.trim().toLowerCase().replace(/\s+/g, '_');
  }

  /**
   * Menghilangkan seluruh karakter selain alfanumerik (a-z, 0-9).
   */
  static cleanAlphanumeric(value: string): string {
    return this.normalizeKey(value).replace(/[^a-z0-9]/g, '');
  }

  /**
   * Memeriksa apakah dua nama sheet secara wajar merujuk pada sheet yang sama.
   */
  static isSheetMatch(nameA: string, nameB: string): boolean {
    if (!nameA || !nameB) return false;
    if (nameA === nameB) return true;
    const normA = this.normalizeKey(nameA);
    const normB = this.normalizeKey(nameB);
    if (normA === normB) return true;
    const cleanA = this.cleanAlphanumeric(normA);
    const cleanB = this.cleanAlphanumeric(normB);
    return cleanA.length > 0 && cleanA === cleanB;
  }

  /**
   * Mencari kecocokan nama sheet tunggal dari daftar sheet yang tersedia.
   * Multi-pass:
   * 1. Exact match
   * 2. Normalized match
   * 3. Clean alphanumeric match
   * 4. Boundary / substring match
   */
  static findMatchingSheet(
    presetSheetName: string,
    availableSheets: string[],
  ): string | undefined {
    if (!presetSheetName || availableSheets.length === 0) {
      return undefined;
    }

    // Pass 1: Exact match
    const exact = availableSheets.find((s) => s === presetSheetName);
    if (exact) return exact;

    const normPreset = this.normalizeKey(presetSheetName);
    const psTrim = presetSheetName.trim().toLowerCase();

    // Pass 2: Case-insensitive / trimmed match
    const matchCase = availableSheets.find((s) => s.trim().toLowerCase() === psTrim);
    if (matchCase) return matchCase;

    // Pass 3: Normalized match
    const norm = availableSheets.find((s) => this.normalizeKey(s) === normPreset);
    if (norm) return norm;

    // Pass 4: Clean alphanumeric match
    const cleanPreset = this.cleanAlphanumeric(normPreset);
    if (cleanPreset) {
      const cleanMatch = availableSheets.find(
        (s) => this.cleanAlphanumeric(s) === cleanPreset,
      );
      if (cleanMatch) return cleanMatch;
    }

    // Pass 5: Loose substring match (menghindari awalan konflik jika tidak ada di preset)
    const conflictPrefixes = ['grafik', 'chart', 'rekap', 'masalah'];
    const loose = availableSheets.find((s) => {
      const normS = this.normalizeKey(s);
      const hasConflict = conflictPrefixes.some(
        (p) => normS.includes(p) && !normPreset.includes(p),
      );
      if (hasConflict) return false;
      return normS.includes(normPreset) || normPreset.includes(normS);
    });

    return loose;
  }

  /**
   * Melakukan pemetaan 1-ke-1 antara sheet pada workbook dan daftar preset sheets.
   * Menjamin setiap preset sheet memetakan paling banyak SATU sheet workbook,
   * dan mencegah sheet tidak relevan merebut preset.
   */
  static matchSheets<T extends { sheetName: string }>(
    availableSheetNames: string[],
    presetSheets: T[],
  ): Map<string, T> {
    const result = new Map<string, T>();
    const claimedPresetIndices = new Set<number>();
    const claimedAvailable = new Set<string>();

    // Pass 1: Exact match (case-insensitive & trimmed)
    for (let i = 0; i < presetSheets.length; i++) {
      const ps = presetSheets[i];
      const psTrim = ps.sheetName.trim().toLowerCase();
      const exact = availableSheetNames.find(
        (name) => !claimedAvailable.has(name) && name.trim().toLowerCase() === psTrim,
      );
      if (exact) {
        result.set(exact, ps);
        claimedPresetIndices.add(i);
        claimedAvailable.add(exact);
      }
    }

    // Pass 2: Normalized match (whitespace & underscore collapsed)
    for (let i = 0; i < presetSheets.length; i++) {
      if (claimedPresetIndices.has(i)) continue;
      const ps = presetSheets[i];
      const psNorm = this.normalizeKey(ps.sheetName);
      const match = availableSheetNames.find(
        (name) => !claimedAvailable.has(name) && this.normalizeKey(name) === psNorm,
      );
      if (match) {
        result.set(match, ps);
        claimedPresetIndices.add(i);
        claimedAvailable.add(match);
      }
    }

    // Pass 3: Clean alphanumeric match
    for (let i = 0; i < presetSheets.length; i++) {
      if (claimedPresetIndices.has(i)) continue;
      const ps = presetSheets[i];
      const psClean = this.cleanAlphanumeric(ps.sheetName);
      if (!psClean) continue;
      const match = availableSheetNames.find(
        (name) =>
          !claimedAvailable.has(name) &&
          this.cleanAlphanumeric(name) === psClean,
      );
      if (match) {
        result.set(match, ps);
        claimedPresetIndices.add(i);
        claimedAvailable.add(match);
      }
    }

    // Pass 4: Boundary-aware match, menghindari kata kunci konflik
    const conflictPrefixes = ['grafik', 'chart', 'rekap', 'masalah'];
    for (let i = 0; i < presetSheets.length; i++) {
      if (claimedPresetIndices.has(i)) continue;
      const ps = presetSheets[i];
      const psNorm = this.normalizeKey(ps.sheetName);
      const match = availableSheetNames.find((name) => {
        if (claimedAvailable.has(name)) return false;
        const nameNorm = this.normalizeKey(name);
        const hasConflict = conflictPrefixes.some(
          (p) => nameNorm.includes(p) && !psNorm.includes(p),
        );
        if (hasConflict) return false;

        const regex = new RegExp(`(^|[_\\s])${psNorm}([_\\s]|$)`, 'i');
        return regex.test(nameNorm);
      });
      if (match) {
        result.set(match, ps);
        claimedPresetIndices.add(i);
        claimedAvailable.add(match);
      }
    }

    return result;
  }

  /**
   * Pencocokan nama header preset dengan kolom yang ada.
   * Multi-pass:
   * 1. Exact match
   * 2. Normalized match
   * 3. Leaf sub-header match
   * 4. Clean alphanumeric exact match
   * 5. Duplicate suffix tolerance: misal preset memiliki "Base Name - % (4)", sheet memiliki "Base Name - % (3)"
   * 6. Token similarity / containment match
   */
  static findMatchingHeader(
    presetHeader: string,
    columns: ColumnInfo[],
  ): string | undefined {
    if (!presetHeader || columns.length === 0) {
      return undefined;
    }

    // 1. Exact match
    const exact = columns.find((c) => c.header === presetHeader);
    if (exact) return exact.header;

    // 2. Normalized match
    const normPreset = this.normalizeKey(presetHeader);
    const norm = columns.find((c) => this.normalizeKey(c.header) === normPreset);
    if (norm) return norm.header;

    // 3. Leaf sub-header match
    const leaf = columns.find(
      (c) => c.leafHeader && this.normalizeKey(c.leafHeader) === normPreset,
    );
    if (leaf) return leaf.header;

    // 4. Clean alphanumeric exact match
    const cleanPreset = this.cleanAlphanumeric(normPreset);
    const cleanExact = columns.find((c) => {
      const cleanH = this.cleanAlphanumeric(c.header);
      const cleanLeaf = c.leafHeader ? this.cleanAlphanumeric(c.leafHeader) : '';
      return cleanH === cleanPreset || cleanLeaf === cleanPreset;
    });
    if (cleanExact) return cleanExact.header;

    // 5. Toleransi nomor duplikasi suffix (misal "(4)" vs "(3)")
    const matchSuffix = presetHeader.match(/^(.*?)\s*\((\d+)\)$/);
    if (matchSuffix) {
      const baseName = matchSuffix[1].trim();
      const normBase = this.normalizeKey(baseName);
      const cleanBase = this.cleanAlphanumeric(normBase);

      const candidates = columns.filter((c) => {
        const hNorm = this.normalizeKey(c.header);
        const hClean = this.cleanAlphanumeric(hNorm);
        return (
          hNorm.startsWith(normBase) ||
          hClean.startsWith(cleanBase) ||
          (c.leafHeader && this.normalizeKey(c.leafHeader) === normBase)
        );
      });

      if (candidates.length > 0) {
        const targetNum = parseInt(matchSuffix[2], 10);
        let bestCandidate = candidates[0];
        let smallestDiff = Infinity;

        for (const cand of candidates) {
          const candMatch = cand.header.match(/\((\d+)\)$/);
          const candNum = candMatch ? parseInt(candMatch[1], 10) : 1;
          const diff = Math.abs(candNum - targetNum);
          if (diff < smallestDiff) {
            smallestDiff = diff;
            bestCandidate = cand;
          }
        }
        return bestCandidate.header;
      }
    }

    // 6. Token similarity / containment match
    const cleanMatch = columns.find((c) => {
      const cleanH = this.cleanAlphanumeric(c.header);
      const cleanLeaf = c.leafHeader ? this.cleanAlphanumeric(c.leafHeader) : '';
      return (
        cleanH === cleanPreset ||
        cleanLeaf === cleanPreset ||
        (cleanPreset.length > 3 && (cleanH.includes(cleanPreset) || cleanPreset.includes(cleanH)))
      );
    });

    return cleanMatch ? cleanMatch.header : undefined;
  }

  /**
   * Mencocokkan kolom kunci join dari preset dengan kolom yang tersedia.
   */
  static findMatchingJoinKey(
    presetJoinBy: string,
    commonCols: string[],
  ): string | undefined {
    if (!presetJoinBy || commonCols.length === 0) {
      return undefined;
    }

    const exact = commonCols.find((c) => c === presetJoinBy);
    if (exact) return exact;

    const normPreset = this.normalizeKey(presetJoinBy);
    const norm = commonCols.find((c) => this.normalizeKey(c) === normPreset);
    if (norm) return norm;

    const cleanPreset = this.cleanAlphanumeric(normPreset);
    const clean = commonCols.find(
      (c) => this.cleanAlphanumeric(c) === cleanPreset,
    );
    if (clean) return clean;

    return undefined;
  }
}
