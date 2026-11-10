import { REVIEW_REASONS, type Evaluation } from "@/lib/evaluation";
import { FlagReview } from "./FlagReview";
import { ManualFlag } from "./ManualFlag";

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
  canReview = false,
  evaluatorId,
  evaluatorName,
}: {
  evaluation: Evaluation | null | undefined;
  canReview?: boolean;
  evaluatorId?: string;
  evaluatorName?: string;
}) {
  return (
    <section className="rounded-xl bg-slate-100 p-4 text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100">

      <h3 className="font-semibold text-lg">
        AI Review
      </h3>
      {evaluatorName && <p className="mt-1 text-sm">Evaluator: {evaluatorName}</p>}

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

                {evaluation.flags.map((flag, index, flags) => (
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

                      {flag.source === "manual" && (
                        <span className="ml-2 rounded bg-amber-200 px-2 py-0.5 text-xs text-amber-950">
                          Added by GM
                        </span>
                      )}
                    </p>

                    <p className="mt-2">
                      {flag.explanation}
                    </p>

                    {flag.evidenceBody && (
                      <blockquote className="mt-2 border-l-2 border-zinc-400 pl-3 italic opacity-80">
                        {flag.evidenceBody}
                      </blockquote>
                    )}

                    {flag.reviewReason && <p className="mt-2 text-sm">False positive because: {REVIEW_REASONS[flag.reviewReason]}</p>}
                    {flag.reviewNote && <p className="mt-2 text-sm">Review note: {flag.reviewNote}</p>}
                    {canReview && <FlagReview flag={flag} evaluatorId={evaluatorId} />}

                    {/* Under the last flag on a reply: add a problem of another type the evaluator missed.
                        Opt-out flags alone can sit on a staff message, which cannot be flagged by hand. */}
                    {canReview && evaluation.dealId && flag.evidenceEventId
                      && flags.findLastIndex((other) => other.evidenceEventId === flag.evidenceEventId) === index
                      && flags.some((other) => other.evidenceEventId === flag.evidenceEventId && other.flagType !== "ignored_opt_out") && (
                      <ManualFlag dealId={evaluation.dealId} evaluatorId={evaluatorId} buttonLabel="Add another flag"
                        reply={{ id: flag.evidenceEventId, channel: flag.evidenceChannel ?? "", body: flag.evidenceBody ?? "", createdAt: flag.evidenceAt ?? "" }}
                        existingTypes={flags.filter((other) => other.evidenceEventId === flag.evidenceEventId).map((other) => other.flagType)} />
                    )}

                  </li>
                ))}

              </ul>

            )}

          {canReview && evaluation.dealId && evaluation.evaluatedAt && evaluation.unflaggedReplies &&
            evaluation.unflaggedReplies.length > 0 && (

              <div className="space-y-3 border-t border-zinc-400/40 pt-3">
                <h4 className="font-semibold">AI replies with no flag</h4>
                <p className="opacity-80">
                  If the evaluator missed a problem in one of these replies, flag it. It becomes a confirmed issue to resolve.
                </p>

                <ul className="space-y-3">
                  {evaluation.unflaggedReplies.map((reply) => (
                    <li key={reply.id} className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
                      <p className="text-xs opacity-70">
                        {reply.channel} · {reply.createdAt.slice(0, 16).replace("T", " ")}
                      </p>
                      <blockquote className="mt-1 whitespace-pre-line">{reply.body}</blockquote>
                      <ManualFlag dealId={evaluation.dealId!} reply={reply} evaluatorId={evaluatorId} />
                    </li>
                  ))}
                </ul>
              </div>

            )}

        </div>
      )}

    </section>
  );
}
