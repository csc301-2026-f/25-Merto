"use client";

import { useState, useTransition } from "react";
import { MODE_LABELS, ScenarioScorecard, VerdictBadge } from "@/components/ScenarioScorecard";
import type { AgentInfo, RunAllResult, Scorecard, ScenarioSummary } from "@/lib/scenarios";
import { runAllScenarios, runScenario } from "./actions";

// Scenarios from Merto's brief (US13). Pick an agent, run one scenario or all of them,
// and read the scorecard. Every run is rolled back by the backend, so it is always safe.
export function ScenarioRunner({ scenarios, agents }: { scenarios: ScenarioSummary[]; agents: AgentInfo[] }) {
  const [agent, setAgent] = useState(agents[0]?.name ?? "");
  // The latest scorecards for each scenario, one per agent that ran it.
  const [cards, setCards] = useState<Record<string, Scorecard[]>>({});
  const [all, setAll] = useState<RunAllResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function runOne(scenarioId: string) {
    setError(undefined);
    setBusy(scenarioId);
    startTransition(async () => {
      const result = await runScenario(scenarioId, agent);
      if (result.ok) {
        setCards((current) => ({ ...current, [scenarioId]: [result.data] }));
      } else {
        setError(result.error);
      }
      setBusy(null);
    });
  }

  function runEvery(names: string[]) {
    setError(undefined);
    setBusy("all");
    startTransition(async () => {
      const result = await runAllScenarios(names);
      if (result.ok) {
        setAll(result.data);
        const next: Record<string, Scorecard[]> = {};
        for (const run of result.data.results) {
          for (const card of run.scorecards) next[card.scenario.id] = [...(next[card.scenario.id] ?? []), card];
        }
        setCards(next);
      } else {
        setError(result.error);
      }
      setBusy(null);
    });
  }

  const selected = agents.find((known) => known.name === agent);

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl bg-slate-100 p-4 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
        <p className="text-sm opacity-70">
          Each scenario loads a deal at a point in time, gives an agent one event, and checks what it does. The
          deal is reset afterwards, so nothing is saved and no customer is contacted.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">
            Agent
            <select
              value={agent}
              onChange={(event) => setAgent(event.target.value)}
              disabled={pending}
              className="ml-2 rounded border-2 bg-transparent px-2 py-1 font-normal"
            >
              {agents.map((known) => (
                <option key={known.name} value={known.name} className="text-black">
                  {known.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={pending || !agent}
            onClick={() => runEvery([agent])}
            className="rounded border-2 px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy === "all" ? "Running…" : "Run all scenarios"}
          </button>
          {agents.length > 1 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => runEvery(agents.map((known) => known.name))}
              className="rounded border-2 px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
            >
              Compare all agents
            </button>
          )}
        </div>
        {selected && <p className="text-sm opacity-70">{selected.description}</p>}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </section>

      {all && <Totals run={all} />}

      <ul className="space-y-4">
        {scenarios.map((scenario) => (
          <li key={scenario.id} className="space-y-3 rounded border-2 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">
                {scenario.title} <span className="font-normal opacity-70">({scenario.brief})</span>
              </h3>
              <span className="rounded border px-2 py-0.5 text-xs">AI mode: {MODE_LABELS[scenario.mode]}</span>
            </div>
            <p className="text-sm">{scenario.description}</p>
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold">What is checked ({scenario.checks.length})</summary>
              <ul className="mt-1 list-disc pl-5 opacity-80">
                {scenario.checks.map((check) => (
                  <li key={check.id}>{check.description}</li>
                ))}
              </ul>
            </details>
            <button
              type="button"
              disabled={pending || !agent}
              onClick={() => runOne(scenario.id)}
              className="rounded border-2 px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
            >
              {busy === scenario.id ? "Running…" : `Run with ${agent}`}
            </button>
            {(cards[scenario.id] ?? []).map((card) => (
              <ScenarioScorecard key={card.runId} card={card} />
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Totals per agent, and a scenario-by-scenario comparison when more than one agent ran.
function Totals({ run }: { run: RunAllResult }) {
  return (
    <section className="space-y-3 rounded border-2 p-4 text-sm">
      <h3 className="font-semibold">Results for all scenarios</h3>
      <ul className="space-y-1">
        {run.results.map(({ agent, totals }) => (
          <li key={agent}>
            <span className="font-semibold">{agent}</span>: {totals.scenariosPassed} of {totals.scenariosTotal}{" "}
            scenarios passed · {totals.checksPassed} of {totals.checksTotal} checks · {totals.flagsRaised}{" "}
            {totals.flagsRaised === 1 ? "flag" : "flags"}
          </li>
        ))}
      </ul>
      {run.comparison && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2">
                <th className="py-1 pr-3">Scenario</th>
                {run.results.map(({ agent }) => (
                  <th key={agent} className="py-1 pr-3">
                    {agent}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {run.comparison.map((row) => (
                <tr key={row.scenario} className="border-b">
                  <td className="py-1.5 pr-3">{row.brief}</td>
                  {row.results.map((result) => (
                    <td key={result.agent} className="py-1.5 pr-3">
                      <VerdictBadge verdict={result.verdict} />{" "}
                      <span className="opacity-70">
                        {result.checksPassed}/{result.checksTotal}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
