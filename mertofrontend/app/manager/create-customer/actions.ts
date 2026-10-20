"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { backendFetch, errorMessage } from "@/lib/api";
import { CUSTOMER_FIELDS } from "@/lib/deals";

// POST /api/deals. A rep owns the customer they create; a manager's starts
// unassigned, so a chosen rep is assigned right after with POST /assign.
const CREATE_PATH = "/api/deals";
const ASSIGN_REASON = "Assigned when the customer was created.";

export type CreateState =
  | { error?: string; success?: string; values?: Record<string, string> }
  | undefined;

export async function createCustomer(
  _prev: CreateState,
  formData: FormData
): Promise<CreateState> {
  // Server actions can be called directly; the backend checks the role again.
  const session = await getSession();
  if (!session) redirect("/login");

  const values: Record<string, string> = {};
  for (const f of CUSTOMER_FIELDS) {
    values[f.name] = String(formData.get(f.name) ?? "").trim();
  }
  const repId = session.role === "manager" ? String(formData.get("repId") ?? "") : "";
  values.repId = repId;

  const missing = CUSTOMER_FIELDS.filter((f) => f.required && !values[f.name]).map((f) => f.label);
  if (missing.length > 0) {
    return { error: `Please fill in: ${missing.join(", ")}.`, values };
  }
  if (!values.email && !values.phone) {
    return { error: "Please fill in an email or a phone.", values };
  }

  let res: Response;
  try {
    res = await backendFetch(CREATE_PATH, {
      method: "POST",
      body: JSON.stringify({
        name: values.buyer,
        vehicleInterest: values.vehicleInterest,
        source: values.source,
        email: values.email || undefined,
        phone: values.phone || undefined,
      }),
    });
  } catch {
    return { error: "Could not reach the server.", values };
  }

  if (res.status === 403) return { error: "You don't have permission.", values };
  if (res.status === 400 || res.status === 409) {
    return { error: (await errorMessage(res)) ?? "The server rejected those details.", values };
  }
  if (!res.ok) return { error: "Could not create the customer.", values };

  const created: { dealId: string; buyer: { existing: boolean; optedOut: boolean } } = await res.json();
  const notes = [
    created.buyer.existing && "This customer was already on file; the new deal joins their record.",
    created.buyer.optedOut && "They opted out of contact: do not message them.",
  ].filter(Boolean).join(" ");

  if (repId) {
    const assign = await backendFetch(`/api/deals/${created.dealId}/assign`, {
      method: "POST",
      body: JSON.stringify({ toUserId: repId, reason: ASSIGN_REASON, expectedOwnerId: null }),
    }).catch(() => null);
    if (!assign?.ok) {
      revalidatePath("/", "layout");
      const why = assign ? await errorMessage(assign) : "Could not reach the server.";
      return { error: `Created ${values.buyer}, but could not assign the rep: ${why ?? "unknown error"}` };
    }
  }

  revalidatePath("/", "layout"); // refresh both dashboards and Customer details
  return { success: `Created ${values.buyer}.${notes ? ` ${notes}` : ""}` };
}
