import type { Evaluation } from "@/lib/evaluation";

const STATUS_LABELS: Record<string, string> = {
  not_evaluated: "Not evaluated yet",
  passed: "Passed",
  flagged: "Flagged for review",
  confirmed_issue: "Confirmed issue",
  resolved: "Resolved",
  false_positive: "False positive",
};

export function EvaluationSummary({
  evaluation,
}: {
  evaluation: Evaluation | null | undefined;
}) {
  return (
    <section className="rounded border-2 p-3">
      <h3 className="font-semibold">AI review</h3>

      {!evaluation ? (
        <p className="mt-1 text-sm">AI review unavailable.</p>
      ) : (
        <div className="mt-1 space-y-2 text-sm">
          <p>
            <span className="font-semibold">Status: </span>
            {STATUS_LABELS[evaluation.status ?? ""] ?? evaluation.status ?? "Unknown"}
          </p>
          <p>
            <span className="font-semibold">Last evaluated: </span>
            {evaluation.evaluatedAt ? evaluation.evaluatedAt.slice(0, 10) : "Never"}
          </p>

            {evaluation.flags && evaluation.flags.length > 0 && (
            <ul className="divide-y-2 rounded border-2">
                {evaluation.flags.map((flag) => (
                <li key={flag.id} className="space-y-1 p-2">
                    <p className="font-semibold">
                        {flag.flagType.replace(/_/g, " ")}
                        <span className="ml-2 opacity-70">({flag.severity})</span>
                        <span className="ml-2 opacity-70">[{flag.reviewStatus}]</span>
                    </p>
                    <p>{flag.explanation}</p>
                    {flag.evidenceBody && (
                    <blockquote className="border-l-4 pl-2 italic">{flag.evidenceBody}</blockquote>
                    )}
                </li>
                ))}
            </ul>
            )}
        </div>
      )}
    </section>
  );
}