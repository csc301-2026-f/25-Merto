import { requireDealAccess, type Staff } from '../auth.ts';
import type { Database } from '../db.ts';
import { notFound } from '../errors.ts';
import { findDeal } from '../deals/repository.ts';
import { parseAppointment } from './policy.ts';
import * as repo from './repository.ts';

export function listAppointments(db: Database, staff: Staff) {
  return repo.listAppointments(db, staff.role === 'gm' ? null : staff.id);
}

export async function createAppointment(
  db: Database,
  staff: Staff,
  dealId: string,
  body: Record<string, unknown>,
) {
  const deal = await findDeal(db, dealId);
  if (!deal) throw notFound('Deal not found.');
  requireDealAccess(staff, deal.ownerId);
  const id = await repo.insertAppointment(db, dealId, parseAppointment(body), staff.id);
  return repo.findAppointment(db, id);
}

export async function editAppointment(
  db: Database,
  staff: Staff,
  appointmentId: string,
  body: Record<string, unknown>,
) {
  const appointment = await repo.findAppointment(db, appointmentId);
  if (!appointment) throw notFound('Appointment not found.');
  requireDealAccess(staff, appointment.ownerId);
  await repo.updateAppointment(db, appointmentId, parseAppointment(body), staff.id);
  return repo.findAppointment(db, appointmentId);
}
