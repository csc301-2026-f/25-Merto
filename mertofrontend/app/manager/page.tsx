import { Suspense } from "react";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { loadJson } from "@/lib/api";
import { Card } from "@/components/Card";
import type { Deal } from "@/lib/deals";
import type { Metrics, QueueItem } from "@/lib/evaluation";

type UnassignedDeal = {
  dealId: string;
  buyer: string;
  vehicleInterest: string;
  stage: string;
  source: string;
  createdAt: string;
};

function labelFor(key: string) {
  const spaced = key.replace(/([A-Z])/g, " $1");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatMetric(key: string, value: unknown): string {
  if (value === null || value === undefined) return "Not measured"; // null = nothing to divide by
  if (typeof value === "number") {
    // Assumes rates are fractions (0.25). Change if the backend sends 25 instead.
    return /rate|precision/i.test(key) && value <= 1
      ? `${(value * 100).toFixed(1)}%`
      : String(value);
  }
  return String(value);
}

function MetricsList({ metrics }: { metrics: Metrics }) {
  return (
    <dl className="space-y-2">
      {Object.entries(metrics).map(([key, value]) =>
        value !== null && typeof value === "object" ? (
          <div key={key}>
            <dt className="font-semibold">{labelFor(key)}</dt>
            <dd>
              <ul className="ml-4 list-disc">
                {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                  <li key={k}>
                    {labelFor(k)}: {formatMetric(k, v)}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : (
          <div key={key} className="flex justify-between gap-4">
            <dt className="font-semibold">{labelFor(key)}</dt>
            <dd>{formatMetric(key, value)}</dd>
          </div>
        )
      )}
    </dl>
  );
}

async function ManagerHome() {
  await requireRole("manager");

  const [deals, unassigned, metrics, queue] = await Promise.all([
    loadJson<Deal[]>("/api/deals"), // every open deal; the assigned ones have an owner
    loadJson<UnassignedDeal[]>("/api/deals/unassigned"),
    loadJson<Metrics>("/api/ai-evaluation/metrics"),
    loadJson<QueueItem[]>("/api/ai-flags/queue"),
  ]);
  const assigned = deals && deals.filter((deal) => deal.ownerId);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Assigned" count={assigned?.length}>
          {assigned === null ? (
            <p>Couldn&apos;t load assigned deals.</p>
          ) : assigned.length === 0 ? (
            <p className="font-semibold">None right now</p>
          ) : (
            <ul className="divide-y-2">
              {assigned.map((deal) => (
                <li key={deal.dealId} className="py-3">
                  <Link
                    href={`/manager/deal-details?deal=${deal.dealId}`}
                    className="block hover:underline"
                  >
                    {deal.buyer} <span className="opacity-70">({deal.owner})</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Unassigned" count={unassigned?.length}>
          {unassigned === null ? (
            <p>Couldn&apos;t load unassigned deals.</p>
          ) : unassigned.length === 0 ? (
            <p className="font-semibold">None right now</p>
          ) : (
            <ul className="divide-y-2">
              {unassigned.map((deal) => (
                <li key={deal.dealId} className="py-3">
                  <Link
                    href={`/manager/deal-details?deal=${deal.dealId}`}
                    className="block hover:underline"
                  >
                    {deal.buyer}{" "}
                    <span className="opacity-70">({deal.vehicleInterest})</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="AI evaluation metrics" hideCount>
          {metrics === null ? (
            <p>Couldn&apos;t load metrics.</p>
          ) : Object.keys(metrics).length === 0 ? (
            <p className="font-semibold">No metrics yet</p>
          ) : (
            <MetricsList metrics={metrics} />
          )}
        </Card>

        <Card title="Flags awaiting review" count={queue?.length}>
          {queue === null ? (
            <p>Couldn&apos;t load the flag queue.</p>
          ) : queue.length === 0 ? (
            <p className="font-semibold">None right now</p>
          ) : (
            <ul className="divide-y-2">
            {queue.map((item) => (
              <li key={item.id} className="py-3">
                <Link
                  href={`/manager/deal-details?deal=${item.dealId}`}
                  className="block hover:underline"
                >
                  <span className="font-semibold">{item.flagType.replace(/_/g, " ")}</span>
                  <span className="ml-2 opacity-70">({item.severity})</span>
                  <span className="ml-2">
                    · {item.buyer} <span className="opacity-70">({item.owner})</span>
                  </span>
                  <span className="block text-sm">{item.explanation}</span>
                  <span className="block text-sm italic opacity-80">{item.evidenceBody}</span>
                </Link>
              </li>
            ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <ManagerHome />
    </Suspense>
  );
}