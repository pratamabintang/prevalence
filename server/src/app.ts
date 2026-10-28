import express, { Express } from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health';
import { districtsRouter } from './routes/districts';
import { configsRouter } from './routes/configs';
import { periodsRouter } from './routes/periods';
import { defaultRouter } from './routes/default';
import { analyticsRouter } from './routes/analytics';
import { authRouter } from './routes/auth';
import { requireAdminForMutations } from './middleware/auth';

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Admin authentication guard for mutating endpoints
  app.use('/api', requireAdminForMutations);

  // API Routes
  app.use('/api', authRouter);
  app.use('/api', healthRouter);
  app.use('/api', districtsRouter);
  app.use('/api', configsRouter);
  app.use('/api', periodsRouter);
  app.use('/api', defaultRouter);
  app.use('/api', analyticsRouter);

  return app;
}
