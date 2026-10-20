"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { backendFetch, errorMessage } from "@/lib/api";
import type { FollowUpAssessment } from "@/lib/follow-ups";

export type FollowUpState = {
  error?: string;
  success?: string;
  eventId?: string;
  recordedAt?: string;
  remaining?: string[];
} | undefined;

export async function recordFollowUp(dealId: string, _previous: FollowUpState, form: FormData): Promise<FollowUpState> {
  await requireRole("rep");
  let response: Response;
  try {
    response = await backendFetch(`/api/deals/${encodeURIComponent(dealId)}/follow-ups`, {
      method: "POST",
      body: JSON.stringify({
        requestId: String(form.get("requestId") ?? ""),
        channel: String(form.get("channel") ?? ""),
        message: String(form.get("message") ?? ""),
      }),
    });
  } catch {
    return { error: "Could not reach the server. Retry this message to check whether it was recorded." };
  }
  if (!response.ok) {
    return { error: [400, 401, 403, 404, 409].includes(response.status)
      ? (await errorMessage(response)) ?? "Could not record the follow-up."
      : "Could not record the follow-up. Please retry." };
  }
  const saved: { eventId: string; recordedAt: string; followUp: FollowUpAssessment } = await response.json();
  revalidatePath("/rep", "layout");
  revalidatePath("/manager", "layout");
  return {
    success: "Follow-up recorded.",
    eventId: saved.eventId, recordedAt: saved.recordedAt,
    remaining: saved.followUp.reasons.map(reason => reason.text),
  };
}
