"use server";

import { revalidatePath } from "next/cache";
import { backendFetch, errorMessage } from "@/lib/api";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export type AppointmentActionState = {
  error?: string;
  success?: string;
};

export async function saveAppointment(
  _previousState: AppointmentActionState | undefined,
  formData: FormData,
): Promise<AppointmentActionState> {
  const session = await getSession();
  if (!session) redirect("/login");
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const dealId = String(formData.get("dealId") ?? "");
  const scheduledFor = String(formData.get("scheduledFor") ?? "");
  const status = String(formData.get("status") ?? "requested");
  const outcomeNote = String(formData.get("outcomeNote") ?? "");
  const isEdit = appointmentId.length > 0;

  let response: Response;
  try {
    response = await backendFetch(
      isEdit ? `/api/appointments/${appointmentId}` : "/api/appointments",
      {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify({ dealId, scheduledFor, status, outcomeNote }),
      },
    );
  } catch {
    return { error: "Could not reach the server." };
  }

  if (!response.ok) {
    return {
      error: (await errorMessage(response)) ?? "Could not save the appointment.",
    };
  }

  revalidatePath(`/${session.role}`, "layout");
  return { success: isEdit ? "Appointment updated." : "Appointment created." };
}
