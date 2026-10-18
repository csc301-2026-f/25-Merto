import express from 'express';
import { currentStaff } from '../auth.ts';
import type { Database } from '../db.ts';
import * as openItems from './service.ts';

// REST endpoint for US4. app.ts has already identified the caller.
export function openItemRoutes(db: Database) {
  const router = express.Router();

  router.get('/open-items', async (req, res) => {
    res.json(await openItems.openItemsOverview(db, currentStaff(res), req.query));
  });

  return router;
}
