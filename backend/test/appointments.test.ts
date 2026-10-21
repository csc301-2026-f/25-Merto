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
      [DEALS.jordan, 'Jordan Lee', 'requested', 'Bring trade-in details'],
    );

    const confirmed = await call(STAFF.dana, 'PATCH', `/api/appointments/${created.body.id}`, {
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
