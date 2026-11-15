
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { loadJson } from "@/lib/api";
import { Card } from "@/components/Card";
import { EntryLink } from "@/components/EntryLink";
import type { Deal } from "@/lib/deals";
import { label } from "@/lib/format";

async function RepDashboard() {
  await requireRole("rep");

  // The backend returns only this rep's deals and follow-ups.
  const [deals] = await Promise.all([
    loadJson<Deal[]>("/api/deals"),

  ]);

  return (
    <div className="space-y-8">
      <Card title="Customers" count={deals?.length}>
        {deals === null ? (
          <p>Couldn&apos;t load your customers.</p>
        ) : deals.length === 0 ? (
          <p className="font-semibold">None right now</p>
        ) : (
          <ul className="space-y-3">
            {deals.map((deal) => (
              <li key={deal.dealId}>
                <EntryLink
                  href={`/rep/deals/${deal.dealId}`}
                  title={
                    <>
                      {deal.buyer}{" "}
                      <span className="font-normal opacity-70">
                        ({deal.vehicleInterest})
                      </span>
                    </>
                  }
                  aside=""
                >
                  <p className="opacity-70">
                    {label(deal.stage)} · from {label(deal.source)}
                  </p>
                </EntryLink>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <RepDashboard />
    </Suspense>
  );
}
