import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let dbInstance: DatabaseType | null = null;

export interface DbConnectionOptions {
  dbPath?: string;
  inMemory?: boolean;
}

/**
 * Mendapatkan jalur berkas database default.
 * Membaca dari environment DB_PATH atau './data/dinkes.db'.
 */
export function getDefaultDbPath(): string {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }
  return path.resolve(process.cwd(), 'data', 'dinkes.db');
}

/**
 * Menginisialisasi koneksi SQLite dengan konfigurasi PRAGMA berperforma tinggi.
 */
export function initDb(options?: DbConnectionOptions): DatabaseType {
  const isMemory = options?.inMemory || options?.dbPath === ':memory:';
  const targetPath = isMemory ? ':memory:' : (options?.dbPath || getDefaultDbPath());

  if (!isMemory) {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(targetPath);

  // Aktifkan foreign keys
  db.pragma('foreign_keys = ON');

  // Konfigurasi performa WAL hanya untuk berkas disk (bukan in-memory)
  if (!isMemory) {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
  }

  dbInstance = db;
  return db;
}

/**
 * Mengambil instans database aktif.
 * Menginisialisasi dengan konfigurasi default jika belum dibuat.
 */
export function getDb(): DatabaseType {
  if (!dbInstance) {
    return initDb();
  }
  return dbInstance;
}

/**
 * Menutup koneksi database.
 */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
