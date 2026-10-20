import { badRequest } from '../errors.ts';

export const APPOINTMENT_STATUSES = [
  'requested', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show',
] as const;
export type AppointmentStatus = typeof APPOINTMENT_STATUSES[number];

export interface AppointmentInput {
  scheduledFor: Date;
  status: AppointmentStatus;
  outcomeNote: string | null;
}

function text(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw badRequest(`${field} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length > 500) throw badRequest(`${field} must be at most 500 characters.`);
  return trimmed || null;
}

export function parseAppointment(body: Record<string, unknown>): AppointmentInput {
  if (typeof body.scheduledFor !== 'string' || !body.scheduledFor.trim()) {
    throw badRequest('scheduledFor is required.');
  }
  const scheduledFor = new Date(body.scheduledFor);
  if (!Number.isFinite(scheduledFor.getTime())) throw badRequest('scheduledFor must be a valid date.');

  const status = body.status ?? 'requested';
  if (typeof status !== 'string' || !APPOINTMENT_STATUSES.includes(status as AppointmentStatus)) {
    throw badRequest(`status must be one of: ${APPOINTMENT_STATUSES.join(', ')}.`);
  }

  return { scheduledFor, status: status as AppointmentStatus, outcomeNote: text(body.outcomeNote, 'outcomeNote') };
}
