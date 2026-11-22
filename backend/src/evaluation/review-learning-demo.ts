// Local demo only (backend/ml/LOCAL_CRM_DEMO.md). Adds simulated GM reviews to
// the sandbox, then refits the MPNet classifier heads from them through the same
// label export the real pipeline uses (training-labels.ts). Never mounted by the
// deployed app: local-demo.ts passes these routes in for the MPNet sandbox only.
import { readFileSync } from 'node:fs';
import express from 'express';
import { currentStaff, requireGm, type Staff } from '../auth.ts';
import type { Database } from '../db.ts';
import { conflict } from '../errors.ts';
import { STAFF } from '../seed-ids.ts';
import type { EvaluationEngine } from './engine.ts';
import { FLAG_SIGNALS, type Side, type Signal } from './model-engine.ts';
import * as repo from './repository.ts';
import { reviewLabel } from './review-policy.ts';
import * as service from './service.ts';
import { evaluationTables } from './store.ts';
import {
  buildTrainingLabels, DEFAULT_LABEL_OPTIONS, isFixtureDeal, isHoldoutDeal, type TriageReason,
} from './training-labels.ts';

interface DemoItem {
  kind: string; // reliable, or a review the label rules must handle
  family?: string;
  side: Side;
  signal: Signal;
  label: boolean; // the true answer for this signal
  text: string;
  copies?: number;
  review?: string | string[]; // what the simulated GM records, for the non-reliable kinds
  opener?: string; // an earlier buyer message, for the ambiguous handoff case
}
interface DemoData { neutralAiReply: string; families: Record<string, string>; reviewItems: DemoItem[]; heldOut: DemoItem[] }
const DATA: DemoData = JSON.parse(readFileSync(new URL('./demo/review-learning.json', import.meta.url), 'utf8'));

export interface ModelAdmin {
  retrain(body: unknown): Promise<any>;
  reset(): Promise<{ version: string }>;
}

const DEAL_PREFIX = '5d000000-0000-0000-0000-'; // not a fixture ID, so its reviews can become labels
const BUYER_PREFIX = '5b000000-0000-0000-0000-';
const fixedId = (prefix: string, n: number) => prefix + String(n).padStart(12, '0');
const flagTypeFor = (signal: Signal) => FLAG_SIGNALS.find(([, , s]) => s === signal)![0];
const DAY = 24 * 60 * 60 * 1000;
// The simulated reviews come from a second, simulated GM, so the signed-in GM
// can give the second opinions.
const SIMULATED_GM: Staff = { id: '1d000000-0000-0000-0000-000000000001', name: 'Sam Reyes (simulated GM)', role: 'gm' };

// Which demo item each simulated deal holds, in creation order.
function demoPlan() {
  const plan: { dealId: string; item: DemoItem; copy: number; replyId?: string }[] = [];
  for (const item of DATA.reviewItems) {
    for (let copy = 0; copy < (item.copies ?? 1); copy++) plan.push({ dealId: fixedId(DEAL_PREFIX, plan.length + 1), item, copy });
  }
  return plan;
}

async function simulatedDeals(db: Database) {
  const [row] = await db.query<{ n: number }>(
    `select count(*)::int as n from public.deals where id::text like '5d000000-%'`);
  return row.n;
}

