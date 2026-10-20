import { Suspense } from "react";
import { AppointmentCalendarPage } from "@/components/AppointmentCalendarPage";

export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <AppointmentCalendarPage role="rep" />
    </Suspense>
  );
}
