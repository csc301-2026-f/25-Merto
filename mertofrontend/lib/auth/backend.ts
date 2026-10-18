import type { AuthResult } from "./types";
import type { Role } from "./types";
import { BACKEND_URL } from "@/lib/api";

// The backend calls the GM "gm"; this app's routes call that role "manager".
const ROLES: Record<string, Role> = { gm: "manager", rep: "rep" };

export async function authenticate(username: string,  password: string): Promise<AuthResult> {
//if (username === "rep" && password === "test") return { status: "ok", token: "x", role: "rep" };
//if (username === "manager" && password === "test") return { status: "ok", token: "x", role: "manager" };
//if (process.env.NODE_ENV === "development") return { status: "invalid" };

  // Backend POST /auth/login: username is a staff email or the part before the @
  // (karen, dana, arjun, sofia, tom); it returns { token, id, name, role }.
  try {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) return { status: "invalid" };
    if (!res.ok) return { status: "error" };

    const data = await res.json();
    const role = ROLES[data.role];
    if (role && typeof data.token === "string") {
      return { status: "ok", token: data.token, role, name: data.name };
    }
    return { status: "invalid" };
  } catch {
    return { status: "error" };
  }
}