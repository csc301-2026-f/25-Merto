import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { loadJson } from "@/lib/api";
import type { Evaluation } from "@/lib/evaluation";
import { EvaluationSummary } from "@/components/EvaluationSummary";

type Params = Promise<{ dealId: string }>;

async function DealDetail({ params }: { params: Params }) {
  await requireRole("rep");
  const { dealId } = await params;

  const evaluation = await loadJson<Evaluation>(`/api/deals/${dealId}/evaluation`);
  if (!evaluation) return <p>Could not load this deal.</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{evaluation.buyer ?? "Deal"}</h1>
      <EvaluationSummary evaluation={evaluation} />
    </div>
  );
}

export default function Page({ params }: { params: Params }) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <DealDetail params={params} />
    </Suspense>
  );
}