import type { Deal } from "@/lib/deals";
import { useMemo, useRef, useState } from "react";

const QUERY_DELIMITER = "\u2003";
const FIELD_ALIASES: Record<string, keyof Deal> = {
  vehicle: "vehicleInterest",
};

function resolveField<K extends keyof Deal>(
  fieldName: string,
  fields: K[]
): K | undefined {
  const field = fields.find(
    (candidate) => String(candidate).toLowerCase() === fieldName.toLowerCase()
  );

  if (field) {
    return field;
  }

  const alias = FIELD_ALIASES[fieldName.toLowerCase()];
  return alias && fields.includes(alias as K) ? alias as K : undefined;
}

export function SearchBar(
  {
    deals,
    fields,
    searchQuery,
    setSearchQuery
  }: {
    deals: Deal[],
    fields: (keyof Deal)[],
    searchQuery: string,
    setSearchQuery: (query: string) => void
  }
) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldSuggestions = useMemo(() => {
    const delimiterIndex = searchQuery.lastIndexOf(QUERY_DELIMITER);
    const queryAfterField = delimiterIndex >= 0
      ? searchQuery.slice(delimiterIndex + 1)
      : searchQuery;
    const match = queryAfterField.match(/^\s*([^:\s]*)$/);
    if (!match || (!match[1] && !isFocused)) {
      return [];
    }

    const query = match[1].toLowerCase();
    const aliases = Object.entries(FIELD_ALIASES)
      .filter(([, field]) => fields.includes(field))
      .map(([alias]) => alias);

    const aliasedFields = new Set(
      Object.entries(FIELD_ALIASES).map(([, field]) => field)
    );
    const fieldNames = fields
      .filter((field) => !aliasedFields.has(field))
      .map(String);

    return [...new Set([...fieldNames, ...aliases])]
      .filter((field) => field.toLowerCase().startsWith(query))
      .sort();
  }, [fields, isFocused, searchQuery]);

  const valueSuggestions = useMemo(() => {
    const delimiterIndex = searchQuery.lastIndexOf(QUERY_DELIMITER);
    const activeQuery = delimiterIndex >= 0
      ? searchQuery.slice(delimiterIndex + 1)
      : searchQuery;
    const match = activeQuery.match(/^([^:\s]+):(.*)$/);
    if (!match) {
      return [];
    }

    const field = resolveField(match[1], fields);
    if (!field) {
      return [];
    }

    const valueQuery = match[2].trim().toLowerCase();
    return [...new Set(
      deals
        .map((deal) => deal[field])
        .filter((value): value is string => typeof value === "string")
    )]
      .filter((value) => value.toLowerCase().includes(valueQuery))
      .sort();
  }, [deals, fields, searchQuery]);

  const suggestions = fieldSuggestions.length > 0
    ? fieldSuggestions
    : valueSuggestions;
  const delimiterIndex = searchQuery.lastIndexOf(QUERY_DELIMITER);
  const fieldPortion = delimiterIndex >= 0
    ? searchQuery.slice(0, delimiterIndex)
    : "";
  const plaintextPortion = delimiterIndex >= 0
    ? searchQuery.slice(delimiterIndex + 1)
    : searchQuery;

  return (
    <div style={{ position: "relative", width: "40%" }}>
      {delimiterIndex >= 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center text-zinc-900 dark:text-zinc-100"
          style={{
            padding: "10px",
            boxSizing: "border-box",
            whiteSpace: "pre",
            fontSize: "16px",
          }}
        >
          {fieldPortion.split(QUERY_DELIMITER).map((field, index) => (
            <span key={`${field}-${index}`}>
              {index > 0 && QUERY_DELIMITER}
              <span className="rounded bg-amber-100 text-amber-900 dark:bg-amber-300/20 dark:text-amber-200">
                {field}
              </span>
            </span>
          ))}
          {"\u2003"}
          {plaintextPortion}
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        placeholder="Search..."
        value={searchQuery}
        className="caret-zinc-900 dark:caret-zinc-100"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={(event) => {
          if (event.key !== "Backspace") {
            return;
          }

          const selectionStart = inputRef.current?.selectionStart;
          const selectionEnd = inputRef.current?.selectionEnd;
          if (
            selectionStart === 0 &&
            selectionEnd === searchQuery.length
          ) {
            event.preventDefault();
            setSearchQuery("");
            return;
          }

          const delimiterIndex = searchQuery.indexOf(QUERY_DELIMITER);
          const cursorPosition = inputRef.current?.selectionStart;
          if (
            delimiterIndex >= 0 &&
            cursorPosition !== null &&
            cursorPosition !== undefined &&
            cursorPosition <= delimiterIndex
          ) {
            event.preventDefault();
            const plaintext = searchQuery.slice(delimiterIndex + 1);
            setSearchQuery(plaintext);
            requestAnimationFrame(() => {
              inputRef.current?.setSelectionRange(0, 0);
            });
          }
        }}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          width: "100%",
          padding: "10px",
          fontSize: "16px",
          borderRadius: "4px",
          border: "1px solid #ccc",
          boxSizing: "border-box",
          color: delimiterIndex >= 0 ? "transparent" : undefined,
          position: "relative"
        }}
      />
      {suggestions.length > 0 && (
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
          {suggestions.map((value) => (
            <li key={value}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (fieldSuggestions.length > 0) {
                    const delimiterIndex = searchQuery.lastIndexOf(QUERY_DELIMITER);
                    const queryPrefix = delimiterIndex >= 0
                      ? searchQuery.slice(0, delimiterIndex + 1)
                      : "";
                    setSearchQuery(`${queryPrefix}${value}:`);
                  } else {
                    const delimiterIndex = searchQuery.lastIndexOf(QUERY_DELIMITER);
                    const activeQuery = delimiterIndex >= 0
                      ? searchQuery.slice(delimiterIndex + 1)
                      : searchQuery;
                    const field = activeQuery.split(":")[0];
                    const queryPrefix = delimiterIndex >= 0
                      ? searchQuery.slice(0, delimiterIndex + 1)
                      : "";
                    setSearchQuery(`${queryPrefix}${field}:${value}${QUERY_DELIMITER}`);
                  }
                }}
                className="text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-700"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: 0,
                  textAlign: "left",
                  cursor: "pointer"
                }}
              >
                {value}
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
  const delimiterIndex = searchQuery.indexOf(QUERY_DELIMITER);
  const fieldPortion = delimiterIndex >= 0
    ? searchQuery.slice(0, delimiterIndex)
    : searchQuery;
  const plaintext = delimiterIndex >= 0
    ? searchQuery.slice(delimiterIndex + 1)
    : "";
  const fieldQuery = fieldPortion.match(/^([^:\s]+):(.*)$/);
  const requestedField = fieldQuery
    ? resolveField(fieldQuery[1], fields)
    : undefined;
  const fieldValue = fieldQuery && requestedField
    ? fieldQuery[2].trim()
    : "";
  const remainingQuery = fieldQuery && requestedField
    ? delimiterIndex >= 0
      ? plaintext
      : ""
    : searchQuery;
  const cleanFieldValue = cleanQuery(fieldValue);
  const additionalFilters: Array<{ field: K; value: string }> = [];
  const plaintextWithoutFilters = remainingQuery.replace(
    /(?:^|\s)([^:\s]+):([^\s]+)/g,
    (clause, fieldName: string, value: string) => {
      const field = resolveField(fieldName, fields);
      if (field) {
        additionalFilters.push({ field, value });
        return "";
      }
      return clause;
    }
  );
  const cleanRemainingQuery = cleanQuery(plaintextWithoutFilters);

  return deals.filter((deal) => {
    const matchesField = requestedField
      ? cleanQuery(String(deal[requestedField] ?? "")).includes(cleanFieldValue)
      : true;
    const matchesAdditionalFields = additionalFilters.every(({ field, value }) =>
      cleanQuery(String(deal[field] ?? "")).includes(cleanQuery(value))
    );
    const matchesRemainingQuery = cleanRemainingQuery
      ? fields.some((field) =>
          cleanQuery(String(deal[field] ?? "")).includes(cleanRemainingQuery)
        )
      : true;

    return matchesField && matchesAdditionalFields && matchesRemainingQuery;
  });
}