import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { getDb } from '../db/connection';

export const periodsRouter = Router();

// Konfigurasi direktori uploads fisik
export function getUploadsDir(): string {
  if (process.env.UPLOADS_DIR) {
    return process.env.UPLOADS_DIR;
  }
  return path.resolve(process.cwd(), 'uploads');
}

// Multer memory storage untuk pemrosesan atomik sebelum ditulis ke disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
});

import { Database as DatabaseType } from 'better-sqlite3';

const ALLOWED_QUARTERS = ['TW1', 'TW2', 'TW3', 'TW4'] as const;
type QuarterType = (typeof ALLOWED_QUARTERS)[number];

function isValidQuarter(q: string): q is QuarterType {
  return (ALLOWED_QUARTERS as readonly string[]).includes(q.toUpperCase());
}

function calculateSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Normalisasi nama wilayah sesuai aturan Toleransi Daerah (GLOSSARY.md):
 * Menghapus awalan "Kabupaten", "Kab.", atau "Kab" tetapi mempertahankan "Kota".
 */
export function normalizeDistrictName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^kab(?:\.|upaten)?\s+/i, '')
    .replace(/\s+/g, ' ');
}

function savePeriodFile(
  db: DatabaseType,
  periodId: number,
  periodDir: string,
  fileType: 'raw' | 'result',
  file: Express.Multer.File,
  defaultFileName: string,
  diskFileName: string,
  now: string,
): void {
  const safeName = file.originalname || defaultFileName;
  const diskPath = path.join(periodDir, diskFileName);
  fs.writeFileSync(diskPath, file.buffer);

  const checksum = calculateSha256(file.buffer);
  db.prepare(`
    INSERT INTO period_files (period_id, file_type, file_name, file_path, file_size, checksum, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(period_id, file_type) DO UPDATE SET
      file_name = excluded.file_name,
      file_path = excluded.file_path,
      file_size = excluded.file_size,
      checksum = excluded.checksum,
      created_at = excluded.created_at
  `).run(periodId, fileType, safeName, diskPath, file.size, checksum, now);
}

