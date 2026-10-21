import express from 'express';
import { currentStaff, requireUuid } from '../auth.ts';
import type { Database } from '../db.ts';
import * as appointments from './service.ts';

export function appointmentRoutes(db: Database) {
  const router = express.Router();

  router.get('/appointments', async (_req, res) => {
    res.json(await appointments.listAppointments(db, currentStaff(res)));
  });

  router.post('/appointments', async (req, res) => {
    const body = typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body) ? req.body : {};
    const dealId = requireUuid(typeof body.dealId === 'string' ? body.dealId : '', 'dealId');
    res.status(201).json(await appointments.createAppointment(db, currentStaff(res), dealId, body));
  });

  router.patch('/appointments/:appointmentId', async (req, res) => {
    const body = typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body) ? req.body : {};
    res.json(await appointments.editAppointment(
      db, currentStaff(res), requireUuid(req.params.appointmentId, 'appointmentId'), body,
    ));
  });

  return router;
}
