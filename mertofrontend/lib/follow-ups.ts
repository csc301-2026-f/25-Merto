// GET /api/follow-ups/due (US6). kind "owed": the buyer is waiting on us (a
// question, a promise); "nudge": the buyer went quiet. text says why.
export type FollowUpReason = {
  code: string;
  kind: "owed" | "nudge";
  text: string;
  since: string;
  dueAt: string;
  evidenceEventId?: string;
  openItemId?: string;
  appointmentId?: string;
};

export type DueFollowUp = {
  dealId: string;
  buyer: { id: string; name: string };
  vehicleInterest: string;
  stage: string;
  owner: { id: string; name: string } | null;
  dueAt: string;
  reasons: FollowUpReason[];
};
