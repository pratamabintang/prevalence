import { Router, Request, Response } from 'express';
import crypto from 'crypto';

export const authRouter = Router();

const SERVER_SECRET = process.env.AUTH_SECRET || 'dinkes-auth-secret-key-2026';

export function createToken(userId: string): string {
  const payload = JSON.stringify({ u: userId, t: Date.now() });
  const payloadBase64 = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', SERVER_SECRET).update(payloadBase64).digest('base64url');
  return `${payloadBase64}.${signature}`;
}

export function verifyToken(token: string): boolean {
  if (!token || !token.includes('.')) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadBase64, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SERVER_SECRET).update(payloadBase64).digest('base64url');
  if (signature !== expectedSig) return false;

  try {
    const jsonStr = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr);
    // Token valid for 24 hours
    if (!payload.t || Date.now() - payload.t > 24 * 60 * 60 * 1000) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

authRouter.post('/auth/login', (req: Request, res: Response): void => {
  const { id, password } = req.body || {};
  const expectedId = process.env.DATA_ADMIN_ID || 'bidangkesmas';
  const expectedPw = process.env.DATA_ADMIN_PASSWORD || '@Dinkes123#';

  if (!id || !password || id !== expectedId || password !== expectedPw) {
    res.status(401).json({
      success: false,
      error: 'ID atau Kata Sandi pengelola tidak valid.',
    });
    return;
  }

  const token = createToken(id);
  res.json({
    success: true,
    token,
    user: id,
    message: 'Login berhasil.',
  });
});
