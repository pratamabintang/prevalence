import { Request, Response, NextFunction } from 'express';

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const expectedId = process.env.DATA_ADMIN_ID || 'bidangkesmas';
  const expectedPw = process.env.DATA_ADMIN_PASSWORD || '@Dinkes123#';

  // 1. Check custom headers
  const headerId = req.header('X-Admin-Id');
  const headerPw = req.header('X-Admin-Password');
  if (headerId === expectedId && headerPw === expectedPw) {
    return next();
  }

  // 2. Check Authorization header (Basic auth)
  const authHeader = req.header('Authorization');
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
    error: 'Akses ditolak: Kredensial pengelola data tidak valid atau belum diberikan.',
  });
}

/**
 * Middleware that guards mutating HTTP methods (POST, PUT, DELETE, PATCH).
 * GET and OPTIONS requests pass through.
 */
export function requireAdminForMutations(req: Request, res: Response, next: NextFunction): void {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method.toUpperCase())) {
    return requireAdminAuth(req, res, next);
  }
  next();
}
