import express, { type ErrorRequestHandler } from 'express';
import type { Database } from './db.ts';
import { assignmentRoutes } from './assignment/routes.ts';
import { evaluationRoutes } from './evaluation/routes.ts';

// Client errors (ours, or express.json's 400 for a malformed body) keep their
// message; anything else is logged and hidden behind a generic 500.
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const status = typeof error?.status === 'number' && error.status < 500 ? error.status : 500;
  if (status === 500) console.error(error);
  res.status(status).json({ error: status === 500 ? 'Internal server error.' : error.message });
};

export function createApp(db: Database) {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api', evaluationRoutes(db));
  app.use('/api', assignmentRoutes(db));
  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found.' });
  });
  app.use(errorHandler);
  return app;
}
