import { Suspense } from "react";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { loadJson } from "@/lib/api";
import { Card } from "@/components/Card";
import { FollowUpList } from "@/components/FollowUpList";
import type { Deal } from "@/lib/deals";
import type { DueFollowUp } from "@/lib/follow-ups";

async function RepDashboard() {
  await requireRole("rep");
  // The backend returns only this rep's deals and follow-ups.
  const [followUps, deals] = await Promise.all([
    loadJson<DueFollowUp[]>("/api/follow-ups/due"),
    loadJson<Deal[]>("/api/deals"),
  ]);

  return (
    <div className="space-y-6">
      <Card title="Needs follow-up" count={followUps?.length}>
        {followUps === null ? (
          <p>Couldn&apos;t load follow-ups.</p>
        ) : (
          <FollowUpList items={followUps} basePath="/rep/deals" />
        )}
        <p className="mt-3 text-sm opacity-70">
          Most overdue first. Opted-out customers, closed deals, and customers with a booked
          visit or a scheduled callback are left out.
        </p>
      </Card>

      <Card title="My customers" count={deals?.length}>
        {deals === null ? (
          <p>Couldn&apos;t load your customers.</p>
        ) : deals.length === 0 ? (
          <p className="font-semibold">None right now</p>
        ) : (
          <ul className="divide-y-2">
            {deals.map((deal) => (
              <li key={deal.dealId} className="py-3">
                <Link href={`/rep/deals/${deal.dealId}`} className="block hover:underline">
                  {deal.buyer}{" "}
                  <span className="opacity-70">
                    ({deal.vehicleInterest} · {deal.stage.replaceAll("_", " ")})
                  </span>
                </Link>
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
