"use client";

import { useState, type ReactNode } from "react";

export function FollowUpPanel({ manual, drafts }: { manual: ReactNode; drafts: ReactNode }) {
  const [mode, setMode] = useState<"manual" | "drafts">("manual");

  return (
    <section className="space-y-4 rounded border-2 p-4" aria-labelledby="follow-up-heading">
      <h2 id="follow-up-heading" className="font-semibold">Follow up</h2>
      <p className="text-sm opacity-70">Write your own message or review a suggested draft. Choose one way to follow up.</p>
      <p className="text-xs opacity-60">Demo mode: messages and calls are recorded here without contacting the customer.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="How to prepare your follow-up">
        <button type="button" aria-pressed={mode === "manual"} aria-controls="manual-follow-up"
          onClick={() => setMode("manual")}
          className="rounded border-2 px-3 py-2 font-semibold aria-pressed:bg-foreground aria-pressed:text-background">
          Write a message
        </button>
        <button type="button" aria-pressed={mode === "drafts"} aria-controls="draft-follow-up"
          onClick={() => setMode("drafts")}
          className="rounded border-2 px-3 py-2 font-semibold aria-pressed:bg-foreground aria-pressed:text-background">
          Use a suggested draft
        </button>
      </div>
      <div id="manual-follow-up" hidden={mode !== "manual"}>{manual}</div>
      <div id="draft-follow-up" hidden={mode !== "drafts"}>{drafts}</div>
    </section>
  );
}
