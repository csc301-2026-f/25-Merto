import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { loadJson } from "@/lib/api";

import { Card } from "@/components/Card";
import { EntryLink } from "@/components/EntryLink";
import { OpenItemList } from "@/components/OpenItemList";

import type { QueueItem } from "@/lib/evaluation";
import type { OpenItemsOverview } from "@/lib/open-items";

import { formatDateTime } from "@/lib/format";

const OPEN_ITEMS_SHOWN = 10;

async function ManagerHome() {
  await requireRole("manager");

  const [queue, openItems] = await Promise.all([
    loadJson<QueueItem[]>("/api/ai-flags/queue"),
    loadJson<OpenItemsOverview>("/api/open-items"),
  ]);

  return (
    <div className="space-y-8">

      {/* Deals Need Attention */}
      <Card
        title="Deals Need Attention"
        count={openItems?.summary.open}
        aside={
          openItems && openItems.summary.open > 0 ? (
            <>
              <span className="font-semibold">
                {openItems.summary.overdue}
              </span>
              {" "}overdue ·{" "}

              <span className="font-semibold">
                {openItems.summary.unowned}
              </span>
              {" "}with no owner · oldest opened{" "}

              {formatDateTime(
                openItems.summary.oldestCreatedAt
              )}
            </>
          ) : undefined
        }
      >
        {openItems === null ? (
          <p>Couldn&apos;t load unresolved work.</p>
        ) : openItems.summary.open === 0 ? (
          <p className="font-semibold">
            None right now
          </p>
        ) : (
          <div className="space-y-3">

            <OpenItemList
              items={openItems.items.slice(
                0,
                OPEN_ITEMS_SHOWN
              )}
              basePath="/manager/deal-details/"
            />

            {openItems.items.length > OPEN_ITEMS_SHOWN && (
              <p className="px-1 text-sm opacity-70">
                Showing the {OPEN_ITEMS_SHOWN} longest-waiting
                of {openItems.items.length}.
              </p>
            )}

          </div>
        )}
      </Card>

      {/* Flags Awaiting Review */}
      <Card
        title="Flags Awaiting Review"
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
      <ManagerHome />
    </Suspense>
  );
}