import express, { Express } from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health';
import { districtsRouter } from './routes/districts';
import { configsRouter } from './routes/configs';
import { periodsRouter } from './routes/periods';
import { defaultRouter } from './routes/default';
import { analyticsRouter } from './routes/analytics';

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Routes
  app.use('/api', healthRouter);
  app.use('/api', districtsRouter);
  app.use('/api', configsRouter);
  app.use('/api', periodsRouter);
  app.use('/api', defaultRouter);
  app.use('/api', analyticsRouter);

  return app;
}
