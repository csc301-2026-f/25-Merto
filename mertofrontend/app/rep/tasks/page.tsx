import { Suspense } from "react";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { loadJson } from "@/lib/api";
import { Card } from "@/components/Card";
import { TaskList } from "@/components/TaskList";
import { TASK_STATUSES, type TaskStatusFilter, type TasksOverview } from "@/lib/tasks";

type SearchParams = Promise<{ status?: string | string[] }>;

const TAB_LABELS: Record<TaskStatusFilter, string> = { open: "To do", completed: "Completed", all: "All" };

// Every task on this rep's deals. The backend returns only deals they own.
async function Tasks({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("rep");
  const requested = (await searchParams).status;
  const status: TaskStatusFilter = TASK_STATUSES.find((value) => value === requested) ?? "open";
  const overview = await loadJson<TasksOverview>(`/api/tasks?status=${status}`);

  return (
    <div className="space-y-6">
      <nav aria-label="Task status" className="flex gap-2 text-sm">
        {TASK_STATUSES.map((value) => (
          <Link
            key={value}
            href={value === "open" ? "/rep/tasks" : `/rep/tasks?status=${value}`}
            aria-current={value === status ? "page" : undefined}
            className={`rounded-md border-2 px-3 py-1 font-semibold ${value === status ? "bg-current/10" : "opacity-70"}`}
          >
            {TAB_LABELS[value]}
          </Link>
        ))}
      </nav>

      <Card
        title={status === "open" ? "Tasks to do" : status === "completed" ? "Completed tasks" : "All tasks"}
        count={overview?.tasks.length}
        aside={overview && overview.summary.open > 0
          ? `${overview.summary.overdue} overdue · ${overview.summary.dueToday} due later today`
          : undefined}
      >
        {overview === null ? (
          <p>Couldn&apos;t load your tasks.</p>
        ) : (
          <TaskList
            tasks={overview.tasks}
            dealHref="/rep/deals"
            empty={status === "completed" ? "No completed tasks yet" : "Nothing to do right now"}
          />
        )}
        <p className="mt-3 text-sm opacity-70">
          Soonest due first; tasks without a due date come last. Add tasks from a customer&apos;s page.
        </p>
      </Card>
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Tasks searchParams={searchParams} />
    </Suspense>
  );
}
