import type { Queryable } from '../db.ts';
import type { AppointmentInput, AppointmentStatus } from './policy.ts';

export interface CalendarAppointment {
  id: string;
  dealId: string;
  createdAt: Date | null;
  scheduledFor: Date;
  status: AppointmentStatus;
  outcomeNote: string | null;
  requestedByType: string;
  requestedById: string | null;
  requestedBy: string | null;
  confirmedById: string | null;
  confirmedBy: string | null;
  buyer: string;
  vehicleInterest: string;
  ownerId: string | null;
  owner: string | null;
}

const appointmentSelect = `
  select a.id, a.deal_id as "dealId", a.created_at as "createdAt",
    a.scheduled_for as "scheduledFor", a.status,
    a.outcome_note as "outcomeNote", a.requested_by_type as "requestedByType",
    a.requested_by_id as "requestedById", requester.name as "requestedBy",
    a.confirmed_by as "confirmedById",
    confirmer.name as "confirmedBy", b.name as buyer, d.vehicle_interest as "vehicleInterest",
    d.owner_id as "ownerId", s.name as owner
  from public.appointments a
  join public.deals d on d.id = a.deal_id
  join public.buyers b on b.id = d.buyer_id
  left join public.staff_users s on s.id = d.owner_id
  left join public.staff_users requester on requester.id = a.requested_by_id
  left join public.staff_users confirmer on confirmer.id = a.confirmed_by`;

export function listAppointments(db: Queryable, ownerId: string | null): Promise<CalendarAppointment[]> {
  return db.query<CalendarAppointment>(`
    ${appointmentSelect}
    where ($1::uuid is null or d.owner_id = $1)
    order by a.scheduled_for, a.id`, [ownerId]);
}

export async function findAppointment(db: Queryable, appointmentId: string, lock = false) {
  const [appointment] = await db.query<CalendarAppointment>(`
    ${appointmentSelect}
    where a.id = $1${lock ? ' for update of a, d' : ''}`, [appointmentId]);
  return appointment;
}

export async function insertAppointment(
  db: Queryable,
  dealId: string,
  input: AppointmentInput,
  staff: { id: string; role: string },
) {
  const [appointment] = await db.query<{ id: string }>(`
    insert into public.appointments
      (deal_id, scheduled_for, status, outcome_note, requested_by_type, requested_by_id,
       confirmed_by, confirmed_at)
    values ($1, $2, $3, $4, $5, $6,
      case when $3 = 'confirmed' then $7::uuid else null end,
      case when $3 = 'confirmed' then now() else null end)
    returning id`, [dealId, input.scheduledFor, input.status, input.outcomeNote, staff.role, staff.id, staff.id]);
  await writeAudit(db, {
    dealId, appointmentId: appointment.id, actorType: staff.role, actorId: staff.id,
    action: input.status === 'requested' ? 'request_appointment' : 'create_confirmed_appointment',
    field: 'status', oldValue: null, newValue: input.status,
  });
  await writeTimeline(db, dealId, staff.role, staff.id, input.status === 'requested'
    ? `Appointment requested for ${input.scheduledFor.toISOString()}.`
    : `Appointment created and confirmed for ${input.scheduledFor.toISOString()}.`);
  if (input.status === 'requested') {
    await writeTimeline(db, dealId, 'system', null,
      `Visit request recorded for ${input.scheduledFor.toISOString()}; awaiting human confirmation.`);
  }
  return appointment.id;
}

export async function updateAppointment(
  db: Queryable,
  appointmentId: string,
  input: AppointmentInput,
  current: CalendarAppointment,
  staff: { id: string; role: string },
) {
  await db.query(`
    update public.appointments
    set scheduled_for = $2, status = $3, outcome_note = $4,
      confirmed_by = case
        when $3 = 'requested' then null
        when $3 in ('confirmed', 'rescheduled', 'completed', 'no_show')
          then coalesce(confirmed_by, $5::uuid)
        else confirmed_by
      end,
      confirmed_at = case
        when $3 = 'requested' then null
        when $3 in ('confirmed', 'rescheduled', 'completed', 'no_show')
          then coalesce(confirmed_at, now())
        else confirmed_at
      end
    where id = $1`, [appointmentId, input.scheduledFor, input.status, input.outcomeNote, staff.id]);

  if (current.status !== input.status) {
    await writeAudit(db, {
      dealId: current.dealId, appointmentId, actorType: staff.role, actorId: staff.id,
      action: 'update_appointment_status', field: 'status',
      oldValue: current.status, newValue: input.status,
    });
    await writeTimeline(db, current.dealId, staff.role, staff.id,
      `Appointment status changed from ${current.status} to ${input.status}.${input.outcomeNote
        && (input.status === 'completed' || input.status === 'no_show') ? ` Outcome: ${input.outcomeNote}` : ''}`);
    await writeTimeline(db, current.dealId, 'system', null,
      `Appointment status: ${current.status} to ${input.status}.`);
  }
  if (current.scheduledFor.getTime() !== input.scheduledFor.getTime()) {
    await writeAudit(db, {
      dealId: current.dealId, appointmentId, actorType: staff.role, actorId: staff.id,
      action: 'update_appointment_time', field: 'scheduled_for',
      oldValue: current.scheduledFor.toISOString(), newValue: input.scheduledFor.toISOString(),
    });
  }

  if (input.status === 'confirmed' || input.status === 'rescheduled') {
    await db.query(`
      update public.deals set stage = 'appointment_set'
      where id = $1 and stage not in ('delivered', 'lost')`, [current.dealId]);
  } else if (input.status === 'completed') {
    await db.query(`
      update public.deals set stage = 'working'
      where id = $1 and stage not in ('delivered', 'lost')`, [current.dealId]);
  }
  if (input.status === 'completed' || input.status === 'no_show') {
    await db.query(`
      update public.open_items
      set status = 'resolved', resolved_at = now()
      where appointment_id = $1 and status = 'open'`, [appointmentId]);
  } else {
    await db.query(`
      update public.open_items
      set status = 'cancelled'
      where appointment_id = $1 and type = 'visit_outcome' and status = 'open'
        and ($2 in ('requested', 'cancelled') or $3 > now())`,
    [appointmentId, input.status, input.scheduledFor]);
    await refreshPassedVisitItems(db, appointmentId);
  }
}

