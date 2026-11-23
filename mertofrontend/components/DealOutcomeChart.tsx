import type { DealStats } from "@/lib/deal-stats";

export function DealOutcomeChart({ stats }: { stats: DealStats }) {
  if (stats.closed === 0) return null;
  return (
    <div
      role="img"
      aria-label={`${stats.sold} sold and ${stats.lost} lost deals`}
      className="flex h-3 overflow-hidden rounded-full"
    >
      <div className="bg-emerald-600 dark:bg-emerald-400" style={{ flexGrow: stats.sold }} />
      <div className="bg-slate-400 dark:bg-slate-500" style={{ flexGrow: stats.lost }} />
    </div>
  );
}
