import type { AuthResult } from "./types";
import type { Role } from "./types";

const DEV_USERS: Record<string, { id: string; role: Role; name: string }> = {
  karen: { id: "10000000-0000-0000-0000-000000000001", role: "manager", name: "Karen" }, // GM
  dana:  { id: "10000000-0000-0000-0000-000000000002", role: "rep", name: "Dana" },
  arjun: { id: "10000000-0000-0000-0000-000000000003", role: "rep", name: "Arjun" },
};

export async function authenticate(username: string,  password: string): Promise<AuthResult> {
//if (username === "rep" && password === "test") return { status: "ok", token: "x", role: "rep" };
//if (username === "manager" && password === "test") return { status: "ok", token: "x", role: "manager" };
//if (process.env.NODE_ENV === "development") return { status: "invalid" };


  const user = DEV_USERS[username.toLowerCase()];
  if (!user || password !== "test") return { status: "invalid" };
  return { status: "ok", token: user.id, role: user.role, name: user.name }; // token = staff id for now

/*
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) return { status: "invalid" };
    if (!res.ok) return { status: "error" };

    // ADAPT THIS to whatever your backend returns
    const data = await res.json();
    if (data.role === "rep" || data.role === "manager") {
      return { status: "ok", token: data.token, role: data.role };
    }
    return { status: "invalid" };
  } catch {
    return { status: "error" };
  }
    */
}