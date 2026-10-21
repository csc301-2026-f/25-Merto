"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { backendFetch, errorMessage } from "@/lib/api";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function toResult(res: Response, fallback: string): Promise<ActionResult> {
  if (res.ok) return { ok: true };
  if (res.status === 403) return { ok: false, error: "You don't have permission." };
  if ([400, 404, 409].includes(res.status)) {
    return { ok: false, error: (await errorMessage(res)) ?? fallback };
  }
  return { ok: false, error: fallback };
}

export async function assignOrTransfer(
  mode: "assign" | "transfer",
  dealId: string,
  toUserId: string,
  reason: string,
  // The owner the page showed (null if unassigned). The backend answers 409 if
  // someone reassigned the deal since, so a stale page cannot move it.
  expectedOwnerId?: string | null
): Promise<ActionResult> {
  await requireRole("manager");
  if (!reason.trim()) return { ok: false, error: "A reason is required." };

  let res: Response;
  try {
    // might need to change api/deals
    res = await backendFetch(`/api/deals/${dealId}/${mode}`, {
      method: "POST",
      body: JSON.stringify({ toUserId, reason: reason.trim(), expectedOwnerId }),
    });
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
  const result = await toResult(res, "Could not save the change.");
  if (result.ok) revalidatePath("/manager", "layout");
  return result;
}

export type EvaluationRunState =
  | { ok: true; evaluated: number; flagged: number; newFlags: number }
  | { ok: false; error: string }
  | undefined;

// Evaluates every deal with AI activity. Safe to rerun: the backend never raises
// the same flag on the same message twice.
export async function runEvaluation(): Promise<EvaluationRunState> {
  await requireRole("manager");
  let res: Response;
  try {
    res = await backendFetch("/api/evaluations/run", { method: "POST" });
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
  if (!res.ok) {
    return { ok: false, error: res.status === 403 ? "You don't have permission." : "Could not run the evaluation." };
  }
  const deals: { result: string; newFlags: number }[] = await res.json();
  revalidatePath("/manager", "layout");
  return {
    ok: true,
    evaluated: deals.length,
    flagged: deals.filter((deal) => deal.result === "flagged").length,
    newFlags: deals.reduce((sum, deal) => sum + deal.newFlags, 0),
  };
}

export async function reviewFlag(
  flagId: string,
  decision: "confirmed_issue" | "false_positive" | "resolved",
  note?: string
): Promise<ActionResult> {
  await requireRole("manager");
  let res: Response;
  try {
    res = await backendFetch(`/api/ai-flags/${flagId}/review`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    });
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
  const result = await toResult(res, "Could not save the review.");
  if (result.ok) revalidatePath("/manager", "layout");
  return result;
}