export type Deal = {
  dealId: string;
  buyer: string;
  vehicleInterest: string;
  stage: string;
  source: string;
  createdAt: string;
  // Not in /api/deals/unassigned. Guessed names for the future all-deals endpoint.
  // Missing or null means unassigned.
  ownerId?: string | null;
  ownerName?: string | null;
};

// TODO: replace with a real "list reps" endpoint when the backend has one.
export const REPS = [
  { id: "10000000-0000-0000-0000-000000000002", name: "Dana Kowalski" },
  { id: "10000000-0000-0000-0000-000000000003", name: "Arjun Mehta" },
];


export const CUSTOMER_FIELDS = [
  { name: "buyer", label: "Customer name" },
  { name: "vehicleInterest", label: "Car interest" },
  { name: "source", label: "Source" },
] as const;