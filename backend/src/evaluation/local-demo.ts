// Only the local launcher imports this. Each evaluator owns a different sandbox,
// including flags, reviews and timeline entries; request headers select a context
// without mutating global state or moving an in-flight request to another model.
import express from 'express';
import { createApp } from '../app.ts';
import type { Database } from '../db.ts';
import { rulesEngine, type EvaluationEngine } from './engine.ts';

export const DEMO_EVALUATORS = [
  { id: 'mpnet', name: 'MPNet v3' },
  { id: 'deterministic', name: 'Deterministic rules' },
] as const;
export type DemoEvaluator = (typeof DEMO_EVALUATORS)[number]['id'];
export const DEMO_EVALUATOR_HEADER = 'X-Merto-Demo-Evaluator';

export async function createLocalDemoApp(options: {
  openDatabase(): Promise<Database>;
  modelEngine(id: Exclude<DemoEvaluator, 'deterministic'>): Promise<EvaluationEngine>;
}) {
  const contexts = new Map<DemoEvaluator, Promise<{ db: Database; app: ReturnType<typeof createApp> }>>();
  function context(id: DemoEvaluator) {
    if (!contexts.has(id)) {
      const pending = (async () => {
        const evaluator = id === 'deterministic' ? rulesEngine : await options.modelEngine(id);
        const db = await options.openDatabase();
        const evaluationEngine: EvaluationEngine = {
          detect: evaluator.detect,
          status: async () => ({ ...await evaluator.status(), id, scope: 'local', choices: [...DEMO_EVALUATORS] }),
        };
        return { db, app: createApp(db, { evaluationEngine, devLoginPassword: 'test' }) };
      })();
      contexts.set(id, pending);
      // A transient load error must be retryable, and must never choose rules.
      void pending.catch(() => { if (contexts.get(id) === pending) contexts.delete(id); });
    }
    return contexts.get(id)!;
  }
  await context('mpnet');
  const app = express();
  app.use(async (req, res, next) => {
    const id = req.get(DEMO_EVALUATOR_HEADER) ?? 'mpnet';
    if (!DEMO_EVALUATORS.some(choice => choice.id === id)) {
      res.status(400).json({ error: 'Unknown local demo evaluator.' });
      return;
    }
    try { (await context(id as DemoEvaluator)).app(req, res, next); }
    catch {
      res.status(503).json({ error: 'Could not load the selected local evaluator. No rules fallback was used.' });
    }
  });
  return {
    app,
    async close() {
      const loaded = await Promise.allSettled(contexts.values());
      await Promise.all(loaded.flatMap(result => result.status === 'fulfilled' ? [result.value.db.close()] : []));
    },
  };
}
