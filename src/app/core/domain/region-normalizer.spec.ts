import { describe, expect, it } from 'vitest';
import { RegionNormalizer } from './region-normalizer';

describe('RegionNormalizer', () => {
  describe('cleanCodePrefix', () => {
    it('should strip BPS/Kemendagri numeric codes and hyphens/separators', () => {
      expect(RegionNormalizer.cleanCodePrefix('3301 - KAB. CILACAP')).toBe('KAB. CILACAP');
      expect(RegionNormalizer.cleanCodePrefix('33.01 - KAB. CILACAP')).toBe('KAB. CILACAP');
      expect(RegionNormalizer.cleanCodePrefix('3301. KAB. CILACAP')).toBe('KAB. CILACAP');
      expect(RegionNormalizer.cleanCodePrefix('3301-KAB. CILACAP')).toBe('KAB. CILACAP');
      expect(RegionNormalizer.cleanCodePrefix('3371 - KOTA MAGELANG')).toBe('KOTA MAGELANG');
      expect(RegionNormalizer.cleanCodePrefix('1 - KAB. CILACAP')).toBe('KAB. CILACAP');
      expect(RegionNormalizer.cleanCodePrefix('1. KAB. CILACAP')).toBe('KAB. CILACAP');
      expect(RegionNormalizer.cleanCodePrefix('CILACAP')).toBe('CILACAP');
      expect(RegionNormalizer.cleanCodePrefix('KAB. CILACAP')).toBe('KAB. CILACAP');
    });

    it('should handle null, undefined, or empty values safely', () => {
      expect(RegionNormalizer.cleanCodePrefix(null)).toBe('');
      expect(RegionNormalizer.cleanCodePrefix(undefined)).toBe('');
      expect(RegionNormalizer.cleanCodePrefix('')).toBe('');
    });
  });

  describe('cleanKabupatenPrefix', () => {
    it('should strip both code and Kabupaten prefix while preserving Kota', () => {
      expect(RegionNormalizer.cleanKabupatenPrefix('3301 - KAB. CILACAP')).toBe('CILACAP');
      expect(RegionNormalizer.cleanKabupatenPrefix('3308 - KAB. MAGELANG')).toBe('MAGELANG');
      expect(RegionNormalizer.cleanKabupatenPrefix('3371 - KOTA MAGELANG')).toBe('KOTA MAGELANG');
      expect(RegionNormalizer.cleanKabupatenPrefix('3328 - KAB. TEGAL')).toBe('TEGAL');
      expect(RegionNormalizer.cleanKabupatenPrefix('3376 - KOTA TEGAL')).toBe('KOTA TEGAL');
    });

    it('should cleanly strip all 35 Central Java districts with new BPS code format', () => {
      const userInputs = [
        { raw: '3301 - KAB. CILACAP', expected: 'CILACAP' },
        { raw: '3302 - KAB. BANYUMAS', expected: 'BANYUMAS' },
        { raw: '3303 - KAB. PURBALINGGA', expected: 'PURBALINGGA' },
        { raw: '3304 - KAB. BANJARNEGARA', expected: 'BANJARNEGARA' },
        { raw: '3305 - KAB. KEBUMEN', expected: 'KEBUMEN' },
        { raw: '3306 - KAB. PURWOREJO', expected: 'PURWOREJO' },
        { raw: '3307 - KAB. WONOSOBO', expected: 'WONOSOBO' },
        { raw: '3308 - KAB. MAGELANG', expected: 'MAGELANG' },
        { raw: '3309 - KAB. BOYOLALI', expected: 'BOYOLALI' },
        { raw: '3310 - KAB. KLATEN', expected: 'KLATEN' },
        { raw: '3311 - KAB. SUKOHARJO', expected: 'SUKOHARJO' },
        { raw: '3312 - KAB. WONOGIRI', expected: 'WONOGIRI' },
        { raw: '3313 - KAB. KARANGANYAR', expected: 'KARANGANYAR' },
        { raw: '3314 - KAB. SRAGEN', expected: 'SRAGEN' },
        { raw: '3315 - KAB. GROBOGAN', expected: 'GROBOGAN' },
        { raw: '3316 - KAB. BLORA', expected: 'BLORA' },
        { raw: '3317 - KAB. REMBANG', expected: 'REMBANG' },
        { raw: '3318 - KAB. PATI', expected: 'PATI' },
        { raw: '3319 - KAB. KUDUS', expected: 'KUDUS' },
        { raw: '3320 - KAB. JEPARA', expected: 'JEPARA' },
        { raw: '3321 - KAB. DEMAK', expected: 'DEMAK' },
        { raw: '3322 - KAB. SEMARANG', expected: 'SEMARANG' },
        { raw: '3323 - KAB. TEMANGGUNG', expected: 'TEMANGGUNG' },
        { raw: '3324 - KAB. KENDAL', expected: 'KENDAL' },
        { raw: '3325 - KAB. BATANG', expected: 'BATANG' },
        { raw: '3326 - KAB. PEKALONGAN', expected: 'PEKALONGAN' },
        { raw: '3327 - KAB. PEMALANG', expected: 'PEMALANG' },
        { raw: '3328 - KAB. TEGAL', expected: 'TEGAL' },
        { raw: '3329 - KAB. BREBES', expected: 'BREBES' },
        { raw: '3371 - KOTA MAGELANG', expected: 'KOTA MAGELANG' },
        { raw: '3372 - KOTA SURAKARTA', expected: 'KOTA SURAKARTA' },
        { raw: '3373 - KOTA SALATIGA', expected: 'KOTA SALATIGA' },
        { raw: '3374 - KOTA SEMARANG', expected: 'KOTA SEMARANG' },
        { raw: '3375 - KOTA PEKALONGAN', expected: 'KOTA PEKALONGAN' },
        { raw: '3376 - KOTA TEGAL', expected: 'KOTA TEGAL' },
      ];

      for (const item of userInputs) {
        expect(RegionNormalizer.cleanKabupatenPrefix(item.raw)).toBe(item.expected);
      }
    });
  });

  describe('normalizeJoinKey', () => {
    it('should produce identical join keys across various input formats', () => {
      const cilacapVariants = [
        '3301 - KAB. CILACAP',
        'KAB. CILACAP',
        'KABUPATEN CILACAP',
        'Kab. Cilacap',
        'CILACAP',
        'cilacap',
      ];

      const expectedKey = 'cilacap';
      for (const variant of cilacapVariants) {
        expect(RegionNormalizer.normalizeJoinKey(variant, true)).toBe(expectedKey);
      }
    });

    it('should distinguish between Kabupaten and Kota with identical city names', () => {
      const kabMagelangKey = RegionNormalizer.normalizeJoinKey('3308 - KAB. MAGELANG', true);
      const kotaMagelangKey = RegionNormalizer.normalizeJoinKey('3371 - KOTA MAGELANG', true);

      expect(kabMagelangKey).toBe('magelang');
      expect(kotaMagelangKey).toBe('kota magelang');
      expect(kabMagelangKey).not.toBe(kotaMagelangKey);

      const kabTegalKey = RegionNormalizer.normalizeJoinKey('3328 - KAB. TEGAL', true);
      const kotaTegalKey = RegionNormalizer.normalizeJoinKey('3376 - KOTA TEGAL', true);

      expect(kabTegalKey).toBe('tegal');
      expect(kotaTegalKey).toBe('kota tegal');
      expect(kabTegalKey).not.toBe(kotaTegalKey);
    });
  });
});
