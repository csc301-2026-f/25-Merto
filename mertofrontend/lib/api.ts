import { getSession } from "@/lib/auth/session";

export async function backendFetch(path: string, init: RequestInit = {}) {
  const session = await getSession();
  return fetch(`${process.env.BACKEND_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Staff-Id": session?.token ?? "",
      ...init.headers,
    },
    cache: "no-store",
  });
}

export async function errorMessage(res: Response): Promise<string | undefined> {
  try { return (await res.json()).error; } catch { return undefined; }
}