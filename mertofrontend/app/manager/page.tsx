import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { backendFetch } from "@/lib/api";
import { logout } from "../login/actions";

async function ManagerDashboard() {
  await requireRole("manager");

  let res: Response;
  try {
    res = await backendFetch("/api/deals/unassigned");
  } catch {
    return <p className="p-6">Could not reach the backend. Is it running on port 3001?</p>;
  }

  if (!res.ok) {
    return <p className="p-6">Backend returned an error (status {res.status}).</p>;
  }

  const unassigned = await res.json();

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Manager Dashboard</h1>

      <h2 className="mt-6 text-lg font-medium">Unassigned deals</h2>
      <pre className="mt-2 overflow-x-auto rounded border p-3 text-sm">
        {JSON.stringify(unassigned, null, 2)}
      </pre>

      <form action={logout}>
        <button className="mt-4 underline">Sign out</button>
      </form>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6">Loading…</p>}>
      <ManagerDashboard />
    </Suspense>
  );
}