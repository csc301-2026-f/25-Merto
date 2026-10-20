import express from 'express';
import { currentStaff, requireUuid } from '../auth.ts';
import type { Database } from '../db.ts';
import * as deals from './service.ts';

// REST endpoints for deal lists, adding a buyer, and the buyer record. Mounted after the
// assignment routes, so /deals/unassigned is matched before /deals/:dealId.
export function dealRoutes(db: Database) {
  const router = express.Router();

  router.get('/deals', async (_req, res) => {
    res.json(await deals.listDeals(db, currentStaff(res)));
  });

  router.post('/deals', async (req, res) => {
    const body = typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body) ? req.body : {};
    res.status(201).json(await deals.createDeal(db, currentStaff(res), body));
  });

  router.get('/deals/:dealId', async (req, res) => {
    res.json(await deals.dealRecord(db, currentStaff(res), requireUuid(req.params.dealId, 'dealId')));
  });

  return router;
}
