"use client";

import { useActionState } from "react";
import { recheckWithModel, resetDemoModel, retrainFromReviews, simulateReviews, simulateSecondOpinions } from "@/app/manager/actions";
import { FLAG_FOR_SIGNAL, flagLabel, type LabelReport, type RecheckResult, type RetrainResult, type ReviewLearningStatus } from "@/lib/review-learning";

const KINDS: Record<string, string> = {
  reliable: "Correct reviews",
  repeated_template: "Same wording reviewed on many deals",
  context_reason: "Dismissed for a deal-history reason",
  unclear_reason: "Dismissed as “not a problem” or “other”",
  too_recent: "Reviewed yesterday (may still change)",
  conflicting_reviews: "Same wording reviewed both ways",
  ambiguous_buyer: "Missed handoff after several buyer messages",
  wrong_dismissal: "Real problems wrongly dismissed as misread wording",
};
const TRIAGE: Record<string, string> = {
  unclear_reason: "Unclear reason",
  ambiguous_buyer_message: "Unclear which buyer message",
  no_buyer_message: "No buyer message",
  conflicting_reviews: "Reviews disagree",
  same_text_conflict: "Same wording labelled both ways",
  needs_second_review: "Waiting for a second GM",
};
const button = "rounded border-2 px-4 py-2 font-semibold disabled:opacity-50";
const GREEN = "text-green-700 dark:text-green-400";
// Colour one before → after cell by its own change: green if better, red if worse.
function trend(before: number | undefined, after: number | undefined, better: "lower" | "higher") {
  if (before === undefined || after === undefined || before === after) return "";
  return (after < before) === (better === "lower") ? GREEN : "text-red-600";
}

function Filters({ labels }: { labels: LabelReport }) {
  const triage = Object.entries(labels.triage).reduce((sum, [, n]) => sum + (n ?? 0), 0);
  const rows: [string, number][] = [
    ["Used for training", labels.used],
    ["Held out for testing (20% of deals)", labels.gmHoldout],
    ["Repeated wording folded into one label", labels.duplicatesFolded],
    ["Too recent: waiting out the 7-day cooling period", labels.skipped.cooling],
    ["Deal-history reason: not a wording mistake", labels.skipped.contextReason],
    ["Second GM disagreed: not used", labels.skipped.secondReviewDisagreed],
    ...Object.entries(labels.triage).map(([reason, n]) => [`Sent to a person: ${TRIAGE[reason] ?? reason}`, n ?? 0] as [string, number]),
  ];
  return (
    <div>
      <h4 className="font-semibold">What the label rules did</h4>
      <table className="mt-1 text-sm">
        <tbody>
          {rows.map(([name, n]) => (
            <tr key={name}><td className="pr-6">{name}</td><td className="text-right font-semibold">{n}</td></tr>
          ))}
        </tbody>
      </table>
      {triage > 0 && <p className="mt-1 text-xs opacity-70">Triage items never train the model until a person settles them.</p>}
    </div>
  );
}

