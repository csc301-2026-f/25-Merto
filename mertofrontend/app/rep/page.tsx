import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import Link from "next/link";
import { Card } from "@/components/Card";
import { loadJson } from "@/lib/api";

// Assigned shape is a GUESS until the backend has this endpoint.
type AssignedDeal = { 
  dealId: string;
  buyer: string;
  vehicleInterest: string;
  stage: string;
  source: string;
  createdAt: string;};

// temp datas
import type { QueueItem } from "@/lib/evaluation";
type MyDeal = { dealId: string; buyer: string; stage: string };

async function RepDashboard() {
  await requireRole("rep");

  const [blahassigned] = await Promise.all([
    loadJson<AssignedDeal[]>("/TEMP/PLEASEREPLACE"), // TODO: real endpoint
  ])

  //temp stuff
  const queue = await loadJson<QueueItem[]>("/api/ai-flags/queue");
const assigned: MyDeal[] | null = queue
  ? [...new Map(
      queue.map((q) => [q.dealId, { dealId: q.dealId, buyer: q.buyer, stage: q.stage }])
    ).values()]
  : null;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Rep Dashboard</h1>
      <Card title="Unassigned" count={assigned?.length}>
          {assigned === null ? (
            <p>Couldn&apos;t load unassigned deals.</p>
          ) : assigned.length === 0 ? (
            <p className="font-semibold">None right now</p>
          ) : (
            <ul className="divide-y-2">
              {assigned.map((deal) => (
                <li key={deal.dealId} className="py-3">
                  <Link
                    href={`/rep/deals/${deal.dealId}`}
                    className="block hover:underline"
                  >
                    {deal.buyer}{" "}
                    <span className="opacity-70">({deal.stage})</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
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


