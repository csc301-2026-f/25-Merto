import express from 'express';
import { currentStaff, requireUuid } from '../auth.ts';
import type { Database } from '../db.ts';
import * as assignment from './service.ts';

// REST endpoints for US8. app.ts has already identified the caller.
export function assignmentRoutes(db: Database) {
  const router = express.Router();

  router.get('/deals/unassigned', async (_req, res) => {
    res.json(await assignment.unassignedDeals(db, currentStaff(res)));
  });

  router.get('/staff/reps', async (_req, res) => {
    res.json(await assignment.assignableReps(db, currentStaff(res)));
  });

  router.post('/deals/:dealId/assign', async (req, res) => {
    res.json(await assignment.assignDeal(db, currentStaff(res),
      requireUuid(req.params.dealId, 'dealId'), req.body ?? {}));
  });

  router.post('/deals/:dealId/transfer', async (req, res) => {
    res.json(await assignment.transferDeal(db, currentStaff(res),
      requireUuid(req.params.dealId, 'dealId'), req.body ?? {}));
  });

  router.get('/deals/:dealId/assignments', async (req, res) => {
    res.json(await assignment.dealAssignments(db, currentStaff(res), requireUuid(req.params.dealId, 'dealId')));
  });

  return router;
}