// GET /api/periods - Daftar seluruh periode
periodsRouter.get('/periods', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        p.id,
        p.year,
        p.quarter,
        p.status,
        p.config_json,
        p.updated_at,
        MAX(CASE WHEN pf.file_type = 'raw' THEN 1 ELSE 0 END) AS hasRaw,
        MAX(CASE WHEN pf.file_type = 'result' THEN 1 ELSE 0 END) AS hasResult,
        MAX(CASE WHEN pf.file_type = 'raw' THEN pf.file_name ELSE NULL END) AS rawFileName,
        MAX(CASE WHEN pf.file_type = 'result' THEN pf.file_name ELSE NULL END) AS resultFileName,
        SUM(pf.file_size) AS totalFileSize
      FROM periods p
      LEFT JOIN period_files pf ON p.id = pf.period_id
      GROUP BY p.id, p.year, p.quarter, p.status, p.config_json, p.updated_at
      ORDER BY p.year DESC, p.quarter DESC
    `).all() as Array<{
      id: number;
      year: number;
      quarter: string;
      status: string;
      config_json: string | null;
      updated_at: string;
      hasRaw: number;
      hasResult: number;
      rawFileName: string | null;
      resultFileName: string | null;
      totalFileSize: number | null;
    }>;

    const periods = rows.map((r) => ({
      id: r.id,
      year: r.year,
      quarter: r.quarter,
      status: r.status,
      updatedAt: r.updated_at,
      hasRaw: r.hasRaw === 1,
      hasResult: r.hasResult === 1,
      hasConfig: Boolean(r.config_json),
      rawFileName: r.rawFileName || undefined,
      resultFileName: r.resultFileName || undefined,
      fileSize: r.totalFileSize || 0,
    }));

    res.json({
      success: true,
      periods,
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal mengambil daftar periode',
    });
  }
});

// GET /api/periods/:year/:quarter - Detail periode & observasi
periodsRouter.get('/periods/:year/:quarter', (req: Request, res: Response) => {
  const year = parseInt(String(req.params.year || ''), 10);
  const quarter = String(req.params.quarter || '').toUpperCase();

  if (isNaN(year) || !isValidQuarter(quarter)) {
    return res.status(400).json({
      success: false,
      message: 'Parameter tahun atau triwulan tidak valid.',
    });
  }

  try {
    const db = getDb();
    const period = db
      .prepare('SELECT id, year, quarter, status, config_json, updated_at FROM periods WHERE year = ? AND quarter = ?')
      .get(year, quarter) as {
        id: number;
        year: number;
        quarter: string;
        status: string;
        config_json: string | null;
        updated_at: string;
      } | undefined;

    if (!period) {
      return res.json({
        success: true,
        hasData: false,
        year,
        quarter,
        message: 'Periode belum memiliki data.',
      });
    }

    // Ambil metadata berkas
    const files = db
      .prepare('SELECT file_type, file_name, file_size, checksum, created_at FROM period_files WHERE period_id = ?')
      .all(period.id) as Array<{
        file_type: string;
        file_name: string;
        file_size: number;
        checksum: string;
        created_at: string;
      }>;

    // Ambil baris observasi per wilayah
    const obsRows = db.prepare(`
      SELECT
        d.code as districtCode,
        d.name as districtName,
        d.type as districtType,
        po.indicator_key,
        po.numeric_value,
        po.display_text
      FROM period_observations po
      JOIN districts d ON po.district_id = d.id
      WHERE po.period_id = ?
      ORDER BY d.code ASC, po.indicator_key ASC
    `).all(period.id) as Array<{
      districtCode: string;
      districtName: string;
      districtType: string;
      indicator_key: string;
      numeric_value: number | null;
      display_text: string | null;
    }>;

    const hasRaw = files.some((f) => f.file_type === 'raw');
    const hasResult = files.some((f) => f.file_type === 'result');

    let parsedConfig: unknown = undefined;
    if (period.config_json) {
      try {
        parsedConfig = JSON.parse(period.config_json);
      } catch {
        parsedConfig = undefined;
      }
    }

    return res.json({
      success: true,
      hasData: true,
      year: period.year,
      quarter: period.quarter,
      status: period.status,
      updatedAt: period.updated_at,
      hasRaw,
      hasResult,
      files,
      config: parsedConfig,
      observationsCount: obsRows.length,
      observations: obsRows,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal memuat rincian periode',
    });
  }
});

// GET /api/periods/:year/:quarter/download/:type - Unduh berkas fisik biner
periodsRouter.get('/periods/:year/:quarter/download/:type', (req: Request, res: Response) => {
  const year = parseInt(String(req.params.year || ''), 10);
  const quarter = String(req.params.quarter || '').toUpperCase();
  const type = String(req.params.type || '').toLowerCase();

  if (isNaN(year) || !isValidQuarter(quarter) || (type !== 'raw' && type !== 'result')) {
    return res.status(400).json({
      success: false,
      message: 'Parameter unduhan tidak valid. Tipe berkas harus "raw" atau "result".',
    });
  }

  try {
    const db = getDb();
    const period = db
      .prepare('SELECT id FROM periods WHERE year = ? AND quarter = ?')
      .get(year, quarter) as { id: number } | undefined;

    if (!period) {
      return res.status(404).json({
        success: false,
        message: 'Periode tidak ditemukan.',
      });
    }

    const fileRow = db
      .prepare('SELECT file_name, file_path FROM period_files WHERE period_id = ? AND file_type = ?')
      .get(period.id, type) as { file_name: string; file_path: string } | undefined;

    if (!fileRow || !fs.existsSync(fileRow.file_path)) {
      return res.status(404).json({
        success: false,
        message: `Berkas '${type}' untuk periode ${year} ${quarter} tidak ditemukan di server.`,
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileRow.file_name}"`);
    const fileStream = fs.createReadStream(fileRow.file_path);
    return fileStream.pipe(res);
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal mengunduh berkas',
    });
  }
});

