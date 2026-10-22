import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection';

export const districtsRouter = Router();

districtsRouter.get('/districts', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT id, code, name, type FROM districts ORDER BY code ASC').all();
    res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to query districts',
    });
  }
});
