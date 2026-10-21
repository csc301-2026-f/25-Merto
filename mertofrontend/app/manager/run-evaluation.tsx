"use client";

import { useActionState } from "react";
import { runEvaluation } from "./actions";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function RunEvaluation() {
  const [state, formAction, pending] = useActionState(() => runEvaluation(), undefined);

  return (
    <form action={formAction} className="space-y-2 border-b-2 pb-4">
      <p className="text-sm opacity-70">
        Checks every conversation with AI activity for risky AI replies. Running it again only
        adds flags for new problems.
      </p>
      <button type="submit" disabled={pending}
        className="rounded border-2 px-4 py-2 font-semibold disabled:opacity-50">
        {pending ? "Evaluating…" : "Run AI evaluation"}
      </button>
      {state?.ok === false && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && (
        <p role="status" className="text-sm text-green-700">
          Evaluated {plural(state.evaluated, "conversation")}: {state.flagged} flagged,{" "}
          {state.newFlags === 0 ? "no new flags" : `${plural(state.newFlags, "new flag")} to review`}.
        </p>
      )}
    </form>
  );
}
