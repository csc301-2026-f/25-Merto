import { HttpError } from './errors.ts';
import type { ReplyGenerator } from './reply-drafts/generator.ts';
import express, { type ErrorRequestHandler } from 'express';
import { requireStaff } from './auth.ts';
import { devLoginRoutes, meRoutes } from './auth-routes.ts';
import type { Database } from './db.ts';
import { assignmentRoutes } from './assignment/routes.ts';
import { dealRoutes } from './deals/routes.ts';
import { evaluationRoutes, type EvaluationContextProvider } from './evaluation/routes.ts';
import type { EvaluationEngine } from './evaluation/engine.ts';
import { followUpRoutes } from './follow-up/routes.ts';
import { openItemRoutes } from './open-items/routes.ts';
import { replyDraftRoutes } from './reply-drafts/routes.ts';
import { appointmentRoutes } from './appointments/routes.ts';
import type { ModelAgentRuntime } from './scenarios/model-agent.ts';
import { scenarioRoutes } from './scenarios/routes.ts';
import { taskRoutes } from './tasks/routes.ts';

export interface AppOptions {
  evaluationEngine?: EvaluationEngine;
  evaluationContext?: EvaluationContextProvider;
  replyGenerator?: ReplyGenerator;
  // A live model for the scenario checks (US13). Leave unset to keep model calls off.
  modelAgent?: ModelAgentRuntime;
  // Shared password for POST /auth/login. Leave unset to turn sign-in off.
  devLoginPassword?: string;
  // Local demo only: extra /api routes, behind the same staff check.
  demoRoutes?: express.Router;
}

// Client errors (ours, or express.json's 400 for a malformed body) keep their
// message; anything else is logged and hidden behind a generic 500.
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const status = error instanceof HttpError ? error.status
    : typeof error?.status === 'number' && error.status < 500 ? error.status : 500;
  if (status === 500) console.error(error);
  res.status(status).json({ error: status === 500 ? 'Internal server error.' : error.message });
};

export function createApp(db: Database, options: AppOptions = {}) {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/auth', devLoginRoutes(db, options.devLoginPassword));
  // Every /api route needs X-Staff-Id; look the caller up once per request.
  // Assignment routes come before deal routes so /deals/unassigned is not a deal ID.
  app.use('/api', requireStaff(db), meRoutes(), ...(options.demoRoutes ? [options.demoRoutes] : []), evaluationRoutes(db, options.evaluationEngine, options.evaluationContext), assignmentRoutes(db),
    followUpRoutes(db), replyDraftRoutes(db, options.replyGenerator), openItemRoutes(db), appointmentRoutes(db), scenarioRoutes(db, options.modelAgent), taskRoutes(db), dealRoutes(db));
  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found.' });
  });
  app.use(errorHandler);
  return app;
}
