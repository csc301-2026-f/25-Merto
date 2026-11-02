import { Suspense } from "react";

import { requireRole } from "@/lib/auth/session";
import { loadJson } from "@/lib/api";

import { Card } from "@/components/Card";
import { EntryLink } from "@/components/EntryLink";

import type { Metrics, QueueItem } from "@/lib/evaluation";

import { RunEvaluation } from "../run-evaluation";


function labelFor(key: string) {
  const spaced = key.replace(/([A-Z])/g, " $1");

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}


function formatMetric(
  key: string,
  value: unknown
): string {
  if (value === null || value === undefined) {
    return "Not measured";
  }

  if (typeof value === "number") {
    return /rate|precision/i.test(key) && value <= 1
      ? `${(value * 100).toFixed(1)}%`
      : String(value);
  }

  return String(value);
}


function MetricsList({
  metrics,
}: {
  metrics: Metrics;
}) {
  return (
    <dl className="space-y-3">

      {Object.entries(metrics).map(([key, value]) =>
        value !== null && typeof value === "object" ? (

          <div key={key}>
            <dt className="font-semibold">
              {labelFor(key)}
            </dt>

            <dd>
              <ul className="ml-4 list-disc">
                {Object.entries(
                  value as Record<string, unknown>
                ).map(([nestedKey, nestedValue]) => (
                  <li key={nestedKey}>
                    {labelFor(nestedKey)}:{" "}
                    {formatMetric(nestedKey, nestedValue)}
                  </li>
                ))}
              </ul>
            </dd>
          </div>

        ) : (

          <div
            key={key}
            className="flex justify-between gap-4"
          >
            <dt className="font-semibold">
              {labelFor(key)}
            </dt>

            <dd>
              {formatMetric(key, value)}
            </dd>
          </div>

        )
      )}

    </dl>
  );
}


async function AiReviewPage() {
  await requireRole("manager");

  const [metrics, queue] = await Promise.all([
    loadJson<Metrics>("/api/ai-evaluation/metrics"),
    loadJson<QueueItem[]>("/api/ai-flags/queue"),
  ]);

  return (
    <div className="space-y-8">

      <header>
        <h1 className="text-2xl font-bold">
          AI Review
        </h1>

        <p className="mt-1 text-sm opacity-70">
          Review AI evaluations, monitor performance,
          and investigate flagged conversations.
        </p>
      </header>

      {/* AI Evaluation Metrics */}
      <Card
        title="AI Evaluation"
        hideCount
      >
        <div className="space-y-4 rounded-xl bg-slate-100 p-4 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">

          <RunEvaluation />

          <div>
            <h3 className="mb-3 font-semibold">
              Results
            </h3>

            {metrics === null ? (
              <p>Couldn&apos;t load metrics.</p>
            ) : Object.keys(metrics).length === 0 ? (
              <p className="font-semibold">
                No metrics yet
              </p>
            ) : (
              <MetricsList metrics={metrics} />
            )}

          </div>
        </div>
      </Card>

      {/* Flags Awaiting Review */}
      <Card
        title="Flag Details"
        count={queue?.length}
      >
        {queue === null ? (
          <p>Couldn&apos;t load the flag queue.</p>
        ) : queue.length === 0 ? (
          <p className="font-semibold">
            None right now
          </p>
        ) : (
          <ul className="space-y-3">

            {queue.map((item) => (
              <li key={item.id}>

                <EntryLink
                  href={`/manager/deal-details/${item.dealId}#event-${item.evidenceEventId ?? ""}`}
                  title={item.buyer}
                  aside={item.owner}
                >
                  <p>
                    <span className="font-semibold">
                      {item.flagType.replace(/_/g, " ")}
                    </span>

                    <span className="ml-2 opacity-70">
                      ({item.severity})
                    </span>
                  </p>

                  <p>{item.explanation}</p>

                  {item.evidenceBody && (
                    <p className="italic opacity-80">
                      {item.evidenceBody}
                    </p>
                  )}

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
      <AiReviewPage />
    </Suspense>
  );
}