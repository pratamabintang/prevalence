import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createApp } from '../src/app';
import { initDb, closeDb } from '../src/db/connection';
import { migrateSchema } from '../src/db/schema';
import { seedDistricts } from '../src/db/seeds';

describe('Backend API: Quarterly Period Storage & Archive (Seam 1)', () => {
  let app: ReturnType<typeof createApp>;
  let tempUploadsDir: string;

  beforeAll(() => {
    // Siapkan temporary uploads folder
    tempUploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dinkes-test-uploads-'));
    process.env.UPLOADS_DIR = tempUploadsDir;

    const db = initDb({ inMemory: true });
    migrateSchema(db);
    seedDistricts(db);
    app = createApp();
  });

  afterAll(() => {
    closeDb();
    delete process.env.UPLOADS_DIR;
    if (fs.existsSync(tempUploadsDir)) {
      fs.rmSync(tempUploadsDir, { recursive: true, force: true });
    }
  });

  it('GET /api/periods - harus mengembalikan daftar kosong jika belum ada data', async () => {
    const res = await request(app).get('/api/periods');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.periods)).toBe(true);
    expect(res.body.periods.length).toBe(0);
  });

  it('POST /api/periods/:year/:quarter - harus menolak triwulan yang tidak valid', async () => {
    const res = await request(app)
      .post('/api/periods/2026/TW5')
      .attach('rawFile', Buffer.from('dummy excel content'), 'test.xlsx');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/periods/2026/TW1 - harus berhasil menyimpan file biner, config JSON, dan observasi (termasuk Toleransi Daerah) ke SQLite', async () => {
    const dummyBuffer = Buffer.from('PK...fake excel binary stream for tw1');
    const mockObservations = JSON.stringify([
      { districtName: 'Cilacap', indicatorKey: 'stunting_prev', numericValue: 12.4, displayText: '12.4%' },
      { districtCode: '3374', indicatorKey: 'stunting_prev', numericValue: 8.1, displayText: '8.1%' },
    ]);
    const mockConfig = JSON.stringify({ joinBy: 'Kabupaten/Kota', sheets: [] });

    const res = await request(app)
      .post('/api/periods/2026/TW1')
      .attach('rawFile', dummyBuffer, 'input_tw1.xlsx')
      .field('observations', mockObservations)
      .field('config', mockConfig);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.periodId).toBeDefined();

    // Verifikasi fisik berkas tersimpan di disk
    const savedPath = path.join(tempUploadsDir, '2026', 'TW1', 'raw-data.xlsx');
    expect(fs.existsSync(savedPath)).toBe(true);
    expect(fs.readFileSync(savedPath).toString()).toBe(dummyBuffer.toString());
  });

  it('GET /api/periods - harus menyertakan periode 2026 TW1 setelah disimpan', async () => {
    const res = await request(app).get('/api/periods');

    expect(res.status).toBe(200);
    expect(res.body.periods.length).toBe(1);
    const p = res.body.periods[0];
    expect(p.year).toBe(2026);
    expect(p.quarter).toBe('TW1');
    expect(p.hasRaw).toBe(true);
    expect(p.hasResult).toBe(false);
    expect(p.hasConfig).toBe(true);
  });

  it('GET /api/periods/2026/TW1 - harus mengembalikan detail berkas, config, dan observasi tersimpan', async () => {
    const res = await request(app).get('/api/periods/2026/TW1');

    expect(res.status).toBe(200);
    expect(res.body.hasData).toBe(true);
    expect(res.body.config).toEqual({ joinBy: 'Kabupaten/Kota', sheets: [] });
    expect(res.body.observationsCount).toBe(2);
    expect(res.body.observations.length).toBe(2);

    const cilacap = res.body.observations.find((o: { districtCode: string }) => o.districtCode === '3301');
    expect(cilacap).toBeDefined();
    expect(cilacap.numeric_value).toBe(12.4);
    expect(cilacap.display_text).toBe('12.4%');
  });

  it('GET /api/periods/2026/TW1/download/raw - harus dapat mengunduh berkas biner asli', async () => {
    const res = await request(app)
      .get('/api/periods/2026/TW1/download/raw')
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/vnd.openxmlformats');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body.toString()).toBe('PK...fake excel binary stream for tw1');
  });

  describe('DELETE /api/periods/:year/:quarter', () => {
    it('harus menolak request dengan parameter tidak valid (400)', async () => {
      const res = await request(app).delete('/api/periods/abc/TW1');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const res2 = await request(app).delete('/api/periods/2026/TW5');
      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);
    });

    it('harus mengembalikan 404 jika periode tidak ditemukan', async () => {
      const res = await request(app).delete('/api/periods/2099/TW4');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('harus berhasil menghapus data periode, berkas fisik, dan entri SQLite (200)', async () => {
      const targetDir = path.join(tempUploadsDir, '2026', 'TW1');
      expect(fs.existsSync(targetDir)).toBe(true);

      const delRes = await request(app).delete('/api/periods/2026/TW1');
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
      expect(delRes.body.message).toContain('berhasil dihapus');

      // Direktori berkas fisik harus sudah terhapus
      expect(fs.existsSync(targetDir)).toBe(false);

      // GET detail periode harus mengembalikan hasData: false
      const getRes = await request(app).get('/api/periods/2026/TW1');
      expect(getRes.status).toBe(200);
      expect(getRes.body.hasData).toBe(false);

      // GET daftar periods harus kosong
      const listRes = await request(app).get('/api/periods');
      expect(listRes.status).toBe(200);
      expect(listRes.body.periods.length).toBe(0);
    });
  });

  describe('Custom Default Workbook Lifecycle (/api/default)', () => {
    it('GET /api/default - harus mengembalikan hasData: false saat belum ada Default Kustom', async () => {
      const res = await request(app).get('/api/default');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.hasData).toBe(false);
    });

    it('POST /api/default - harus menyimpan berkas Default Kustom dan Preset Konfigurasi Dinkes', async () => {
      const dummyBuffer = Buffer.from('PK...custom default excel binary');
      const mockConfig = JSON.stringify({
        version: '1.0',
        name: 'Default Provinsi Jateng',
        joinBy: 'Kabupaten/Kota',
        sheets: [],
      });

      const res = await request(app)
        .post('/api/default')
        .attach('excelFile', dummyBuffer, 'custom-default.xlsx')
        .field('fileName', 'custom-default.xlsx')
        .field('config', mockConfig);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.updatedAt).toBeDefined();

      const savedPath = path.join(tempUploadsDir, 'default', 'default-join-data.xlsx');
      expect(fs.existsSync(savedPath)).toBe(true);
    });

    it('GET /api/default & GET /api/default/download - harus mengembalikan metadata dan berkas biner Default Kustom', async () => {
      const metaRes = await request(app).get('/api/default');
      expect(metaRes.status).toBe(200);
      expect(metaRes.body.success).toBe(true);
      expect(metaRes.body.hasData).toBe(true);
      expect(metaRes.body.fileName).toBe('custom-default.xlsx');
      expect(metaRes.body.config).toEqual({
        version: '1.0',
        name: 'Default Provinsi Jateng',
        joinBy: 'Kabupaten/Kota',
        sheets: [],
      });

      const dlRes = await request(app)
        .get('/api/default/download')
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(dlRes.status).toBe(200);
      expect(dlRes.headers['content-type']).toContain('application/vnd.openxmlformats');
      expect(dlRes.body.toString()).toBe('PK...custom default excel binary');
    });

    it('DELETE /api/default - harus menghapus Default Kustom dari disk dan SQLite', async () => {
      const delRes = await request(app).delete('/api/default');
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      const afterRes = await request(app).get('/api/default');
      expect(afterRes.status).toBe(200);
      expect(afterRes.body.hasData).toBe(false);
    });
  });
});
