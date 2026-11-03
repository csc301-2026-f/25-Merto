import { Suspense } from "react";
import Link from "next/link";

import { requireRole } from "@/lib/auth/session";
import { loadJson } from "@/lib/api";

import type { DealRecord as DealRecordData } from "@/lib/deals";
import { demoEvaluatorId, evaluationRequest, type Evaluation, type EvaluationEngine, type EvaluationSearchParams } from "@/lib/evaluation";

import { DealRecord } from "@/components/DealRecord";
import { EvaluationSummary } from "@/components/EvaluationSummary";

type Params = Promise<{
  dealId: string;
}>;


async function FullRecord({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: EvaluationSearchParams;
}) {
  await requireRole("manager");

  const { dealId } = await params;

  const id = encodeURIComponent(dealId);
  const requested = demoEvaluatorId((await searchParams).evaluator);
  const engine = await loadJson<EvaluationEngine>("/api/ai-evaluation/engine", evaluationRequest(requested));
  if (requested && engine?.id !== requested) return <p>Could not load the selected evaluator.</p>;
  const context = evaluationRequest(engine?.id);

  const [deal, evaluation] = await Promise.all([
    loadJson<DealRecordData>(`/api/deals/${id}`, context),
    loadJson<Evaluation>(`/api/deals/${id}/evaluation`, context),
  ]);

  if (!deal) {
    return <p>Couldn&apos;t load this customer.</p>;
  }

  return (
    <div className="space-y-6">

      {engine?.id && <Link href={`/manager/ai-review?evaluator=${engine.id}`} className="text-sm underline">← Back to this evaluator&apos;s AI Review</Link>}

      <DealRecord
        deal={deal}
        flags={evaluation?.flags}
      />

      <EvaluationSummary
        evaluation={evaluation}
        canReview
        evaluatorId={engine?.id}
        evaluatorName={engine?.name}
      />

    </div>
  );
}


export default function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: EvaluationSearchParams;
}) {
  return (
    <div className="space-y-6">

      {/* Return button at top right */}
      <div className="flex ">

        <Link
          href="/manager/deal-details"
          className="inline-flex items-center rounded-lg px-4 py-2 font-semibold text-zinc-950 bg-[#d5bd91] hover:bg-[#e3cda6]"
        >
          ← Back to Deal Details
        </Link>

      </div>

      <Suspense fallback={<p>Loading…</p>}>
        <FullRecord params={params} searchParams={searchParams} />
      </Suspense>

    </div>
  );
}
