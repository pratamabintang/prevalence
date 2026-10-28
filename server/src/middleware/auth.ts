import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../routes/auth';

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  // Allow login endpoint unconditionally
  if (req.path === '/auth/login' || req.originalUrl?.includes('/api/auth/login')) {
    return next();
  }

  // 1. Check Bearer Token in Authorization header
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (verifyToken(token)) {
      return next();
    }
  }

  // 2. Check X-Admin-Token header
  const adminToken = req.header('X-Admin-Token');
  if (adminToken && verifyToken(adminToken)) {
    return next();
  }

  // 3. Fallback: Direct credentials (useful for server integration tests/scripts)
  const expectedId = process.env.DATA_ADMIN_ID || 'bidangkesmas';
  const expectedPw = process.env.DATA_ADMIN_PASSWORD || '@Dinkes123#';

  const headerId = req.header('X-Admin-Id');
  const headerPw = req.header('X-Admin-Password');
  if (headerId === expectedId && headerPw === expectedPw) {
    return next();
  }

  if (authHeader && authHeader.startsWith('Basic ')) {
    const base64 = authHeader.substring(6).trim();
    try {
      const decoded = Buffer.from(base64, 'base64').toString('utf8');
      const [user, ...passParts] = decoded.split(':');
      const pass = passParts.join(':');
      if (user === expectedId && pass === expectedPw) {
        return next();
      }
    } catch {
      // Invalid base64
    }
  }

  res.status(401).json({
    success: false,
    error: 'Akses ditolak: Sesi atau kredensial pengelola data tidak valid atau belum diberikan.',
  });
}

/**
 * Middleware that guards mutating HTTP methods (POST, PUT, DELETE, PATCH).
 * GET and OPTIONS requests pass through.
 */
export function requireAdminForMutations(req: Request, res: Response, next: NextFunction): void {
  // Never block login endpoint
  if (req.path === '/auth/login' || req.originalUrl?.includes('/api/auth/login')) {
    return next();
  }

  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method.toUpperCase())) {
    return requireAdminAuth(req, res, next);
  }
  next();
}
