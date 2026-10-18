import express from 'express';
import { currentStaff, requireUuid } from '../auth.ts';
import type { Database } from '../db.ts';
import * as followUp from './service.ts';

// REST endpoints for US6. app.ts has already identified the caller.
export function followUpRoutes(db: Database) {
  const router = express.Router();

  router.get('/follow-ups/due', async (_req, res) => {
    res.json(await followUp.dueFollowUps(db, currentStaff(res)));
  });

  router.get('/deals/:dealId/follow-up', async (req, res) => {
    res.json(await followUp.dealFollowUp(db, currentStaff(res), requireUuid(req.params.dealId, 'dealId')));
  });

  return router;
}
