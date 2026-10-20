import Link from "next/link";
import { formatDateTime, label } from "@/lib/format";
import type { OpenItem } from "@/lib/open-items";

// "5h" under two days, then whole days.
const waiting = (hours: number) => (hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`);

// Unresolved work (US4), longest-waiting first. Each row links to its buyer record.
export function OpenItemList({ items, basePath }: { items: OpenItem[]; basePath: string }) {
  if (items.length === 0) return <p className="font-semibold">None right now</p>;
  return (
    <ul className="divide-y-2">
      {items.map((item) => (
        <li key={item.id} className="py-3">
          <Link href={`${basePath}${item.deal.id}`} className="block hover:underline">
            <span className="font-semibold">{label(item.type)}</span>
            {item.overdue && (
              <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800">
                overdue
              </span>
            )}
            {item.owner === null && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
                no owner
              </span>
            )}
            <span className="ml-2">
              · {item.deal.buyer} <span className="opacity-70">({item.deal.vehicleInterest})</span>
            </span>
            <span className="block text-sm">{item.description}</span>
            <span className="block text-sm opacity-70">
              {item.owner?.name ?? "No owner"} · due {formatDateTime(item.dueAt)}
              {item.ageHours !== null && ` · open ${waiting(item.ageHours)}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
