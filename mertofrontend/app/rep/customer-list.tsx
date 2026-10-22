"use client";
import { useState } from "react";
import Link from "next/link";
import type { Deal } from "@/lib/deals";
import { Card } from "@/components/Card";
import { SearchBar, cleanQuery } from "@/components/SearchBar";

export function DealList({deals}: {deals: Deal[];}) {

  // For use with SearchBar
  const [searchQuery, setSearchQuery] = useState("");
  const cleanSearchQuery = cleanQuery(searchQuery);
  const filteredDeals = deals.filter((item) =>
    cleanQuery(item.buyer).includes(cleanSearchQuery) ||
    cleanQuery(item.vehicleInterest).includes(cleanSearchQuery)
  );

  return (
    <Card title="My customers" count={filteredDeals?.length}>
      <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      {deals === null ? (
        <p>Couldn&apos;t load your customers.</p>
      ) : deals.length === 0 ? (
        <p className="font-semibold">None right now</p>
      ) : (
        <ul className="divide-y-2">
          {filteredDeals.map((deal) => (
            <li key={deal.dealId} className="py-3">
              <Link href={`/rep/deals/${deal.dealId}`} className="block hover:underline">
                {deal.buyer}{" "}
                <span className="opacity-70">
                  ({deal.vehicleInterest} · {deal.stage.replaceAll("_", " ")})
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}