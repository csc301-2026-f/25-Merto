import express from 'express';
import { currentStaff, requireUuid } from '../auth.ts';
import type { Database } from '../db.ts';
import * as openItems from './service.ts';

// REST endpoints for US4. app.ts has already identified the caller.
export function openItemRoutes(db: Database) {
  const router = express.Router();

  router.get('/open-items', async (req, res) => {
    res.json(await openItems.openItemsOverview(db, currentStaff(res), req.query));
  });

  for (const action of ['resolve', 'cancel'] as const) {
    router.post(`/open-items/:itemId/${action}`, async (req, res) => {
      const body = typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body) ? req.body : {};
      res.json(await openItems.closeOpenItem(db, currentStaff(res),
        requireUuid(req.params.itemId, 'itemId'), action, body));
    });
  }

  return router;
}
