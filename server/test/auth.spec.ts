import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { requireAdminForMutations, requireAdminAuth } from '../src/middleware/auth';

describe('requireAdminForMutations middleware', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/data', requireAdminForMutations, (req, res) => {
      res.json({ success: true, method: req.method });
    });
  });

  it('should allow GET requests without credentials', async () => {
    const res = await request(app).get('/api/data');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should block POST requests without credentials with 401', async () => {
    const res = await request(app).post('/api/data').send({ title: 'test' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Akses ditolak');
  });

  it('should block DELETE requests with wrong credentials with 401', async () => {
    const res = await request(app)
      .delete('/api/data')
      .set('X-Admin-Id', 'wrong')
      .set('X-Admin-Password', 'wrong');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should allow POST requests with valid X-Admin headers', async () => {
    const res = await request(app)
      .post('/api/data')
      .set('X-Admin-Id', 'bidangkesmas')
      .set('X-Admin-Password', '@Dinkes123#')
      .send({ title: 'test' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should allow DELETE requests with valid HTTP Basic Auth', async () => {
    const credentials = Buffer.from('bidangkesmas:@Dinkes123#').toString('base64');
    const res = await request(app)
      .delete('/api/data')
      .set('Authorization', `Basic ${credentials}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
