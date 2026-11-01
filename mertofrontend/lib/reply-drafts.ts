export type ReplyDraft = {
  id: string;
  dealId: string;
  channel: "email" | "sms";
  source: "simulated_template" | "groq_ai";
  model: string | null;
  promptVersion: string | null;
  originalText: string;
  context: {
    activityVersion?: string;
    stage?: string;
    appointments?: { scheduledFor: string; status: string }[];
    openItems?: { type: string; description: string; dueAt: string | null }[];
    buyer: string;
    vehicleInterest: string;
    reasons: string[];
    messages: { eventId: string; actorType: string; body: string; createdAt: string }[];
  };
  createdAt: string;
  decision: "approve" | "edit" | "reject" | null;
  finalText: string | null;
  reviewedAt: string | null;
  sentEventId: string | null;
};
