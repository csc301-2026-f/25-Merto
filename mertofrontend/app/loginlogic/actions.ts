"use server";

import { redirect } from "next/navigation";
import { authenticate } from "@/lib/auth/backend";
import { createSession, destroySession, homeFor } from "@/lib/auth/session";

export type LoginState = { error?: string; username?: string } | undefined;

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Please enter a username and password.", username };
  }

  const result = await authenticate(username, password);

  if (result.status === "invalid") {
    return { error: "Username or password was incorrect.", username };
  }
  if (result.status === "error") {
    return { error: "Something went wrong. Please try again.", username };
  }

  await createSession({ token: result.token, role: result.role });
  redirect(homeFor(result.role)); // keep outside any try/catch
}

export async function logout() {
  await destroySession();
  redirect("/login");
}