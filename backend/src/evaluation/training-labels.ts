// Turns GM reviews into wording-signal labels for retraining the signal model.
// Pure: the export script loads the rows (repository.flagsForTraining) and
// writes the snapshot. Nothing here trains or changes a model.
//
// A review becomes a label only when it says whether the wording was read
// right. Context mistakes (already handled, visit confirmed) belong to the
// deal-history rules in detect.ts, so they never teach the model. Anything
// unclear or contradictory goes to triage for a person to settle.
import { createHash } from 'node:crypto';
import { FLAG_SIGNALS, type Side, type Signal } from './model-engine.ts';
import type { FlagForTraining } from './repository.ts';
import { isDisputed } from './review-policy.ts';

export interface LabelSource {
  store: FlagForTraining['store'];
  flagId: string;
  flagType: FlagForTraining['flagType'];
  origin: FlagForTraining['source'];
  reviewStatus: FlagForTraining['reviewStatus'];
  reviewReason: FlagForTraining['reviewReason'];
  reviewedBy: string | null;
  reviewedAt: string | null;
  modelVersion: string | null;
}

export interface TrainingLabel {
  key: string; // `${messageId}:${signal}`
  messageId: string;
  dealId: string;
  side: Side;
  signal: Signal;
  label: 0 | 1;
  text: string;
  split: 'train' | 'holdout';
  // Not in the previous snapshot (every label is new without one).
  isNew: boolean;
  // Other messages with the same normalized text and label, folded into this one.
  duplicates: number;
  sources: LabelSource[];
}

export type TriageReason =
  | 'unclear_reason' // false positive marked not_a_problem or other
  | 'ambiguous_buyer_message' // a missed handoff answered several buyer messages
  | 'no_buyer_message' // a missed handoff with no buyer message before the reply
  | 'conflicting_reviews' // the same message and signal reviewed both ways
  | 'same_text_conflict' // the same wording labelled both ways on different messages
  | 'needs_second_review'; // strongly disagrees with the model and no second GM has agreed yet

export interface TriageItem {
  reason: TriageReason;
  signal: Signal;
  messageIds: string[];
  text: string;
  sources: LabelSource[];
}

export interface LabelOptions {
  now: Date;
  // A review may still be changed (confirmed issue <-> false positive), so it
  // counts only once it is this old. Resolved flags are final and skip the wait.
  coolingDays: number;
  // Share of deals, chosen by a hash of the deal ID, kept out of training.
  holdoutPercent: number;
  // Fewest new training labels, overall and on the best signal, before a retrain is worth running.
  minNewLabels: number;
  minNewPerSignal: number;
  // Keys of the labels in the previous snapshot, if any.
  previousKeys?: ReadonlySet<string>;
}

export const DEFAULT_LABEL_OPTIONS: Omit<LabelOptions, 'now'> = {
  coolingDays: 7, holdoutPercent: 20, minNewLabels: 50, minNewPerSignal: 10,
};

// Seeded and check:hosted deals use fixed IDs (supabase/seed, scripts/check-hosted.ts).
// The scenario deals among them are the held-out evaluation set, so no review
// of a fixed-ID deal may become a training label.
export const isFixtureDeal = (dealId: string) => /^3\d000000-0000-0000-0000-/.test(dealId);

// The same cleanup the model service applies before predicting, plus case and spacing.
export const normalizeText = (text: string) =>
  text.replace(/^\[Simulated[^\]]*\]\s*/, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Stable across runs and machines: the same deal always lands in the same split.
export function isHoldoutDeal(dealId: string, holdoutPercent: number) {
  return createHash('sha256').update(dealId).digest().readUInt32BE(0) % 100 < holdoutPercent;
}

const SIGNAL_BY_FLAG = new Map(FLAG_SIGNALS.map(([flagType, side, signal]) => [flagType, { side, signal }]));
const DAY_MS = 24 * 60 * 60 * 1000;

interface Candidate {
  messageId: string;
  dealId: string;
  side: Side;
  signal: Signal;
  label: 0 | 1;
  text: string;
  source: LabelSource;
}

