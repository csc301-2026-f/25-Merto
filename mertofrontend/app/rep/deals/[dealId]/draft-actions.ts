"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { backendFetch, errorMessage } from "@/lib/api";

export type DraftActionState = { error?: string; success?: string } | undefined;

async function post(path: string, body: object): Promise<{ error?: string }> {
  await requireRole("rep");
  let response: Response;
  try { response = await backendFetch(path, { method: "POST", body: JSON.stringify(body) }); }
  catch { return { error: "Could not reach the server. Please retry." }; }
  if (!response.ok) return { error: (await errorMessage(response)) ?? "Could not save the draft action." };
  revalidatePath("/rep", "layout");
  revalidatePath("/manager", "layout");
  return {};
}

export async function createDraftAction(dealId: string, _previous: DraftActionState, form: FormData): Promise<DraftActionState> {
  const result = await post(`/api/deals/${encodeURIComponent(dealId)}/reply-drafts`, {
    requestId: String(form.get("requestId") ?? ""), channel: String(form.get("channel") ?? ""),
  });
  return result.error ? result : { success: "Draft prepared for review." };
}

export async function reviewDraftAction(id: string, _previous: DraftActionState, form: FormData): Promise<DraftActionState> {
  const decision = String(form.get("decision") ?? "");
  const result = await post(`/api/reply-drafts/${encodeURIComponent(id)}/review`, {
    decision, ...(decision === "edit" ? { message: String(form.get("message") ?? "") } : {}),
  });
  return result.error ? result : { success: decision === "reject"
    ? "Draft rejected. Nothing was sent." : "Review saved. Choose Record follow-up when you are ready." };
}

export async function sendDraftAction(id: string): Promise<DraftActionState> {
  const result = await post(`/api/reply-drafts/${encodeURIComponent(id)}/send`, {});
  return result.error ? result : { success: "Follow-up recorded in the timeline." };
}
