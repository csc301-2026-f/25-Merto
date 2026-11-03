"use client";

import { useActionState } from "react";
import { reviewFlag, type ActionResult } from "@/app/manager/actions";
import type { Flag } from "@/lib/evaluation";
import type { FlagDecision } from "@/lib/auth/types";

const DECISIONS: Record<string, FlagDecision[]> = {
  pending: ["confirmed_issue", "false_positive", "resolved"],
  confirmed_issue: ["resolved", "false_positive"],
  false_positive: ["confirmed_issue"],
  resolved: [],
};
const LABELS: Record<FlagDecision, string> = {
  confirmed_issue: "Confirm issue", false_positive: "Mark false positive", resolved: "Mark resolved",
};

export function FlagReview({ flag, evaluatorId }: { flag: Flag; evaluatorId?: string }) {
  const allowed = DECISIONS[flag.reviewStatus] ?? [];
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(async (_previous, data) => {
    const decision = data.get("decision") as FlagDecision;
    if (!allowed.includes(decision)) return { ok: false, error: "Choose an available review decision." };
    return reviewFlag(flag.id, decision, String(data.get("note") ?? ""), evaluatorId);
  }, undefined);

  if (!allowed.length) return null;
  return (
    <form action={action} className="mt-4 space-y-2 border-t border-zinc-400/40 pt-3">
      <label htmlFor={`review-note-${flag.id}`} className="block text-sm font-semibold">Review note (optional)</label>
      <textarea id={`review-note-${flag.id}`} name="note" defaultValue={flag.reviewNote ?? ""} maxLength={2000}
        rows={2} disabled={pending} className="w-full rounded border border-zinc-400 bg-transparent p-2 text-sm" />
      <div className="flex flex-wrap gap-2">
        {allowed.map(decision => (
          <button key={decision} type="submit" name="decision" value={decision} disabled={pending}
            className="rounded border border-zinc-500 px-3 py-2 text-sm font-semibold disabled:opacity-50">
            {LABELS[decision]}
          </button>
        ))}
      </div>
      {pending && <p role="status" className="text-sm">Saving review…</p>}
      {state?.ok === false && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-blue-700 dark:text-blue-300">Review saved.</p>}
    </form>
  );
}
