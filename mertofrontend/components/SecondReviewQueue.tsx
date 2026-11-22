"use client";

import { useState, useTransition } from "react";
import { secondReview } from "@/app/manager/actions";
import { REVIEW_REASONS, type SecondReviewItem } from "@/lib/evaluation";

// What the first GM decided, in words.
function firstDecision(item: SecondReviewItem) {
  if (item.source === "manual") return "added this flag (the model missed it)";
  if (item.reviewStatus === "false_positive") {
    return `dismissed it: ${REVIEW_REASONS[item.reviewReason ?? "misread_wording"].toLowerCase()}`;
  }
  return "confirmed it is a real problem";
}

function Item({ item, evaluatorId }: { item: SecondReviewItem; evaluatorId?: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const decide = (decision: "agree" | "disagree") => start(async () => {
    const result = await secondReview(item.id, decision, evaluatorId);
    if (!result.ok) setError(result.error);
  });
  const sure = item.modelScore >= 0.5
    ? `The model is ${Math.round(item.modelScore * 100)}% sure this is a problem.`
    : `The model is ${Math.round((1 - item.modelScore) * 100)}% sure this is fine.`;
  return (
    <li className="space-y-1 rounded border p-3 text-sm">
      <p>
        <span className="font-semibold capitalize">{item.flagType.replace(/_/g, " ")}</span>
        <span className="ml-2 opacity-70">{item.buyer}</span>
      </p>
      {item.flagType.startsWith("missed_") && item.buyerMessage && <p>Buyer: <em>“{item.buyerMessage}”</em></p>}
      <p>AI reply: <em>“{item.evidenceBody}”</em></p>
      <p>{item.reviewer} {firstDecision(item)}. {sure}</p>
      {item.canReview ? (
        <div className="flex gap-2">
          <button className="rounded border-2 px-3 py-1 font-semibold disabled:opacity-50" disabled={pending}
            onClick={() => decide("agree")}>Agree with {item.reviewer.split(" ")[0]}</button>
          <button className="rounded border-2 px-3 py-1 font-semibold disabled:opacity-50" disabled={pending}
            onClick={() => decide("disagree")}>Disagree</button>
        </div>
      ) : (
        <p className="opacity-70">You made this review, so another GM must give the second opinion.</p>
      )}
      {error && <p role="alert" className="text-red-600">{error}</p>}
    </li>
  );
}

export function SecondReviewQueue({ items, evaluatorId }: { items: SecondReviewItem[]; evaluatorId?: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm opacity-70">
        These reviews strongly disagree with the model (it was at least 90% sure of the opposite). They train the model
        only if a second GM agrees; if you disagree, the review is not used for training, and a dismissed flag becomes
        an issue to follow up.
      </p>
      <ul className="space-y-2">
        {items.map((item) => <Item key={item.id} item={item} evaluatorId={evaluatorId} />)}
      </ul>
    </div>
  );
}
