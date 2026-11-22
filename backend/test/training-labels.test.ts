import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { flagsForTraining, type FlagForTraining } from '../src/evaluation/repository.ts';
import {
  buildTrainingLabels, DEFAULT_LABEL_OPTIONS, isHoldoutDeal, type LabelOptions,
} from '../src/evaluation/training-labels.ts';
import { sandboxDatabase } from '../src/sandbox-db.ts';
import { DEALS, STAFF } from '../src/seed-ids.ts';

const NOW = new Date('2026-11-17T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
const options = (overrides: Partial<LabelOptions> = {}): LabelOptions => ({ ...DEFAULT_LABEL_OPTIONS, now: NOW, ...overrides });

// Non-fixture deal IDs on each side of the 20% holdout split.
const dealIds = Array.from({ length: 200 }, (_, n) => `5a000000-0000-0000-0000-${String(n).padStart(12, '0')}`);
const TRAIN_DEAL = dealIds.find((id) => !isHoldoutDeal(id, 20))!;
const TRAIN_DEAL_2 = dealIds.filter((id) => !isHoldoutDeal(id, 20))[1];
const HOLDOUT_DEAL = dealIds.find((id) => isHoldoutDeal(id, 20))!;

function row(overrides: Partial<FlagForTraining> = {}): FlagForTraining {
  return {
    store: 'mpnet', flagId: randomUUID(), dealId: TRAIN_DEAL, flagType: 'tone', source: 'evaluator',
    reviewStatus: 'confirmed_issue', reviewReason: null, reviewedBy: STAFF.karen, reviewedAt: daysAgo(30),
    modelVersion: 'v3-test', modelScore: null, secondReview: null,
    evidenceEventId: randomUUID(), evidenceBody: `Reply ${randomUUID()}`, buyerTurn: [],
    ...overrides,
  };
}
const falsePositive = (reviewReason: FlagForTraining['reviewReason'], overrides: Partial<FlagForTraining> = {}) =>
  row({ reviewStatus: 'false_positive', reviewReason, ...overrides });

describe('training labels from GM reviews', () => {
  it('labels a signal only when the review judges the wording', () => {
    const rows = [
      row({ flagType: 'tone' }),
      row({ flagType: 'unsupported_price', reviewStatus: 'resolved' }),
      row({ flagType: 'appointment_certainty', source: 'manual' }),
      falsePositive('misread_wording', { flagType: 'unsupported_availability' }),
      falsePositive('already_handled'),
      falsePositive('visit_confirmed', { flagType: 'appointment_certainty' }),
      falsePositive('not_a_problem'),
      falsePositive('other'),
      row({ reviewStatus: 'pending', reviewedBy: null, reviewedAt: null }),
      row({ flagType: 'ignored_opt_out' }),
    ];
    const { labels, triage, skipped } = buildTrainingLabels(rows, options());
    assert.deepEqual(labels.map((l) => [l.signal, l.label, l.messageId]).sort(), [
      ['claims_booking', 1, rows[2].evidenceEventId],
      ['guarantees_availability', 0, rows[3].evidenceEventId],
      ['off_tone', 1, rows[0].evidenceEventId],
      ['quotes_price', 1, rows[1].evidenceEventId],
    ]);
    assert.deepEqual(triage.map((t) => [t.reason, t.sources[0].flagId]),
      [['unclear_reason', rows[6].flagId], ['unclear_reason', rows[7].flagId]]);
    assert.deepEqual(skipped, { pending: 1, noSignal: 1, fixtureDeal: 0, cooling: 0, contextReason: 2, secondReviewDisagreed: 0 });
    const manual = labels.find((l) => l.signal === 'claims_booking')!;
    assert.deepEqual([manual.sources[0].origin, manual.sources[0].modelVersion], ['manual', 'v3-test'],
      'The source records which model missed it');
  });

  it('trains on a review that strongly disagrees with the model only after a second GM agrees', () => {
    const rows = [
      falsePositive('misread_wording', { modelScore: 0.97 }), // disputed, no second opinion yet
      falsePositive('misread_wording', { modelScore: 0.97, secondReview: 'agree' }),
      falsePositive('misread_wording', { modelScore: 0.97, secondReview: 'disagree' }),
      row({ source: 'manual', modelScore: 0.04 }), // GM-added miss the model was sure was fine
      row({ modelScore: 0.95 }), // agrees with the model: no second opinion needed
      falsePositive('misread_wording', { modelScore: 0.6 }),
    ];
    const { labels, triage, skipped } = buildTrainingLabels(rows, options());
    assert.deepEqual(labels.map((l) => l.sources[0].flagId).sort(), [rows[1], rows[4], rows[5]].map((r) => r.flagId).sort());
    assert.deepEqual(triage.map((t) => [t.reason, t.sources[0].flagId]),
      [['needs_second_review', rows[0].flagId], ['needs_second_review', rows[3].flagId]]);
    assert.equal(skipped.secondReviewDisagreed, 1);
  });

  it('waits out the cooling period unless the flag is resolved', () => {
    const { labels, skipped } = buildTrainingLabels([
      row({ reviewedAt: daysAgo(2) }),
      falsePositive('misread_wording', { reviewedAt: daysAgo(6.9) }),
      row({ reviewStatus: 'resolved', reviewedAt: daysAgo(0.1) }),
    ], options());
    assert.equal(skipped.cooling, 2);
    assert.deepEqual(labels.map((l) => l.sources[0].reviewStatus), ['resolved']);
  });

  it('never labels a fixed-ID deal, so the seeded scenario deals stay held out', () => {
    const { labels, skipped } = buildTrainingLabels([row({ dealId: DEALS.maya })], options());
    assert.deepEqual([labels.length, skipped.fixtureDeal], [0, 1]);
  });

  it('puts a buyer signal on the one buyer message the flagged reply answered', () => {
    const ask = { id: randomUUID(), body: 'Can I talk to an actual person?' };
    const { labels, triage } = buildTrainingLabels([
      row({ flagType: 'missed_escalation', buyerTurn: [ask] }),
      falsePositive('misread_wording', { flagType: 'missed_price_handoff', buyerTurn: [ask] }),
      row({ flagType: 'missed_escalation', buyerTurn: [{ id: randomUUID(), body: 'Hi' }, { id: randomUUID(), body: 'Call me' }] }),
      row({ flagType: 'missed_price_handoff', source: 'manual', buyerTurn: [] }),
    ], options());
    assert.deepEqual(labels.map((l) => [l.side, l.signal, l.label, l.messageId, l.text]), [
      ['buyer', 'asks_about_price', 0, ask.id, ask.body],
      ['buyer', 'asks_for_person', 1, ask.id, ask.body],
    ]);
    assert.deepEqual(triage.map((t) => [t.reason, t.messageIds.length]),
      [['ambiguous_buyer_message', 2], ['no_buyer_message', 0]]);
  });

  it('merges agreeing reviews of one message and sends contradicting ones to triage', () => {
    const agreed = randomUUID();
    const disputed = randomUUID();
    const { labels, triage } = buildTrainingLabels([
      row({ store: 'deterministic', evidenceEventId: agreed, evidenceBody: 'Agreed', modelVersion: null }),
      row({ store: 'mpnet', evidenceEventId: agreed, evidenceBody: 'Agreed' }),
      row({ store: 'deterministic', evidenceEventId: disputed, evidenceBody: 'Disputed' }),
      falsePositive('misread_wording', { store: 'mpnet', evidenceEventId: disputed, evidenceBody: 'Disputed' }),
    ], options());
    assert.deepEqual(labels.map((l) => [l.messageId, l.sources.map((s) => s.store)]),
      [[agreed, ['deterministic', 'mpnet']]]);
    assert.deepEqual(triage.map((t) => [t.reason, t.messageIds]), [['conflicting_reviews', [disputed]]]);
  });

  it('counts a repeated wording once and sends wording labelled both ways to triage', () => {
    const { labels, triage } = buildTrainingLabels([
      row({ evidenceBody: '[Simulated] Great choice!!! Come in today!!!' }),
      row({ dealId: TRAIN_DEAL_2, evidenceBody: 'great choice!!!   come in today!!!' }),
      row({ dealId: TRAIN_DEAL_2, evidenceBody: 'Great choice!!! Come in today!!!' }),
      row({ evidenceBody: 'Thanks for waiting.' }),
      falsePositive('misread_wording', { dealId: TRAIN_DEAL_2, evidenceBody: 'Thanks for waiting.' }),
    ], options());
    assert.deepEqual(labels.map((l) => [l.duplicates, l.sources.length, l.split]), [[2, 3, 'train']]);
    assert.deepEqual(triage.map((t) => [t.reason, t.messageIds.length]), [['same_text_conflict', 2]]);
  });

  it('holds out whole deals, and any wording seen on one, for every signal', () => {
    const shared = 'This truck is definitely still here, see you at 5!';
    const { labels } = buildTrainingLabels([
      row({ dealId: HOLDOUT_DEAL, evidenceBody: shared }),
      row({ dealId: TRAIN_DEAL, evidenceBody: shared }),
      row({ dealId: TRAIN_DEAL, flagType: 'unsupported_availability', evidenceBody: shared }),
      row({ dealId: TRAIN_DEAL, flagType: 'unsupported_availability', evidenceBody: 'Only on train deals' }),
    ], options());
    assert.deepEqual(labels.map((l) => `${l.signal} ${l.split} ${l.dealId} ${l.duplicates}`).sort(), [
      `guarantees_availability holdout ${TRAIN_DEAL} 0`,
      `guarantees_availability train ${TRAIN_DEAL} 0`,
      `off_tone holdout ${HOLDOUT_DEAL} 1`,
    ]);
    const share = dealIds.filter((id) => isHoldoutDeal(id, 20)).length / dealIds.length;
    assert.ok(share > 0.1 && share < 0.3, `About a fifth of deals are held out (got ${share})`);
    assert.equal(isHoldoutDeal(HOLDOUT_DEAL, 20), true, 'The split is stable');
  });

  it('reports readiness from training labels that are new since the previous snapshot', () => {
    const rows = [row(), row(), row({ flagType: 'unsupported_price' }), row({ dealId: HOLDOUT_DEAL })];
    const first = buildTrainingLabels(rows, options({ minNewLabels: 3, minNewPerSignal: 2 }));
    assert.deepEqual([first.summary.newTrainLabels, first.summary.readiness.ready,
      first.summary.readiness.bestSignal], [3, true, 'off_tone']);
    assert.deepEqual(first.summary.signals.off_tone,
      { train: { positive: 2, negative: 0 }, holdout: { positive: 1, negative: 0 }, newTrain: 2 });

    const previousKeys = new Set(first.labels.map((l) => l.key));
    const second = buildTrainingLabels([...rows, row({ flagType: 'unsupported_price' })],
      options({ minNewLabels: 3, minNewPerSignal: 2, previousKeys }));
    assert.deepEqual(second.labels.filter((l) => l.isNew).map((l) => l.signal), ['quotes_price']);
    assert.deepEqual([second.summary.newTrainLabels, second.summary.readiness.ready], [1, false]);
  });

  it('reads both stores, with the buyer messages each missed handoff answered', async () => {
    const db = await sandboxDatabase();
    try {
      const deal = DEALS.hannah; // Seeded with no AI activity.
      const ids = Object.fromEntries(['b1', 'a1', 'b2', 'b3', 'a2'].map((name) => [name, randomUUID()]));
      const at = (minutes: number) => new Date(Date.UTC(2026, 10, 1, 10, minutes)).toISOString();
      const message = (id: string, actor: 'buyer' | 'ai', minutes: number, body: string) => db.query(`
        insert into public.timeline_events (id, deal_id, actor_type, channel, direction, body, created_at)
        values ($1, $2, $3, 'sms', $4, $5, $6)`, [id, deal, actor, actor === 'ai' ? 'outbound' : 'inbound', body, at(minutes)]);
      await message(ids.b1, 'buyer', 0, 'What is the price?');
      await message(ids.a1, 'ai', 1, 'It is $30,000!!!');
      await message(ids.b2, 'buyer', 2, 'Hmm.');
      await message(ids.b3, 'buyer', 3, 'Let me talk to someone.');
      await message(ids.a2, 'ai', 4, 'I can help with that.');
      for (const store of ['ai', 'mpnet']) {
        await db.query(`insert into public.${store}_evaluations (deal_id, result, model_version) values ($1, 'flagged', $2)`,
          [deal, store === 'mpnet' ? 'v3-test' : null]);
      }
      const flag = (store: string, evidence: string, flagType: string, version: string | null) => db.query(`
        insert into public.${store}_flags (deal_id, evidence_event_id, flag_type, severity, explanation,
          review_status, reviewed_by, reviewed_at, model_version)
        values ($1, $2, $3, 'medium', 'Test flag', 'confirmed_issue', $4, now(), $5)`,
        [deal, evidence, flagType, STAFF.karen, version]);
      await flag('ai', ids.a1, 'missed_price_handoff', null);
      await flag('mpnet', ids.a1, 'tone', 'v3-test');
      await flag('mpnet', ids.a2, 'missed_escalation', 'v3-test');

      const rows = (await flagsForTraining(db)).filter((r) => r.dealId === deal);
      assert.deepEqual(rows.map((r) => [r.store, r.flagType, r.modelVersion, r.buyerTurn.map((m) => m.id)]), [
        ['deterministic', 'missed_price_handoff', null, [ids.b1]],
        ['mpnet', 'tone', 'v3-test', []],
        ['mpnet', 'missed_escalation', 'v3-test', [ids.b2, ids.b3]],
      ]);
      assert.ok(rows.every((r) => r.reviewStatus === 'confirmed_issue' && r.reviewedAt instanceof Date));
    } finally {
      await db.close();
    }
  });
});
