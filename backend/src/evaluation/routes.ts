import express from 'express';
import { currentStaff, requireUuid } from '../auth.ts';
import type { Database } from '../db.ts';
import * as evaluation from './service.ts';

// REST endpoints for conversation evaluation. app.ts has already identified the caller.
export function evaluationRoutes(db: Database) {
  const router = express.Router();

  router.post('/evaluations/run', async (_req, res) => {
    res.json(await evaluation.evaluateAllDeals(db, currentStaff(res)));
  });

  router.get('/deals/:dealId/evaluation', async (req, res) => {
    res.json(await evaluation.dealEvaluation(db, currentStaff(res), requireUuid(req.params.dealId, 'dealId')));
  });

  router.post('/deals/:dealId/evaluation', async (req, res) => {
    res.json(await evaluation.evaluateDeal(db, currentStaff(res), requireUuid(req.params.dealId, 'dealId')));
  });

  router.get('/deals/:dealId/evaluation/preview', async (req, res) => {
    res.json(await evaluation.previewDeal(db, currentStaff(res), requireUuid(req.params.dealId, 'dealId')));
  });

  router.get('/ai-flags/queue', async (_req, res) => {
    res.json(await evaluation.reviewQueue(db, currentStaff(res)));
  });

  router.post('/ai-flags/:flagId/review', async (req, res) => {
    const { decision, note } = req.body ?? {};
    res.json(await evaluation.reviewFlag(db, currentStaff(res),
      requireUuid(req.params.flagId, 'flagId'), decision, note));
  });

  router.get('/ai-evaluation/metrics', async (_req, res) => {
    res.json(await evaluation.evaluationMetrics(db, currentStaff(res)));
  });

  return router;
}
