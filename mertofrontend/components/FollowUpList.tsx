
import Link from "next/link";
import type { DueFollowUp } from "@/lib/follow-ups";

// Customers due a follow-up (US6), most overdue first, each with the reasons why.
export function FollowUpList({
  items,
  basePath,
}: {
  items: DueFollowUp[];
  basePath: string;
}) {
  if (items.length === 0) {
    return <p className="font-semibold">None right now</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.dealId}>
          <Link
            href={`${basePath}/${item.dealId}`}


            className="block rounded-lg bg-current/5 p-4 transition-colors hover:bg-current/10"
          
          
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold transition hover:text-[#8b7045] dark:hover:text-[#d5bd91]">
                {item.buyer.name}
              </span>

              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {item.vehicleInterest}
              </span>
            </div>

            <ul className="mt-3 space-y-2">
              {item.reasons.map((reason) => (
                <li
                  key={`${reason.code}:${reason.openItemId ?? reason.evidenceEventId ?? reason.appointmentId ?? ""}`}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      reason.kind === "owed"
                        ? "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300"
                        : "bg-[#d5bd91]/30 text-[#725b38] dark:bg-[#d5bd91]/20 dark:text-[#d5bd91]"
                    }`}
                  >
                    {reason.kind === "owed" ? "customer waiting" : "check in"}
                  </span>

                  <span className="text-zinc-700 dark:text-zinc-300">
                    {reason.text}
                  </span>
                </li>
              ))}
            </ul>
          </Link>
        </li>
      ))}
    </ul>
  );
}
