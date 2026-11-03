import type { Database } from '../db.ts';
import { badRequest, HttpError } from '../errors.ts';
import { rulesEngine, type EvaluationEngine } from './engine.ts';
import { createRemoteModelEngine } from './model-engine.ts';
import type { EvaluationContextProvider } from './routes.ts';
import { mpnetEvaluationStore } from './store.ts';

export const HOSTED_EVALUATORS = [
  { id: 'deterministic', name: 'Deterministic rules' },
  { id: 'mpnet', name: 'MPNet v3' },
] as const;

export function hostedEvaluationContext(db: Database,
  loadModel: () => Promise<EvaluationEngine>): EvaluationContextProvider {
  let loaded: Promise<EvaluationEngine> | undefined;
  function model() {
    if (!loaded) {
      const pending = loadModel();
      loaded = pending;
      void pending.catch(() => { if (loaded === pending) loaded = undefined; });
    }
    return loaded;
  }
  const mpnet: EvaluationEngine = {
    detect: async conversation => (await model()).detect(conversation),
    status: async () => {
      try { return await (await model()).status(); }
      catch { return { id: 'mpnet', mode: 'model', name: 'MPNet v3', ready: false }; }
    },
  };
  const modelDb = mpnetEvaluationStore(db);
  return requested => {
    const id = requested ?? 'deterministic';
    if (id !== 'deterministic' && id !== 'mpnet') throw badRequest('Choose deterministic or MPNet.');
    const selected = id === 'mpnet' ? mpnet : rulesEngine;
    return { db: id === 'mpnet' ? modelDb : db, engine: {
      detect: selected.detect,
      status: async () => ({ ...await selected.status(), id, scope: 'hosted', choices: [...HOSTED_EVALUATORS] }),
    } };
  };
}

export function configuredEvaluationContext(db: Database,
  env: { MERTO_MODEL_URL?: string; MERTO_MODEL_TOKEN?: string } = process.env) {
  if (!env.MERTO_MODEL_URL) return undefined;
  const url = env.MERTO_MODEL_URL;
  const token = env.MERTO_MODEL_TOKEN;
  if (!token) throw new HttpError(503, 'Configure MERTO_MODEL_TOKEN alongside MERTO_MODEL_URL.');
  return hostedEvaluationContext(db, () => createRemoteModelEngine(url, token));
}
