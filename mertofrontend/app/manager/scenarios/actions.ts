"use server";

import { requireRole } from "@/lib/auth/session";
import { backendFetch, errorMessage } from "@/lib/api";
import type { RunAllResult, Scorecard } from "@/lib/scenarios";

export type RunResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function post<T>(path: string, body: object, fallback: string): Promise<RunResult<T>> {
  await requireRole("manager");
  let res: Response;
  try {
    res = await backendFetch(path, { method: "POST", body: JSON.stringify(body) });
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
  if (res.ok) return { ok: true, data: (await res.json()) as T };
  if (res.status === 403) return { ok: false, error: "You don't have permission." };
  if (res.status === 400 || res.status === 404) return { ok: false, error: (await errorMessage(res)) ?? fallback };
  return { ok: false, error: fallback };
}

// Runs one scenario for one built-in agent. The backend saves nothing.
export async function runScenario(scenarioId: string, agent: string): Promise<RunResult<Scorecard>> {
  return post<Scorecard>(`/api/scenarios/${encodeURIComponent(scenarioId)}/runs`, { agent }, "Could not run the scenario.");
}

// Runs every scenario for each named agent; two or more agents come back with a comparison.
export async function runAllScenarios(agents: string[]): Promise<RunResult<RunAllResult>> {
  return post<RunAllResult>("/api/scenario-runs", { agents }, "Could not run the scenarios.");
}
