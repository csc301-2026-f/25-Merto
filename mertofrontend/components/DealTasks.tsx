"use client";

import { useState, useTransition } from "react";
import { createTask } from "@/app/task-actions";
import type { Task } from "@/lib/tasks";
import { TaskList } from "./TaskList";

// The Tasks section of a deal: add a task, tick it off when it's done.
// Completed tasks are tucked under a toggle so the to-do list stays short.
export function DealTasks({ dealId, tasks, canAdd }: { dealId: string; tasks: Task[] | null; canAdd: boolean }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (tasks === null) return <p>Couldn&apos;t load tasks.</p>;
  const open = tasks.filter((task) => task.status === "open");
  const done = tasks.filter((task) => task.status === "completed");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setError(undefined);
    startTransition(async () => {
      const result = await createTask(dealId, title.trim(), due);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTitle("");
      setDue("");
    });
  }

  return (
    <div className="space-y-4">
      {canAdd && (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <label htmlFor="task-title" className="block text-xs font-semibold">New task</label>
            <input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Ask finance for the lease residual" maxLength={200} required disabled={pending}
              className="w-full rounded border-2 px-2 py-1" />
          </div>
          <div>
            <label htmlFor="task-due" className="block text-xs font-semibold">Due (optional)</label>
            <input id="task-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)}
              disabled={pending} className="rounded border-2 px-2 py-1" />
          </div>
          <button type="submit" disabled={pending || !title.trim()}
            className="rounded border-2 px-3 py-1 text-sm font-semibold disabled:opacity-50">
            {pending ? "Adding…" : "Add task"}
          </button>
          {error && <p role="alert" className="w-full text-xs text-red-600">{error}</p>}
        </form>
      )}

      <TaskList tasks={open} />

      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Completed ({done.length})</summary>
          <div className="mt-2"><TaskList tasks={done} /></div>
        </details>
      )}
    </div>
  );
}
