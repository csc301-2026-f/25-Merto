"use client";

import { useState, useTransition } from "react";
import { closeOpenItem } from "@/app/open-item-actions";
import type { DealOpenItem } from "@/lib/deals";
import { formatDateTime, label } from "@/lib/format";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  cancelled: "bg-gray-200 text-gray-800",
};

const isOverdue = (item: DealOpenItem) =>
  item.status === "open" && item.dueAt !== null && Date.parse(item.dueAt) < Date.now();

// A deal's open items (US4): unresolved work first, each with Resolve and Cancel;
// closed items below, greyed out, so done and not-done are never confused.
export function OpenItems({ items }: { items: DealOpenItem[] }) {
  const open = items.filter((item) => item.status === "open");
  const closed = items.filter((item) => item.status !== "open");
  return (
    <div className="space-y-3">
      {open.length === 0 ? (
        <p className="font-semibold">None right now</p>
      ) : (
        <ul className="divide-y-2 text-sm">
          {open.map((item) => <OpenItemRow key={item.id} item={item} />)}
        </ul>
      )}
      {closed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Closed ({closed.length})</summary>
          <ul className="mt-2 divide-y-2 text-sm opacity-70">
            {closed.map((item) => (
              <li key={item.id} className="py-2">
                <StatusBadge status={item.status} />
                <span className="font-semibold line-through">{label(item.type)}</span>: {item.description}
                {item.resolvedAt && <span> · resolved {formatDateTime(item.resolvedAt)}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] ?? ""}`}>
      {status}
    </span>
  );
}

function OpenItemRow({ item }: { item: DealOpenItem }) {
  const [action, setAction] = useState<"resolve" | "cancel" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action) return;
    setError(undefined);
    startTransition(async () => {
      const result = await closeOpenItem(item.id, action, note);
      if (!result.ok) setError(result.error);
      // On success the page refreshes and this item moves to the closed list.
    });
  }

  return (
    <li className="space-y-2 py-2">
      <div>
        <StatusBadge status={item.status} />
        {isOverdue(item) && (
          <span className="mr-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800">overdue</span>
        )}
        <span className="font-semibold">{label(item.type)}</span>: {item.description}{" "}
        <span className="opacity-70">({item.owner ?? "no owner"}, due {formatDateTime(item.dueAt)})</span>
      </div>
      {action === null ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => setAction("resolve")}
            className="rounded border-2 px-2 py-0.5 text-xs font-semibold">Resolve</button>
          <button type="button" onClick={() => setAction("cancel")}
            className="rounded border-2 px-2 py-0.5 text-xs font-semibold">Cancel item</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <label className="block text-xs font-semibold" htmlFor={`note-${item.id}`}>
            {action === "resolve" ? "How was it done? (optional)" : "Why is it no longer needed? (required)"}
          </label>
          <input id={`note-${item.id}`} value={note} onChange={(e) => setNote(e.target.value)}
            maxLength={500} required={action === "cancel"} disabled={pending}
            className="w-full rounded border-2 px-2 py-1" />
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending || (action === "cancel" && !note.trim())}
              className="rounded border-2 px-2 py-0.5 text-xs font-semibold disabled:opacity-50">
              {pending ? "Saving…" : action === "resolve" ? "Mark resolved" : "Cancel this item"}
            </button>
            <button type="button" disabled={pending} onClick={() => { setAction(null); setError(undefined); }}
              className="px-2 py-0.5 text-xs underline">Back</button>
          </div>
        </form>
      )}
    </li>
  );
}
