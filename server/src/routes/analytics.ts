import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection';

export const analyticsRouter = Router();

export interface TrendPoint {
  year: number;
  quarter: string;
  count: number;
  avgValue: number | null;
  averageValue: number | null;
  medianValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  achievedCount: number;
  totalTargeted: number;
  districtCode?: string;
  districtName?: string;
  displayText?: string | null;
}

function computeMedian(sortedValues: number[]): number | null {
  const n = sortedValues.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) {
    return sortedValues[mid];
  }
  return Number(((sortedValues[mid - 1] + sortedValues[mid]) / 2).toFixed(2));
}

function isNegativePolarityIndicator(indicatorKey: string, standardText?: string | null): boolean {
  if (standardText && standardText.includes('<')) {
    return true;
  }
  const lower = indicatorKey.toLowerCase();
  return lower.includes('stunting') || lower.includes('wasting') || lower.includes('kematian') || lower.includes('gizi buruk');
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
    const targetRow = db
      .prepare('SELECT target_value, standard_text FROM indicator_targets WHERE indicator_key = ?')
      .get(indicatorKey) as { target_value: number; standard_text: string | null } | undefined;

    const isLowerBetter = isNegativePolarityIndicator(indicatorKey, targetRow?.standard_text);
    const evaluateAchieved = (val: number | null): boolean => {
      if (val === null || targetRow === undefined) return false;
      return isLowerBetter ? val <= targetRow.target_value : val >= targetRow.target_value;
    };

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

      const series: TrendPoint[] = rows.map((r) => ({
        year: r.year,
        quarter: r.quarter,
        count: 1,
        avgValue: r.value,
        averageValue: r.value,
        medianValue: r.value,
        minValue: r.value,
        maxValue: r.value,
        achievedCount: evaluateAchieved(r.value) ? 1 : 0,
        totalTargeted: r.value !== null ? 1 : 0,
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
    const rawObs = db.prepare(`
      SELECT
        p.year,
        p.quarter,
        po.numeric_value AS value
      FROM period_observations po
      JOIN periods p ON po.period_id = p.id
      WHERE po.indicator_key = ?
      ORDER BY p.year ASC, p.quarter ASC, po.numeric_value ASC
    `).all(indicatorKey) as Array<{
      year: number;
      quarter: string;
      value: number | null;
    }>;

    const grouped = new Map<string, { year: number; quarter: string; values: number[] }>();
    for (const row of rawObs) {
      const key = `${row.year}-${row.quarter}`;
      let entry = grouped.get(key);
      if (!entry) {
        entry = { year: row.year, quarter: row.quarter, values: [] };
        grouped.set(key, entry);
      }
      if (row.value !== null && typeof row.value === 'number' && !isNaN(row.value)) {
        entry.values.push(row.value);
      }
    }

    const series: TrendPoint[] = Array.from(grouped.values()).map((g) => {
      const sorted = [...g.values].sort((a, b) => a - b);
      const count = sorted.length;
      const avgValue = count > 0 ? Number((sorted.reduce((sum, v) => sum + v, 0) / count).toFixed(2)) : null;
      const medianValue = computeMedian(sorted);
      const minValue = count > 0 ? sorted[0] : null;
      const maxValue = count > 0 ? sorted[count - 1] : null;
      const achievedCount = sorted.filter((v) => evaluateAchieved(v)).length;

      return {
        year: g.year,
        quarter: g.quarter,
        count,
        avgValue,
        averageValue: avgValue,
        medianValue,
        minValue,
        maxValue,
        achievedCount,
        totalTargeted: count,
      };
    });

    return res.json({
      success: true,
      indicator: indicatorKey,
      scope: 'province',
      totalPeriods: series.length,
      series,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal mengeksekusi kueri analitik tren',
    });
  }
});
