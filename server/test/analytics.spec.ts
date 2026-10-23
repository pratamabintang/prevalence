import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { initDb, closeDb } from '../src/db/connection';
import { migrateSchema } from '../src/db/schema';
import { seedDistricts } from '../src/db/seeds';

describe('Backend API: Multi-Year Indicator Analytics Query (Seam 1)', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    const db = initDb({ inMemory: true });
    migrateSchema(db);
    seedDistricts(db);

    // Siapkan data observasi multi-periode (2025 TW3, 2025 TW4, 2026 TW1)
    db.prepare("INSERT INTO periods (id, year, quarter) VALUES (1, 2025, 'TW3'), (2, 2025, 'TW4'), (3, 2026, 'TW1')").run();

    const insertObs = db.prepare(`
      INSERT INTO period_observations (period_id, district_id, indicator_key, numeric_value, display_text)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Cilacap (id: 1, code: 3301): 14.5 -> 13.8 -> 12.4
    insertObs.run(1, 1, 'stunting_prev', 14.5, '14.5%');
    insertObs.run(2, 1, 'stunting_prev', 13.8, '13.8%');
    insertObs.run(3, 1, 'stunting_prev', 12.4, '12.4%');

    // Semarang Kota (id: 33, code: 3374): 10.0 -> 9.5 -> 8.1
    const semarangId = (db.prepare("SELECT id FROM districts WHERE code = '3374'").get() as { id: number }).id;
    insertObs.run(1, semarangId, 'stunting_prev', 10.0, '10.0%');
    insertObs.run(2, semarangId, 'stunting_prev', 9.5, '9.5%');
    insertObs.run(3, semarangId, 'stunting_prev', 8.1, '8.1%');

    // Indikator lain: ANC 6x
    insertObs.run(3, 1, 'anc_6x', 82.5, '82.5%');

    app = createApp();
  });

  afterAll(() => {
    closeDb();
  });

  it('GET /api/analytics/indicators - harus mengembalikan daftar unik seluruh indikator', async () => {
    const res = await request(app).get('/api/analytics/indicators');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.indicators).toContain('stunting_prev');
    expect(res.body.indicators).toContain('anc_6x');
  });

  it('GET /api/analytics/trends - harus menolak kueri tanpa parameter indicator', async () => {
    const res = await request(app).get('/api/analytics/trends');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('wajib disertakan');
  });

  it('GET /api/analytics/trends - harus mengembalikan deret waktu agregat tingkat provinsi', async () => {
    const res = await request(app).get('/api/analytics/trends?indicator=stunting_prev');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.scope).toBe('province');
    expect(res.body.series.length).toBe(3);

    // 2025 TW3: Cilacap (14.5) + Semarang (10.0) -> Avg = 12.25, Median = 12.25
    const tw3 = res.body.series.find((p: { year: number; quarter: string }) => p.year === 2025 && p.quarter === 'TW3');
    expect(tw3).toBeDefined();
    expect(tw3.count).toBe(2);
    expect(tw3.avgValue).toBe(12.25);
    expect(tw3.averageValue).toBe(12.25);
    expect(tw3.medianValue).toBe(12.25);
    expect(tw3.minValue).toBe(10.0);
    expect(tw3.maxValue).toBe(14.5);
    expect(tw3.totalTargeted).toBe(2);
    expect(typeof tw3.achievedCount).toBe('number');

    // 2026 TW1: Cilacap (12.4) + Semarang (8.1) -> Avg = 10.25
    const tw1 = res.body.series.find((p: { year: number; quarter: string }) => p.year === 2026 && p.quarter === 'TW1');
    expect(tw1.avgValue).toBe(10.25);
    expect(tw1.medianValue).toBe(10.25);
  });

  it('GET /api/analytics/trends - harus mengembalikan deret waktu spesifik untuk satu kabupaten/kota', async () => {
    const res = await request(app).get('/api/analytics/trends?indicator=stunting_prev&district=3301');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.scope).toBe('district');
    expect(res.body.districtCode).toBe('3301');
    expect(res.body.districtName).toBe('Kab. Cilacap');
    expect(res.body.series.length).toBe(3);

    expect(res.body.series[0].avgValue).toBe(14.5);
    expect(res.body.series[1].avgValue).toBe(13.8);
    expect(res.body.series[2].avgValue).toBe(12.4);
  });
});