export async function simulateReviews(db: Database, staff: Staff, engine: EvaluationEngine) {
  requireGm(staff, 'simulate GM reviews');
  if (await simulatedDeals(db) > 0) {
    throw conflict('Simulated reviews were already added. Restart the local demo to start over.');
  }
  const plan = demoPlan();

  // One small conversation per review, two weeks old, owned by a seeded rep.
  await db.transaction(async (tx) => {
    await tx.query(`insert into public.staff_users (id, name, role, email) values ($1, $2, 'gm', 'simulated-gm@example.test')
      on conflict (id) do nothing`, [SIMULATED_GM.id, SIMULATED_GM.name]);
    for (const [i, entry] of plan.entries()) {
      const buyer = fixedId(BUYER_PREFIX, i + 1);
      await tx.query(`insert into public.buyers (id, name, email, preferred_channel) values ($1, $2, $3, 'sms')`,
        [buyer, `Simulated buyer ${i + 1}`, `simulated-${i + 1}@example.test`]);
      await tx.query(`insert into public.deals (id, buyer_id, owner_id, vehicle_interest, source, stage, created_at)
        values ($1, $2, $3, 'Demo vehicle', 'web', 'engaged', $4)`,
      [entry.dealId, buyer, i % 2 ? STAFF.arjun : STAFF.dana, new Date(Date.now() - 15 * DAY)]);
      const messages: [string, string][] = entry.item.side === 'ai' ? [['ai', entry.item.text]]
        : [...(entry.item.opener ? [['buyer', entry.item.opener] as [string, string]] : []),
          ['buyer', entry.item.text], ['ai', DATA.neutralAiReply]];
      for (const [m, [actor, body]] of messages.entries()) {
        const [event] = await tx.query<{ id: string }>(`
          insert into public.timeline_events (deal_id, actor_type, channel, direction, body, created_at)
          values ($1, $2, 'sms', $3, $4, $5) returning id`,
        [entry.dealId, actor, actor === 'ai' ? 'outbound' : 'inbound', body, new Date(Date.now() - 14 * DAY + m * 60_000)]);
        if (actor === 'ai') entry.replyId = event.id;
      }
    }
  });

  await service.evaluateDeals(db, staff, plan.map((entry) => entry.dealId), engine);

  // The simulated GM: a reliable review records the true answer for the flag the
  // model raised, or adds the flag the model missed. The other kinds record what
  // their item says, so the label rules have something to catch.
  const counts = { confirmed: 0, falsePositive: 0, manual: 0, notReviewed: 0 };
  const byKind: Record<string, number> = {};
  const recent: string[] = [];
  for (const entry of plan) {
    const { item } = entry;
    const flagType = flagTypeFor(item.signal);
    const flag = (await repo.dealFlags(db, entry.dealId)).find((f) => f.flagType === flagType);
    const wanted = item.kind === 'reliable' ? (item.label ? 'confirmed_issue' : 'misread_wording')
      : Array.isArray(item.review) ? item.review[entry.copy] : item.review ?? 'confirmed_issue';
    if (flag) {
      if (wanted === 'confirmed_issue') {
        await service.reviewFlag(db, SIMULATED_GM, flag.id, 'confirmed_issue', 'Simulated GM review.', undefined, engine);
        counts.confirmed++;
      } else {
        await service.reviewFlag(db, SIMULATED_GM, flag.id, 'false_positive',
          wanted === 'other' ? 'Simulated GM review: fine by me.' : 'Simulated GM review.', wanted, engine);
        counts.falsePositive++;
      }
    } else if (wanted === 'confirmed_issue') {
      await service.addManualFlag(db, SIMULATED_GM, entry.dealId, entry.replyId, flagType,
        'Simulated GM review: the model missed this.', engine);
      counts.manual++;
    } else {
      counts.notReviewed++; // the model passed it and it was fine: a GM never sees it
      continue;
    }
    byKind[item.kind] = (byKind[item.kind] ?? 0) + 1;
    if (item.kind === 'too_recent') recent.push(entry.dealId);
  }

  // Reviews count only after the cooling period, so date them 10 days back,
  // except the ones meant to show the cooling period.
  const flags = evaluationTables(db).flags;
  await db.query(`update ${flags} set reviewed_at = now() - interval '10 days'
    where deal_id::text like '5d000000-%' and review_status <> 'pending'`);
  if (recent.length) {
    await db.query(`update ${flags} set reviewed_at = now() - interval '1 day' where deal_id = any($1::uuid[])`, [recent]);
  }
  const reviews = counts.confirmed + counts.falsePositive + counts.manual;
  // Reviews that strongly disagree with the model wait for a second GM; the rest
  // go straight to the label rules.
  const disputed = await service.secondReviewQueue(db, staff);
  const sentForSecondOpinion = {
    total: disputed.length,
    dismissedWhileModelSureOfProblem: disputed.filter((f) => f.reviewStatus === 'false_positive').length,
    addedWhileModelSureItWasFine: disputed.filter((f) => f.source === 'manual').length,
  };
  return { deals: plan.length, reviews, ...counts, byKind, sentForSecondOpinion };
}

