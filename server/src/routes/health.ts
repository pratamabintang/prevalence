import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    // Periksa status WAL mode
    const pragmaRow = db.pragma('journal_mode', { simple: true });
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      walMode: pragmaRow === 'wal',
      journalMode: pragmaRow,
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (err: unknown) {
    res.status(500).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Database check failed',
      timestamp: new Date().toISOString(),
    });
  }
});
