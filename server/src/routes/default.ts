import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { getDb } from '../db/connection';
import { getUploadsDir } from './periods';

export const defaultRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
});

interface CustomDefaultRow {
  id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  checksum: string | null;
  config_json: string | null;
  updated_at: string;
}

function getDefaultDir(): string {
  return path.join(getUploadsDir(), 'default');
}

function getDefaultExcelPath(): string {
  return path.join(getDefaultDir(), 'default-join-data.xlsx');
}

function calculateSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// GET /api/default - Mengambil metadata Default Kustom dari SQLite
defaultRouter.get('/default', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const row = db
      .prepare(
        'SELECT id, file_name, file_path, file_size, checksum, config_json, updated_at FROM custom_defaults WHERE id = 1',
      )
      .get() as CustomDefaultRow | undefined;

    if (!row || !fs.existsSync(row.file_path)) {
      return res.json({
        success: true,
        hasData: false,
        message: 'Belum ada Default Kustom yang tersimpan di server.',
      });
    }

    let parsedConfig: unknown = undefined;
    if (row.config_json) {
      try {
        parsedConfig = JSON.parse(row.config_json);
      } catch {
        parsedConfig = undefined;
      }
    }

    return res.json({
      success: true,
      hasData: true,
      fileName: row.file_name || 'default-join-data.xlsx',
      config: parsedConfig,
      updatedAt: row.updated_at,
      fileSize: row.file_size,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      hasData: false,
      message: err instanceof Error ? err.message : 'Gagal membaca metadata Default Kustom',
    });
  }
});

// GET /api/default/download - Mengunduh berkas biner .xlsx Default Kustom
defaultRouter.get('/default/download', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const row = db
      .prepare('SELECT file_name, file_path FROM custom_defaults WHERE id = 1')
      .get() as { file_name: string; file_path: string } | undefined;

    const excelPath = row?.file_path || getDefaultExcelPath();
    if (!fs.existsSync(excelPath)) {
      return res.status(404).json({
        success: false,
        message: 'Berkas Default Kustom tidak ditemukan di server.',
      });
    }

    const fileName = row?.file_name || 'default-join-data.xlsx';
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.sendFile(excelPath);
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal mengunduh berkas Default Kustom',
    });
  }
});

// POST /api/default - Menyimpan berkas .xlsx & Preset Konfigurasi Dinkes sebagai Default Kustom di SQLite + Disk
defaultRouter.post(
  '/default',
  upload.single('excelFile'),
  (req: Request, res: Response) => {
    const file = req.file;
    if (!file || !file.buffer || file.buffer.byteLength === 0) {
      return res.status(400).json({
        success: false,
        message: 'Berkas Excel wajib disertakan (excelFile).',
      });
    }

    const rawConfigField = req.body?.configJson ?? req.body?.config;
    let configJsonStr: string | null = null;
    if (rawConfigField !== undefined && rawConfigField !== null && rawConfigField !== '') {
      try {
        const parsed =
          typeof rawConfigField === 'string' ? JSON.parse(rawConfigField) : rawConfigField;
        configJsonStr = JSON.stringify(parsed);
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Format JSON konfigurasi tidak valid.',
        });
      }
    }

    try {
      const defaultDir = getDefaultDir();
      fs.mkdirSync(defaultDir, { recursive: true });

      const now = new Date().toISOString();
      const fileName = String(req.body?.fileName || file.originalname || 'default-join-data.xlsx');
      const excelPath = getDefaultExcelPath();
      const checksum = calculateSha256(file.buffer);

      fs.writeFileSync(excelPath, file.buffer);

      const db = getDb();
      db.prepare(`
        INSERT INTO custom_defaults (id, file_name, file_path, file_size, checksum, config_json, updated_at)
        VALUES (1, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          file_name = excluded.file_name,
          file_path = excluded.file_path,
          file_size = excluded.file_size,
          checksum = excluded.checksum,
          config_json = excluded.config_json,
          updated_at = excluded.updated_at
      `).run(fileName, excelPath, file.size, checksum, configJsonStr, now);

      return res.json({
        success: true,
        message: 'Berkas Excel dan konfigurasi Default Kustom berhasil disimpan di Server Database.',
        updatedAt: now,
      });
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : 'Gagal menyimpan Default Kustom di server',
      });
    }
  },
);

// DELETE /api/default - Menghapus Default Kustom dari disk dan SQLite tanpa menghapus konfigurasi preset join mandiri
defaultRouter.delete('/default', (_req: Request, res: Response) => {
  try {
    const defaultDir = getDefaultDir();
    if (fs.existsSync(defaultDir)) {
      fs.rmSync(defaultDir, { recursive: true, force: true });
    }

    const db = getDb();
    db.prepare('DELETE FROM custom_defaults WHERE id = 1').run();

    return res.json({
      success: true,
      message: 'Default Kustom di server berhasil dihapus dan dikembalikan ke Bawaan Sistem.',
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal menghapus Default Kustom di server',
    });
  }
});
