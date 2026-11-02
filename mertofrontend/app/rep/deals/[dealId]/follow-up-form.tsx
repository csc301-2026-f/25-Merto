"use client";

import { useActionState, useState } from "react";
import type { FollowUpAssessment } from "@/lib/follow-ups";
import { formatDateTime } from "@/lib/format";
import { recordFollowUp } from "./follow-up-actions";

type Channel = "email" | "sms" | "call";
const CHANNEL_LABELS: Record<Channel, string> = { email: "Email", sms: "SMS", call: "Call" };

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-black focus:border-[#d5bd91] focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white";
const primaryButtonClass =
  "rounded-lg bg-[#d5bd91] px-4 py-2 font-semibold text-black transition hover:bg-[#e3cda6] disabled:opacity-50";

export function FollowUpForm({ dealId, initialRequestId, assessment, email, phone, preferredChannel }: {
  dealId: string;
  initialRequestId: string;
  assessment: FollowUpAssessment | null;
  email: string | null;
  phone: string | null;
  preferredChannel: string;
}) {
  const channels: Channel[] = [
    ...(email?.trim() ? ["email" as const] : []),
    ...(phone?.trim() ? ["sms" as const, "call" as const] : []),
  ];
  const [channel, setChannel] = useState(channels.find(value => value === preferredChannel) ?? channels[0] ?? "email");
  const [message, setMessage] = useState("");
  const [requestId, setRequestId] = useState(initialRequestId);
  const [state, formAction, pending] = useActionState(recordFollowUp.bind(null, dealId), undefined);
  const recorded = state?.eventId === requestId;

  return (
    <section aria-labelledby="manual-message-heading">
      <h3 id="manual-message-heading" className="font-semibold">Write a message</h3>
      <p className="mt-1 text-sm opacity-70">
        Write a message or add notes from a call to this customer&apos;s history.
      </p>
      {state?.error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state?.success && (
        <div role="status" className="mt-3 space-y-1 text-sm text-green-700 dark:text-green-400">
          <p>{state.success}</p>
          <p>Recorded {formatDateTime(state.recordedAt ?? null)}. See the timeline below.</p>
          {state.remaining?.length === 0 ? <p>No follow-up is currently due.</p> : (
            <p>Other work still needs attention; recording a message does not complete an unresolved promise.</p>
          )}
        </div>
      )}
      {!assessment ? <p className="mt-3">Couldn&apos;t check follow-up eligibility. Refresh to try again.</p>
        : assessment.status !== "due" ? (
          <p className="mt-3 text-sm">
            {assessment.suppressions.some(item => item.code === "opted_out")
              ? "This customer opted out. Follow-up is blocked."
              : assessment.suppressions.some(item => item.code === "deal_closed")
                ? "This deal is closed. Follow-up is blocked."
                : "No follow-up is currently due for this customer."}
          </p>
        ) : channels.length === 0 ? <p className="mt-3">No email address or phone number is available.</p> : (
          <form action={formAction} className="mt-4 space-y-4">
            <ul className="list-inside list-disc text-sm">
              {assessment.reasons.map((reason, index) => <li key={`${reason.code}:${index}`}>{reason.text}</li>)}
            </ul>
            <input type="hidden" name="requestId" value={requestId} />
            <div className="flex flex-col gap-1">
              <label htmlFor="follow-up-channel" className="font-semibold">Channel</label>
              <select id="follow-up-channel" name="channel" value={channel} disabled={pending}
                onChange={event => { setChannel(event.target.value as Channel); setRequestId(crypto.randomUUID()); }}
                className={inputClass}>
                {channels.map(value => (
                  <option key={value} value={value} className="bg-white text-black">{CHANNEL_LABELS[value]}</option>
                ))}
              </select>
              <p className="text-sm opacity-70">{channel === "email" ? email : phone}</p>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="follow-up-message" className="font-semibold">Message or call notes</label>
              <textarea id="follow-up-message" name="message" required maxLength={2000} rows={4}
                value={message} disabled={pending}
                onChange={event => { setMessage(event.target.value); setRequestId(crypto.randomUUID()); }}
                className={inputClass} />
            </div>
            <button type="submit" disabled={pending || !message.trim() || recorded} className={primaryButtonClass}>
              {pending ? "Recording…" : recorded ? "Follow-up recorded" : "Record follow-up"}
            </button>
          </form>
        )}
    </section>
  );
}