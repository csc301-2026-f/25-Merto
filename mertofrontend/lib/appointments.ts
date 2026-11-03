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
  createdAt: string | null;
  scheduledFor: string;
  status: AppointmentStatus;
  outcomeNote: string | null;
  requestedByType: "ai" | "system" | "rep" | "gm";
  requestedById: string | null;
  requestedBy: string | null;
  confirmedById: string | null;
  confirmedBy: string | null;
  buyer: string;
  vehicleInterest: string;
  ownerId: string | null;
  owner: string | null;
};

export type AppointmentOverview = {
  appointments: Appointment[];
  metrics: {
    requested: number;
    confirmed: number;
    showRate: number | null;
    completed: number;
    noShow: number;
    requestedUnconfirmed: number;
    visitsWithoutOutcome: number;
  };
  requestedToConfirm: Appointment[];
  visitsToRecord: Appointment[];
};

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "requested", "confirmed", "rescheduled", "cancelled", "completed", "no_show",
];
