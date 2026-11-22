import express from 'express';
import { currentStaff, requireUuid } from '../auth.ts';
import type { Database } from '../db.ts';
import * as tasks from './service.ts';

const objectBody = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : {};

// REST endpoints for deal tasks. app.ts has already identified the caller.
export function taskRoutes(db: Database) {
  const router = express.Router();

  router.get('/tasks', async (req, res) => {
    res.json(await tasks.tasksOverview(db, currentStaff(res), req.query));
  });

  router.patch('/tasks/:taskId', async (req, res) => {
    res.json(await tasks.setTaskCompleted(db, currentStaff(res),
      requireUuid(req.params.taskId, 'taskId'), objectBody(req.body)));
  });

  router.get('/deals/:dealId/tasks', async (req, res) => {
    res.json(await tasks.tasksForDeal(db, currentStaff(res), requireUuid(req.params.dealId, 'dealId')));
  });

  router.post('/deals/:dealId/tasks', async (req, res) => {
    res.status(201).json(await tasks.createTask(db, currentStaff(res),
      requireUuid(req.params.dealId, 'dealId'), objectBody(req.body)));
  });

  return router;
}
