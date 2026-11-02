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
    <section className="rounded-xl bg-slate-100 p-4 text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100">

      <h3 className="font-semibold text-lg">
        AI Review
      </h3>

      {!evaluation ? (
        <p className="mt-2 text-sm">
          AI review unavailable.
        </p>
      ) : (
        <div className="mt-3 space-y-3 text-sm">

          <div className="flex flex-wrap gap-x-6 gap-y-2">

            <p>
              <span className="font-semibold">
                Status:
              </span>
              {" "}
              {STATUS_LABELS[evaluation.status ?? ""] ??
                evaluation.status ??
                "Unknown"}
            </p>

            <p>
              <span className="font-semibold">
                Last evaluated:
              </span>
              {" "}
              {evaluation.evaluatedAt
                ? evaluation.evaluatedAt.slice(0, 10)
                : "Never"}
            </p>

          </div>


          {evaluation.flags &&
            evaluation.flags.length > 0 && (

              <ul className="space-y-3">

                {evaluation.flags.map((flag) => (
                  <li
                    key={flag.id}
                    className="rounded-lg bg-slate-200 p-4 dark:bg-zinc-800"
                  >

                    <p className="font-semibold">
                      {flag.flagType.replace(/_/g, " ")}

                      <span className="ml-2 opacity-70">
                        ({flag.severity})
                      </span>

                      <span className="ml-2 opacity-70">
                        [{flag.reviewStatus}]
                      </span>
                    </p>

                    <p className="mt-2">
                      {flag.explanation}
                    </p>

                    {flag.evidenceBody && (
                      <blockquote className="mt-2 border-l-2 border-zinc-400 pl-3 italic opacity-80">
                        {flag.evidenceBody}
                      </blockquote>
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