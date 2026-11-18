import { Suspense } from "react";
import { Card } from "@/components/Card";
import { DealOutcomeChart } from "@/components/DealOutcomeChart";
import { DealOutcomeSummary } from "@/components/DealOutcomeSummary";
import { requireRole } from "@/lib/auth/session";
import { loadDealStats, loadRepStatistics } from "@/lib/deal-stats";

async function ManagerStatistics() {
  await requireRole("manager");
  const [stats, reps] = await Promise.all([loadDealStats(), loadRepStatistics()]);
  return (
    <div className="space-y-8">
      <Card title="Store sales outcomes" count={stats?.closed}>
        <div className="max-w-xl space-y-4 rounded-lg bg-current/5 p-4">
          <DealOutcomeSummary stats={stats} />
          {stats && <DealOutcomeChart stats={stats} />}
        </div>
      </Card>
      <Card title="Sales representatives" count={reps?.length}>
        {reps === null ? (
          <p>Couldn&apos;t load sales representative statistics.</p>
        ) : reps.length === 0 ? (
          <p>No sales representatives yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">All-time sales outcomes by sales representative</caption>
              <thead>
                <tr className="border-b border-current/20">
                  {["Representative", "Sold", "Lost", "Closed", "Sale rate"].map((heading) => (
                    <th key={heading} scope="col" className="p-3">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reps.map((rep) => (
                  <tr key={rep.repId} className="border-b border-current/10">
                    <th scope="row" className="p-3 font-medium">{rep.name}</th>
                    <td className="p-3">{rep.sold}</td>
                    <td className="p-3">{rep.lost}</td>
                    <td className="p-3">{rep.closed}</td>
                    <td className="p-3">
                      {rep.saleRate === null ? "No closed deals" : new Intl.NumberFormat("en-CA", {
                        style: "percent", maximumFractionDigits: 1,
                      }).format(rep.saleRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-sm opacity-70">
        Delivered deals count as sold. Sale rate is sold divided by all closed deals.
        Rep totals use the current deal owner. Store totals also include unassigned deals.
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Statistics</h1>
        <p className="text-sm opacity-70">All-time sales outcomes for the store and each sales representative.</p>
      </header>
      <Suspense fallback={<p>Loading statistics…</p>}>
        <ManagerStatistics />
      </Suspense>
    </div>
  );
}
