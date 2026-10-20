"use client";

import { useState } from "react";
import type { Flag } from "@/lib/evaluation";
import type { ActorType, TimelineEntry } from "@/lib/deals";
import { formatDateTime, label } from "@/lib/format";

// Every timeline entry shows who acted, so AI activity is never mistaken for a person's.
const ACTORS: { [type in ActorType]: { name: string; className: string } } = {
  ai: { name: "AI", className: "bg-violet-100 text-violet-800" },
  rep: { name: "Rep", className: "bg-blue-100 text-blue-800" },
  gm: { name: "GM", className: "bg-amber-100 text-amber-800" },
  system: { name: "System", className: "bg-gray-200 text-gray-800" },
  buyer: { name: "Buyer", className: "bg-green-100 text-green-800" },
};

const SEVERITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-orange-100 text-orange-800",
  low: "bg-yellow-100 text-yellow-800",
};

// A flag still needs a person until the GM reviews it, or after they confirm it is a real issue.
const needsAttention = (flag: Flag) => flag.reviewStatus === "pending" || flag.reviewStatus === "confirmed_issue";

type Filter = "all" | "conversation" | "ai" | "attention";

// Messages between the buyer and the dealership, AI or human; not internal notes or bookkeeping.
const isMessage = (entry: TimelineEntry) => entry.eventType === "interaction" && entry.direction !== "internal";

// The buyer record's timeline (US2, US3). With `flags` (the deal's AI evaluation),
// each flagged message shows why it was flagged, and "Needs attention" lists them.
export function Timeline({ entries, buyer, flags }: { entries: TimelineEntry[]; buyer: string; flags?: Flag[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const flagsByEvent = new Map<string, Flag[]>();
  for (const flag of flags ?? []) {
    if (!flag.evidenceEventId) continue;
    flagsByEvent.set(flag.evidenceEventId, [...(flagsByEvent.get(flag.evidenceEventId) ?? []), flag]);
  }
  const flagged = (entry: TimelineEntry) => (flagsByEvent.get(entry.id) ?? []).some(needsAttention);

  const options: { value: Filter; text: string; matches: (entry: TimelineEntry) => boolean }[] = [
    { value: "all", text: "All activity", matches: () => true },
    { value: "conversation", text: "Conversation", matches: isMessage },
    { value: "ai", text: "AI only", matches: (entry) => entry.actorType === "ai" },
    ...(flags ? [{ value: "attention" as const, text: "Needs attention", matches: flagged }] : []),
  ];
  const active = options.find((option) => option.value === filter) ?? options[0];
  const shown = entries.filter(active.matches);

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Filter the timeline" className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button key={option.value} type="button" aria-pressed={option.value === active.value}
            onClick={() => setFilter(option.value)}
            className={`rounded border-2 px-2 py-0.5 text-sm ${option.value === active.value ? "font-semibold" : "opacity-70"}`}>
            {option.text} ({entries.filter(option.matches).length})
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="font-semibold">Nothing here</p>
      ) : (
        <ol className="divide-y-2">
          {shown.map((entry) => (
            <TimelineItem key={entry.id} entry={entry} buyer={buyer} flags={flagsByEvent.get(entry.id) ?? []} />
          ))}
        </ol>
      )}
    </div>
  );
}

function TimelineItem({ entry, buyer, flags }: { entry: TimelineEntry; buyer: string; flags: Flag[] }) {
  const actor = ACTORS[entry.actorType];
  const who = entry.actorType === "buyer" ? buyer : entry.actorName;
  const attention = flags.some(needsAttention);
  return (
    // The id lets the flag queue link straight to this message.
    <li id={`event-${entry.id}`} className={`scroll-mt-4 py-3 ${attention ? "border-l-4 border-red-600 pl-3" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${actor.className}`}>{actor.name}</span>
        {who && <span className="font-semibold">{who}</span>}
        <span className="opacity-70">
          {label(entry.channel)} · {entry.direction}
          {entry.eventType !== "interaction" && ` · ${label(entry.eventType)}`} · {formatDateTime(entry.createdAt)}
        </span>
      </div>
      <p className="mt-1 whitespace-pre-wrap">{entry.body}</p>
      {flags.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {flags.map((flag) => (
            <li key={flag.id}>
              <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-semibold ${SEVERITY_STYLES[flag.severity] ?? ""}`}>
                {label(flag.flagType)}
              </span>
              <span className="opacity-70">[{label(flag.reviewStatus)}]</span> {flag.explanation}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
