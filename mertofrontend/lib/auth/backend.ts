import type { AuthResult } from "./types";



export async function authenticate(username: string,  password: string): Promise<AuthResult> {
//if (username === "rep" && password === "test") return { status: "ok", token: "x", role: "rep" };
//if (username === "manager" && password === "test") return { status: "ok", token: "x", role: "manager" };
//if (process.env.NODE_ENV === "development") return { status: "invalid" };

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
}