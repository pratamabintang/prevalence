import { Database as DatabaseType } from 'better-sqlite3';

export interface DistrictSeed {
  code: string;
  name: string;
  type: 'KAB' | 'KOTA';
}

export const CENTRAL_JAVA_DISTRICTS: DistrictSeed[] = [
  { code: '3301', name: 'Kab. Cilacap', type: 'KAB' },
  { code: '3302', name: 'Kab. Banyumas', type: 'KAB' },
  { code: '3303', name: 'Kab. Purbalingga', type: 'KAB' },
  { code: '3304', name: 'Kab. Banjarnegara', type: 'KAB' },
  { code: '3305', name: 'Kab. Kebumen', type: 'KAB' },
  { code: '3306', name: 'Kab. Purworejo', type: 'KAB' },
  { code: '3307', name: 'Kab. Wonosobo', type: 'KAB' },
  { code: '3308', name: 'Kab. Magelang', type: 'KAB' },
  { code: '3309', name: 'Kab. Boyolali', type: 'KAB' },
  { code: '3310', name: 'Kab. Klaten', type: 'KAB' },
  { code: '3311', name: 'Kab. Sukoharjo', type: 'KAB' },
  { code: '3312', name: 'Kab. Wonogiri', type: 'KAB' },
  { code: '3313', name: 'Kab. Karanganyar', type: 'KAB' },
  { code: '3314', name: 'Kab. Sragen', type: 'KAB' },
  { code: '3315', name: 'Kab. Grobogan', type: 'KAB' },
  { code: '3316', name: 'Kab. Blora', type: 'KAB' },
  { code: '3317', name: 'Kab. Rembang', type: 'KAB' },
  { code: '3318', name: 'Kab. Pati', type: 'KAB' },
  { code: '3319', name: 'Kab. Kudus', type: 'KAB' },
  { code: '3320', name: 'Kab. Jepara', type: 'KAB' },
  { code: '3321', name: 'Kab. Demak', type: 'KAB' },
  { code: '3322', name: 'Kab. Semarang', type: 'KAB' },
  { code: '3323', name: 'Kab. Temanggung', type: 'KAB' },
  { code: '3324', name: 'Kab. Kendal', type: 'KAB' },
  { code: '3325', name: 'Kab. Batang', type: 'KAB' },
  { code: '3326', name: 'Kab. Pekalongan', type: 'KAB' },
  { code: '3327', name: 'Kab. Pemalang', type: 'KAB' },
  { code: '3328', name: 'Kab. Tegal', type: 'KAB' },
  { code: '3329', name: 'Kab. Brebes', type: 'KAB' },
  { code: '3371', name: 'Kota Magelang', type: 'KOTA' },
  { code: '3372', name: 'Kota Surakarta', type: 'KOTA' },
  { code: '3373', name: 'Kota Salatiga', type: 'KOTA' },
  { code: '3374', name: 'Kota Semarang', type: 'KOTA' },
  { code: '3375', name: 'Kota Pekalongan', type: 'KOTA' },
  { code: '3376', name: 'Kota Tegal', type: 'KOTA' },
];

/**
 * Melakukan inisialisasi awal master 35 Kabupaten/Kota Jawa Tengah jika belum ada.
 */
export function seedDistricts(db: DatabaseType): void {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM districts').get() as { cnt: number };
  if (countRow && countRow.cnt >= 35) {
    return;
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO districts (code, name, type)
    VALUES (@code, @name, @type)
  `);

  const runSeed = db.transaction((districts: DistrictSeed[]) => {
    for (const d of districts) {
      insert.run(d);
    }
  });

  runSeed(CENTRAL_JAVA_DISTRICTS);
}
