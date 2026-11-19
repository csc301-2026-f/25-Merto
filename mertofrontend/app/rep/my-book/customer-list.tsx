"use client";
import { useMemo, useState } from "react";
import { EntryLink } from "@/components/EntryLink";
import type { Deal } from "@/lib/deals";
import { Card } from "@/components/Card";
import { SearchBar, filterDeals } from "@/components/SearchBar";
import { label } from "@/lib/format";

type SortKey = "newest" | "oldest";

function sortDeals(deals: Deal[], key: SortKey): Deal[] {
  // Copy first: .sort() mutates, and props must not be mutated.
  return [...deals].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return key === "oldest" ? diff : -diff;
  });
}

export function CustomerList({deals} : {deals: Deal[];}) {
  // For use with SearchBar
  const searchFields: (keyof Deal)[] = [
    "buyer",
    "vehicleInterest",
    "stage",
    "source",
    "dealId"
  ]
  const [searchQuery, setSearchQuery] = useState("");
  const filteredDeals = filterDeals(
    deals,
    searchQuery,
    searchFields
  );

  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const sorted = useMemo(
    () => sortDeals(filteredDeals, sortKey),
    [filteredDeals, sortKey]
  );

  return(
    <div className="space-y-8">
      <Card 
        title="Customers"
        count={deals?.length}
        aside={
          <div className="flex flex-wrap items-center gap-70">
            <div className="w-2xl max-w-full">
              <SearchBar
                deals={deals}
                fields={searchFields}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                placeholder={"Search by customer, vehicle..."}
                width="100%"
              />
            </div>
            <label className="flex items-center gap-3">
              Sort by
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-black focus:border-[#d5bd91] focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="newest">Deal age (newest first)</option>
                <option value="oldest">Deal age (oldest first)</option>
              </select>
            </label>
          </div>
        }
      >
        {filteredDeals === null ? (
          <p>Couldn&apos;t load your customers.</p>
        ) : filteredDeals.length === 0 ? (
          <p className="font-semibold">None right now</p>
        ) : (
          <ul className="space-y-3">
            {sorted.map((deal) => (
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
  )
}