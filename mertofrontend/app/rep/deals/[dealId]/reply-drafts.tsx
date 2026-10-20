"use client";

import { useActionState, useState } from "react";
import type { ReplyDraft } from "@/lib/reply-drafts";
import { formatDateTime, label } from "@/lib/format";
import { createDraftAction, reviewDraftAction, sendDraftAction, type DraftActionState } from "./draft-actions";

function Feedback({ state }: { state: DraftActionState }) {
  return <>
    {state?.error && <p role="alert" className="mt-2 text-sm text-red-600">{state.error}</p>}
    {state?.success && <p role="status" className="mt-2 text-sm text-green-700">{state.success}</p>}
  </>;
}

function DraftCard({ draft, eligible }: { draft: ReplyDraft; eligible: boolean }) {
  const [text, setText] = useState(draft.originalText);
  const [reviewState, reviewAction, reviewing] = useActionState(reviewDraftAction.bind(null, draft.id), undefined);
  const [sendState, sendAction, sending] = useActionState(sendDraftAction.bind(null, draft.id), undefined);
  const changed = text.trim() !== draft.originalText;
  const status = draft.sentEventId ? "Follow-up recorded"
    : draft.decision === "approve" ? "Approved" : draft.decision === "edit" ? "Edited and approved"
      : draft.decision === "reject" ? "Rejected" : "Awaiting review";
  return (
    <article className="space-y-3 rounded border-2 p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-semibold">{draft.channel.toUpperCase()} draft · {status}</h3>
        <p className="text-sm opacity-70">Prepared {formatDateTime(draft.createdAt)}</p>
      </div>
      <div className="rounded border p-3 text-sm">
        <p className="font-semibold">Context used for this draft</p>
        <p>{draft.context.buyer} · {draft.context.vehicleInterest}</p>
        <ul className="mt-1 list-inside list-disc">
          {draft.context.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
        </ul>
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold">Recent messages when the draft was prepared</summary>
          <ol className="mt-2 divide-y">
            {draft.context.messages.map(message => <li key={message.eventId} className="py-2">
              <p className="font-semibold">{label(message.actorType)} · {formatDateTime(message.createdAt)}</p>
              <p className="whitespace-pre-wrap">{message.body}</p>
            </li>)}
          </ol>
        </details>
      </div>
      {draft.decision === null ? (
        <form action={reviewAction} className="space-y-3">
          <label className="block text-sm font-semibold" htmlFor={`draft-${draft.id}`}>Reply text</label>
          <textarea id={`draft-${draft.id}`} name="message" value={text} rows={4} maxLength={2000}
            disabled={reviewing} onChange={event => setText(event.target.value)} className="w-full rounded border-2 p-2" />
          <div className="flex flex-wrap gap-2">
            <button name="decision" value="approve" disabled={reviewing || changed || !eligible}
              className="rounded border-2 px-3 py-2 font-semibold disabled:opacity-50">Approve</button>
            <button name="decision" value="edit" disabled={reviewing || !changed || !text.trim() || !eligible}
              className="rounded border-2 px-3 py-2 font-semibold disabled:opacity-50">Save edits and approve</button>
            <button name="decision" value="reject" disabled={reviewing}
              className="rounded border-2 px-3 py-2 disabled:opacity-50">Reject</button>
          </div>
        </form>
      ) : (
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Original draft</p>
          <p className="whitespace-pre-wrap">{draft.originalText}</p>
          {draft.decision === "edit" && <><p className="font-semibold">Approved reply</p><p className="whitespace-pre-wrap">{draft.finalText}</p></>}
          <p>{status} · reviewed {formatDateTime(draft.reviewedAt)}</p>
          {draft.decision === "reject" && <p>This draft cannot be sent.</p>}
        </div>
      )}
      {!draft.sentEventId && <Feedback state={reviewState} />}
      {(draft.decision === "approve" || draft.decision === "edit") && !draft.sentEventId && (
        <form action={sendAction}>
          <button disabled={sending || !eligible} className="rounded border-2 px-3 py-2 font-semibold disabled:opacity-50">
            {sending ? "Recording…" : "Record follow-up"}
          </button>
          {!eligible && <p className="mt-2 text-sm">Sending is unavailable while this customer is not eligible for follow-up.</p>}
        </form>
      )}
      <Feedback state={sendState} />
    </article>
  );
}

export function ReplyDrafts({ dealId, initialRequestId, drafts, eligible, email, phone, preferredChannel }: {
  dealId: string; initialRequestId: string; drafts: ReplyDraft[] | null; eligible: boolean;
  email: string | null; phone: string | null; preferredChannel: string;
}) {
  const [requestId, setRequestId] = useState(initialRequestId);
  const [channel, setChannel] = useState(preferredChannel === "email" && email ? "email" : phone ? "sms" : "email");
  const [state, action, pending] = useActionState(async (previous: DraftActionState, form: FormData) => {
    const result = await createDraftAction(dealId, previous, form);
    if (!result?.error) setRequestId(crypto.randomUUID());
    return result;
  }, undefined);
  return (
    <section className="space-y-4" aria-labelledby="drafts-heading">
      <h3 id="drafts-heading" className="font-semibold">Review a reply draft</h3>
      <p className="text-sm opacity-70">Review the context and wording, then approve, edit, or reject the suggested reply.</p>
      {drafts === null ? <p role="alert">Couldn&apos;t load saved drafts. Refresh to try again.</p> : <>
        {eligible && (email?.trim() || phone?.trim()) ? (
          <form action={action} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="requestId" value={requestId} />
            <div>
              <label htmlFor="draft-channel" className="block text-sm font-semibold">Draft channel</label>
              <select id="draft-channel" name="channel" value={channel} disabled={pending}
                onChange={event => { setChannel(event.target.value); setRequestId(crypto.randomUUID()); }}
                className="mt-1 rounded border-2 px-2 py-1">
                {email?.trim() && <option value="email">Email</option>}
                {phone?.trim() && <option value="sms">SMS</option>}
              </select>
            </div>
            <button disabled={pending} className="rounded border-2 px-3 py-2 font-semibold disabled:opacity-50">
              {pending ? "Preparing…" : drafts.length ? "Prepare another draft" : "Prepare draft"}
            </button>
          </form>
        ) : <p className="text-sm">New drafts are available when this customer is eligible for follow-up and has contact details.</p>}
        <Feedback state={state} />
        {drafts.length === 0 && <p className="text-sm">No saved drafts yet.</p>}
        {drafts.slice(0, 1).map(draft => <DraftCard key={draft.id} draft={draft} eligible={eligible} />)}
        {drafts.length > 1 && (
          <details className="rounded border p-3">
            <summary className="cursor-pointer text-sm font-semibold">Earlier drafts ({drafts.length - 1})</summary>
            <div className="mt-3 space-y-3">
              {drafts.slice(1).map(draft => (
                <details key={draft.id} className="rounded border p-3">
                  <summary className="cursor-pointer text-sm">
                    {draft.channel.toUpperCase()} · {draft.sentEventId ? "Follow-up recorded"
                      : draft.decision === "reject" ? "Rejected" : draft.decision ? "Approved" : "Awaiting review"}
                    {" · "}{formatDateTime(draft.createdAt)}
                  </summary>
                  <div className="mt-3"><DraftCard draft={draft} eligible={eligible} /></div>
                </details>
              ))}
            </div>
          </details>
        )}
      </>}
    </section>
  );
}
