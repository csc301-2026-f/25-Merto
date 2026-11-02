"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Deal, Rep } from "@/lib/deals";
import { assignOrTransfer } from "../actions";
import type { Evaluation } from "@/lib/evaluation";
import { EvaluationSummary } from "@/components/EvaluationSummary";

const DEFAULT_ASSIGN_REASON = "Customer was not attended.";

type SortKey = "newest" | "oldest";

function sortDeals(deals: Deal[], key: SortKey): Deal[] {
  // Copy first: .sort() mutates, and props must not be mutated.
  return [...deals].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return key === "oldest" ? diff : -diff;
  });
}

export function DealList({
  deals,
  evaluations,
  reps,
  openDealId,
}: {
  deals: Deal[];
  evaluations: Record<string, Evaluation | null>;
  reps: Rep[];
  openDealId?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const sorted = useMemo(() => sortDeals(deals, sortKey), [deals, sortKey]);

  return (
    <section>
      <header className="flex items-center justify-between px-1 pb-4">
        <h1 className="text-2xl font-bold">
          {deals.length} {deals.length === 1 ? "Deal" : "Deals"}
        </h1>
        <label className="flex items-center gap-2 ">
          Sort by
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded border-2 px-2 py-1 dark:text-white"
          >
            <option value="newest" className="text-black">Deal age (newest first)</option>
            <option value="oldest" className="text-black">Deal age (oldest first)</option>
          </select>
        </label>
      </header>

      {deals.length === 0 ? (
        <p className="p-4 font-semibold">No deals right now.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((deal) => (
            <DealRow
              key={deal.dealId}
              deal={deal}
              evaluation={evaluations[deal.dealId]}
              reps={reps}
              startOpen={deal.dealId === openDealId}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function DealRow({
  deal,
  evaluation,
  reps,
  startOpen,
}: {
  deal: Deal;
  evaluation: Evaluation | null | undefined;
  reps: Rep[];
  startOpen: boolean;
}) {
  const [owner, setOwner] = useState<{ id: string; name: string } | null>(
    deal.ownerId ? { id: deal.ownerId, name: deal.owner ?? "Unknown" } : null
  );
  const [repId, setRepId] = useState("");
  const [reason, setReason] = useState(owner ? "" : DEFAULT_ASSIGN_REASON);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const rowRef = useRef<HTMLLIElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Reset: start closed (or open if linked to), and close again when leaving the page.
  useEffect(() => {
    const el = detailsRef.current;
    if (el) el.open = startOpen;
    return () => {
      if (el) el.open = false;
    };
  }, [startOpen]);

  // If we arrived from another page with ?deal=, scroll this row into view.
  useEffect(() => {
    if (startOpen) rowRef.current?.scrollIntoView({ block: "center" });
  }, [startOpen]);

  const isAssigned = owner !== null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const rep = reps.find((r) => r.id === repId);
    if (!rep) return;
    setError(undefined);

    startTransition(async () => {
      const mode = isAssigned ? "transfer" : "assign";
      // owner?.id is who this page shows; the backend refuses if that changed since.
      const result = await assignOrTransfer(mode, deal.dealId, rep.id, reason, owner?.id ?? null);
      if (result.ok) {
        setOwner(rep);
        setRepId("");
        setReason(""); // a transfer needs a fresh reason
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <li ref={rowRef} className="rounded-lg bg-current/5 transition-colors hover:bg-current/10">
      <details ref={detailsRef} open={startOpen}>
        <summary className="flex cursor-pointer items-start justify-between gap-4 p-4">
          <span className="font-semibold">
            {deal.buyer}{" "}
            <span className="font-normal opacity-70">({deal.vehicleInterest})</span>
          </span>
          <span className="shrink-0 font-semibold">{owner ? owner.name : "Unassigned"}</span>
        </summary>

        <div className="space-y-3 px-4 pb-4">
          <p>
            <span className="font-semibold">Current rep: </span>
            {owner ? owner.name : "Unassigned"}
          </p>
          <p>
            <span className="font-semibold">Stage: </span>
            {deal.stage}
          </p>
          <p>
            <span className="font-semibold">Source: </span>
            {deal.source}
          </p>
          <p>
            <span className="font-semibold">Created: </span>
            {deal.createdAt.slice(0, 10)}
          </p>
          <p className="text-sm opacity-70">Deal ID: {deal.dealId}</p>
          <EvaluationSummary evaluation={evaluation} />

          <form onSubmit={handleSubmit} className="flex flex-wrap items-start gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor={`rep-${deal.dealId}`} className="font-semibold">
                {isAssigned ? "Transfer to:" : "Assign to:"}
              </label>
              <select
                id={`rep-${deal.dealId}`}
                value={repId}
                onChange={(e) => setRepId(e.target.value)}
                required
                disabled={pending}
                className="rounded border-2 px-2 py-1"
              >
                <option className="text-black" value="" disabled>Select rep…</option>
                {reps.map((rep) => (
                  <option className="text-black" key={rep.id} value={rep.id} disabled={rep.id === owner?.id}>
                    {rep.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-64 flex-1 flex-col gap-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Type the reason…"
                aria-label="Reason"
                required
                maxLength={500}
                rows={3}
                disabled={pending}
                className="w-full rounded border-2 p-2"
              />
              <div className="flex items-center justify-end gap-3">
                {pending && <span className="text-sm">Saving…</span>}
                {error && (
                  <span role="alert" className="text-sm text-red-600">
                    {error}
                  </span>
                )}
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded border-2 px-3 py-1 font-semibold disabled:opacity-50"
                >
                  {isAssigned ? "Transfer" : "Assign"}
                </button>
              </div>
            </div>
          </form>
          <div className="flex justify-start border-t border-zinc-300 pt-4 dark:border-zinc-700">
            <Link href={`/manager/deal-details/${deal.dealId}`} className="inline-flex items-center rounded-lg bg-[#d5bd91] px-4 py-2 font-semibold text-zinc-950 hover:bg-[#e3cda6]">
              View Full Record
            </Link>
          </div>
        </div>
      </details>
    </li>
  );
}