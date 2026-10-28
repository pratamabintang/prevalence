import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('Server Authentication & Token-based Authorization', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
  });

  describe('POST /api/auth/login', () => {
    it('should reject invalid credentials with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ id: 'wrong', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('tidak valid');
    });

    it('should return token and success on valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ id: 'bidangkesmas', password: '@Dinkes123#' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBe('bidangkesmas');
    });
  });

  describe('Bearer Token on Protected Mutating Routes', () => {
    it('should block POST requests without token with 401', async () => {
      const res = await request(app)
        .post('/api/default')
        .send({ test: true });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should allow POST requests with valid Bearer token', async () => {
      // 1. Login to get token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ id: 'bidangkesmas', password: '@Dinkes123#' });

      const token = loginRes.body.token;
      expect(token).toBeTruthy();

      // 2. Make authenticated call with Bearer token
      const deleteRes = await request(app)
        .delete('/api/default')
        .set('Authorization', `Bearer ${token}`);

      // The request should pass the auth guard (can be 200 or whatever route handler returns, not 401)
      expect(deleteRes.status).not.toBe(401);
    });

    it('should reject forged or corrupted Bearer token with 401', async () => {
      const res = await request(app)
        .delete('/api/default')
        .set('Authorization', 'Bearer invalid.token.signature');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
