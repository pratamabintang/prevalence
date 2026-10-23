import { Database as DatabaseType } from 'better-sqlite3';

/**
 * Menjalankan migrasi DDL ke database SQLite.
 */
export function migrateSchema(db: DatabaseType): void {
  db.exec(`
    -- 1. Master Wilayah (35 Kabupaten/Kota Jawa Tengah)
    CREATE TABLE IF NOT EXISTS districts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('KAB', 'KOTA')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Manajemen Periode Triwulan
    CREATE TABLE IF NOT EXISTS periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      quarter TEXT NOT NULL CHECK(quarter IN ('TW1', 'TW2', 'TW3', 'TW4')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived', 'draft')),
      config_json TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, quarter)
    );

    -- 3. Metadata Berkas Spreadsheet Fisik di Server
    CREATE TABLE IF NOT EXISTS period_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
      file_type TEXT NOT NULL CHECK(file_type IN ('raw', 'result')),
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      checksum TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(period_id, file_type)
    );

    -- 4. Observasi Indikator Capaian Kesehatan (Per Sel Data)
    CREATE TABLE IF NOT EXISTS period_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
      district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
      indicator_key TEXT NOT NULL,
      numeric_value REAL,
      display_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(period_id, district_id, indicator_key)
    );

    -- 5. Target Acuan Operasional Indikator
    CREATE TABLE IF NOT EXISTS indicator_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indicator_key TEXT UNIQUE NOT NULL,
      target_value REAL NOT NULL,
      standard_text TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. Konfigurasi Preset Terpusat (Join, Chart, Stunting)
    CREATE TABLE IF NOT EXISTS configurations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_type TEXT UNIQUE NOT NULL CHECK(config_type IN ('join', 'chart', 'stunting')),
      payload_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 7. Metadata Berkas & Konfigurasi Default Kustom (Singleton Row id = 1)
    CREATE TABLE IF NOT EXISTS custom_defaults (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      checksum TEXT,
      config_json TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indeks performa untuk kueri observasi dan tren
    CREATE INDEX IF NOT EXISTS idx_obs_period_district ON period_observations(period_id, district_id);
    CREATE INDEX IF NOT EXISTS idx_obs_indicator ON period_observations(indicator_key);
  `);
}
