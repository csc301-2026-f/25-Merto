"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { backendFetch, errorMessage } from "@/lib/api";
import { CUSTOMER_FIELDS, REPS } from "@/lib/deals";

// TODO: replace with the real endpoint when the backend has one.
const CREATE_PATH = "/TEMP/PLEASEREPLACE";

export type CreateState =
  | { error?: string; success?: string; values?: Record<string, string> }
  | undefined;

export async function createCustomer(
  _prev: CreateState,
  formData: FormData
): Promise<CreateState> {
  await requireRole("manager"); // server actions can be called directly

  const values: Record<string, string> = {};
  for (const f of CUSTOMER_FIELDS) {
    values[f.name] = String(formData.get(f.name) ?? "").trim();
  }
  const repId = String(formData.get("repId") ?? "");
  values.repId = repId;

  const missing = CUSTOMER_FIELDS.filter((f) => !values[f.name]).map((f) => f.label);
  if (missing.length > 0) {
    return { error: `Please fill in: ${missing.join(", ")}.`, values };
  }
  if (repId && !REPS.some((r) => r.id === repId)) {
    return { error: "Unknown rep selected.", values };
  }

  let res: Response;
  try {
    res = await backendFetch(CREATE_PATH, {
      method: "POST",
      body: JSON.stringify({
        buyer: values.buyer,
        vehicleInterest: values.vehicleInterest,
        source: values.source,
        ...(repId ? { toUserId: repId } : {}),
      }),
    });
  } catch {
    return { error: "Could not reach the server.", values };
  }

  if (res.status === 403) return { error: "You don't have permission.", values };
  if (res.status === 400) {
    return { error: (await errorMessage(res)) ?? "The server rejected those details.", values };
  }
  if (!res.ok) return { error: "Could not create the customer.", values };

  revalidatePath("/manager", "layout"); // refresh Home and Customer details
  return { success: `Created ${values.buyer}.` };
}