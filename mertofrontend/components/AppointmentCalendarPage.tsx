import { requireRole } from "@/lib/auth/session";
import { loadJson } from "@/lib/api";
import type { AppointmentOverview } from "@/lib/appointments";
import type { Deal, Rep } from "@/lib/deals";
import { AppointmentCalendar } from "@/components/AppointmentCalendar";

export async function AppointmentCalendarPage({ role }: { role: "manager" | "rep" }) {
  await requireRole(role);
  const [overview, deals, reps] = await Promise.all([
    loadJson<AppointmentOverview>("/api/appointments/overview"),
    loadJson<Deal[]>("/api/deals"),
    role === "manager" ? loadJson<Rep[]>("/api/staff/reps") : Promise.resolve([]),
  ]);

  if (overview === null || deals === null || reps === null) {
    return <p role="alert">Couldn&apos;t load calendar data. Please try again.</p>;
  }

  return <AppointmentCalendar role={role} overview={overview} deals={deals} reps={reps} />;
}
