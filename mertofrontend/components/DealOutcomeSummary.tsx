import type { DealStats } from "@/lib/deal-stats";

export function DealOutcomeSummary({ stats }: { stats: DealStats | null }) {
  if (!stats) return <p>Couldn&apos;t load sales outcomes.</p>;
  if (stats.saleRate === null) return <p>No closed deals yet.</p>;

  return (
    <dl className="grid grid-cols-3 gap-3">
      <div>
        <dt className="font-medium text-emerald-700 dark:text-emerald-400">Sold</dt>
        <dd className="text-2xl font-bold">{stats.sold}</dd>
      </div>
      <div>
        <dt className="font-medium text-slate-600 dark:text-slate-400">Lost</dt>
        <dd className="text-2xl font-bold">{stats.lost}</dd>
      </div>
      <div>
        <dt>Sale rate</dt>
        <dd className="text-2xl font-bold">
          {new Intl.NumberFormat("en-CA", { style: "percent", maximumFractionDigits: 1 }).format(stats.saleRate)}
        </dd>
      </div>
    </dl>
  );
}
