import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { backendFetch, loadJson } from "@/lib/api";
import type { Deal, Rep } from "@/lib/deals";
import type { Evaluation } from "@/lib/evaluation";
import { DealList } from "./deal-list";

// Every open deal, assigned or not.
const DEALS_PATH = "/api/deals";

type SearchParams = Promise<{ deal?: string | string[] }>;

async function CustomerDetails({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("manager");

  const { deal } = await searchParams;
  const openDealId = typeof deal === "string" ? deal : undefined;

  let res: Response;
  try {
    res = await backendFetch(DEALS_PATH);
  } catch {
    return <p>Could not reach the backend.</p>;
  }
  if (!res.ok) return <p>Could not load deals (status {res.status}).</p>;

  const deals: Deal[] = await res.json();

  // One evaluation request per deal, all at the same time.
  const entries = await Promise.all(
    deals.map(
      async (d) =>
        [d.dealId, await loadJson<Evaluation>(`/api/deals/${d.dealId}/evaluation`)] as const
    )
  );
  const evaluations = Object.fromEntries(entries);
  const reps = (await loadJson<Rep[]>("/api/staff/reps")) ?? [];

  return <DealList deals={deals} evaluations={evaluations} reps={reps} openDealId={openDealId} />;
}

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <CustomerDetails searchParams={searchParams} />
    </Suspense>
  );
}