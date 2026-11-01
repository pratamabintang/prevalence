import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Rate limit exceeded' },
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'test' || req.path === '/api/health';
  },
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, try again later' },
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

export const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Rate limit exceeded for this operation' },
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'test' || req.method === 'GET';
  },
});
