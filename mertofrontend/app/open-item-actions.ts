"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { backendFetch, errorMessage } from "@/lib/api";

export type CloseResult = { ok: true } | { ok: false; error: string };

// POST /api/open-items/:itemId/resolve or /cancel (US4). Managers and reps both
// use it; the backend decides who may close which item.
export async function closeOpenItem(itemId: string, action: "resolve" | "cancel", note: string): Promise<CloseResult> {
  if (!(await getSession())) return { ok: false, error: "Please sign in again." };
  let res: Response;
  try {
    res = await backendFetch(`/api/open-items/${encodeURIComponent(itemId)}/${action}`, {
      method: "POST",
      body: JSON.stringify({ note: note.trim() || undefined }),
    });
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
  if (!res.ok) {
    if (res.status === 403) return { ok: false, error: "You don't have permission." };
    return { ok: false, error: [400, 404, 409].includes(res.status)
      ? (await errorMessage(res)) ?? "Could not update the item."
      : "Could not update the item." };
  }
  revalidatePath("/manager", "layout");
  revalidatePath("/rep", "layout");
  return { ok: true };
}
