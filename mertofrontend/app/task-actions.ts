"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { backendFetch, errorMessage } from "@/lib/api";
import { dealershipDateTimeToIso } from "@/lib/format";

export type TaskActionResult = { ok: true } | { ok: false; error: string };

async function send(path: string, init: RequestInit, fallback: string): Promise<TaskActionResult> {
  if (!(await getSession())) return { ok: false, error: "Please sign in again." };
  let res: Response;
  try {
    res = await backendFetch(path, init);
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
  if (!res.ok) {
    if (res.status === 403) return { ok: false, error: "You don't have permission." };
    return { ok: false, error: [400, 404, 409].includes(res.status) ? (await errorMessage(res)) ?? fallback : fallback };
  }
  revalidatePath("/manager", "layout");
  revalidatePath("/rep", "layout");
  return { ok: true };
}

// POST /api/deals/:dealId/tasks. dueLocal is a datetime-local value in the
// dealership's time zone, or empty for no due time.
export async function createTask(dealId: string, title: string, dueLocal: string): Promise<TaskActionResult> {
  let dueAt: string | null = null;
  if (dueLocal) {
    try {
      dueAt = dealershipDateTimeToIso(dueLocal);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Enter a valid due date." };
    }
  }
  return send(`/api/deals/${encodeURIComponent(dealId)}/tasks`,
    { method: "POST", body: JSON.stringify({ title, dueAt }) }, "Could not add the task.");
}

// PATCH /api/tasks/:taskId: mark done, or reopen a task ticked by mistake.
export async function setTaskCompleted(taskId: string, completed: boolean): Promise<TaskActionResult> {
  return send(`/api/tasks/${encodeURIComponent(taskId)}`,
    { method: "PATCH", body: JSON.stringify({ completed }) }, "Could not update the task.");
}
