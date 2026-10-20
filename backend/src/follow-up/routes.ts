import express from 'express';
import { currentStaff, requireUuid } from '../auth.ts';
import type { Database } from '../db.ts';
import * as followUp from './service.ts';
import { recordFollowUp } from './send-service.ts';

// Follow-up eligibility (US6) and recording a follow-up (US7).
export function followUpRoutes(db: Database) {
  const router = express.Router();

  router.get('/follow-ups/due', async (_req, res) => {
    res.json(await followUp.dueFollowUps(db, currentStaff(res)));
  });

  router.get('/deals/:dealId/follow-up', async (req, res) => {
    res.json(await followUp.dealFollowUp(db, currentStaff(res), requireUuid(req.params.dealId, 'dealId')));
  });

  router.post('/deals/:dealId/follow-ups', async (req, res) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    res.json(await recordFollowUp(db, currentStaff(res), requireUuid(req.params.dealId, 'dealId'), body));
  });

  return router;
}
