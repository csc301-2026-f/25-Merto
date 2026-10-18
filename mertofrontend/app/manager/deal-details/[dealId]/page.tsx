import { Suspense } from "react";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { loadJson } from "@/lib/api";
import type { DealRecord as DealRecordData } from "@/lib/deals";
import type { Evaluation } from "@/lib/evaluation";
import { DealRecord } from "@/components/DealRecord";
import { EvaluationSummary } from "@/components/EvaluationSummary";

type Params = Promise<{ dealId: string }>;

async function FullRecord({ params }: { params: Params }) {
  await requireRole("manager");
  const { dealId } = await params;
  const id = encodeURIComponent(dealId);
  const [deal, evaluation] = await Promise.all([
    loadJson<DealRecordData>(`/api/deals/${id}`),
    loadJson<Evaluation>(`/api/deals/${id}/evaluation`),
  ]);
  if (!deal) return <p>Couldn&apos;t load this customer.</p>;

  return (
    <div className="space-y-6">
      <DealRecord deal={deal} />
      <EvaluationSummary evaluation={evaluation} />
    </div>
  );
}

export default function Page({ params }: { params: Params }) {
  return (
    <div className="space-y-4">
      <Link href="/manager/deal-details" className="underline">
        ← Deal details
      </Link>
      <Suspense fallback={<p>Loading…</p>}>
        <FullRecord params={params} />
      </Suspense>
    </div>
  );
}
