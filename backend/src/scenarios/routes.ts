import express from 'express';
import { currentStaff } from '../auth.ts';
import type { Database } from '../db.ts';
import * as scenarios from './service.ts';

const asObject = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : {};

// REST endpoints for US13. app.ts has already identified the caller. Runs are rolled back.
export function scenarioRoutes(db: Database) {
  const router = express.Router();

  router.get('/scenarios', (_req, res) => {
    res.json(scenarios.listScenarios(currentStaff(res)));
  });

  router.get('/scenarios/:scenarioId', (req, res) => {
    res.json(scenarios.scenarioDetail(currentStaff(res), req.params.scenarioId));
  });

  router.post('/scenarios/:scenarioId/runs', async (req, res) => {
    res.json(await scenarios.runOne(db, currentStaff(res), req.params.scenarioId, asObject(req.body)));
  });

  router.post('/scenario-runs', async (req, res) => {
    res.json(await scenarios.runAll(db, currentStaff(res), asObject(req.body)));
  });

  return router;
}
