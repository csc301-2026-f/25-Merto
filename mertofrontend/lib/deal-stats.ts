import { loadJson } from "@/lib/api";

export const DEAL_OUTCOME_FILTERS = ["all", "sold", "lost"] as const;
export type DealOutcomeFilter = (typeof DEAL_OUTCOME_FILTERS)[number];

export type DealStats = {
  sold: number;
  lost: number;
  closed: number;
  saleRate: number | null;
};

type DealOutcomes = {
  deals: {
    dealId: string;
    buyer: string;
    vehicleInterest: string;
    stage: "delivered" | "lost";
    lostReason: string | null;
  }[];
  hasNextPage: boolean;
};

export function loadDealStats() {
  return loadJson<DealStats>("/api/deals/stats");
}

export function loadDealOutcomes(outcome: DealOutcomeFilter, page: number) {
  const query = new URLSearchParams({ outcome, page: String(page) });
  return loadJson<DealOutcomes>(`/api/deals/stats/outcomes?${query}`);
}
