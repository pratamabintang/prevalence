import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection';

export const targetsRouter = Router();

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const ALLOWED_DATASET_KEYS = ['intervensi-spesifik', 'masalah-gizi'] as const;
type DatasetKey = (typeof ALLOWED_DATASET_KEYS)[number];
const ALLOWED_OPERATORS = ['<=', '>=', '>', '<', '=='] as const;
type TargetOperator = (typeof ALLOWED_OPERATORS)[number];

interface TargetCellInput {
  enabled?: unknown;
  operator?: unknown;
  value?: unknown;
}

function isValidDatasetKey(key: string): key is DatasetKey {
  return (ALLOWED_DATASET_KEYS as readonly string[]).includes(key);
}

function normalizeTargetCell(raw: TargetCellInput): { enabled: number; operator: TargetOperator; value: number | null } | null {
  const enabled = raw.enabled === undefined ? true : Boolean(raw.enabled);
  const operator = ALLOWED_OPERATORS.find((op) => op === raw.operator) ?? '>=';

  let value: number | null = null;
  if (raw.value !== null && raw.value !== undefined) {
    const parsed = Number(raw.value);
    if (Number.isNaN(parsed)) return null;
    value = parsed;
  }

  return { enabled: enabled ? 1 : 0, operator, value };
}

// GET /api/targets
targetsRouter.get('/targets', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db
      .prepare('SELECT year, dataset_key, column_key, enabled, operator, value FROM year_indicator_targets ORDER BY year DESC, dataset_key, column_key')
      .all() as Array<{ year: number; dataset_key: string; column_key: string; enabled: number; operator: string; value: number | null }>;

    const targets: Record<string, Record<string, Record<string, { enabled: boolean; operator: string; value: number | null }>>> = {};
    for (const row of rows) {
      const yearBucket = (targets[row.year] ??= {});
      const datasetBucket = (yearBucket[row.dataset_key] ??= {});
      datasetBucket[row.column_key] = {
        enabled: row.enabled === 1,
        operator: row.operator,
        value: row.value,
      };
    }

    return res.json({
      success: true,
      targets,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal mengambil acuan target tahunan',
    });
  }
});

// PUT /api/targets/:year
targetsRouter.put('/targets/:year', (req: Request, res: Response) => {  const year = Number(req.params.year);
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return res.status(400).json({
      success: false,
      message: `Tahun '${req.params.year}' tidak valid. Gunakan angka 4 digit antara ${MIN_YEAR} dan ${MAX_YEAR}.`,
    });
  }

  const payload = req.body;
  const incomingTargets = payload && typeof payload === 'object' ? (payload.targets ?? payload) : null;
  if (!incomingTargets || typeof incomingTargets !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Body harus berisi objek targets: { [datasetKey]: { [columnKey]: { enabled, operator, value } } }',
    });
  }

  const prepared: Array<{ dataset_key: string; column_key: string; enabled: number; operator: TargetOperator; value: number | null }> = [];
  for (const [datasetKey, columns] of Object.entries(incomingTargets as Record<string, unknown>)) {
    if (!isValidDatasetKey(datasetKey)) {
      return res.status(400).json({
        success: false,
        message: `Dataset key '${datasetKey}' tidak valid. Harus salah satu dari: ${ALLOWED_DATASET_KEYS.join(', ')}`,
      });
    }
    if (!columns || typeof columns !== 'object') {
      return res.status(400).json({
        success: false,
        message: `Target untuk dataset '${datasetKey}' harus berupa objek kolom.`,
      });
    }
    for (const [columnKey, cell] of Object.entries(columns as Record<string, unknown>)) {
      const normalized = normalizeTargetCell((cell ?? {}) as TargetCellInput);
      if (!normalized) {
        return res.status(400).json({
          success: false,
          message: `Nilai target kolom '${columnKey}' pada dataset '${datasetKey}' tidak valid.`,
        });
      }
      prepared.push({ dataset_key: datasetKey, column_key: columnKey, ...normalized });
    }
  }

  try {
    const db = getDb();
    const now = new Date().toISOString();
    const replaceYear = db.transaction((yearRows: typeof prepared) => {
      db.prepare('DELETE FROM year_indicator_targets WHERE year = ?').run(year);
      const insert = db.prepare(`
        INSERT INTO year_indicator_targets (year, dataset_key, column_key, enabled, operator, value, updated_at)
        VALUES (@year, @dataset_key, @column_key, @enabled, @operator, @value, @updated_at)
      `);
      for (const row of yearRows) {
        insert.run({ year, updated_at: now, ...row });
      }
    });
    replaceYear(prepared);

    return res.json({
      success: true,
      message: `Acuan target tahun ${year} berhasil disimpan di server.`,
      updatedAt: now,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal menyimpan acuan target tahunan',
    });
  }
});

// DELETE /api/targets/:year
targetsRouter.delete('/targets/:year', (req: Request, res: Response) => {
  const year = Number(req.params.year);
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return res.status(400).json({
      success: false,
      message: `Tahun '${req.params.year}' tidak valid. Gunakan angka 4 digit antara ${MIN_YEAR} dan ${MAX_YEAR}.`,
    });
  }

  try {
    const db = getDb();
    const info = db.prepare('DELETE FROM year_indicator_targets WHERE year = ?').run(year);

    return res.json({
      success: true,
      message:
        info.changes > 0
          ? `Acuan target tahun ${year} dihapus dari server.`
          : `Tahun ${year} tidak memiliki acuan target tersimpan.`,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal menghapus acuan target tahunan',
    });
  }
});
