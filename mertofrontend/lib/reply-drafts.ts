export type ReplyDraft = {
  id: string;
  dealId: string;
  channel: "email" | "sms";
  source: "simulated_template";
  originalText: string;
  context: {
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