export async function refreshPassedVisitItems(db: Queryable, appointmentId: string | null = null): Promise<void> {
  await db.query(`
    insert into public.open_items (deal_id, appointment_id, owner_id, type, description, due_at, created_at)
    select a.deal_id, a.id, d.owner_id, 'visit_outcome',
      'Record the outcome of the visit with ' || b.name || '.',
      a.scheduled_for, now()
    from public.appointments a
    join public.deals d on d.id = a.deal_id
    join public.buyers b on b.id = d.buyer_id
    where a.status in ('confirmed', 'rescheduled')
      and a.scheduled_for <= now()
      and ($1::uuid is null or a.id = $1)
    on conflict (appointment_id) do update
      set owner_id = excluded.owner_id, description = excluded.description,
        due_at = excluded.due_at, status = 'open', resolved_at = null,
        created_at = case when open_items.status = 'open' then open_items.created_at else now() end
      where open_items.status <> 'open'`, [appointmentId]);
}

export async function appointmentOverview(db: Queryable, ownerId: string | null) {
  const [metrics] = await db.query<{
    requested: number; confirmed: number; completed: number; noShow: number;
    requestedUnconfirmed: number; visitsWithoutOutcome: number;
  }>(`
    select
      count(*) filter (where a.status = 'requested')::int as requested,
      count(*) filter (where a.confirmed_by is not null)::int as confirmed,
      count(*) filter (where a.status = 'completed'
        and (a.scheduled_for at time zone 'America/Toronto')::date
          <= (now() at time zone 'America/Toronto')::date)::int as completed,
      count(*) filter (where a.status = 'no_show'
        and (a.scheduled_for at time zone 'America/Toronto')::date
          <= (now() at time zone 'America/Toronto')::date)::int as "noShow",
      count(*) filter (where a.status = 'requested')::int as "requestedUnconfirmed",
      count(*) filter (where a.status in ('confirmed', 'rescheduled') and a.scheduled_for <= now())::int
        as "visitsWithoutOutcome"
    from public.appointments a
    join public.deals d on d.id = a.deal_id
    where ($1::uuid is null or d.owner_id = $1)`, [ownerId]);
  const appointments = await listAppointments(db, ownerId);
  return {
    appointments,
    metrics: {
      requested: metrics.requested,
      confirmed: metrics.confirmed,
      showRate: metrics.completed + metrics.noShow === 0
        ? null : metrics.completed / (metrics.completed + metrics.noShow),
      completed: metrics.completed,
      noShow: metrics.noShow,
      requestedUnconfirmed: metrics.requestedUnconfirmed,
      visitsWithoutOutcome: metrics.visitsWithoutOutcome,
    },
    requestedToConfirm: appointments.filter((appointment) => appointment.status === 'requested'),
    visitsToRecord: appointments.filter((appointment) =>
      ['confirmed', 'rescheduled'].includes(appointment.status)
      && appointment.scheduledFor.getTime() <= Date.now()),
  };
}

async function writeAudit(db: Queryable, entry: {
  dealId: string; appointmentId: string; actorType: string; actorId: string | null;
  action: string; field: string; oldValue: string | null; newValue: string | null;
}) {
  await db.query(`
    insert into public.audit_events
      (actor_type, actor_id, action, entity_type, entity_id, deal_id, field_name, old_value, new_value)
    values ($1, $2, $3, 'appointment', $4, $5, $6, $7, $8)`,
  [entry.actorType, entry.actorId, entry.action, entry.appointmentId, entry.dealId,
    entry.field, entry.oldValue, entry.newValue]);
}

async function writeTimeline(
  db: Queryable, dealId: string, actorType: string, actorId: string | null, body: string,
) {
  await db.query(`
    insert into public.timeline_events
      (deal_id, event_type, actor_type, actor_id, channel, direction, body)
    values ($1, 'appointment', $2, $3, 'note', 'internal', $4)`,
  [dealId, actorType, actorId, body]);
}
