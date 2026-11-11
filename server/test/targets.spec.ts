import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { initDb, closeDb } from '../src/db/connection';
import { migrateSchema } from '../src/db/schema';

describe('Backend API: Acuan Target Tahunan (Seam Targets)', () => {
  let app: ReturnType<typeof createApp>;
  const authHeaders = { 'X-Admin-Id': 'bidangkesmas', 'X-Admin-Password': '@Dinkes123#' };

  beforeAll(() => {
    const db = initDb({ inMemory: true });
    migrateSchema(db);
    app = createApp();
  });

  afterAll(() => {
    closeDb();
  });

  it('harus mengembalikan targets kosong saat belum ada acuan tersimpan', async () => {
    const res = await request(app).get('/api/targets');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.targets).toEqual({});
  });

  it('harus menolak tahun di luar rentang 2000-2100 dengan status 400', async () => {
    const res = await request(app)
      .put('/api/targets/1999').set(authHeaders)
      .send({ targets: { 'masalah-gizi': {} } });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('harus menolak dataset key yang tidak dikenal', async () => {
    const res = await request(app)
      .put('/api/targets/2026').set(authHeaders)
      .send({ targets: { 'dataset-lain': { 'Stunting - %': { enabled: true, operator: '<=', value: 14 } } } });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('harus dapat menyimpan acuan per tahun dan membacanya kembali terkelompok per tahun', async () => {
    const yearTargets = {
      'intervensi-spesifik': {
        'ANC K6 - %': { enabled: true, operator: '>=', value: 95 },
      },
      'masalah-gizi': {
        'Stunting - %': { enabled: true, operator: '<=', value: 14 },
        'Gizi Kurang - %': { enabled: false, operator: '<=', value: null },
      },
    };

    const putRes = await request(app)
      .put('/api/targets/2026').set(authHeaders)
      .send({ targets: yearTargets });

    expect(putRes.status).toBe(200);
    expect(putRes.body.success).toBe(true);
    expect(putRes.body.updatedAt).toBeDefined();

    const getRes = await request(app).get('/api/targets');
    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.targets['2026']).toEqual(yearTargets);
  });

  it('harus mengganti seluruh baris tahun terkait saat PUT ulang (replace, bukan append)', async () => {
    const replacement = {
      'masalah-gizi': {
        'Stunting - %': { enabled: true, operator: '<=', value: 12 },
      },
    };

    const putRes = await request(app)
      .put('/api/targets/2026').set(authHeaders)
      .send({ targets: replacement });

    expect(putRes.status).toBe(200);

    const getRes = await request(app).get('/api/targets');
    expect(getRes.body.targets['2026']).toEqual(replacement);
  });

  it('harus menghapus seluruh acuan satu tahun via DELETE dan melaporkan tahun tanpa acuan', async () => {
    const yearTargets = {
      'masalah-gizi': {
        'Stunting - %': { enabled: true, operator: '<=', value: 14 },
      },
    };
    await request(app)
      .put('/api/targets/2028').set(authHeaders)
      .send({ targets: yearTargets });

    const delRes = await request(app).delete('/api/targets/2028').set(authHeaders);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
    expect(delRes.body.message).toContain('dihapus');

    const getRes = await request(app).get('/api/targets');
    expect(getRes.body.targets['2028']).toBeUndefined();

    // DELETE ulang pada tahun tanpa acuan tetap sukses dengan pesan berbeda
    const delAgain = await request(app).delete('/api/targets/2028').set(authHeaders);
    expect(delAgain.status).toBe(200);
    expect(delAgain.body.message).toContain('tidak memiliki acuan');
  });

  it('harus menolak DELETE dengan tahun tidak valid', async () => {
    const res = await request(app).delete('/api/targets/abcd').set(authHeaders);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
