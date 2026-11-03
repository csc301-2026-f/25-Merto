import express from 'express';
import { currentStaff, requireUuid } from '../auth.ts';
import type { Database } from '../db.ts';
import * as evaluation from './service.ts';
import { rulesEngine, type EvaluationEngine } from './engine.ts';

export type EvaluationContext = { db: Database; engine: EvaluationEngine };
export type EvaluationContextProvider = (id: string | undefined) => EvaluationContext;

// REST endpoints for conversation evaluation. app.ts has already identified the caller.
export function evaluationRoutes(db: Database, engine: EvaluationEngine = rulesEngine,
  provider?: EvaluationContextProvider) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.locals.evaluation = provider?.(req.get('X-Merto-Demo-Evaluator')) ?? { db, engine };
    next();
  });
  const context = (res: express.Response): EvaluationContext => res.locals.evaluation;

  router.post('/evaluations/run', async (_req, res) => {
    const { db, engine } = context(res);
    res.json(await evaluation.evaluateAllDeals(db, currentStaff(res), engine.detect));
  });

  router.get('/ai-evaluation/engine', async (_req, res) => {
    const { engine } = context(res);
    res.json(await engine.status());
  });

  router.get('/deals/:dealId/evaluation', async (req, res) => {
    const { db } = context(res);
    res.json(await evaluation.dealEvaluation(db, currentStaff(res), requireUuid(req.params.dealId, 'dealId')));
  });

  router.post('/deals/:dealId/evaluation', async (req, res) => {
    const { db, engine } = context(res);
    res.json(await evaluation.evaluateDeal(db, currentStaff(res), requireUuid(req.params.dealId, 'dealId'), engine.detect));
  });

  router.get('/deals/:dealId/evaluation/preview', async (req, res) => {
    const { db, engine } = context(res);
    res.json(await evaluation.previewDeal(db, currentStaff(res), requireUuid(req.params.dealId, 'dealId'), engine.detect));
  });

  router.get('/ai-flags/queue', async (_req, res) => {
    const { db } = context(res);
    res.json(await evaluation.reviewQueue(db, currentStaff(res)));
  });

  router.post('/ai-flags/:flagId/review', async (req, res) => {
    const { db } = context(res);
    const { decision, note } = req.body ?? {};
    res.json(await evaluation.reviewFlag(db, currentStaff(res),
      requireUuid(req.params.flagId, 'flagId'), decision, note));
  });

  router.get('/ai-evaluation/metrics', async (_req, res) => {
    const { db } = context(res);
    res.json(await evaluation.evaluationMetrics(db, currentStaff(res)));
  });

  return router;
}