export function buildTrainingLabels(rows: FlagForTraining[], options: LabelOptions) {
  const skipped = { pending: 0, noSignal: 0, fixtureDeal: 0, cooling: 0, contextReason: 0, secondReviewDisagreed: 0 };
  const triage: TriageItem[] = [];
  const candidates: Candidate[] = [];

  for (const row of rows) {
    const mapping = SIGNAL_BY_FLAG.get(row.flagType);
    const source: LabelSource = {
      store: row.store, flagId: row.flagId, flagType: row.flagType, origin: row.source,
      reviewStatus: row.reviewStatus, reviewReason: row.reviewReason, reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt ? new Date(row.reviewedAt).toISOString() : null, modelVersion: row.modelVersion,
    };
    if (row.reviewStatus === 'pending' || !row.reviewedAt) { skipped.pending++; continue; }
    if (!mapping) { skipped.noSignal++; continue; }
    if (isFixtureDeal(row.dealId)) { skipped.fixtureDeal++; continue; }
    if (row.reviewStatus !== 'resolved'
      && options.now.getTime() - new Date(row.reviewedAt).getTime() < options.coolingDays * DAY_MS) {
      skipped.cooling++; continue;
    }

    let label: 0 | 1;
    if (row.reviewStatus === 'confirmed_issue' || row.reviewStatus === 'resolved') label = 1;
    else if (row.reviewReason === 'misread_wording') label = 0;
    else if (row.reviewReason === 'already_handled' || row.reviewReason === 'visit_confirmed') {
      skipped.contextReason++; continue;
    } else {
      triage.push({ reason: 'unclear_reason', signal: mapping.signal, messageIds: [row.evidenceEventId],
        text: row.evidenceBody, sources: [source] });
      continue;
    }

    // A second GM who disagreed overrules the review. A review that strongly
    // disagrees with the model waits for a second GM to agree.
    if (row.secondReview === 'disagree') { skipped.secondReviewDisagreed++; continue; }
    if (isDisputed(label, row.modelScore) && row.secondReview !== 'agree') {
      triage.push({ reason: 'needs_second_review', signal: mapping.signal, messageIds: [row.evidenceEventId],
        text: row.evidenceBody, sources: [source] });
      continue;
    }

    // An AI-side signal is read from the flagged reply itself; a buyer-side one
    // from the single buyer message that reply answered.
    let message = { id: row.evidenceEventId, body: row.evidenceBody };
    if (mapping.side === 'buyer') {
      if (row.buyerTurn.length !== 1) {
        triage.push({
          reason: row.buyerTurn.length === 0 ? 'no_buyer_message' : 'ambiguous_buyer_message',
          signal: mapping.signal, messageIds: row.buyerTurn.map((m) => m.id),
          text: row.buyerTurn.map((m) => m.body).join('\n'), sources: [source],
        });
        continue;
      }
      message = row.buyerTurn[0];
    }
    candidates.push({ messageId: message.id, dealId: row.dealId, ...mapping, label, text: message.body, source });
  }

  // One label per message and signal. Both stores may hold a review of it;
  // reviews that disagree go to triage instead.
  const byKey = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const key = `${candidate.messageId}:${candidate.signal}`;
    byKey.set(key, [...byKey.get(key) ?? [], candidate]);
  }
  const merged: Omit<TrainingLabel, 'split' | 'isNew' | 'duplicates'>[] = [];
  for (const [key, group] of byKey) {
    const [first] = group;
    const sources = group.map((c) => c.source);
    if (group.some((c) => c.label !== first.label)) {
      triage.push({ reason: 'conflicting_reviews', signal: first.signal, messageIds: [first.messageId],
        text: first.text, sources });
      continue;
    }
    const { source: _source, ...rest } = first;
    merged.push({ key, ...rest, sources });
  }

  // AI replies are templated, so one wording can appear on many deals. Wording
  // seen on any holdout deal is held out for every signal, so it cannot leak
  // into training through another copy.
  const heldOutTexts = new Set(merged.filter((l) => isHoldoutDeal(l.dealId, options.holdoutPercent))
    .map((l) => normalizeText(l.text)));

  // Fold repeats of the same wording into one label, so a template reviewed on
  // fifty deals counts once. Repeats labelled both ways go to triage.
  const byText = new Map<string, typeof merged>();
  for (const label of merged) {
    const textKey = `${label.signal}:${normalizeText(label.text)}`;
    byText.set(textKey, [...byText.get(textKey) ?? [], label]);
  }
  const labels: TrainingLabel[] = [];
  for (const group of byText.values()) {
    group.sort((a, b) => a.key.localeCompare(b.key));
    const [first] = group;
    if (group.some((l) => l.label !== first.label)) {
      triage.push({ reason: 'same_text_conflict', signal: first.signal, messageIds: group.map((l) => l.messageId),
        text: first.text, sources: group.flatMap((l) => l.sources) });
      continue;
    }
    const split = heldOutTexts.has(normalizeText(first.text)) ? 'holdout' : 'train';
    // Prefer a holdout deal's copy, so a held-out label points at a held-out deal where it can.
    const kept = group.find((l) => isHoldoutDeal(l.dealId, options.holdoutPercent)) ?? first;
    labels.push({
      ...kept, split, isNew: !options.previousKeys?.has(kept.key), duplicates: group.length - 1,
      sources: group.flatMap((l) => l.sources),
    });
  }
  labels.sort((a, b) => a.signal.localeCompare(b.signal) || a.key.localeCompare(b.key));

  return { labels, triage, skipped, summary: summarize(labels, options) };
}

function summarize(labels: TrainingLabel[], options: LabelOptions) {
  const signals = Object.fromEntries(FLAG_SIGNALS.map(([, , signal]) => [signal, {
    train: { positive: 0, negative: 0 }, holdout: { positive: 0, negative: 0 }, newTrain: 0,
  }])) as Record<Signal, { train: { positive: number; negative: number };
    holdout: { positive: number; negative: number }; newTrain: number }>;
  for (const label of labels) {
    const counts = signals[label.signal];
    counts[label.split][label.label === 1 ? 'positive' : 'negative']++;
    if (label.split === 'train' && label.isNew) counts.newTrain++;
  }
  const newTrainLabels = labels.filter((l) => l.split === 'train' && l.isNew).length;
  const [bestSignal, best] = Object.entries(signals)
    .sort(([a, x], [b, y]) => y.newTrain - x.newTrain || a.localeCompare(b))[0];
  return {
    signals,
    newTrainLabels,
    readiness: {
      ready: newTrainLabels >= options.minNewLabels && best.newTrain >= options.minNewPerSignal,
      minNewLabels: options.minNewLabels,
      minNewPerSignal: options.minNewPerSignal,
      bestSignal,
      bestSignalNewTrain: best.newTrain,
    },
  };
}
