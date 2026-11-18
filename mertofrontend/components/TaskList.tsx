"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { setTaskCompleted } from "@/app/task-actions";
import type { Task, TaskWithDeal } from "@/lib/tasks";
import { formatDateTime } from "@/lib/format";

// Tasks with a checkbox each. With dealHref, every row also links to its deal
// (the Tasks page and the homepage); on a deal page the deal is already known.
export function TaskList({
  tasks,
  dealHref,
  empty = "None right now",
}: {
  tasks: (Task | TaskWithDeal)[];
  dealHref?: string;
  empty?: string;
}) {
  if (tasks.length === 0) return <p className="font-semibold">{empty}</p>;
  return (
    <ul className="divide-y divide-zinc-300 text-sm dark:divide-zinc-700">
      {tasks.map((task) => <TaskRow key={task.id} task={task} dealHref={dealHref} />)}
    </ul>
  );
}

function TaskRow({ task, dealHref }: { task: Task | TaskWithDeal; dealHref?: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const saved = task.status === "completed";
  // Tick the box at once; it settles to the saved state when the page refreshes.
  const [done, setDone] = useOptimistic(saved);
  const deal = "deal" in task ? task.deal : null;

  function toggle() {
    setError(undefined);
    startTransition(async () => {
      setDone(!saved);
      const result = await setTaskCompleted(task.id, !saved);
      if (!result.ok) setError(result.error);
      // On success the page refreshes with the task in its new place.
    });
  }

  return (
    <li className="flex items-start gap-3 py-2">
      <input
        type="checkbox"
        checked={done}
        onChange={toggle}
        disabled={pending}
        aria-label={done ? `Reopen: ${task.title}` : `Mark done: ${task.title}`}
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer"
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className={done ? "line-through opacity-60" : "font-semibold"}>
          {task.overdue && !done && (
            <span className="mr-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800">overdue</span>
          )}
          {task.title}
        </p>
        <p className="text-xs opacity-70">
          {deal && dealHref && (
            <>
              <Link href={`${dealHref}/${deal.id}`} className="underline">{deal.buyer}</Link>
              {` (${deal.vehicleInterest}) · `}
            </>
          )}
          {done
            ? `Done ${formatDateTime(task.completedAt)}${task.completedBy ? ` by ${task.completedBy.name}` : ""}`
            : task.dueAt ? `Due ${formatDateTime(task.dueAt)}` : "No due date"}
        </p>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </div>
    </li>
  );
}
