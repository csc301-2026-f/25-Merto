import { Suspense } from "react";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { loadJson } from "@/lib/api";
import { Card } from "@/components/Card";
import { OpenItemList } from "@/components/OpenItemList";
import type { Deal } from "@/lib/deals";
import type { Metrics, QueueItem } from "@/lib/evaluation";
import { formatDateTime } from "@/lib/format";
import type { OpenItemsOverview } from "@/lib/open-items";

// The card lists the longest-waiting items; the summary counts them all.
const OPEN_ITEMS_SHOWN = 10;

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

  const [deals, unassigned, metrics, queue, openItems] = await Promise.all([
    loadJson<Deal[]>("/api/deals"), // every open deal; the assigned ones have an owner
    loadJson<UnassignedDeal[]>("/api/deals/unassigned"),
    loadJson<Metrics>("/api/ai-evaluation/metrics"),
    loadJson<QueueItem[]>("/api/ai-flags/queue"),
    loadJson<OpenItemsOverview>("/api/open-items"), // unresolved work, longest-waiting first
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

      <Card title="Unresolved work" count={openItems?.summary.open}>
        {openItems === null ? (
          <p>Couldn&apos;t load unresolved work.</p>
        ) : openItems.summary.open === 0 ? (
          <p className="font-semibold">None right now</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              <span className="font-semibold">{openItems.summary.overdue}</span> overdue ·{" "}
              <span className="font-semibold">{openItems.summary.unowned}</span> with no owner · oldest
              opened {formatDateTime(openItems.summary.oldestCreatedAt)}
            </p>
            <OpenItemList
              items={openItems.items.slice(0, OPEN_ITEMS_SHOWN)}
              basePath="/manager/deal-details?deal="
            />
            {openItems.items.length > OPEN_ITEMS_SHOWN && (
              <p className="text-sm opacity-70">
                Showing the {OPEN_ITEMS_SHOWN} longest-waiting of {openItems.items.length}.
              </p>
            )}
          </div>
        )}
      </Card>

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
                  href={`/manager/deal-details/${item.dealId}#event-${item.evidenceEventId}`}
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