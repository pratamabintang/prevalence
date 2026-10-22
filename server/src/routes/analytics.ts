import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection';

export const analyticsRouter = Router();

export interface TrendPoint {
  year: number;
  quarter: string;
  count: number;
  avgValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  districtCode?: string;
  districtName?: string;
}

// GET /api/analytics/indicators - Mengambil daftar seluruh indikator yang tersedia dalam observasi
analyticsRouter.get('/analytics/indicators', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT DISTINCT indicator_key
      FROM period_observations
      ORDER BY indicator_key ASC
    `).all() as Array<{ indicator_key: string }>;

    res.json({
      success: true,
      indicators: rows.map((r) => r.indicator_key),
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal mengambil daftar indikator',
    });
  }
});

// GET /api/analytics/trends?indicator=...&district=...
analyticsRouter.get('/analytics/trends', (req: Request, res: Response) => {
  const indicatorKey = typeof req.query.indicator === 'string' ? req.query.indicator.trim() : '';
  const districtCode = typeof req.query.district === 'string' ? req.query.district.trim() : '';

  if (!indicatorKey) {
    return res.status(400).json({
      success: false,
      message: 'Parameter kueri "indicator" wajib disertakan.',
    });
  }

  try {
    const db = getDb();

    if (districtCode) {
      // Tren spesifik satu kabupaten/kota
      const rows = db.prepare(`
        SELECT
          p.year,
          p.quarter,
          d.code AS districtCode,
          d.name AS districtName,
          po.numeric_value AS value,
          po.display_text AS displayText
        FROM period_observations po
        JOIN periods p ON po.period_id = p.id
        JOIN districts d ON po.district_id = d.id
        WHERE po.indicator_key = ? AND d.code = ?
        ORDER BY p.year ASC, p.quarter ASC
      `).all(indicatorKey, districtCode) as Array<{
        year: number;
        quarter: string;
        districtCode: string;
        districtName: string;
        value: number | null;
        displayText: string | null;
      }>;

      const series = rows.map((r) => ({
        year: r.year,
        quarter: r.quarter,
        count: 1,
        avgValue: r.value,
        minValue: r.value,
        maxValue: r.value,
        districtCode: r.districtCode,
        districtName: r.districtName,
        displayText: r.displayText,
      }));

      return res.json({
        success: true,
        indicator: indicatorKey,
        scope: 'district',
        districtCode,
        districtName: rows[0]?.districtName || '',
        totalPeriods: series.length,
        series,
      });
    }

    // Agregasi seluruh provinsi Jawa Tengah (semua kabupaten/kota)
    const rows = db.prepare(`
      SELECT
        p.year,
        p.quarter,
        COUNT(po.numeric_value) AS count,
        ROUND(AVG(po.numeric_value), 2) AS avgValue,
        MIN(po.numeric_value) AS minValue,
        MAX(po.numeric_value) AS maxValue
      FROM period_observations po
      JOIN periods p ON po.period_id = p.id
      WHERE po.indicator_key = ?
      GROUP BY p.year, p.quarter
      ORDER BY p.year ASC, p.quarter ASC
    `).all(indicatorKey) as Array<{
      year: number;
      quarter: string;
      count: number;
      avgValue: number | null;
      minValue: number | null;
      maxValue: number | null;
    }>;

    return res.json({
      success: true,
      indicator: indicatorKey,
      scope: 'province',
      totalPeriods: rows.length,
      series: rows,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal mengeksekusi kueri analitik tren',
    });
  }
});
