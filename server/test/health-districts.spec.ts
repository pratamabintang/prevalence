import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { initDb, closeDb } from '../src/db/connection';
import { migrateSchema } from '../src/db/schema';
import { seedDistricts } from '../src/db/seeds';

describe('Backend API: Health & Master Districts (Seam 1)', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    // Inisialisasi in-memory DB terisolasi untuk testing
    const db = initDb({ inMemory: true });
    migrateSchema(db);
    seedDistricts(db);
    app = createApp();
  });

  afterAll(() => {
    closeDb();
  });

  describe('GET /api/health', () => {
    it('harus mengembalikan status ok dan koneksi database', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('connected');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/districts', () => {
    it('harus mengembalikan tepat 35 Kabupaten/Kota Jawa Tengah', async () => {
      const res = await request(app).get('/api/districts');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(35);
      expect(res.body.data.length).toBe(35);

      // Verifikasi sampel kabupaten dan kota
      const cilacap = res.body.data.find((d: { code: string }) => d.code === '3301');
      expect(cilacap).toBeDefined();
      expect(cilacap.name).toBe('Kab. Cilacap');
      expect(cilacap.type).toBe('KAB');

      const kotaSemarang = res.body.data.find((d: { code: string }) => d.code === '3374');
      expect(kotaSemarang).toBeDefined();
      expect(kotaSemarang.name).toBe('Kota Semarang');
      expect(kotaSemarang.type).toBe('KOTA');

      // Hitung komposisi: 29 Kab dan 6 Kota
      const kabCount = res.body.data.filter((d: { type: string }) => d.type === 'KAB').length;
      const kotaCount = res.body.data.filter((d: { type: string }) => d.type === 'KOTA').length;
      expect(kabCount).toBe(29);
      expect(kotaCount).toBe(6);
    });
  });
});
