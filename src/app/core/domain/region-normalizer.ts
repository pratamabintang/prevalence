/**
 * RegionNormalizer: Modul untuk standarisasi nama daerah/wilayah administrasi kesehatan Indonesia.
 *
 * Mengikuti aturan domain:
 * Menghilangkan awalan "Kabupaten" / "Kab." / "Kab", namun secara ketat mempertahankan "Kota"
 * agar wilayah kabupaten dan kota bernama sama (misal: "Kabupaten Magelang" vs "Kota Magelang")
 * tidak bertabrakan atau saling menimpa.
 */
export class RegionNormalizer {
  /**
   * Menghilangkan awalan kode wilayah angka (misal: "3301 - ", "33.01 - ", "3301. ", "3301 : ", "1. ", "1 - ").
   */
  static cleanCodePrefix(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value).trim();
    return str.replace(/^\s*\d+(?:[.\-_/]\d+)*(?:\s*[-–—.:)]\s*|\s+)/, '').trim();
  }

  /**
   * Menghilangkan awalan kode wilayah dan awalan "Kabupaten" / "Kab." / "Kab" pada nama daerah,
   * mempertahankan awalan "Kota".
   */
  static cleanKabupatenPrefix(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    let str = String(value).trim();
    str = this.cleanCodePrefix(str);
    const cleaned = str.replace(/^\s*(?:kabupaten|kab\b\.?|kab\.)\s*/i, '').trim();
    return cleaned || str;
  }

  /**
   * Menghasilkan key join yang dinormalisasi untuk pencocokan antar-sheet.
   */
  static normalizeJoinKey(value: unknown, stripKabupaten = true): string {
    if (value === null || value === undefined) {
      return '';
    }
    let str = String(value).trim();
    str = this.cleanCodePrefix(str);
    if (stripKabupaten) {
      str = this.cleanKabupatenPrefix(str);
    }
    return str.toLowerCase().replace(/\s+/g, ' ').trim();
  }
}
