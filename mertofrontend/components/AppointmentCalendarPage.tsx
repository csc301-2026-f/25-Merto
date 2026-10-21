import { requireRole } from "@/lib/auth/session";
import { loadJson } from "@/lib/api";
import type { Appointment } from "@/lib/appointments";
import type { Deal } from "@/lib/deals";
import { AppointmentCalendar } from "@/components/AppointmentCalendar";

export async function AppointmentCalendarPage({ role }: { role: "manager" | "rep" }) {
  await requireRole(role);
  const [appointments, deals] = await Promise.all([
    loadJson<Appointment[]>("/api/appointments"),
    loadJson<Deal[]>("/api/deals"),
  ]);

  if (appointments === null || deals === null) {
    return <p role="alert">Couldn&apos;t load calendar data. Please try again.</p>;
  }

  return <AppointmentCalendar role={role} appointments={appointments} deals={deals} />;
}
