import { formatDateTime, label } from "@/lib/format";
import type { OpenItem } from "@/lib/open-items";
import { EntryLink } from "./EntryLink";

// "5h" under two days, then whole days.
const waiting = (hours: number) => (hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`);

// Unresolved work (US4), longest-waiting first. Each entry links to its buyer record.
export function OpenItemList({ items, basePath }: { items: OpenItem[]; basePath: string }) {
  if (items.length === 0) return <p className="font-semibold">None right now</p>;
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          <EntryLink
            href={`${basePath}${item.deal.id}`}
            title={
              <>
                {item.deal.buyer}{" "}
                <span className="font-normal opacity-70">({item.deal.vehicleInterest})</span>
              </>
            }
            aside={item.owner?.name ?? "Unassigned"}
          >
            <p>
              <span className="font-semibold">{label(item.type)}</span>
              {item.overdue && (
                <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800">
                  overdue
                </span>
              )}
              : {item.description}
            </p>
            <p className="opacity-70">
              due {formatDateTime(item.dueAt)}
              {item.ageHours !== null && ` · open ${waiting(item.ageHours)}`}
            </p>
          </EntryLink>
        </li>
      ))}
    </ul>
  );
}