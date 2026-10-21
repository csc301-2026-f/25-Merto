export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "rescheduled"
  | "cancelled"
  | "completed"
  | "no_show";

export type Appointment = {
  id: string;
  dealId: string;
  scheduledFor: string;
  status: AppointmentStatus;
  outcomeNote: string | null;
  buyer: string;
  vehicleInterest: string;
  ownerId: string | null;
  owner: string | null;
};

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "requested", "confirmed", "rescheduled", "cancelled", "completed", "no_show",
];