function Result({ result }: { result: RetrainResult }) {
  const { model } = result;
  const order = Object.keys(FLAG_FOR_SIGNAL);
  const flags = order.filter((signal) => model.heldOut.before[signal]);
  const signals = order.filter((signal) => model.testSplit.before[signal]);
  const sum = (side: "before" | "after") => signals.reduce((n, s) => n + model.testSplit[side][s].correct, 0);
  const total = signals.reduce((n, s) => n + model.testSplit.before[s].total, 0);
  const share = (correct: number, all: number) => `${((correct / all) * 100).toFixed(1)}%`;
  const cell = (before: number | undefined, after: number | undefined, better: "lower" | "higher") => (
    <td className={`pr-4 ${trend(before, after, better)}`}>{before ?? 0} → <strong>{after ?? 0}</strong></td>
  );
  return (
    <div className="space-y-4">
      <Filters labels={result.labels} />
      <p role="status" className={`rounded border-2 p-2 text-sm font-semibold ${model.adopted ? "border-green-600" : "border-red-600"}`}>
        {model.adopted
          ? <>Adopted: no flag got worse on the gold set. Now using <code>{model.version}</code>.</>
          : <>Not adopted: worse on the gold set for {model.worseSignals.map(flagLabel).join(", ") || "the total"}. Still using <code>{model.previousVersion}</code>.</>}
      </p>
      <div>
        <h4 className="font-semibold">Accuracy on the gold set (fixed test set: 960 messages, never trained on)</h4>
        <table className="mt-1 w-full text-sm">
          <thead><tr className="text-left"><th>Flag</th><th>Before</th><th>After</th></tr></thead>
          <tbody>
            {signals.map((signal) => {
              const before = model.testSplit.before[signal];
              const after = model.testSplit.after[signal];
              return (
                <tr key={signal}>
                  <td className="pr-4 capitalize">{flagLabel(signal)}</td>
                  <td className="pr-4">{share(before.correct, before.total)} ({before.correct}/{before.total})</td>
                  <td className={`font-semibold ${trend(before.correct, after.correct, "higher")}`}>
                    {share(after.correct, after.total)} ({after.correct}/{after.total})
                  </td>
                </tr>
              );
            })}
            <tr>
              <td className="pr-4 font-semibold">All decisions</td>
              <td className="pr-4">{share(sum("before"), total)} ({sum("before")}/{total})</td>
              <td className={`font-semibold ${trend(sum("before"), sum("after"), "higher")}`}>{share(sum("after"), total)} ({sum("after")}/{total})</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-1 text-xs opacity-70">Only the classifier heads are refit; the MPNet encoder is unchanged.</p>
      </div>
      <div>
        <h4 className="font-semibold">Held-out hard messages, by flag (never reviewed, never trained on)</h4>
        <table className="mt-1 w-full text-sm">
          <thead>
            <tr className="text-left">
              <th>Flag</th><th>Messages</th><th>Wrong flags</th><th>Missed problems</th><th>Correct</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((signal) => {
              const before = model.heldOut.before[signal];
              const after = model.heldOut.after[signal];
              return (
                <tr key={signal}>
                  <td className="pr-4 capitalize">{flagLabel(signal)}</td>
                  <td className="pr-4">{before.total}</td>
                  {cell(before.falsePositives, after.falsePositives, "lower")}
                  {cell(before.missed, after.missed, "lower")}
                  {cell(before.correct, after.correct, "higher")}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {model.changed.length > 0 && (
        <div>
          <h4 className="font-semibold">Held-out messages whose decision changed</h4>
          <ul className="mt-1 space-y-1 text-sm">
            {model.changed.map((c) => (
              <li key={c.text + c.signal}>
                <span className={c.nowCorrect ? GREEN : "text-red-600"}>{c.nowCorrect ? "Fixed" : "Broke"}</span>{" "}
                <span className="opacity-70">{flagLabel(c.signal)} {c.before.toFixed(2)} → {c.after.toFixed(2)}</span>{" "}
                <em>“{c.text}”</em>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const percent = (value: number | null) => (value === null ? "Not measured" : `${(value * 100).toFixed(1)}%`);

// Same metric names as the Results list above, so the two read the same way.
function Recheck({ result }: { result: RecheckResult }) {
  const rows: [string, string | number, string | number, string][] = [
    ["Evaluated conversations", result.evaluated, result.evaluated, ""],
    // Fewer flags is not better by itself, so these two are not coloured.
    ["Flagged conversations", result.flagged.saved, result.flagged.rerun, ""],
    ["Flag rate", percent(result.flagRate.saved), percent(result.flagRate.rerun), ""],
    ["Reviewed precision", percent(result.reviewedPrecision.saved), percent(result.reviewedPrecision.rerun),
      trend(result.reviewedPrecision.saved ?? undefined, result.reviewedPrecision.rerun ?? undefined, "higher")],
    ["Confirmed issues still flagged", `${result.confirmed.saved}`, `${result.confirmed.rerun} of ${result.confirmed.saved}`,
      trend(result.confirmed.saved, result.confirmed.rerun, "higher")],
    ["False positives still flagged", `${result.dismissed.saved}`, `${result.dismissed.rerun} of ${result.dismissed.saved}`,
      trend(result.dismissed.saved, result.dismissed.rerun, "lower")],
    ["Missed flags (GM had to add them)", `${result.missed.saved}`, `${result.missed.rerun} of ${result.missed.saved}`,
      trend(result.missed.saved, result.missed.rerun, "lower")],
  ];
  const held = result.heldOut;
  return (
    <div className="text-sm">
      <table className="w-full">
        <thead>
          <tr className="text-left">
            <th></th><th>Saved results</th><th>Re-run with <code>{result.modelVersion ?? "current model"}</code></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, saved, rerun, colour]) => (
            <tr key={name}>
              <td className="pr-4 font-semibold">{name}</td>
              <td className="pr-4">{saved}</td>
              <td className={`font-semibold ${colour}`}>{rerun}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs opacity-70">
        Preview only: nothing was saved, so the Results above do not change. GM decisions are kept: a false positive the
        model no longer raises drops out, and a missed flag it now catches counts as caught. Most of these reviews trained
        the new model; on the 20% of deals held out from training: false positives still flagged {held.dismissed.rerun} of{" "}
        {held.dismissed.saved}, confirmed issues still flagged {held.confirmed.rerun} of {held.confirmed.saved}, missed
        flags {held.missed.rerun} of {held.missed.saved}.
      </p>
    </div>
  );
}

export function ReviewLearningDemo({ status }: { status: ReviewLearningStatus | null }) {
  const [simulated, simulate, simulating] = useActionState(() => simulateReviews(), undefined);
  const [retrained, retrain, retraining] = useActionState(() => retrainFromReviews(), undefined);
  const [reset, resetAction, resetting] = useActionState(() => resetDemoModel(), undefined);
  const [rechecked, recheck, rechecking] = useActionState(() => recheckWithModel(), undefined);
  const [opinions, giveOpinions, givingOpinions] = useActionState(() => simulateSecondOpinions(), undefined);
  const waiting = status?.secondOpinionsWaiting ?? 0;
  const readiness = status?.labels.readiness;
  // One retrain per demo run; "Reset to the original model" allows another.
  const retrainedAlready = status?.modelVersion?.includes("+gm") ?? false;

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-70">
        Simulated GM reviews, not real ones. The reviews go through the same label rules as a real export, then the
        classifier is refit offline in the local model service. Restart the demo to start over.
      </p>
      <p className="text-sm">
        Model version: <code>{status?.modelVersion ?? "unknown"}</code>
        {readiness && <> · Training labels ready: {readiness.newTrainLabels}/{readiness.minNewLabels}</>}
        {status?.simulated && <> · Second opinions waiting: {waiting}</>}
      </p>

      <form action={simulate} className="space-y-2">
        <button type="submit" className={button} disabled={simulating || status?.simulated}>
          {simulating ? "Adding reviews…" : status?.simulated ? "Simulated reviews added" : "1. Simulate GM reviews"}
        </button>
        {simulated?.ok === false && <p role="alert" className="text-sm text-red-600">{simulated.error}</p>}
        {simulated?.ok && (
          <div className="text-sm">
            <p role="status">
              Added {simulated.value.reviews} reviews on {simulated.value.deals} conversations:{" "}
              {simulated.value.confirmed} confirmed, {simulated.value.falsePositive} dismissed,{" "}
              {simulated.value.manual} missed problems added by the GM.
            </p>
            <ul className="ml-4 list-disc">
              {Object.entries(simulated.value.byKind).map(([kind, n]) => <li key={kind}>{KINDS[kind] ?? kind}: {n}</li>)}
            </ul>
            <div className="mt-2 rounded border-2 border-amber-500 p-2">
              <p className="font-semibold">
                Sent for a second opinion: {simulated.value.sentForSecondOpinion.total} reviews strongly disagree with the model
              </p>
              <ul className="ml-4 list-disc">
                <li>Dismissed as misread wording while the model was at least 90% sure of a problem:{" "}
                  {simulated.value.sentForSecondOpinion.dismissedWhileModelSureOfProblem}</li>
                <li>Added as a missed problem while the model was at least 90% sure it was fine:{" "}
                  {simulated.value.sentForSecondOpinion.addedWhileModelSureItWasFine}</li>
              </ul>
              <p>
                They are listed in <a className="underline" href="#second-opinions">Second opinion needed</a> below and train
                the model only if a second GM agrees. The other{" "}
                {simulated.value.reviews - simulated.value.sentForSecondOpinion.total} reviews go straight to the label rules.
              </p>
            </div>
          </div>
        )}
      </form>

      <form action={giveOpinions} className="space-y-2">
        <button type="submit" className={button} disabled={givingOpinions || !status?.simulated || waiting === 0}>
          {givingOpinions ? "Giving second opinions…" : "2. Give the remaining second opinions"}
        </button>
        <p className="text-sm opacity-70">
          Reviews where the GM and the model strongly disagree need a second GM before they can train the model. Answer
          a few in “Second opinion needed” below, then let this button answer the rest as a careful second GM would.
        </p>
        {opinions?.ok === false && <p role="alert" className="text-sm text-red-600">{opinions.error}</p>}
        {opinions?.ok && (
          <p role="status" className="text-sm">
            Second GM agreed with {opinions.value.agreed} and disagreed with {opinions.value.disagreed} (those are not used).
          </p>
        )}
      </form>

      <form action={retrain} className="space-y-2">
        <button type="submit" className={button} disabled={retraining || !readiness?.ready || retrainedAlready}>
          {retraining ? "Retraining…" : retrainedAlready ? "Classifier retrained" : "3. Retrain classifier from reviews"}
        </button>
        {!readiness?.ready && !retrained && (
          <p className="text-sm opacity-70">Retraining waits for at least {readiness?.minNewLabels ?? 50} usable labels.</p>
        )}
        {retrained?.ok === false && <p role="alert" className="text-sm text-red-600">{retrained.error}</p>}
        {retrained?.ok && <Result result={retrained.value} />}
      </form>

      <form action={recheck} className="space-y-2">
        <button type="submit" className={button} disabled={rechecking || !status?.simulated}>
          {rechecking ? "Re-running…" : "4. Preview: re-run AI evaluation with the current model"}
        </button>
        <p className="text-sm opacity-70">Compares the saved Results with a fresh run of the current model. Nothing is saved.</p>
        {rechecked?.ok === false && <p role="alert" className="text-sm text-red-600">{rechecked.error}</p>}
        {rechecked?.ok && <Recheck result={rechecked.value} />}
      </form>

      <form action={resetAction}>
        <button type="submit" className="text-sm underline disabled:opacity-50" disabled={resetting}>
          {resetting ? "Resetting…" : "Reset to the original model"}
        </button>
        {reset?.ok && <span className="ml-2 text-sm">Back to {reset.value.version}.</span>}
        {reset?.ok === false && <span role="alert" className="ml-2 text-sm text-red-600">{reset.error}</span>}
      </form>
    </div>
  );
}
