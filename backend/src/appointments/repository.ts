import type { Queryable } from '../db.ts';
import type { AppointmentInput } from './policy.ts';

export interface CalendarAppointment {
  id: string;
  dealId: string;
  scheduledFor: Date;
  status: string;
  outcomeNote: string | null;
  buyer: string;
  vehicleInterest: string;
  ownerId: string | null;
  owner: string | null;
}

const appointmentSelect = `
  select a.id, a.deal_id as "dealId", a.scheduled_for as "scheduledFor", a.status,
    a.outcome_note as "outcomeNote", b.name as buyer, d.vehicle_interest as "vehicleInterest",
    d.owner_id as "ownerId", s.name as owner
  from public.appointments a
  join public.deals d on d.id = a.deal_id
  join public.buyers b on b.id = d.buyer_id
  left join public.staff_users s on s.id = d.owner_id`;

export function listAppointments(db: Queryable, ownerId: string | null): Promise<CalendarAppointment[]> {
  return db.query<CalendarAppointment>(`
    ${appointmentSelect}
    where ($1::uuid is null or d.owner_id = $1)
    order by a.scheduled_for, a.id`, [ownerId]);
}

export async function findAppointment(db: Queryable, appointmentId: string) {
  const [appointment] = await db.query<CalendarAppointment>(`
    ${appointmentSelect}
    where a.id = $1`, [appointmentId]);
  return appointment;
}

export async function insertAppointment(
  db: Queryable,
  dealId: string,
  input: AppointmentInput,
  staffId: string,
) {
  const [appointment] = await db.query<{ id: string }>(`
    insert into public.appointments (deal_id, scheduled_for, status, outcome_note, confirmed_by, confirmed_at)
    values ($1, $2, $3, $4,
      case when $3 in ('confirmed', 'completed', 'no_show') then $5::uuid else null end,
      case when $3 in ('confirmed', 'completed', 'no_show') then now() else null end)
    returning id`, [dealId, input.scheduledFor, input.status, input.outcomeNote, staffId]);
  return appointment.id;
}

export async function updateAppointment(
  db: Queryable,
  appointmentId: string,
  input: AppointmentInput,
  staffId: string,
) {
  await db.query(`
    update public.appointments
    set scheduled_for = $2, status = $3, outcome_note = $4,
      confirmed_by = case when $3 in ('confirmed', 'completed', 'no_show') then $5::uuid else null end,
      confirmed_at = case when $3 in ('confirmed', 'completed', 'no_show') then now() else null end
    where id = $1`, [appointmentId, input.scheduledFor, input.status, input.outcomeNote, staffId]);
}