// The signed-in GM gives the second opinions still waiting, as a careful second
// reviewer would: agree when the first review matches the true answer.
export async function simulateSecondOpinions(db: Database, staff: Staff) {
  const byDeal = new Map(demoPlan().map((entry) => [entry.dealId, entry.item]));
  let agreed = 0;
  let disagreed = 0;
  for (const flag of await service.secondReviewQueue(db, staff)) {
    const item = byDeal.get(flag.dealId);
    if (!item || !flag.canReview) continue;
    const decision = reviewLabel(flag.reviewStatus, flag.reviewReason) === (item.label ? 1 : 0) ? 'agree' : 'disagree';
    await service.secondReviewFlag(db, staff, flag.id, decision);
    if (decision === 'agree') agreed++; else disagreed++;
  }
  return { agreed, disagreed };
}

function exportLabels(rows: repo.FlagForTraining[]) {
  return buildTrainingLabels(rows, { ...DEFAULT_LABEL_OPTIONS, now: new Date() });
}

function labelReport(result: ReturnType<typeof exportLabels>) {
  const triage: Partial<Record<TriageReason, number>> = {};
  for (const item of result.triage) triage[item.reason] = (triage[item.reason] ?? 0) + 1;
  return {
    used: result.labels.filter((l) => l.split === 'train').length,
    gmHoldout: result.labels.filter((l) => l.split === 'holdout').length,
    duplicatesFolded: result.labels.reduce((sum, l) => sum + l.duplicates, 0),
    skipped: result.skipped,
    triage,
    readiness: { ...result.summary.readiness, newTrainLabels: result.summary.newTrainLabels },
  };
}

export async function reviewLearningStatus(db: Database, staff: Staff, engine: EvaluationEngine) {
  requireGm(staff, 'view the review-learning demo');
  return {
    simulated: await simulatedDeals(db) > 0,
    secondOpinionsWaiting: (await service.secondReviewQueue(db, staff)).length,
    modelVersion: (await engine.status()).version ?? null,
    labels: labelReport(exportLabels(await repo.flagsForTraining(db))),
  };
}

export async function retrainFromReviews(db: Database, staff: Staff, admin: ModelAdmin, reload: () => Promise<void>) {
  requireGm(staff, 'retrain the demo model');
  const result = exportLabels(await repo.flagsForTraining(db));
  const labels = labelReport(result);
  if (!labels.readiness.ready) {
    throw conflict(`Not enough reviews to retrain yet: ${labels.readiness.newTrainLabels} of `
      + `${labels.readiness.minNewLabels} training labels.`);
  }
  const row = (l: { side: Side; signal: Signal; label: 0 | 1 | boolean; text: string; family?: string }) =>
    ({ side: l.side, signal: l.signal, label: l.label ? 1 : 0, text: l.text, family: l.family });
  const model = await admin.retrain({
    labels: result.labels.filter((l) => l.split === 'train').map(row),
    gmHoldout: result.labels.filter((l) => l.split === 'holdout').map(row),
    heldOut: DATA.heldOut.map(row),
  });
  if (model.adopted) await reload(); // a model that failed the gold-set gate is not used
  return { labels, model, families: DATA.families };
}

