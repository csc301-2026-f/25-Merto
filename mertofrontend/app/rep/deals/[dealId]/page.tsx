import { Suspense } from "react";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { loadJson } from "@/lib/api";
import type { DealRecord as DealRecordData } from "@/lib/deals";
import { DealRecord } from "@/components/DealRecord";

type Params = Promise<{ dealId: string }>;

async function RepRecord({ params }: { params: Params }) {
  await requireRole("rep");
  const { dealId } = await params;
  // The backend refuses (403) a customer this rep does not own.
  const deal = await loadJson<DealRecordData>(`/api/deals/${encodeURIComponent(dealId)}`);
  if (!deal) return <p>Couldn&apos;t load this customer. They may belong to another rep.</p>;
  return <DealRecord deal={deal} />;
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
