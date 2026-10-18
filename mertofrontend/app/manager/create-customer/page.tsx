import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { CreateCustomerForm } from "./create-customer-form";

async function CreateCustomer() {
  await requireRole("manager");
  return <CreateCustomerForm />;
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <CreateCustomer />
    </Suspense>
  );
}