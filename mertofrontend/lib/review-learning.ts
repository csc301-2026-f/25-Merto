// Local demo only: simulated GM reviews and a classifier refit from them.
export type Counts = { correct: number; total: number; falsePositives?: number; missed?: number };

// The model scores wording signals; the CRM shows the flag type each one raises.
export const FLAG_FOR_SIGNAL: Record<string, string> = {
  claims_booking: "appointment_certainty",
  guarantees_availability: "unsupported_availability",
  quotes_price: "unsupported_price",
  off_tone: "tone",
  asks_for_person: "missed_escalation",
  asks_about_price: "missed_price_handoff",
};
export const flagLabel = (signal: string) => (FLAG_FOR_SIGNAL[signal] ?? signal).replace(/_/g, " ");

export type LabelReport = {
  used: number;
  gmHoldout: number;
  duplicatesFolded: number;
  skipped: { pending: number; noSignal: number; fixtureDeal: number; cooling: number; contextReason: number;
    secondReviewDisagreed: number };
  triage: Partial<Record<string, number>>;
  readiness: { ready: boolean; newTrainLabels: number; minNewLabels: number; minNewPerSignal: number;
    bestSignal: string; bestSignalNewTrain: number };
};

export type ReviewLearningStatus = {
  simulated: boolean; secondOpinionsWaiting: number; modelVersion: string | null; labels: LabelReport;
};

export type SimulationResult = {
  deals: number; reviews: number; confirmed: number; falsePositive: number; manual: number;
  notReviewed: number; byKind: Record<string, number>;
  sentForSecondOpinion: { total: number; dismissedWhileModelSureOfProblem: number; addedWhileModelSureItWasFine: number };
};

export type RetrainResult = {
  labels: LabelReport;
  families: Record<string, string>;
  model: {
    adopted: boolean; // passed the gold-set gate and replaced the model in use
    worseSignals: string[];
    previousVersion: string;
    version: string;
    labelsBySignal: Record<string, number>;
    heldOut: { before: Record<string, Counts>; after: Record<string, Counts> };
    gmHoldout: { before: Record<string, Counts>; after: Record<string, Counts> };
    testSplit: { before: Record<string, Counts & { f1: number }>; after: Record<string, Counts & { f1: number }> };
    changed: { text: string; family: string | null; signal: string; label: boolean; before: number; after: number; nowCorrect: boolean }[];
  };
};

type Pair = { saved: number; rerun: number };
export type RecheckResult = {
  modelVersion: string | null;
  evaluated: number;
  flagged: Pair;
  flagRate: { saved: number | null; rerun: number | null };
  reviewedPrecision: { saved: number | null; rerun: number | null };
  confirmed: Pair;
  dismissed: Pair;
  missed: Pair;
  heldOut: { confirmed: Pair; dismissed: Pair; missed: Pair };
};
