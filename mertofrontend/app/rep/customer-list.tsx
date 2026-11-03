"use client";
import { useState } from "react";
import { EntryLink } from "@/components/EntryLink";
import type { Deal } from "@/lib/deals";
import { Card } from "@/components/Card";
import { SearchBar, filterDeals } from "@/components/SearchBar";
import { label } from "@/lib/format";

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

  return(
    <Card
      title="My customers"
      count={deals?.length}
      aside={
        <div className="w-2xl">
          <SearchBar
          deals={deals}
          fields={searchFields}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          placeholder={"Search by customer, vehicle..."}
          width="100%"
          />
        </div>
      }
    >
      {filteredDeals.length === 0 ? (
        <p className="font-semibold">None right now</p>
      ) : (
        <ul className="space-y-3">
          {filteredDeals.map((deal) => (
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
  )
}