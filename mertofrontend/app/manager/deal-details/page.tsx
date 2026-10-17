import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { backendFetch, loadJson } from "@/lib/api";
import type { Deal } from "@/lib/deals";
import type { Evaluation } from "@/lib/evaluation";
import { DealList } from "./deal-list";

// TODO: change to the all-deals endpoint when it exists.
const DEALS_PATH = "/api/deals/unassigned";

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

  return <DealList deals={deals} evaluations={evaluations} openDealId={openDealId} />;
}

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <CustomerDetails searchParams={searchParams} />
    </Suspense>
  );
}