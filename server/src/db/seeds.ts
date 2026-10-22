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

export interface IndicatorTargetSeed {
  indicator_key: string;
  target_value: number;
  standard_text: string;
}

export const STANDARD_INDICATOR_TARGETS: IndicatorTargetSeed[] = [
  { indicator_key: 'Stunting %', target_value: 14.0, standard_text: 'RPJMN Target < 14%' },
  { indicator_key: 'Wasting %', target_value: 7.0, standard_text: 'RPJMN Target < 7%' },
  { indicator_key: 'ASI Eksklusif %', target_value: 80.0, standard_text: 'Renstra Kemenkes >= 80%' },
  { indicator_key: 'D/S %', target_value: 85.0, standard_text: 'Partisipasi Posyandu >= 85%' },
  { indicator_key: 'K4 %', target_value: 95.0, standard_text: 'Kunjungan Antenatal >= 95%' },
  { indicator_key: 'Imunisasi Dasar Lengkap %', target_value: 90.0, standard_text: 'IDL Nasional >= 90%' },
];

/**
 * Melakukan inisialisasi awal master 35 Kabupaten/Kota Jawa Tengah dan target indikator standar jika belum ada.
 */
export function seedDistricts(db: DatabaseType): void {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM districts').get() as { cnt: number };
  if (!countRow || countRow.cnt < 35) {
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

  seedIndicatorTargets(db);
}

/**
 * Melakukan seeding target acuan operasional indikator kesehatan standar.
 */
export function seedIndicatorTargets(db: DatabaseType): void {
  const insertTarget = db.prepare(`
    INSERT OR IGNORE INTO indicator_targets (indicator_key, target_value, standard_text)
    VALUES (@indicator_key, @target_value, @standard_text)
  `);

  const runTargetSeed = db.transaction((targets: IndicatorTargetSeed[]) => {
    for (const t of targets) {
      insertTarget.run(t);
    }
  });

  runTargetSeed(STANDARD_INDICATOR_TARGETS);
}
