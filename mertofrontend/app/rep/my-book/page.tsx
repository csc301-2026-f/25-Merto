
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { loadJson } from "@/lib/api";
import type { Deal } from "@/lib/deals";
import { CustomerList } from "./customer-list";

async function RepDashboard() {
  await requireRole("rep");

  // The backend returns only this rep's deals and follow-ups.
  const deals = await loadJson<Deal[]>("/api/deals");

  return <CustomerList deals={deals ?? []} />;
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <RepDashboard />
    </Suspense>
  );
}
