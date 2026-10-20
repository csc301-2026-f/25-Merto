import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { loadJson } from "@/lib/api";
import type { DealRecord as DealRecordData } from "@/lib/deals";
import { DealRecord } from "@/components/DealRecord";
import type { FollowUpAssessment } from "@/lib/follow-ups";
import { FollowUpForm } from "./follow-up-form";
import { ReplyDrafts } from "./reply-drafts";
import { FollowUpPanel } from "./follow-up-panel";
import type { ReplyDraft } from "@/lib/reply-drafts";

type Params = Promise<{ dealId: string }>;

async function RepRecord({ params }: { params: Params }) {
  await requireRole("rep");
  const { dealId } = await params;
  // The backend refuses (403) a customer this rep does not own.
  const [deal, assessment, drafts] = await Promise.all([
    loadJson<DealRecordData>(`/api/deals/${encodeURIComponent(dealId)}`),
    loadJson<FollowUpAssessment>(`/api/deals/${encodeURIComponent(dealId)}/follow-up`),
    loadJson<ReplyDraft[]>(`/api/deals/${encodeURIComponent(dealId)}/reply-drafts`),
  ]);
  if (!deal) return <p>Couldn&apos;t load this customer. They may belong to another rep.</p>;
  return <DealRecord deal={deal} followUp={<FollowUpPanel
    drafts={<ReplyDrafts dealId={dealId} initialRequestId={randomUUID()} drafts={drafts} eligible={assessment?.status === "due"}
      email={deal.buyer.email} phone={deal.buyer.phone} preferredChannel={deal.buyer.preferredChannel} />}
    manual={<FollowUpForm dealId={dealId} initialRequestId={randomUUID()} assessment={assessment}
      email={deal.buyer.email} phone={deal.buyer.phone} preferredChannel={deal.buyer.preferredChannel} />}
  />} />;
}

export default function Page({ params }: { params: Params }) {
  return (
    <div className="space-y-4">
      <Link href="/rep" className="underline">
        ← Home
      </Link>
      <Suspense fallback={<p>Loading…</p>}>
        <RepRecord params={params} />
      </Suspense>
    </div>
  );
}
