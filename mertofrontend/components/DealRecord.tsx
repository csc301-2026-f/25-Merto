import type { ReactNode } from "react";

import { formatDateTime, label } from "@/lib/format";

import type {
  AssignmentRecord,
  DealRecord as DealRecordData,
} from "@/lib/deals";

import type { Flag } from "@/lib/evaluation";

import { OpenItems } from "./OpenItems";
import { Timeline } from "./Timeline";


function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-slate-100 text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100">

      <h2 className="bg-slate-200 px-4 py-3 font-semibold dark:bg-zinc-800">
        {title}
      </h2>

      <div className="p-4">
        {children}
      </div>

    </section>
  );
}


function OwnershipEntry({
  entry,
}: {
  entry: AssignmentRecord;
}) {
  const by = entry.by
    ? ` by ${entry.by.name}`
    : "";

  return (
    <li className="py-3">

      <p className="text-sm opacity-70">
        {formatDateTime(entry.at)}
      </p>

      {entry.structured ? (
        <>
          <p className="font-semibold">
            {entry.kind === "assignment"
              ? `Assigned to ${entry.to?.name}${by}`
              : `Transferred from ${entry.from?.name} to ${entry.to?.name}${by}`}
          </p>

          <p className="text-sm">
            Reason: {entry.reason}
          </p>

          {entry.openItemsMoved ? (
            <p className="text-sm opacity-70">
              {entry.openItemsMoved} open item
              {entry.openItemsMoved === 1 ? "" : "s"}
              {" "}moved to the new owner.
            </p>
          ) : null}
        </>
      ) : (
        <p>{entry.body}</p>
      )}

    </li>
  );
}


// Full buyer record.
export function DealRecord({
  deal,
  followUp,
  flags,
}: {
  deal: DealRecordData;
  followUp?: ReactNode;
  flags?: Flag[];
}) {
  return (
    <div className="space-y-6">

      {/* Customer information */}
      <Section title="Customer Info">

        <div className="space-y-2">

          <h1 className="text-2xl font-bold">
            {deal.buyer.name}
          </h1>

          <p className="opacity-70">
            {deal.vehicleInterest}
            {" · "}
            {label(deal.stage)}
            {" · from "}
            {label(deal.source)}
          </p>

          <p>
            <span className="font-semibold">
              Current rep:
            </span>
            {" "}
            {deal.owner?.name ?? "Unassigned"}
          </p>

          <p className="text-sm opacity-70">
            {[
              deal.buyer.email,
              deal.buyer.phone,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {deal.buyer.optedOut && (
            <p
              role="alert"
              className="mt-2 rounded-lg bg-red-100 p-3 text-sm text-red-800"
            >
              This customer opted out. Do not contact them.
            </p>
          )}

        </div>

      </Section>


      {followUp}


      {/* Ownership, open items and appointments */}
      <div className="grid items-stretch gap-4 lg:grid-cols-3">

        {/* Ownership History */}
        <Section title="Ownership History">

          {deal.assignments.length === 0 ? (
            <p className="font-semibold">
              Never assigned
            </p>
          ) : (
            <ol className="divide-y divide-zinc-300 dark:divide-zinc-700">

              {[...deal.assignments]
                .reverse()
                .map((entry) => (
                  <OwnershipEntry
                    key={entry.eventId}
                    entry={entry}
                  />
                ))}

            </ol>
          )}

        </Section>


        {/* Open Items */}
        <Section title="Open Items">

          <OpenItems items={deal.openItems} />

        </Section>


        {/* Appointments */}
        <Section title="Appointments">

          {deal.appointments.length === 0 ? (
            <p className="font-semibold">
              None right now
            </p>
          ) : (
            <ul className="divide-y divide-zinc-300 text-sm dark:divide-zinc-700">

              {deal.appointments.map((visit) => (
                <li
                  key={visit.id}
                  className="py-2"
                >
                  {formatDateTime(visit.scheduledFor)}

                  {": "}

                  <span className="font-semibold">
                    {label(visit.status)}
                  </span>

                  {visit.confirmedBy &&
                    ` (confirmed by ${visit.confirmedBy})`}
                </li>
              ))}

            </ul>
          )}

        </Section>

      </div>


      {/* Timeline */}
      <Section title="Timeline">

        <Timeline
          entries={deal.timeline}
          buyer={deal.buyer.name}
          flags={flags}
        />

      </Section>

    </div>
  );
}