// Preview of "Run AI evaluation" with the current model, scored with the GM
// decisions already saved. Writes nothing. "Saved" uses the same formulas as the
// metrics above the panel; "rerun" asks the current model about every evaluated
// conversation and keeps each GM decision: a dismissed flag the model no longer
// raises drops out, and a GM-added miss the model now catches counts as caught.
export async function rerunPreview(db: Database, staff: Staff, engine: EvaluationEngine) {
  requireGm(staff, 'preview an evaluation');
  const tables = evaluationTables(db);
  const deals = await db.query<{ dealId: string; result: string }>(
    `select deal_id as "dealId", result from ${tables.evaluations}`);
  const flags = await db.query<{ dealId: string; key: string; source: string; reviewStatus: string }>(`
    select deal_id as "dealId", evidence_event_id || ':' || flag_type as key, source, review_status as "reviewStatus"
    from ${tables.flags}`);

  const raised = new Set<string>();
  const flaggedByModel = new Set<string>();
  const queue = deals.map((d) => d.dealId);
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let dealId = queue.shift(); dealId; dealId = queue.shift()) {
      const issues = await engine.detect(await repo.loadConversation(db, dealId));
      if (issues.length) flaggedByModel.add(dealId);
      for (const issue of issues) raised.add(`${issue.evidenceEventId}:${issue.flagType}`);
    }
  }));

  const tally = (rows: typeof flags) => {
    const confirmed = rows.filter((f) => f.source === 'evaluator' && ['confirmed_issue', 'resolved'].includes(f.reviewStatus));
    const dismissed = rows.filter((f) => f.source === 'evaluator' && f.reviewStatus === 'false_positive');
    const manual = rows.filter((f) => f.source === 'manual');
    const still = (list: typeof flags) => list.filter((f) => raised.has(f.key)).length;
    return {
      confirmed: { saved: confirmed.length, rerun: still(confirmed) },
      dismissed: { saved: dismissed.length, rerun: still(dismissed) },
      missed: { saved: manual.length, rerun: manual.length - still(manual) },
      caughtMisses: still(manual),
    };
  };
  const ratio = (part: number, whole: number) => (whole ? part / whole : null);
  const all = tally(flags);
  const manualDeals = new Set(flags.filter((f) => f.source === 'manual').map((f) => f.dealId));
  const flaggedRerun = deals.filter((d) => flaggedByModel.has(d.dealId) || manualDeals.has(d.dealId)).length;
  const flaggedSaved = deals.filter((d) => d.result === 'flagged').length;
  const heldOut = tally(flags.filter((f) => !isFixtureDeal(f.dealId) && isHoldoutDeal(f.dealId, DEFAULT_LABEL_OPTIONS.holdoutPercent)));
  return {
    modelVersion: (await engine.status()).version ?? null,
    evaluated: deals.length,
    flagged: { saved: flaggedSaved, rerun: flaggedRerun },
    flagRate: { saved: ratio(flaggedSaved, deals.length), rerun: ratio(flaggedRerun, deals.length) },
    reviewedPrecision: {
      saved: ratio(all.confirmed.saved, all.confirmed.saved + all.dismissed.saved),
      rerun: ratio(all.confirmed.rerun + all.caughtMisses, all.confirmed.rerun + all.caughtMisses + all.dismissed.rerun),
    },
    confirmed: all.confirmed,
    dismissed: all.dismissed,
    missed: all.missed,
    // The 20% of deals whose reviews never trained the model.
    heldOut: { confirmed: heldOut.confirmed, dismissed: heldOut.dismissed, missed: heldOut.missed },
  };
}

export function reviewLearningRoutes(db: Database, engine: EvaluationEngine, admin: ModelAdmin,
  reload: () => Promise<void>) {
  const router = express.Router();
  router.get('/demo/review-learning', async (_req, res) => {
    res.json(await reviewLearningStatus(db, currentStaff(res), engine));
  });
  router.post('/demo/review-learning/simulate', async (_req, res) => {
    res.json(await simulateReviews(db, currentStaff(res), engine));
  });
  router.post('/demo/review-learning/second-opinions', async (_req, res) => {
    const staff = currentStaff(res);
    requireGm(staff, 'give second opinions');
    res.json(await simulateSecondOpinions(db, staff));
  });
  router.post('/demo/review-learning/retrain', async (_req, res) => {
    res.json(await retrainFromReviews(db, currentStaff(res), admin, reload));
  });
  router.post('/demo/review-learning/recheck', async (_req, res) => {
    res.json(await rerunPreview(db, currentStaff(res), engine));
  });
  router.post('/demo/review-learning/reset', async (_req, res) => {
    requireGm(currentStaff(res), 'reset the demo model');
    const reset = await admin.reset();
    await reload();
    res.json(reset);
  });
  return router;
}

