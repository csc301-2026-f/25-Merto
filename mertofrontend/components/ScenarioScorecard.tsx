import { formatDateTime, label } from "@/lib/format";
import type { AiMode, Scorecard, ToolCall } from "@/lib/scenarios";

export const MODE_LABELS: Record<AiMode, string> = {
  auto: "Auto",
  draft_only: "Draft only",
  off: "Off",
};

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-green-100 text-green-800",
  drafted: "bg-amber-100 text-amber-800",
  blocked: "bg-red-100 text-red-800",
  created: "bg-blue-100 text-blue-800",
  recorded: "bg-gray-200 text-gray-800",
};

const SEVERITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-orange-100 text-orange-800",
  low: "bg-yellow-100 text-yellow-800",
};

export function VerdictBadge({ verdict }: { verdict: "pass" | "fail" }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${
        verdict === "pass" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
    >
      {verdict === "pass" ? "Passed" : "Failed"}
    </span>
  );
}

function describeCall(call: ToolCall): string {
  switch (call.tool) {
    case "send_reply":
      return `Reply by ${call.channel}: “${call.body}”`;
    case "create_open_item":
      return `Create a ${label(String(call.type))} to-do: ${call.description}`;
    case "request_appointment":
      return `Request a visit for ${formatDateTime(String(call.scheduledFor))}`;
    case "do_nothing":
      return `Do nothing: ${call.reason}`;
    default:
      return call.tool;
  }
}

// One run's result (US13): the verdict, each check with its evidence, the flags the
// evaluation rules raised on the agent's own messages, and the run log.
export function ScenarioScorecard({ card }: { card: Scorecard }) {
  const { summary } = card;
  return (
    <div className="space-y-4 rounded border-2 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <VerdictBadge verdict={summary.verdict} />
        <span className="font-semibold">Agent: {card.agent.name}</span>
        <span className="opacity-70">
          {summary.checksPassed} of {summary.checksTotal} checks passed · {summary.flagsRaised}{" "}
          {summary.flagsRaised === 1 ? "flag" : "flags"} · {summary.actionsTaken}{" "}
          {summary.actionsTaken === 1 ? "action" : "actions"} taken
        </span>
      </div>

      <section>
        <h4 className="mb-1 font-semibold">Checks</h4>
        <ul className="divide-y-2">
          {card.checks.map((check) => (
            <li key={check.id} className="flex gap-2 py-1.5">
              <span
                className={`mt-0.5 h-fit shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${
                  check.passed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}
              >
                {check.passed ? "Pass" : "Fail"}
              </span>
              <span>
                {check.description}
                <span className="block opacity-70">{check.evidence}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {card.flags.length > 0 && (
        <section>
          <h4 className="mb-1 font-semibold">Flags raised on the agent&apos;s messages</h4>
          <ul className="divide-y-2">
            {card.flags.map((flag, index) => (
              <li key={`${flag.flagType}:${index}`} className="py-1.5">
                <span className="font-semibold">{label(flag.flagType)}</span>
                <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-semibold ${SEVERITY_STYLES[flag.severity] ?? ""}`}>
                  {flag.severity}
                </span>
                <span className="ml-2 opacity-70">({flag.delivery === "drafted" ? "draft" : "sent"})</span>
                <span className="block">{flag.explanation}</span>
                <blockquote className="border-l-4 pl-2 italic opacity-80">{flag.evidenceBody}</blockquote>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h4 className="mb-1 font-semibold">Run log</h4>
        <ol className="divide-y-2">
          {card.steps.map((step) => (
            <li key={step.step} className="py-1.5">
              <span className="font-semibold">{step.step}.</span> {describeCall(step.call)}
              <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[step.status] ?? ""}`}>
                {step.status}
              </span>
              <span className="block opacity-70">
                {step.detail} Changed: {step.stateChange}.
              </span>
            </li>
          ))}
        </ol>
      </section>

      <p className="opacity-70">This run was reset afterwards. Nothing was saved.</p>
    </div>
  );
}
