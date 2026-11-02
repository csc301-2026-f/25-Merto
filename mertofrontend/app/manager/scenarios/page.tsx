import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { loadJson } from "@/lib/api";
import type { ScenarioList } from "@/lib/scenarios";
import { ScenarioRunner } from "./scenario-runner";

async function ScenariosPage() {
  await requireRole("manager");
  const data = await loadJson<ScenarioList>("/api/scenarios");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Scenario checks</h1>
        <p className="mt-1 text-sm opacity-70">
          Run a predefined scenario and see whether the AI did what the store expects.
        </p>
      </header>

      {data === null ? (
        <p>Couldn&apos;t load the scenarios.</p>
      ) : (
        <ScenarioRunner scenarios={data.scenarios} agents={data.agents} />
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <ScenariosPage />
    </Suspense>
  );
}
