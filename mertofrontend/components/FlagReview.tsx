"use client";

import { useActionState, useState } from "react";
import { reviewFlag, type ActionResult } from "@/app/manager/actions";
import { REVIEW_REASONS, type Flag, type ReviewReason } from "@/lib/evaluation";
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

// A false positive needs a reason, so that button opens a choice of reasons;
// each reason button submits the review.
export function FlagReview({ flag, evaluatorId }: { flag: Flag; evaluatorId?: string }) {
  const allowed = DECISIONS[flag.reviewStatus] ?? [];
  const [choosingReason, setChoosingReason] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(async (_previous, data) => {
    // A reason button stands for "false positive, because…".
    const reason = data.get("reason") as ReviewReason | null;
    const decision = (reason ? "false_positive" : data.get("decision")) as FlagDecision;
    if (!allowed.includes(decision)) return { ok: false, error: "Choose an available review decision." };
    const note = String(data.get("note") ?? "");
    if (decision === "false_positive" && !reason) return { ok: false, error: "Choose why this flag is a false positive." };
    if (reason === "other" && !note.trim()) return { ok: false, error: "Add a note saying why this flag is a false positive." };
    return reviewFlag(flag.id, decision, note, evaluatorId, reason ?? undefined);
  }, undefined);

  if (!allowed.length) return null;
  return (
    <form action={action} className="mt-4 space-y-2 border-t border-zinc-400/40 pt-3">
      <label htmlFor={`review-note-${flag.id}`} className="block text-sm font-semibold">Review note (optional)</label>
      <textarea id={`review-note-${flag.id}`} name="note" defaultValue={flag.reviewNote ?? ""} maxLength={2000}
        rows={2} disabled={pending} className="w-full rounded border border-zinc-400 bg-transparent p-2 text-sm" />
      <div className="flex flex-wrap gap-2">
        {allowed.map(decision => decision === "false_positive" ? (
          <button key={decision} type="button" onClick={() => setChoosingReason(open => !open)} disabled={pending}
            aria-expanded={choosingReason} aria-controls={`review-reasons-${flag.id}`}
            className="rounded border border-zinc-500 px-3 py-2 text-sm font-semibold disabled:opacity-50">
            {LABELS[decision]}
          </button>
        ) : (
          <button key={decision} type="submit" name="decision" value={decision} disabled={pending}
            className="rounded border border-zinc-500 px-3 py-2 text-sm font-semibold disabled:opacity-50">
            {LABELS[decision]}
          </button>
        ))}
      </div>
      {choosingReason && allowed.includes("false_positive") && (
        <fieldset id={`review-reasons-${flag.id}`} className="space-y-2">
          <legend className="text-sm font-semibold">Why is it a false positive?</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(REVIEW_REASONS) as [ReviewReason, string][]).map(([reason, label]) => (
              <button key={reason} type="submit" name="reason" value={reason} disabled={pending}
                className="rounded border border-zinc-500 bg-white/60 px-3 py-2 text-sm disabled:opacity-50 dark:bg-zinc-950/40">
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {pending && <p role="status" className="text-sm">Saving review…</p>}
      {state?.ok === false && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-blue-700 dark:text-blue-300">Review saved.</p>}
    </form>
  );
}
