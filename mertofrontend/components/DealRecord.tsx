import type { ReactNode } from "react";
import { formatDateTime, label } from "@/lib/format";
import type { AssignmentRecord, DealRecord as DealRecordData } from "@/lib/deals";
import type { Flag } from "@/lib/evaluation";
import { OpenItems } from "./OpenItems";
import { Timeline } from "./Timeline";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded border-2">
      <h2 className="border-b-2 p-3 font-semibold">{title}</h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

function OwnershipEntry({ entry }: { entry: AssignmentRecord }) {
  const by = entry.by ? ` by ${entry.by.name}` : "";
  return (
    <li className="py-3">
      <p className="text-sm opacity-70">{formatDateTime(entry.at)}</p>
      {entry.structured ? (
        <>
          <p className="font-semibold">
            {entry.kind === "assignment"
              ? `Assigned to ${entry.to?.name}${by}`
              : `Transferred from ${entry.from?.name} to ${entry.to?.name}${by}`}
          </p>
          <p className="text-sm">Reason: {entry.reason}</p>
          {entry.openItemsMoved ? (
            <p className="text-sm opacity-70">
              {entry.openItemsMoved} open item{entry.openItemsMoved === 1 ? "" : "s"} moved to the new owner.
            </p>
          ) : null}
        </>
      ) : (
        // Recorded before from/to/reason were stored separately: show the note as written.
        <p>{entry.body}</p>
      )}
    </li>
  );
}

// The whole buyer record (GET /api/deals/:dealId) for the manager or the owning rep.
// flags: the deal's AI evaluation flags, shown on the messages they point at.
export function DealRecord({ deal, followUp, flags }: { deal: DealRecordData; followUp?: ReactNode; flags?: Flag[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{deal.buyer.name}</h1>
        <p className="opacity-70">
          {deal.vehicleInterest} · {label(deal.stage)} · from {label(deal.source)}
        </p>
        <p>
          <span className="font-semibold">Current rep: </span>
          {deal.owner?.name ?? "Unassigned"}
        </p>
        <p className="text-sm opacity-70">
          {[deal.buyer.email, deal.buyer.phone].filter(Boolean).join(" · ")}
        </p>
        {deal.buyer.optedOut && (
          <p role="alert" className="mt-2 rounded border-2 border-red-600 p-2 text-sm text-red-600">
            This customer opted out. Do not contact them.
          </p>
        )}
      </div>

      {followUp}

      <Section title="Ownership history">
        {deal.assignments.length === 0 ? (
          <p className="font-semibold">Never assigned</p>
        ) : (
          <ol className="divide-y-2">
            {[...deal.assignments].reverse().map((entry) => (
              <OwnershipEntry key={entry.eventId} entry={entry} />
            ))}
          </ol>
        )}
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Open items">
          <OpenItems items={deal.openItems} />
        </Section>

        <Section title="Appointments">
          {deal.appointments.length === 0 ? (
            <p className="font-semibold">None right now</p>
          ) : (
            <ul className="divide-y-2 text-sm">
              {deal.appointments.map((visit) => (
                <li key={visit.id} className="py-2">
                  {formatDateTime(visit.scheduledFor)}: <span className="font-semibold">{label(visit.status)}</span>
                  {visit.confirmedBy && ` (confirmed by ${visit.confirmedBy})`}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Timeline">
        <Timeline entries={deal.timeline} buyer={deal.buyer.name} flags={flags} />
      </Section>
    </div>
  );
}
