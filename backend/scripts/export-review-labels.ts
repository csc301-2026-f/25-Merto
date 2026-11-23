// Exports GM reviews from the database as a signal-label snapshot for
// retraining, and reports whether there are enough new labels to bother.
// Read-only: it changes nothing in the database and trains nothing.
//
//   npm run eval:export-labels -- [--out file] [--previous earlier-snapshot.json]
//     [--cooling-days 7] [--holdout-percent 20] [--min-new 50] [--min-new-per-signal 10]
//
// Snapshots hold real message text: keep them out of git (ml/feedback/ is ignored).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { postgresDatabase } from '../src/db.ts';
import { flagsForTraining } from '../src/evaluation/repository.ts';
import {
  buildTrainingLabels, DEFAULT_LABEL_OPTIONS, type LabelOptions, type TrainingLabel,
} from '../src/evaluation/training-labels.ts';

try { process.loadEnvFile(); } catch { /* Environment variables also work. */ }
const url = process.env.DATABASE_URL;
if (!url || url.includes('[YOUR-PASSWORD]')) {
  throw new Error('Set DATABASE_URL in backend/.env before exporting review labels.');
}

const { values: args } = parseArgs({ options: {
  out: { type: 'string' },
  previous: { type: 'string' },
  'cooling-days': { type: 'string' },
  'holdout-percent': { type: 'string' },
  'min-new': { type: 'string' },
  'min-new-per-signal': { type: 'string' },
} });
function count(name: keyof typeof args, fallback: number, max = Infinity) {
  const raw = args[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > max) throw new Error(`--${name} must be a whole number from 0 to ${max}.`);
  return value;
}

const now = new Date();
let previousKeys: Set<string> | undefined;
if (args.previous) {
  const previous = JSON.parse(readFileSync(args.previous, 'utf8')) as { labels?: TrainingLabel[] };
  if (!Array.isArray(previous.labels)) throw new Error(`${args.previous} is not a label snapshot.`);
  previousKeys = new Set(previous.labels.map((label) => label.key));
}
const options: LabelOptions = {
  now,
  coolingDays: count('cooling-days', DEFAULT_LABEL_OPTIONS.coolingDays),
  holdoutPercent: count('holdout-percent', DEFAULT_LABEL_OPTIONS.holdoutPercent, 100),
  minNewLabels: count('min-new', DEFAULT_LABEL_OPTIONS.minNewLabels),
  minNewPerSignal: count('min-new-per-signal', DEFAULT_LABEL_OPTIONS.minNewPerSignal),
  previousKeys,
};

const db = postgresDatabase(url);
try {
  const rows = await flagsForTraining(db);
  const result = buildTrainingLabels(rows, options);
  const out = resolve(args.out ?? `ml/feedback/review-labels-${now.toISOString().replaceAll(':', '-')}.json`);
  mkdirSync(dirname(out), { recursive: true });
  const { previousKeys: _keys, ...savedOptions } = options;
  writeFileSync(out, `${JSON.stringify({
    format: 'merto-review-labels/1',
    exportedAt: now.toISOString(),
    previousSnapshot: args.previous ?? null,
    options: savedOptions,
    flagsRead: rows.length,
    ...result,
  }, null, 2)}\n`);

  const { summary, skipped, triage, labels } = result;
  console.log(`Read ${rows.length} flags. Wrote ${labels.length} labels and ${triage.length} triage items to ${out}`);
  console.log(`Skipped: ${Object.entries(skipped).map(([reason, n]) => `${reason} ${n}`).join(', ')}`);
  console.table(Object.fromEntries(Object.entries(summary.signals).map(([signal, c]) => [signal, {
    'train +': c.train.positive, 'train -': c.train.negative,
    'holdout +': c.holdout.positive, 'holdout -': c.holdout.negative, 'new train': c.newTrain,
  }])));
  const { readiness } = summary;
  console.log(readiness.ready
    ? `Ready to retrain: ${summary.newTrainLabels} new training labels (${readiness.bestSignal}: ${readiness.bestSignalNewTrain}).`
    : `Not ready to retrain: ${summary.newTrainLabels}/${readiness.minNewLabels} new training labels, `
      + `best signal ${readiness.bestSignal} ${readiness.bestSignalNewTrain}/${readiness.minNewPerSignal}.`);
  if (triage.length) console.log(`${triage.length} reviews need a person to settle them (see "triage" in the file).`);
} finally {
  await db.close();
}
