import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { initDb, closeDb } from '../src/db/connection';
import { migrateSchema } from '../src/db/schema';

describe('Backend API: Configurations Preset Persistence (Seam 1)', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    const db = initDb({ inMemory: true });
    migrateSchema(db);
    app = createApp();
  });

  afterAll(() => {
    closeDb();
  });

  it('harus mengembalikan hasConfig false untuk preset yang belum pernah disimpan', async () => {
    const res = await request(app).get('/api/configs/join');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.hasConfig).toBe(false);
    expect(res.body.config).toBeNull();
  });

  it('harus menolak tipe konfigurasi yang tidak valid dengan status 400', async () => {
    const res = await request(app).get('/api/configs/invalid-type');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('tidak valid');
  });

  it('harus dapat menyimpan preset konfigurasi join baru via PUT', async () => {
    const mockJoinConfig = {
      sheetMappings: { Sheet1: { joinKey: 'KABUPATEN' } },
      columnConfigs: { 'Balita D/S': { dataType: 'percentage', target: 80 } },
    };

    const res = await request(app)
      .put('/api/configs/join')
      .send(mockJoinConfig);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.updatedAt).toBeDefined();

    // Verifikasi pembacaan ulang via GET
    const getRes = await request(app).get('/api/configs/join');
    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.hasConfig).toBe(true);
    expect(getRes.body.config).toEqual(mockJoinConfig);
  });

  it('harus dapat memperbarui (upsert) preset yang sudah ada', async () => {
    const updatedConfig = {
      sheetMappings: { Sheet1: { joinKey: 'KABUPATEN' }, Sheet2: { joinKey: 'KABUPATEN' } },
      updated: true,
    };

    const putRes = await request(app)
      .put('/api/configs/join')
      .send(updatedConfig);
    expect(putRes.status).toBe(200);

    const getRes = await request(app).get('/api/configs/join');
    expect(getRes.body.config).toEqual(updatedConfig);
  });

  it('harus mendukung penyimpanan konfigurasi chart dan stunting secara independen', async () => {
    const chartConfig = { viewMode: 'by-indicator', activeSeries: ['tw1', 'tw2'] };
    const stuntingConfig = { baselineQuarter: 'TW1', evaluationQuarter: 'TW2' };

    await request(app).put('/api/configs/chart').send(chartConfig);
    await request(app).put('/api/configs/stunting').send(stuntingConfig);

    const chartRes = await request(app).get('/api/configs/chart');
    const stuntingRes = await request(app).get('/api/configs/stunting');

    expect(chartRes.body.config).toEqual(chartConfig);
    expect(stuntingRes.body.config).toEqual(stuntingConfig);
  });
});
