import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { logout } from "../login/actions";

async function RepDashboard() {
  await requireRole("rep");
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Rep Dashboard</h1>
      <form action={logout}>
        <button className="mt-4 underline">Sign out</button>
      </form>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6">Loading…</p>}>
      <RepDashboard />
    </Suspense>
  );
}