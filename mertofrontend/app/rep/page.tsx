
import { Suspense } from "react";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { loadJson } from "@/lib/api";
import { Card } from "@/components/Card";
import { EntryLink } from "@/components/EntryLink";
import { FollowUpList } from "@/components/FollowUpList";
import type { Deal } from "@/lib/deals";
import type { DueFollowUp } from "@/lib/follow-ups";
import type { AppointmentOverview } from "@/lib/appointments";
import { formatDateTime } from "@/lib/format";
import { label } from "@/lib/format";
import { DealOutcomeSummary } from "@/components/DealOutcomeSummary";
import { loadDealStats } from "@/lib/deal-stats";
import { TaskList } from "@/components/TaskList";
import type { TasksOverview } from "@/lib/tasks";

const HOME_TASK_LIMIT = 5;

async function RepDashboard() {
  await requireRole("rep");

  // The backend returns only this rep's deals and follow-ups.
  const [followUps, deals, appointments, tasks, stats] = await Promise.all([
    loadJson<DueFollowUp[]>("/api/follow-ups/due"),
    loadJson<Deal[]>("/api/deals"),
    loadJson<AppointmentOverview>("/api/appointments/overview"),
    loadJson<TasksOverview>("/api/tasks"),
    loadDealStats(),
  ]);

  return (
    <div className="space-y-8">
      <Card
        title="My tasks"
        count={tasks?.summary.open}
        aside={<Link href="/rep/tasks" className="underline">View all tasks</Link>}
      >
        {tasks === null ? (
          <p>Couldn&apos;t load your tasks.</p>
        ) : (
          <>
            {tasks.summary.open > 0 && (
              <p className="mb-2 text-sm">
                <span className={tasks.summary.overdue > 0 ? "font-semibold text-red-600" : ""}>
                  {tasks.summary.overdue} overdue
                </span>
                {" · "}
                {tasks.summary.dueToday} due later today
              </p>
            )}
            <TaskList tasks={tasks.tasks.slice(0, HOME_TASK_LIMIT)} dealHref="/rep/deals" empty="Nothing to do right now" />
            {tasks.tasks.length > HOME_TASK_LIMIT && (
              <p className="mt-2 text-sm">
                <Link href="/rep/tasks" className="underline">
                  {tasks.tasks.length - HOME_TASK_LIMIT} more open task{tasks.tasks.length - HOME_TASK_LIMIT === 1 ? "" : "s"}
                </Link>
              </p>
            )}
          </>
        )}
      </Card>

      <Card title="Needs follow-up" count={followUps?.length}>
        {followUps === null ? (
          <p>Couldn&apos;t load follow-ups.</p>
        ) : followUps.length === 0 ? (
          <p className="font-semibold">None right now</p>
        ) : (
          <FollowUpList items={followUps} basePath="/rep/deals" />
        )}

        <p className="mt-3 text-sm opacity-70">
          Most overdue first. Opted-out customers, closed deals, and customers
          with a booked visit or a scheduled callback are left out.
        </p>
      </Card>

      <Card
        title="Appointments to confirm"
        count={appointments?.requestedToConfirm.length}
      >
        {appointments === null ? (
          <p>Couldn&apos;t load appointment tasks.</p>
        ) : appointments.requestedToConfirm.length === 0 ? (
          <p className="font-semibold">None right now</p>
        ) : (
          <ul className="space-y-2">
            {appointments.requestedToConfirm.map((appointment) => (
              <li key={appointment.id}>
                <EntryLink href="/rep/calendar" title={appointment.buyer} aside="">
                  <p>{appointment.vehicleInterest} · confirm {formatDateTime(appointment.scheduledFor)}</p>
                </EntryLink>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Visit outcomes to record"
        count={appointments?.visitsToRecord.length}
      >
        {appointments === null ? (
          <p>Couldn&apos;t load appointment tasks.</p>
        ) : appointments.visitsToRecord.length === 0 ? (
          <p className="font-semibold">None right now</p>
        ) : (
          <ul className="space-y-2">
            {appointments.visitsToRecord.map((appointment) => (
              <li key={appointment.id}>
                <EntryLink href="/rep/calendar" title={appointment.buyer} aside="">
                  <p>{appointment.vehicleInterest} · record outcome ({formatDateTime(appointment.scheduledFor)})</p>
                </EntryLink>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Sales outcomes" hideCount>
        <EntryLink href="/rep/stats" title="View statistics" aside="">
          <DealOutcomeSummary stats={stats} />
        </EntryLink>
      </Card>

      <Card title="My customers" count={deals?.length}>
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
