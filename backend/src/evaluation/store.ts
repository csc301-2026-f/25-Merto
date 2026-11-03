import type { Database, Queryable } from '../db.ts';

// Core CRM data stays shared. Only MPNet's evaluation/review tables are scoped.
// Metadata travels with each transaction, so no request mutates global state.
const modelStores = new WeakSet<Queryable>();
export function evaluationTables(db: Queryable) {
  return modelStores.has(db)
    ? { evaluations: 'public.mpnet_evaluations', flags: 'public.mpnet_flags', label: 'MPNet' }
    : { evaluations: 'public.ai_evaluations', flags: 'public.ai_flags', label: 'Deterministic' };
}

export function mpnetEvaluationStore(db: Database): Database {
  function scoped(source: Queryable): Queryable {
    const queryable: Queryable = { query: (sql, params) => source.query(sql, params) };
    modelStores.add(queryable);
    return queryable;
  }
  const store: Database = {
    query: (sql, params) => db.query(sql, params),
    transaction: work => db.transaction(tx => work(scoped(tx))),
    close: async () => {}, // The shared database is owned by the application.
  };
  modelStores.add(store);
  return store;
}
