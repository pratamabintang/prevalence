import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection';

export const configsRouter = Router();

const ALLOWED_CONFIG_TYPES = ['join', 'chart', 'stunting'] as const;
type ConfigType = (typeof ALLOWED_CONFIG_TYPES)[number];

function isValidConfigType(type: string): type is ConfigType {
  return (ALLOWED_CONFIG_TYPES as readonly string[]).includes(type);
}

// GET /api/configs/:type
configsRouter.get('/configs/:type', (req: Request, res: Response) => {
  const type = String(req.params.type || '');

  if (!isValidConfigType(type)) {
    return res.status(400).json({
      success: false,
      message: `Tipe konfigurasi '${type}' tidak valid. Harus salah satu dari: ${ALLOWED_CONFIG_TYPES.join(', ')}`,
    });
  }

  try {
    const db = getDb();
    const row = db
      .prepare('SELECT payload_json, updated_at FROM configurations WHERE config_type = ?')
      .get(type) as { payload_json: string; updated_at: string } | undefined;

    if (!row) {
      return res.json({
        success: true,
        hasConfig: false,
        config: null,
      });
    }

    let parsedConfig: unknown = null;
    try {
      parsedConfig = JSON.parse(row.payload_json);
    } catch {
      parsedConfig = row.payload_json;
    }

    return res.json({
      success: true,
      hasConfig: true,
      config: parsedConfig,
      updatedAt: row.updated_at,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal mengambil konfigurasi preset',
    });
  }
});

// PUT /api/configs/:type
configsRouter.put('/configs/:type', (req: Request, res: Response) => {
  const type = String(req.params.type || '');

  if (!isValidConfigType(type)) {
    return res.status(400).json({
      success: false,
      message: `Tipe konfigurasi '${type}' tidak valid. Harus salah satu dari: ${ALLOWED_CONFIG_TYPES.join(', ')}`,
    });
  }

  const payload = req.body;
  if (!payload || (typeof payload !== 'object' && typeof payload !== 'string')) {
    return res.status(400).json({
      success: false,
      message: 'Body konfigurasi harus berupa JSON object yang valid',
    });
  }

  const jsonString = typeof payload === 'string' ? payload : JSON.stringify(payload);

  try {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO configurations (config_type, payload_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(config_type) DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `).run(type, jsonString, now);

    return res.json({
      success: true,
      message: `Konfigurasi preset '${type}' berhasil disimpan di server.`,
      updatedAt: now,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi preset',
    });
  }
});
