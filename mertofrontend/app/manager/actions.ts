"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { backendFetch, errorMessage } from "@/lib/api";
import { demoEvaluatorId, evaluationRequest, type EvaluationEngine } from "@/lib/evaluation";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function selectEvaluationEngine(_previous: ActionResult | undefined, data: FormData): Promise<ActionResult> {
  await requireRole("manager");
  const id = String(data.get("evaluator") ?? "");
  if (!demoEvaluatorId(id)) {
    return { ok: false, error: "Choose an available evaluator." };
  }
  try {
    // The backend advertises only evaluators configured for this deployment.
    const res = await backendFetch("/api/ai-evaluation/engine", {
      headers: { "X-Merto-Demo-Evaluator": id },
    });
    if (!res.ok) return { ok: false, error: (await errorMessage(res)) ?? "Could not load this evaluator." };
    const selected = await res.json();
    if (selected.id !== id || !selected.ready || !selected.choices?.some((choice: { id: string }) => choice.id === id)) {
      return { ok: false, error: "This evaluator is not available on this deployment." };
    }
    (await cookies()).set("merto-demo-evaluator", id, {
      httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production",
    });
  } catch { return { ok: false, error: "Could not reach the selected evaluator." }; }
  revalidatePath("/manager", "layout");
  // The URL pins this tab's data even when another tab changes the cookie.
  // Next redirect throws, so it must remain outside the error handler above.
  redirect(`/manager/ai-review?evaluator=${id}`);
}

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
  | { ok: true; evaluatorName: string; evaluated: number; flagged: number; newFlags: number }
  | { ok: false; error: string }
  | undefined;

// Evaluates every deal with AI activity. Safe to rerun: the backend never raises
// the same flag on the same message twice.
export async function runEvaluation(evaluatorId?: string): Promise<EvaluationRunState> {
  await requireRole("manager");
  let res: Response;
  let actual: EvaluationEngine;
  try {
    const context = evaluationRequest(evaluatorId);
    const status = await backendFetch("/api/ai-evaluation/engine", context);
    if (!status.ok) return { ok: false, error: "Could not verify the selected evaluator." };
    actual = await status.json();
    if ((evaluatorId && actual.id !== evaluatorId) || !actual.ready) {
      return { ok: false, error: "The selected evaluator is unavailable. Refresh this page and try again." };
    }
    res = await backendFetch("/api/evaluations/run", { ...context, method: "POST" });
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
  if (!res.ok) {
    return { ok: false, error: res.status === 403 ? "You don't have permission."
      : res.status === 503 ? (await errorMessage(res)) ?? "Model service unavailable. Try again later."
      : "Could not run the evaluation." };
  }
  const deals: { result: string; newFlags: number }[] = await res.json();
  revalidatePath("/manager", "layout");
  return {
    ok: true,
    evaluatorName: actual.name,
    evaluated: deals.length,
    flagged: deals.filter((deal) => deal.result === "flagged").length,
    newFlags: deals.reduce((sum, deal) => sum + deal.newFlags, 0),
  };
}

export async function reviewFlag(
  flagId: string,
  decision: "confirmed_issue" | "false_positive" | "resolved",
  note?: string,
  evaluatorId?: string
): Promise<ActionResult> {
  await requireRole("manager");
  let res: Response;
  try {
    res = await backendFetch(`/api/ai-flags/${flagId}/review`, {
      ...evaluationRequest(evaluatorId),
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
