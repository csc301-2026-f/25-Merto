import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { loadJson } from "@/lib/api";
import type { Rep } from "@/lib/deals";
import { CreateCustomerForm } from "./create-customer-form";

async function CreateCustomer() {
  await requireRole("manager");
  const reps = await loadJson<Rep[]>("/api/staff/reps");
  return <CreateCustomerForm reps={reps ?? []} />;
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <CreateCustomer />
    </Suspense>
  );
}