import Link from "next/link";
import type { DueFollowUp } from "@/lib/follow-ups";

// Customers due a follow-up (US6), most overdue first, each with the reasons why.
export function FollowUpList({ items, basePath }: { items: DueFollowUp[]; basePath: string }) {
  if (items.length === 0) return <p className="font-semibold">None right now</p>;
  return (
    <ul className="divide-y-2">
      {items.map((item) => (
        <li key={item.dealId} className="py-3">
          <Link href={`${basePath}/${item.dealId}`} className="block hover:underline">
            <span className="font-semibold">{item.buyer.name}</span>{" "}
            <span className="opacity-70">({item.vehicleInterest})</span>
          </Link>
          <ul className="mt-1 space-y-1 text-sm">
            {item.reasons.map((reason) => (
              <li key={`${reason.code}:${reason.openItemId ?? reason.evidenceEventId ?? reason.appointmentId ?? ""}`}>
                <span
                  className={`mr-2 rounded px-1.5 py-0.5 text-xs font-semibold ${
                    reason.kind === "owed" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {reason.kind === "owed" ? "customer waiting" : "check in"}
                </span>
                {reason.text}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
