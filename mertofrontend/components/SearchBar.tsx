import type { Deal } from "@/lib/deals";
import { useMemo } from "react";

export function SearchBar(
  {
    deals,
    searchQuery,
    setSearchQuery
  }: {
    deals: Deal[],
    searchQuery: string,
    setSearchQuery: (query: string) => void
  }
) {
  const repSuggestions = useMemo(() => {
    const match = searchQuery.match(/^rep:(.*)$/i);
    if (!match) {
      return [];
    }

    const repQuery = match[1].trim().toLowerCase();
    return [...new Set(
      deals
        .map((deal) => deal.owner)
        .filter((owner): owner is string => Boolean(owner))
    )]
      .filter((rep) => rep.toLowerCase().includes(repQuery))
      .sort();
  }, [deals, searchQuery]);

  return (
    <div style={{ position: "relative", width: "40%" }}>
      <input
        type="text"
        placeholder="Search..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          width: "100%",
          padding: "10px",
          fontSize: "16px",
          borderRadius: "4px",
          border: "1px solid #ccc",
          boxSizing: "border-box"
        }}
      />
      {repSuggestions.length > 0 && (
        <ul
          className="border-zinc-300 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          style={{
            position: "absolute",
            zIndex: 1,
            width: "100%",
            margin: 0,
            padding: 0,
            listStyle: "none",
            border: "1px solid #ccc"
          }}
        >
          {repSuggestions.map((rep) => (
            <li key={rep}>
              <button
                type="button"
                onClick={() => setSearchQuery(`rep:${rep}`)}
                className="text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-700"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: 0,
                  textAlign: "left",
                  cursor: "pointer"
                }}
              >
                {rep}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function cleanQuery(query: string) {
  return query.toLowerCase().replace(/[^a-z0-9 ]/g, "");
}

export function filterDeals<K extends keyof Deal>(
  deals: Deal[],
  searchQuery: string,
  fields: K[]
): Deal[] {
  const repQuery = searchQuery.match(/^rep:(.*)$/i);
  const cleanSearchQuery = cleanQuery(repQuery ? repQuery[1] : searchQuery);
  const searchFields = repQuery ? (["owner"] as const) : fields;

  return deals.filter((deal) =>
    searchFields.some((field) =>
      cleanQuery(String(deal[field] ?? "")).includes(cleanSearchQuery)
    )
  );
}