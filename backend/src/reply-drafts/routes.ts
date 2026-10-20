import express from 'express';
import { currentStaff, requireUuid } from '../auth.ts';
import type { Database } from '../db.ts';
import { createDraft, listDrafts, reviewDraft, sendDraft } from './service.ts';

export function replyDraftRoutes(db: Database) {
  const router = express.Router();
  router.get('/deals/:dealId/reply-drafts', async (req, res) => {
    res.json(await listDrafts(db, currentStaff(res), requireUuid(req.params.dealId, 'dealId')));
  });
  router.post('/deals/:dealId/reply-drafts', async (req, res) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    res.json(await createDraft(db, currentStaff(res), requireUuid(req.params.dealId, 'dealId'), body));
  });
  router.post('/reply-drafts/:draftId/review', async (req, res) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    res.json(await reviewDraft(db, currentStaff(res), requireUuid(req.params.draftId, 'draftId'), body));
  });
  router.post('/reply-drafts/:draftId/send', async (req, res) => {
    res.json(await sendDraft(db, currentStaff(res), requireUuid(req.params.draftId, 'draftId')));
  });
  return router;
}
