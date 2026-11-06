import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEALS, STAFF } from '../src/seed-ids.ts';
import { useApi } from './harness.ts';

describe('appointments calendar API', () => {
  const api = useApi();
  const { call } = api;

  it('lists all appointments for a GM and only the rep-owned appointments', async () => {
    const gm = await call(STAFF.karen, 'GET', '/api/appointments');
    const rep = await call(STAFF.dana, 'GET', '/api/appointments');
    assert.equal(gm.status, 200);
    assert.equal(rep.status, 200);
    assert.ok(gm.body.length >= rep.body.length);
    assert.ok(rep.body.length > 0);
    assert.ok(rep.body.every((item: { ownerId: string }) => item.ownerId === STAFF.dana));
    assert.ok(gm.body.some((item: { dealId: string; buyer: string }) =>
      item.dealId === DEALS.jordan && item.buyer === 'Jordan Lee'));
    const ninaAppointment = gm.body.find((item: { id: string }) =>
      item.id === '50000000-0000-0000-0000-000000000002');
    assert.ok(ninaAppointment);
    assert.equal(ninaAppointment.status, 'requested');
    assert.equal(ninaAppointment.confirmedById, null);
    const [ninaRequest] = await api.db.query<{ created_at: Date; scheduled_for: Date }>(
      `select a.created_at, a.scheduled_for
       from public.appointments a
       where a.id = '50000000-0000-0000-0000-000000000002'`,
    );
    assert.equal(ninaAppointment.createdAt, ninaRequest.created_at.toISOString());
    const [expectedNinaTime] = await api.db.query<{ scheduled_for: Date }>(
      `select (((now() at time zone 'America/Toronto')::date + 2) + time '12:00')
        at time zone 'America/Toronto' as scheduled_for`,
    );
    assert.equal(ninaRequest.scheduled_for.toISOString(), expectedNinaTime.scheduled_for.toISOString());
    const ninaMessages = await api.db.query<{
      actor_type: string; direction: string; body: string;
    }>(
      `select actor_type, direction, body from public.timeline_events
       where deal_id = $1 and id between '40000000-0000-0000-0000-000000000008'
         and '40000000-0000-0000-0000-000000000032'
       order by created_at, id`,
      [DEALS.nina],
    );
    assert.deepEqual(ninaMessages.map(({ actor_type, direction }) => [actor_type, direction]), [
      ['buyer', 'inbound'], ['ai', 'outbound'], ['buyer', 'inbound'], ['ai', 'outbound'], ['system', 'internal'],
    ]);
    assert.match(ninaMessages[3].body, /A representative will confirm it\./);
    assert.equal((await api.db.query<{ count: number }>(
      `select count(*)::int as count from public.audit_events
       where entity_id = '50000000-0000-0000-0000-000000000002'
         and action = 'request_appointment' and new_value = 'requested'`,
    ))[0].count, 1);
    const mayaAppointment = gm.body.find((item: { id: string }) =>
      item.id === '50000000-0000-0000-0000-000000000003');
    const [mayaRequest] = await api.db.query<{ created_at: Date }>(
      `select created_at from public.timeline_events
       where id = '40000000-0000-0000-0000-000000000011'`,
    );
    assert.equal(mayaAppointment.createdAt, mayaRequest.created_at.toISOString());
    assert.equal((await call(null, 'GET', '/api/appointments')).status, 401);
  });

  it('creates and edits an appointment for a rep-owned customer', async () => {
    const created = await call(STAFF.dana, 'POST', '/api/appointments', {
      dealId: DEALS.jordan,
      scheduledFor: '2026-11-10T15:30:00.000Z',
      outcomeNote: 'Bring trade-in details',
    });
    assert.equal(created.status, 201);
    assert.deepEqual(
      [created.body.dealId, created.body.buyer, created.body.status, created.body.outcomeNote],
      [DEALS.jordan, 'Jordan Lee', 'confirmed', 'Bring trade-in details'],
    );
    assert.ok(Number.isFinite(Date.parse(created.body.createdAt)));
    const [requestAudit] = await api.db.query<{ created_at: Date }>(
      `select created_at from public.audit_events
       where entity_id = $1 and action = 'create_confirmed_appointment'`,
      [created.body.id],
    );
    assert.equal(created.body.createdAt, requestAudit.created_at.toISOString());
    const [request] = await api.db.query<{
      requested_by_type: string; requested_by_id: string | null; confirmed_by: string | null;
    }>('select requested_by_type, requested_by_id, confirmed_by from public.appointments where id = $1',
    [created.body.id]);
    assert.deepEqual(request, { requested_by_type: 'rep', requested_by_id: STAFF.dana, confirmed_by: STAFF.dana });
    assert.equal((await api.db.query<{ count: number }>(
      `select count(*)::int as count from public.audit_events
       where entity_id = $1 and field_name = 'status' and old_value is null and new_value = 'confirmed'`,
      [created.body.id]))[0].count, 1);

    const resetToRequested = await call(STAFF.dana, 'PATCH', `/api/appointments/${created.body.id}`, {
      scheduledFor: '2026-11-10T16:00:00.000Z',
      status: 'requested',
    });
    assert.equal(resetToRequested.status, 200);
    assert.equal(resetToRequested.body.confirmedById, null);
    const confirmed = await call(STAFF.dana, 'POST', `/api/appointments/${created.body.id}/confirm`, {
      scheduledFor: '2026-11-10T16:00:00.000Z',
      status: 'confirmed',
      outcomeNote: 'Customer confirmed by phone',
    });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.status, 'confirmed');
    const [record] = await api.db.query<{ confirmed_by: string; outcome_note: string }>(
      'select confirmed_by, outcome_note from public.appointments where id = $1', [created.body.id],
    );
    assert.deepEqual(record, { confirmed_by: STAFF.dana, outcome_note: 'Customer confirmed by phone' });
    const [audit] = await api.db.query<{ old_value: string; new_value: string; actor_id: string }>(
      `select old_value, new_value, actor_id from public.audit_events
       where entity_id = $1 and field_name = 'status' and old_value = 'requested'`,
      [created.body.id]);
    assert.deepEqual(audit, { old_value: 'requested', new_value: 'confirmed', actor_id: STAFF.dana });
  });

  it('creates a to-do for a passed confirmed visit and resolves it with an outcome', async () => {
    const created = await call(STAFF.dana, 'POST', '/api/appointments', {
      dealId: DEALS.jordan, scheduledFor: '2000-11-10T16:00:00.000Z',
    });
    assert.equal(created.status, 201);
    const overview = await call(STAFF.dana, 'GET', '/api/appointments/overview');
    assert.equal(overview.status, 200);
    assert.equal(overview.body.visitsToRecord.length, 1);
    const [openItem] = await api.db.query<{ type: string; appointment_id: string; status: string }>(
      'select type, appointment_id, status from public.open_items where appointment_id = $1',
      [created.body.id]);
    assert.deepEqual(openItem, { type: 'visit_outcome', appointment_id: created.body.id, status: 'open' });

    const outcome = await call(STAFF.dana, 'POST', `/api/appointments/${created.body.id}/outcome`, {
      status: 'completed', outcomeNote: 'Test drove the RAV4 and agreed to buy.',
    });
    assert.equal(outcome.status, 200);
    assert.equal(outcome.body.status, 'completed');
    const afterOutcome = await call(STAFF.dana, 'GET', '/api/appointments/overview');
    assert.equal(afterOutcome.body.metrics.requested, overview.body.metrics.requested);
    assert.equal(afterOutcome.body.metrics.completed, overview.body.metrics.completed + 1);
    assert.equal(afterOutcome.body.metrics.noShow, overview.body.metrics.noShow);
    assert.equal(afterOutcome.body.metrics.showRate,
      afterOutcome.body.metrics.completed
      / (afterOutcome.body.metrics.completed + afterOutcome.body.metrics.noShow));
    const [resolved] = await api.db.query<{ status: string; resolved_at: Date | null }>(
      'select status, resolved_at from public.open_items where appointment_id = $1', [created.body.id]);
    assert.equal(resolved.status, 'resolved');
    assert.ok(resolved.resolved_at);
    const [deal] = await api.db.query<{ stage: string }>(
      'select stage from public.deals where id = $1', [DEALS.jordan]);
    assert.equal(deal.stage, 'working');

    await call(STAFF.dana, 'PATCH', `/api/appointments/${created.body.id}`, {
      status: 'confirmed', scheduledFor: created.body.scheduledFor,
    });
    const [reopened] = await api.db.query<{ status: string }>(
      'select status from public.open_items where appointment_id = $1', [created.body.id]);
    assert.equal(reopened.status, 'open');
    await call(STAFF.dana, 'PATCH', `/api/appointments/${created.body.id}`, {
      status: 'cancelled', scheduledFor: created.body.scheduledFor,
    });
    const [cancelledItem] = await api.db.query<{ status: string }>(
      'select status from public.open_items where appointment_id = $1', [created.body.id]);
    assert.equal(cancelledItem.status, 'cancelled');
  });

  it('lets a manager schedule an unassigned customer and blocks reps from other customers', async () => {
    const created = await call(STAFF.karen, 'POST', '/api/appointments', {
      dealId: DEALS.nina, scheduledFor: '2026-11-12T14:00:00.000Z',
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.ownerId, null);
    assert.equal((await call(STAFF.dana, 'POST', '/api/appointments', {
      dealId: DEALS.nina, scheduledFor: '2026-11-12T14:00:00.000Z',
    })).status, 403);
    assert.equal((await call(STAFF.arjun, 'PATCH', `/api/appointments/${created.body.id}`, {
      scheduledFor: '2026-11-12T14:00:00.000Z', status: 'requested',
    })).status, 403);
  });

  it('lets a GM create a requested appointment and allows editing to any status', async () => {
    const created = await call(STAFF.karen, 'POST', '/api/appointments', {
      dealId: DEALS.nina,
      scheduledFor: '2026-11-12T14:00:00.000Z',
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, 'requested');
    assert.equal(created.body.confirmedById, null);

    const completed = await call(STAFF.karen, 'PATCH', `/api/appointments/${created.body.id}`, {
      scheduledFor: '2026-11-12T14:00:00.000Z',
      status: 'completed',
    });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.status, 'completed');
    assert.equal(completed.body.confirmedById, STAFF.karen);
    assert.equal((await call(STAFF.karen, 'PATCH', `/api/appointments/${created.body.id}`, {
      scheduledFor: '2026-11-12T14:00:00.000Z',
      status: 'requested',
    })).status, 200);
  });

  it('rejects invalid appointment data and missing records', async () => {
    assert.equal((await call(STAFF.dana, 'POST', '/api/appointments', {
      dealId: DEALS.jordan, scheduledFor: 'soon',
    })).status, 400);
    assert.equal((await call(STAFF.dana, 'POST', '/api/appointments', {
      dealId: DEALS.jordan, scheduledFor: '2026-11-12T14:00:00.000Z', status: 'unknown',
    })).status, 400);
    assert.equal((await call(STAFF.dana, 'PATCH',
      '/api/appointments/ffffffff-ffff-ffff-ffff-ffffffffffff', {
        scheduledFor: '2026-11-12T14:00:00.000Z',
      })).status, 404);
  });
});
