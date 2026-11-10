"use client";

import { useActionState, useState } from "react";
import { addManualFlag, type ActionResult } from "@/app/manager/actions";
import { MANUAL_FLAG_TYPES, type AiReply, type ManualFlagType } from "@/lib/evaluation";

// Lets a GM mark an AI reply with a problem the evaluator missed.
// The new flag is saved as a confirmed issue that still needs resolving.
// existingTypes: flags the reply already has, which are left out of the choices.
export function ManualFlag({ dealId, reply, evaluatorId, existingTypes = [], buttonLabel = "Flag this reply" }: {
  dealId: string; reply: AiReply; evaluatorId?: string; existingTypes?: string[]; buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const choices = (Object.entries(MANUAL_FLAG_TYPES) as [ManualFlagType, string][])
    .filter(([type]) => !existingTypes.includes(type));
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(async (_previous, data) => {
    const flagType = data.get("flagType") as ManualFlagType | null;
    if (!flagType || !(flagType in MANUAL_FLAG_TYPES)) return { ok: false, error: "Choose what is wrong with this reply." };
    return addManualFlag(dealId, reply.id, flagType, String(data.get("note") ?? ""), evaluatorId);
  }, undefined);

  if (!choices.length) return null;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="mt-2 rounded border border-zinc-500 px-3 py-1 text-sm font-semibold">
        {buttonLabel}
      </button>
    );
  }
  return (
    <form action={action} className="mt-3 space-y-2">
      <label htmlFor={`manual-type-${reply.id}`} className="block text-sm font-semibold">What is wrong with it?</label>
      <select id={`manual-type-${reply.id}`} name="flagType" defaultValue="" disabled={pending} required
        className="w-full rounded border border-zinc-400 bg-transparent p-2 text-sm">
        <option value="" disabled>Choose a problem</option>
        {choices.map(([type, label]) => (
          <option key={type} value={type}>{label}</option>
        ))}
      </select>
      <label htmlFor={`manual-note-${reply.id}`} className="block text-sm font-semibold">Note (optional)</label>
      <textarea id={`manual-note-${reply.id}`} name="note" maxLength={2000} rows={2} disabled={pending}
        className="w-full rounded border border-zinc-400 bg-transparent p-2 text-sm" />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending}
          className="rounded border border-zinc-500 px-3 py-2 text-sm font-semibold disabled:opacity-50">
          Add flag
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={pending}
          className="rounded px-3 py-2 text-sm underline disabled:opacity-50">
          Cancel
        </button>
      </div>
      {pending && <p role="status" className="text-sm">Adding flag…</p>}
      {state?.ok === false && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
