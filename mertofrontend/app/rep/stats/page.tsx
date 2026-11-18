import { Suspense } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { DealOutcomeSummary } from "@/components/DealOutcomeSummary";
import { DealOutcomeChart } from "@/components/DealOutcomeChart";
import { EntryLink } from "@/components/EntryLink";
import { requireRole } from "@/lib/auth/session";
import { DEAL_OUTCOME_FILTERS, loadDealOutcomes, loadDealStats, type DealOutcomeFilter } from "@/lib/deal-stats";

type SearchParams = Promise<{ outcome?: string | string[]; page?: string | string[] }>;

const filterLabels: Record<DealOutcomeFilter, string> = {
  all: "All outcomes",
  sold: "Sold",
  lost: "Lost",
};

function statsHref(outcome: DealOutcomeFilter, page = 1) {
  const query = new URLSearchParams();
  if (outcome !== "all") query.set("outcome", outcome);
  if (page > 1) query.set("page", String(page));
  return query.size ? `/rep/stats?${query}` : "/rep/stats";
}

async function RepStats({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("rep");
  const { outcome: requestedOutcome, page: requestedPage } = await searchParams;
  const outcome = DEAL_OUTCOME_FILTERS.find((filter) => filter === requestedOutcome) ?? "all";
  const page = typeof requestedPage === "string" && /^[1-9]\d{0,8}$/.test(requestedPage)
    ? Number(requestedPage)
    : 1;
  const [stats, results] = await Promise.all([loadDealStats(), loadDealOutcomes(outcome, page)]);

  return (
    <div className="space-y-8">
      <Card title="Closed deals" count={stats?.closed}>
        <div className="max-w-xl space-y-4 rounded-lg bg-current/5 p-4">
          <DealOutcomeSummary stats={stats} />
          {stats && <DealOutcomeChart stats={stats} />}
        </div>
        <p className="mt-3 text-sm opacity-70">
          Delivered deals count as sold. The sale rate is the share of closed deals that sold.
        </p>
      </Card>

      <Card title="Deal history" hideCount>
        <nav aria-label="Filter deal outcomes" className="mb-4 flex flex-wrap gap-2">
          {DEAL_OUTCOME_FILTERS.map((filter) => (
            <Link
              key={filter}
              href={statsHref(filter)}
              aria-current={filter === outcome ? "true" : undefined}
              className={`rounded-lg border border-current/20 px-3 py-1.5 text-sm transition-colors hover:bg-current/10 ${filter === outcome ? "bg-current/10 font-semibold" : ""}`}
            >
              {filterLabels[filter]}
            </Link>
          ))}
        </nav>

        {results === null ? (
          <p>Couldn&apos;t load deal history.</p>
        ) : results.deals.length === 0 ? (
          <p>{page > 1 ? "There are no deals on this page." : "No deals match this outcome."}</p>
        ) : (
          <ul className="space-y-2">
            {results.deals.map((deal) => (
              <li key={deal.dealId}>
                <EntryLink
                  href={`/rep/deals/${deal.dealId}`}
                  title={deal.buyer}
                  aside={deal.stage === "delivered" ? "Sold" : "Lost"}
                >
                  <p>{deal.vehicleInterest}</p>
                  {deal.stage === "lost" && deal.lostReason && <p>Reason: {deal.lostReason}</p>}
                </EntryLink>
              </li>
            ))}
          </ul>
        )}

        {(page > 1 || results?.hasNextPage) && (
          <div className="mt-4 flex items-center gap-4 text-sm">
            {page > 1 && <Link href={statsHref(outcome, page - 1)} className="underline">Previous page</Link>}
            <span>Page {page}</span>
            {results?.hasNextPage && <Link href={statsHref(outcome, page + 1)} className="underline">Next page</Link>}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Statistics</h1>
        <p className="text-sm opacity-70">All-time sales outcomes for your deals.</p>
      </header>
      <Suspense fallback={<p>Loading statistics…</p>}>
        <RepStats searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
