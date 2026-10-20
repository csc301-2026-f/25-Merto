// GET /api/open-items (US4): unresolved work across buyers. Open items come first,
// longest-waiting first. The GM sees the whole store; a rep sees their own deals.
export type OpenItem = {
  id: string;
  type: string; // promise | missing_doc | unanswered_question | callback
  description: string;
  status: string; // open | resolved | cancelled
  owner: { id: string; name: string } | null;
  dueAt: string | null;
  createdAt: string;
  resolvedAt: string | null;
  overdue: boolean; // open and past its due time
  ageHours: number | null; // open items only
  deal: {
    id: string;
    buyer: string;
    vehicleInterest: string;
    stage: string;
    owner: { id: string; name: string } | null;
  };
};

export type OpenItemsOverview = {
  // Unresolved work in scope, whatever status the list shows.
  summary: {
    open: number;
    overdue: number;
    unowned: number;
    oldestCreatedAt: string | null; // null when nothing is open
    byType: { type: string; open: number; overdue: number; unowned: number }[];
  };
  items: OpenItem[];
};
