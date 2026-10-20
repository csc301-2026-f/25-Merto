export type Deal = {
  dealId: string;
  buyer: string;
  vehicleInterest: string;
  stage: string;
  source: string;
  createdAt: string;
  // From GET /api/deals (not in /api/deals/unassigned). Missing or null means unassigned.
  ownerId?: string | null;
  owner?: string | null;
};

// GET /api/staff/reps
export type Rep = { id: string; name: string; email: string; activeDeals: number };


// The backend accepts only these sources for new deals (POST /api/deals).
export const SOURCES = [
  "website", "web_chat", "email", "phone", "sms", "walk_in", "listing_portal", "referral", "other",
] as const;

// The backend needs an email or a phone, so neither is required on its own.
export const CUSTOMER_FIELDS = [
  { name: "buyer", label: "Customer name", required: true },
  { name: "vehicleInterest", label: "Car interest", required: true },
  { name: "source", label: "Source", required: true, options: SOURCES },
  { name: "email", label: "Email", required: false },
  { name: "phone", label: "Phone", required: false },
] as const;
// GET /api/deals/:dealId: the whole buyer record. Dates arrive as ISO strings.
export type ActorType = "buyer" | "ai" | "rep" | "gm" | "system";

export type TimelineEntry = {
  id: string;
  eventType: string;
  actorType: ActorType;
  actorName: string | null;
  channel: string;
  direction: string;
  body: string;
  createdAt: string;
};

// structured is false for entries recorded before from/to/reason were stored;
// those only have the text in body.
export type AssignmentRecord = {
  eventId: string;
  kind: "assignment" | "transfer";
  at: string;
  by: { id: string; name: string } | null;
  from: { id: string; name: string } | null;
  to: { id: string; name: string } | null;
  reason: string | null;
  openItemsMoved: number | null;
  body: string;
  structured: boolean;
};

export type DealRecord = {
  dealId: string;
  vehicleInterest: string;
  stage: string;
  source: string;
  buyer: { id: string; name: string; email: string | null; phone: string | null; preferredChannel: string; optedOut: boolean };
  owner: { id: string; name: string } | null;
  timeline: TimelineEntry[];
  openItems: { id: string; type: string; description: string; status: string; owner: string | null; dueAt: string | null }[];
  appointments: { id: string; scheduledFor: string; status: string; confirmedBy: string | null }[];
  assignments: AssignmentRecord[];
};
