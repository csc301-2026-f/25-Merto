import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "./types";

const COOKIE = "session";

export type Session = { token: string; role: Role; name: string};

export const homeFor = (role: Role) => (role === "manager" ? "/manager" : "/rep");

export async function createSession(session: Session) {
  (await cookies()).set(COOKIE, JSON.stringify(session), {
    httpOnly: true,                       // JS in the browser can't read it
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,                  // 8 hours
  });
}

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** Call at the top of a protected page. */
export async function requireRole(role: Role) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== role) redirect(homeFor(session.role));
  return session;
}