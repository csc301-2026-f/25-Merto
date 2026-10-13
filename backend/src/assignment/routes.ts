import express from 'express';
import { currentStaff, requireStaff, requireUuid } from '../auth.ts';
import type { Database } from '../db.ts';
import * as assignment from './service.ts';

// REST endpoints for US8. Every route needs X-Staff-Id.
export function assignmentRoutes(db: Database) {
  const router = express.Router();
  router.use(requireStaff(db));

  router.get('/deals/unassigned', async (_req, res) => {
    res.json(await assignment.unassignedDeals(db, currentStaff(res)));
  });

  router.post('/deals/:dealId/assign', async (req, res) => {
    const { toUserId, reason } = req.body ?? {};
    res.json(await assignment.assignDeal(db, currentStaff(res),
      requireUuid(req.params.dealId, 'dealId'), toUserId, reason));
  });

  router.post('/deals/:dealId/transfer', async (req, res) => {
    const { toUserId, reason } = req.body ?? {};
    res.json(await assignment.transferDeal(db, currentStaff(res),
      requireUuid(req.params.dealId, 'dealId'), toUserId, reason));
  });

  router.get('/deals/:dealId/assignments', async (req, res) => {
    res.json(await assignment.dealAssignments(db, currentStaff(res), requireUuid(req.params.dealId, 'dealId')));
  });

  return router;
}
