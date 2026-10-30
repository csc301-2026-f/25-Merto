import "server-only";
import { getSession } from "@/lib/auth/session";

// Defaults to the backend's `npm run dev` port when .env.local does not set it.
export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export function backendHeaders(initial?: HeadersInit) {
  const headers = new Headers(initial);
  headers.set("Content-Type", "application/json");
  if (process.env.BACKEND_PROTECTION_BYPASS) {
    headers.set("x-vercel-protection-bypass", process.env.BACKEND_PROTECTION_BYPASS);
  }
  return headers;
}

export async function backendFetch(path: string, init: RequestInit = {}) {
  const session = await getSession();
  const headers = backendHeaders(init.headers);
  headers.set("X-Staff-Id", session?.token ?? "");
  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function errorMessage(res: Response): Promise<string | undefined> {
  try { return (await res.json()).error; } catch { return undefined; }
}

// Returns the parsed JSON, or null if anything went wrong.
export async function loadJson<T>(path: string): Promise<T | null> {
  try {
    const res = await backendFetch(path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
