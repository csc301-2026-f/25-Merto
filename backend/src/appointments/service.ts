import { requireDealAccess, type Staff } from '../auth.ts';
import type { Database } from '../db.ts';
import { badRequest, notFound } from '../errors.ts';
import { parseAppointment } from './policy.ts';
import * as repo from './repository.ts';

export function listAppointments(db: Database, staff: Staff) {
  return repo.listAppointments(db, staff.role === 'gm' ? null : staff.id);
}

export async function appointmentsOverview(db: Database, staff: Staff) {
  await repo.refreshPassedVisitItems(db);
  return repo.appointmentOverview(db, staff.role === 'gm' ? null : staff.id);
}

export async function createAppointment(
  db: Database,
  staff: Staff,
  dealId: string,
  body: Record<string, unknown>,
) {
  const input = parseAppointment(body);
  const status = staff.role === 'rep' ? 'confirmed' : 'requested';
  const id = await db.transaction(async (tx) => {
    const [deal] = await tx.query<{ ownerId: string | null }>(
      'select owner_id as "ownerId" from public.deals where id = $1 for update', [dealId]);
    if (!deal) throw notFound('Deal not found.');
    requireDealAccess(staff, deal.ownerId);
    return repo.insertAppointment(tx, dealId, { ...input, status }, staff);
  });
  return repo.findAppointment(db, id);
}

export async function editAppointment(
  db: Database,
  staff: Staff,
  appointmentId: string,
  body: Record<string, unknown>,
) {
  const input = parseAppointment(body);
  await db.transaction(async (tx) => {
    const appointment = await repo.findAppointment(tx, appointmentId, true);
    if (!appointment) throw notFound('Appointment not found.');
    requireDealAccess(staff, appointment.ownerId);
    await repo.updateAppointment(tx, appointmentId, input, appointment, staff);
  });
  return repo.findAppointment(db, appointmentId);
}

export async function confirmAppointment(
  db: Database,
  staff: Staff,
  appointmentId: string,
  body: Record<string, unknown>,
) {
  const appointment = await repo.findAppointment(db, appointmentId);
  if (!appointment) throw notFound('Appointment not found.');
  requireDealAccess(staff, appointment.ownerId);
  return editAppointment(db, staff, appointmentId, {
    ...body,
    scheduledFor: body.scheduledFor ?? appointment.scheduledFor.toISOString(),
    status: 'confirmed',
    outcomeNote: body.outcomeNote ?? appointment.outcomeNote,
  });
}

export async function recordVisitOutcome(
  db: Database,
  staff: Staff,
  appointmentId: string,
  body: Record<string, unknown>,
) {
  if (body.status !== 'completed' && body.status !== 'no_show') {
    throw badRequest('status must be completed or no_show.');
  }
  const appointment = await repo.findAppointment(db, appointmentId);
  if (!appointment) throw notFound('Appointment not found.');
  requireDealAccess(staff, appointment.ownerId);
  return editAppointment(db, staff, appointmentId, {
    ...body,
    scheduledFor: body.scheduledFor ?? appointment.scheduledFor.toISOString(),
  });
}
