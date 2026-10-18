import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { CreateCustomerForm } from "@/app/manager/create-customer/create-customer-form";

// The manager's form without "Assign to": a rep owns the customers they create.
async function CreateCustomer() {
  await requireRole("rep");
  return <CreateCustomerForm />;
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <CreateCustomer />
    </Suspense>
  );
}