// POST /api/periods/:year/:quarter - Simpan berkas & ekstrak observasi
periodsRouter.post(
  '/periods/:year/:quarter',
  upload.fields([
    { name: 'rawFile', maxCount: 1 },
    { name: 'resultFile', maxCount: 1 },
  ]),
  (req: Request, res: Response) => {
    const year = parseInt(String(req.params.year || ''), 10);
    const quarter = String(req.params.quarter || '').toUpperCase();

    if (isNaN(year) || !isValidQuarter(quarter)) {
      return res.status(400).json({
        success: false,
        message: 'Parameter tahun atau triwulan tidak valid.',
      });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const rawFile = files?.['rawFile']?.[0];
    const resultFile = files?.['resultFile']?.[0];

    if (!rawFile && !resultFile) {
      return res.status(400).json({
        success: false,
        message: 'Harus menyertakan setidaknya berkas rawFile atau resultFile.',
      });
    }

    const db = getDb();
    const uploadsBase = getUploadsDir();
    const periodDir = path.join(uploadsBase, String(year), quarter);

    try {
      if (!fs.existsSync(periodDir)) {
        fs.mkdirSync(periodDir, { recursive: true });
      }

      const now = new Date().toISOString();

      const rawConfig = req.body?.config ?? req.body?.configJson;
      let serializedConfig: string | null = null;
      if (rawConfig !== undefined && rawConfig !== null && rawConfig !== '') {
        serializedConfig = typeof rawConfig === 'string' ? rawConfig : JSON.stringify(rawConfig);
      }

      // Transaksi atomik database
      const saveTransaction = db.transaction(() => {
        // 1. Upsert Periode
        db.prepare(`
          INSERT INTO periods (year, quarter, status, config_json, updated_at)
          VALUES (?, ?, 'active', ?, ?)
          ON CONFLICT(year, quarter) DO UPDATE SET
            config_json = COALESCE(excluded.config_json, periods.config_json),
            updated_at = excluded.updated_at
        `).run(year, quarter, serializedConfig, now);

        const periodRow = db
          .prepare('SELECT id FROM periods WHERE year = ? AND quarter = ?')
          .get(year, quarter) as { id: number };
        const periodId = periodRow.id;

        // 2. Simpan Raw File jika ada
        if (rawFile) {
          savePeriodFile(
            db,
            periodId,
            periodDir,
            'raw',
            rawFile,
            `raw-data-${year}-${quarter}.xlsx`,
            'raw-data.xlsx',
            now,
          );
        }

        // 3. Simpan Result File jika ada
        if (resultFile) {
          savePeriodFile(
            db,
            periodId,
            periodDir,
            'result',
            resultFile,
            `joined-result-${year}-${quarter}.xlsx`,
            'joined-result.xlsx',
            now,
          );
        }

        // 4. Ingesti baris observasi jika disediakan dalam body
        const rawObservations = req.body.observations;
        if (rawObservations) {
          let obsList: Array<{
            districtCode?: string;
            districtName?: string;
            indicatorKey: string;
            numericValue: number | null;
            displayText?: string;
          }> = [];

          try {
            obsList = typeof rawObservations === 'string' ? JSON.parse(rawObservations) : rawObservations;
          } catch {
            // Abaikan error parse jika format string bukan JSON
          }

          if (Array.isArray(obsList) && obsList.length > 0) {
            // Ambil peta seluruh wilayah untuk pemadanan id (termasuk Toleransi Daerah)
            const districtMap = new Map<string, number>();
            const districts = db.prepare('SELECT id, code, name FROM districts').all() as Array<{
              id: number;
              code: string;
              name: string;
            }>;
            districts.forEach((d) => {
              districtMap.set(d.code, d.id);
              districtMap.set(d.name.toLowerCase().trim(), d.id);
              districtMap.set(normalizeDistrictName(d.name), d.id);
            });

            const insertObs = db.prepare(`
              INSERT INTO period_observations (period_id, district_id, indicator_key, numeric_value, display_text)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(period_id, district_id, indicator_key) DO UPDATE SET
                numeric_value = excluded.numeric_value,
                display_text = excluded.display_text
            `);

            for (const item of obsList) {
              const dId =
                (item.districtCode && districtMap.get(item.districtCode)) ||
                (item.districtName &&
                  (districtMap.get(item.districtName.toLowerCase().trim()) ||
                    districtMap.get(normalizeDistrictName(item.districtName))));

              if (dId && item.indicatorKey) {
                insertObs.run(
                  periodId,
                  dId,
                  item.indicatorKey,
                  item.numericValue !== undefined ? item.numericValue : null,
                  item.displayText || null
                );
              }
            }
          }
        }

        return periodId;
      });

      const periodId = saveTransaction();

      return res.json({
        success: true,
        message: `Periode ${year} ${quarter} berhasil disimpan ke server.`,
        periodId,
        year,
        quarter,
        updatedAt: now,
      });
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : 'Gagal menyimpan periode ke server',
      });
    }
  }
);
