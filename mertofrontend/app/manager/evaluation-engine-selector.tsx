"use client";

import { useActionState, useState } from "react";
import { selectEvaluationEngine } from "./actions";
import type { EvaluationEngine } from "@/lib/evaluation";

export function EvaluationEngineSelector({ engine }: { engine: EvaluationEngine }) {
  const [selected, setSelected] = useState(engine.id ?? "mpnet");
  const [state, action, pending] = useActionState(selectEvaluationEngine, undefined);
  return (
    <form action={action} className="mb-4 space-y-2">
      <label htmlFor="local-evaluator" className="block text-sm font-semibold">Evaluation method</label>
      <div className="flex flex-wrap items-center gap-2">
        <select id="local-evaluator" name="evaluator" value={selected} disabled={pending}
          onChange={event => setSelected(event.target.value)}
          className="rounded border border-zinc-400 bg-white px-3 py-2 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
          {engine.choices?.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}
        </select>
        <button type="submit" disabled={pending || selected === engine.id}
          className="rounded border-2 px-3 py-2 font-semibold disabled:opacity-50">
          {pending ? "Loading evaluator…" : "Apply evaluator"}
        </button>
      </div>
      <p className="text-sm opacity-70">Each method keeps its own results and reviews. The first model load may take a few seconds.</p>
      {pending && <p role="status" className="text-sm">Loading the selected evaluator…</p>}
      {state?.ok === false && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
