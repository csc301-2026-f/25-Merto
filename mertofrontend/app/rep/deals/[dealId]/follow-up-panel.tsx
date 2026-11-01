"use client";

import { useState, type ReactNode } from "react";

const toggleClass =
  "rounded-lg border border-zinc-300 px-3 py-2 font-semibold transition hover:bg-zinc-200 aria-pressed:border-[#d5bd91] aria-pressed:bg-[#d5bd91] aria-pressed:text-black dark:border-zinc-700 dark:hover:bg-zinc-800 dark:aria-pressed:hover:bg-[#d5bd91]";

export function FollowUpPanel({ manual, drafts }: { manual: ReactNode; drafts: ReactNode }) {
  const [mode, setMode] = useState<"manual" | "drafts">("manual");

  return (
    <section
      className="overflow-hidden rounded-xl bg-slate-100 text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
      aria-labelledby="follow-up-heading"
    >
      <h2 id="follow-up-heading" className="bg-slate-200 px-4 py-3 font-semibold dark:bg-zinc-800">
        Follow up
      </h2>
      <div className="space-y-4 p-4">
        <p className="text-sm opacity-70">Write your own message or review a suggested draft. Choose one way to follow up.</p>
        <p className="text-xs opacity-60">Demo mode: messages and calls are recorded here without contacting the customer.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="How to prepare your follow-up">
          <button type="button" aria-pressed={mode === "manual"} aria-controls="manual-follow-up"
            onClick={() => setMode("manual")} className={toggleClass}>
            Write a message
          </button>
          <button type="button" aria-pressed={mode === "drafts"} aria-controls="draft-follow-up"
            onClick={() => setMode("drafts")} className={toggleClass}>
            Use a suggested draft
          </button>
        </div>
        <div id="manual-follow-up" hidden={mode !== "manual"}>{manual}</div>
        <div id="draft-follow-up" hidden={mode !== "drafts"}>{drafts}</div>
      </div>
    </section>
  );
}