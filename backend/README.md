# Merto backend: evaluation, assignment, and follow-ups

A TypeScript/Express REST API for US5 (evaluate AI conversations), US8 (assign or
transfer a buyer, see below), US6 (which buyers need a follow-up, and why), and the deterministic checks required by section 10 of the Merto brief, including its
example that an open item is created when the buyer asks for a price. It reads the
database team's tables (see [`supabase/DATA_CONTRACT.md`](../supabase/DATA_CONTRACT.md))
and stores results in `ai_evaluations`, `ai_flags`, and `deal_assignments`. No paid AI key is used:
deterministic rules decide what to flag, and a GM makes the final call. It also
serves the frontend in [`mertofrontend/`](../mertofrontend): sign-in, deal lists,
and the buyer record.

## Run it

Requires Node.js 20 or newer. From this folder:

```sh
npm install
npm run demo    # walks through the whole flow over HTTP and prints each step
npm test        # rule unit tests + API tests
# If many test files at once run out of memory (each loads its own sandbox):
#   npx tsx --test --test-concurrency=1 test/*.test.ts
npm run eval:rules   # scores the rules against the labelled datasets
npm run dev     # API on http://localhost:3001
```

Without `DATABASE_URL`, the server, demo, and tests use an in-memory sandbox
loaded from `supabase/migrations` and `supabase/seed`, the same steps as
`supabase db reset`. Nothing is sent anywhere, and the sandbox resets on restart.
To use the team's Supabase database, copy `.env.example` to `.env` and set
`DATABASE_URL` to its server-side connection string. That database must already
have every migration in `supabase/migrations` applied, including
`20261017000100_deal_assignments.sql` (see [hosted integration](../supabase/HOSTED_INTEGRATION.md)).
Never commit `.env`.

To try it with the frontend, run `npm run dev` here and `npm run dev` in
`../mertofrontend`, then open http://localhost:3000 and sign in as `karen` (GM),
`dana`, `arjun`, `sofia`, or `tom` (reps) with password `test`.

## Who is calling

Until Supabase Auth is mapped to `staff_users`, every request names its caller
in an `X-Staff-Id` header. The server looks up that person's role and enforces
permissions itself. Seeded IDs:

| Person | Role | X-Staff-Id |
| --- | --- | --- |
| Karen Holt | GM | `10000000-0000-0000-0000-000000000001` |
| Dana Kowalski | Rep | `10000000-0000-0000-0000-000000000002` |
| Arjun Mehta | Rep | `10000000-0000-0000-0000-000000000003` |

This header is a development stand-in, not authentication: replace it with a
verified Supabase session before deploying.

The frontend gets that ID from `POST /auth/login` with `{ "username", "password" }`.
The username is a staff email or the part before the @; every account shares one
password, `DEV_LOGIN_PASSWORD` (default `test` for the sandbox; with `DATABASE_URL`,
sign-in is off unless it is set). It returns `{ token, id, name, role }`, where
`token` is the staff ID and `role` (`gm` or `rep`) comes from `staff_users`. Wrong
credentials are 401. `GET /api/me` returns the caller's `{ id, name, role }`. This is
as weak as the header: anyone who knows a staff ID can act as that person.

## Verify shared Supabase integration

See [hosted database setup and verification](../supabase/HOSTED_INTEGRATION.md).
With `DATABASE_URL` configured in this folder's ignored `.env`, run:

```sh
npm run check:hosted
```

This requires PostgreSQL: it never falls back to the sandbox. It exercises the
existing HTTP endpoints, recreates the backend server and connection pool, and
checks that evaluation results, manager reviews, and timeline entries remain.
It also checks rerun safety and hosted constraints. It retains one clearly named
fictional fixture, reused by subsequent checks. Run it against a development/demo
database rather than customer data.

## Endpoints

All responses are JSON. Errors are `{ "error": "..." }` with 400 (bad input),
401 (unknown caller), 403 (role not allowed), 404, or 409 (review not allowed
from the flag's current status).

| Method and path | Who | What it does |
| --- | --- | --- |
| `POST /api/evaluations/run` | GM | Nightly job: evaluates every deal with AI activity. Returns `buyer`, `dealId`, `result`, `evaluatedAt`, `newFlags` per deal. Safe to rerun. The manager dashboard's **Run AI evaluation** button calls it. |
| `POST /api/deals/:dealId/evaluation` | GM | Evaluates one deal. |
| `GET /api/deals/:dealId/evaluation` | GM, owning rep | The buyer record's AI review: `status` (`not_evaluated`, `passed`, `flagged`, `confirmed_issue`, `resolved`, `false_positive`), `evaluatedAt`, and every flag with its evidence message. |
| `GET /api/deals/:dealId/evaluation/preview` | GM, owning rep | Dry run: what the rules would flag now. Writes nothing. |
| `GET /api/ai-flags/queue` | GM: all; rep: own deals | Pending flags, highest severity and oldest evidence first, each with `evidenceBody`. |
| `POST /api/ai-flags/:flagId/review` | GM | Body `{ "decision": "confirmed_issue" \| "false_positive" \| "resolved", "note"?: string }`. Also writes the decision to the deal's timeline. |
| `GET /api/ai-evaluation/metrics` | GM | `evaluatedConversations`, `flaggedConversations`, `flagRate`, counts by review status, and `reviewedPrecision`. Rates are `null` ("not measured") when there is nothing to divide by. |

```sh
curl -X POST -H "X-Staff-Id: 10000000-0000-0000-0000-000000000001" \
  http://localhost:3001/api/evaluations/run
curl -H "X-Staff-Id: 10000000-0000-0000-0000-000000000001" \
  http://localhost:3001/api/ai-flags/queue
```

## Assignment and transfer (US8)

Only a GM can assign an unassigned buyer or transfer an assigned one. Each change
writes, in one transaction:

- the new `deals.owner_id` (a `new` deal moves to `assigned`);
- the new owner on every open item (resolved and cancelled items keep theirs);
- a timeline entry (`assignment` or `transfer`, actor `gm`) that everyone sees:
  `Assigned Nina Shah to Dana Kowalski: <reason>` or
  `Transferred Hannah Clarke from Arjun Mehta to Dana Kowalski: <reason>`;
- a `deal_assignments` row with who (`assigned_by`), when (`created_at`, equal to the
  timeline entry's), from whom, to whom, why, and how many open items moved.

Messages, notes, appointments, and evaluations stay on the deal, so the new owner
reads the same history; the former owner loses access (403).

| Method and path | Who | What it does |
| --- | --- | --- |
| `GET /api/deals/unassigned` | GM | Open deals with no owner, oldest first. |
| `GET /api/staff/reps` | GM | Reps a deal can go to: `id`, `name`, `email`, `activeDeals` (owned, not delivered or lost). |
| `POST /api/deals/:dealId/assign` | GM | Body `{ "toUserId", "reason", "expectedOwnerId"? }`. Only for an unassigned deal. |
| `POST /api/deals/:dealId/transfer` | GM | Same body. Only for an assigned deal. |
| `GET /api/deals/:dealId/assignments` | GM, owning rep | `currentOwner` and `history`, oldest first. |

Both POSTs return `{ dealId, buyer, kind, at, by, from, to, reason, openItemsMoved, eventId }`,
where `by`, `from`, and `to` are `{ id, name }` (`from` is null for an assignment).
Each `history` entry is `{ eventId, kind, at, by, from, to, reason, openItemsMoved, body, structured }`.
Entries written before `deal_assignments` existed have `structured: false` and null
`from`, `to`, `reason`, and `openItemsMoved`; their details are only in `body`.

Rules: `reason` is required (max 500 characters, line breaks collapsed). The target
must be an existing staff member with role `rep` (400 for a GM, 404 if unknown).
Assigning an owned deal, transferring an unassigned one, transferring to the current
owner, and reassigning a delivered or lost deal are all 409. `expectedOwnerId` is the
owner the GM's page showed (`null` for unassigned); if the deal has changed hands
since, the request is 409 and nothing changes, so a stale page cannot move a buyer
the GM did not mean to move. Two simultaneous changes to one deal are serialised by a
row lock, so only one succeeds.

## Deals and the buyer record

| Method and path | Who | What it does |
| --- | --- | --- |
| `GET /api/deals` | GM: all; rep: own | Open deals (not delivered or lost), most recent activity first: `dealId`, `buyer`, `vehicleInterest`, `stage`, `source`, `ownerId`, `owner`, `optedOut`, `openItems`, `lastActivityAt`, `createdAt`. |
| `GET /api/deals/:dealId` | GM, owning rep | The buyer record: deal fields, `buyer` (contact, `optedOut`), `owner`, `timeline`, `openItems`, `appointments`, `assignments` (as above). |
| `POST /api/deals` | GM, rep | Adds a buyer and their first deal (201). See below. |
| `GET /api/appointments` | GM: all; rep: own deals | All appointments, ordered by scheduled time, with customer, vehicle, and owner details. |
| `POST /api/appointments` | GM, owning rep | Creates an appointment (requested by default). Body: `{ "dealId", "scheduledFor", "status"?, "outcomeNote"? }`. |
| `PATCH /api/appointments/:appointmentId` | GM, owning rep | Updates `scheduledFor`, `status`, and `outcomeNote`. Status is `requested`, `confirmed`, `rescheduled`, `cancelled`, `completed`, or `no_show`. |

Every timeline entry has `actorType` (`buyer`, `ai`, `rep`, `gm`, or `system`) and,
for staff, `actorName`, so AI activity is always distinguishable from a person's.

### Adding a buyer

`POST /api/deals` takes `{ "name", "vehicleInterest", "source", "email"?, "phone"?, "preferredChannel"? }`.
Name and vehicle are required (max 200 characters). `source` is one of `website`,
`web_chat`, `email`, `phone`, `sms`, `walk_in`, `listing_portal`, `referral`, `other`
(older seeded deals use free text). An email or a phone is required, as the database
demands. `preferredChannel` (`email`, `sms`, `call`) defaults to `email` when there is
an email and `sms` otherwise, and must be a channel the buyer can be reached on.

- A buyer whose email (any case) or phone digits are already on file is reused: the
  deal joins their record, so history and opt-out stay in one place. Missing contact
  details are filled in; existing ones are never overwritten. An email of one buyer
  with the phone of another is 409.
- A rep owns the deal they add (stage `assigned`, with a `deal_assignments` record by
  that rep). A GM's deal starts unassigned (stage `new`) and appears in
  `GET /api/deals/unassigned` for US8.
- One timeline note records who added the buyer, the vehicle, and the source.

It returns `{ dealId, stage, owner, buyer, otherOpenDeals, eventId }`. `buyer.existing`
is true when an existing buyer matched; `otherOpenDeals` lists their other open deals
so a duplicate entry is easy to spot. `buyer.optedOut` true means the buyer asked not
to be contacted: the deal is still created (they may have walked in), but nobody
should email, text, or schedule follow-ups until they agree again. There is no
re-consent action yet.

## Follow-ups (US6)

Which buyers need a follow-up now, and why. Read-only: nothing is sent or stored.
Every reason says what happened and since when ("Quote sent 4 days ago; no reply
from the buyer and no follow-up since"), so a rep can see why a buyer is listed.

| Method and path | Who | What it does |
| --- | --- | --- |
| `GET /api/follow-ups/due` | GM: all, unassigned included; rep: own | Buyers due now, most overdue first: `dealId`, `buyer` (`id`, `name`), `vehicleInterest`, `stage`, `owner` (`{ id, name }` or null), `dueAt`, `reasons`. |
| `GET /api/deals/:dealId/follow-up` | GM, owning rep | One buyer: the same fields plus `status` (`due`, `not_due`, `suppressed`) and `suppressions`. |

Each reason is `{ code, kind, text, since, dueAt }` plus, where there is one, the
`evidenceEventId`, `openItemId`, or `appointmentId` it came from. `since` is when the
clock started; `dueAt` is when the follow-up became due. A deal's `dueAt` is its
earliest reason's. Each suppression is `{ code, text }`.

### Follow-up rules

Thresholds are in [`src/follow-up/rules.ts`](src/follow-up/rules.ts); the logic is a
pure function in [`src/follow-up/detect.ts`](src/follow-up/detect.ts) that takes one
deal's timeline, appointments, open items, stage, and opt-out state, plus `now`. The
thresholds follow the scenario seed: reps follow up 3 days after a quote and the day
after a visit or a no-show, and a dormant buyer gets a check-in on day 45 (F.1, F.2).

| Code | Kind | Due when | Cleared by |
| --- | --- | --- | --- |
| `unanswered_message` | owed | A buyer message has had no reply from a person for 4 hours. AI replies do not count (the text says "only the AI answered"): the AI cannot commit to a price, a visit, or a vehicle. | A rep/GM message, call, or note on the deal (visits and calls are often logged as notes), or the buyer coming in person. Assignment and transfer entries do not count. |
| `overdue_commitment` | owed | An open `promise`, `callback`, or `unanswered_question` is past its `due_at`. | Resolving or cancelling the item. A message alone does not prove the promise was kept. |
| `quote_no_reply` | nudge | Staff sent a quote (a dollar figure, or "here is your quote") 3 days ago, and nothing since from either side. | Any outbound message (AI or staff) or a buyer reply. |
| `missed_appointment` | nudge | The latest visit that has passed was a no-show or cancelled, 24 hours ago, with no contact since its time. | Any contact since the visit time. |
| `visit_no_follow_up` | nudge | The latest visit that has passed was attended, or its outcome was never recorded, 24 hours ago, with no contact since. | Any contact since the visit time. |
| `document_overdue` | nudge | An open `missing_doc` (the buyer owes a document) is past its `due_at` and no contact since. | A reminder or any contact since the due time, or resolving the item. |
| `gone_quiet` | nudge | 45 days since the buyer's last message (or since the deal was added, if they never wrote) and no outbound since day 45. | One outbound check-in on or after day 45. |

**Owed** reasons mean the buyer is waiting on us. **Nudges** mean the buyer went quiet.

| Suppression | Hides | When |
| --- | --- | --- |
| `opted_out` | everything | `buyers.opted_out`, or an `opt_out` event on any of the buyer's deals. |
| `deal_closed` | everything | Stage `delivered` or `lost`. The due list only reads open deals anyway. |
| `appointment_upcoming` | nudges | A future visit that is `requested`, `confirmed`, or `rescheduled`. A booked visit is already the next contact, but it does not answer a question or keep a promise, so owed reasons stay. |
| `callback_scheduled` | nudges | An open `callback` with a future `due_at`: the follow-up is already planned (Zane's day-45 callback). |

`status` is `due` when a reason remains, else `suppressed` when any suppression
applies, else `not_due`. With every seed loaded, the due list includes Hannah
(overdue quote promise), Nina and Keira (unanswered message and overdue callback),
Maya (visit outcome never recorded, no contact since), Callum (visited, no follow-up),
Theo (unanswered), Olivia (only the AI answered, overdue question), and Ben, Wes, Uri,
and Maren (only the AI answered). Jordan, Imani, and Samir are suppressed by a booked
visit and Zane by his scheduled callback; Marcus (quote 2 days ago) and Yvonne (day 26
of 45) are not due yet. Rob and Parker are suppressed by their opt-outs.

### Record an immediate follow-up (US7)

`POST /api/deals/:dealId/follow-ups` takes
`{ "requestId": "<UUID>", "channel": "email" | "sms" | "call", "message": "..." }`.
The owning rep or a GM can record a **simulated** follow-up for a currently due
deal. This never sends real email, SMS, or calls. Scheduling for later is not
implemented yet.

The server rechecks current ownership, stage, opt-outs across all of the buyer's
deals, follow-up eligibility, and the selected channel's contact information.
Messages must be nonblank and at most 2,000 characters. Actor and time come from
the server, not the request. The response includes `status: "simulated_sent"`,
`eventId`, `recordedAt`, `alreadyRecorded`, and the recalculated `followUp` assessment.

The existing timeline stores the outbound interaction with the prefix
`[Simulated follow-up]`. No schema migration is needed. A transaction covers
checking eligibility, recording the event, and refreshing status. A deal/buyer
row lock serializes ownership changes; a request lock prevents duplicate retries.
Use the same UUID and contents to retry an uncertain request: the existing event
is returned without writing another one, even when the reminder has cleared.
Reusing a UUID for different contents returns 409.

The rep's buyer page has a **Follow up now** form. After success, the timeline and
dashboard refresh. Visit/quote reminders can clear; an overdue promise remains
until its open item is explicitly resolved. Recording a message does not claim
that every outstanding task has been completed.

To try this path with fresh fictional data, use two terminals from the repo root:

```sh
# Terminal 1: sandbox backend
DATABASE_URL= PORT=3021 DEV_LOGIN_PASSWORD=test npm --prefix backend start

# Terminal 2: frontend
BACKEND_URL=http://127.0.0.1:3021 npm --prefix mertofrontend run dev -- --hostname 127.0.0.1 --port 3020
```

Open `http://127.0.0.1:3020`, sign in as `dana` / `test`, and open Maya Desai from
**Needs follow-up**. Record a simulated SMS, check the new attributed timeline
entry, reload the page, then return Home: Maya's visit reminder should be cleared.
Hannah's overdue quote promise is a useful comparison: recording an email leaves
that unresolved task visible. Restarting the sandbox backend restores these
fictional scenarios for another run.

## Reply draft review (US11)

The rep's customer page can prepare a **simulated, template-generated draft**,
show its saved customer context and recent messages, and approve, edit, or reject
it. This does not call an AI model. Approval and rejection are internal reviews,
not customer contact; only a separate simulated send records an outbound reply.

| Endpoint | Action |
| --- | --- |
| `GET /api/deals/:dealId/reply-drafts` | List saved drafts and decisions |
| `POST /api/deals/:dealId/reply-drafts` | Prepare a draft with `{ requestId, channel }` (`email` or `sms`) |
| `POST /api/reply-drafts/:draftId/review` | `{ decision: "approve" \| "edit" \| "reject", message? }`; text is required only for edits |
| `POST /api/reply-drafts/:draftId/send` | Record a simulated send of the saved approved text |

The owning rep or GM can use these endpoints. The server derives context, checks
current ownership and eligibility, and saves the decision and final text in a
`draft_review` timeline event. A reviewed draft cannot be changed; prepare another
if needed. Pending/rejected drafts cannot be sent. Send retries reuse the draft ID
and do not duplicate contact. Opt-out, stage, contact details, and eligibility are
checked again when sending. The manual US7 form remains an independent compose flow.

Apply `supabase/migrations/20261020000200_reply_drafts.sql` before running this
against an existing database. Sandbox startup loads it automatically. For a manual
check, sign in as Dana, open Maya, reject one draft, prepare another, edit and
approve it, then record the simulated send. The timeline should contain both
decisions and only one outbound follow-up; the visit reminder should clear only
after that send.

## Unresolved work (US4)

`GET /api/open-items` lists open items (promises, missing documents, unanswered
questions, callbacks) across buyers. The GM sees every
deal in the store, unassigned ones included; a rep sees items on their own deals, so
an item follows its deal when it is transferred (US8). Items on delivered or lost
deals are left out. The same items appear per deal in `GET /api/deals/:dealId`.

Optional query filters, all strictly validated (400 on a bad value):

| Filter | Values | Default |
| --- | --- | --- |
| `status` | `open`, `resolved`, `cancelled`, `all` | `open` |
| `type` | `promise`, `missing_doc`, `unanswered_question`, `callback` | any |
| `ownerId` | a staff ID, or `none` for items nobody owns | anyone |

The response has `summary` and `items`. `summary` always counts unresolved work in
scope, whatever `status` lists: `open`, `overdue`, `unowned`, `oldestCreatedAt`
(`null` when there is none), and the same counts `byType`. Each item has its `type`,
`description`, `status`, `owner`, `dueAt`, `createdAt`, `resolvedAt`, `overdue` (open
and past its due time), `ageHours` (open items only), and a `deal` with the buyer,
vehicle, stage, and deal owner. Open items come first, longest-waiting first;
resolved and cancelled ones follow, most recently closed first.

### Resolving or cancelling an item

| Method and path | Who | What it does |
| --- | --- | --- |
| `POST /api/open-items/:itemId/resolve` | GM, owning rep | The work was done. Body `{ "note"?: string }`. Sets `status: resolved` and `resolvedAt`. |
| `POST /api/open-items/:itemId/cancel` | GM, owning rep | It is no longer needed. Body `{ "note": string }` (required: say why). Sets `status: cancelled`; `resolvedAt` stays null. |

"Owning rep" means the rep who owns the item's deal, as for the overview; only the GM
can close work on an unassigned deal. Notes are at most 500 characters, line breaks
collapsed. Closing an item that is not open, or one on a delivered or lost deal, is 409.
Each close writes, in one transaction, the new status and a timeline entry (event type
`open_item`, actor the caller) such as
`Resolved promise for Hannah Clarke: Send the CR-V lease quote promised by Arjun. Note: Emailed it`.
It returns `{ id, dealId, type, description, status, resolvedAt, note, by, at, eventId }`.

The `open_item` event type (migration `20261020000100_open_item_events.sql`) keeps this
bookkeeping apart from contact with the buyer: it does not clear `unanswered_message`
(US6) or count as a human taking over for `missed_escalation` (US5). Resolving an overdue
promise or callback does clear its `overdue_commitment` follow-up reason.

## Appointment tracking and calendar (US11)

The manager and sales-rep navigation includes a **Calendar** tab at
`/manager/calendar` and `/rep/calendar`. Both pages show a month grid and an
agenda for the selected day. Choose a day and use the form to create an
appointment, or select an existing appointment to edit its date, time, status,
or notes. The manager calendar includes appointments for all deals, including
unassigned deals; a rep sees appointments only for deals they own. Customer
choices for new appointments come from that user's open-deal list, so managers
can schedule for unassigned customers and reps can schedule for their own
customers.

| Method and path | Who | What it does |
| --- | --- | --- |
| `GET /api/appointments` | GM: all; rep: own deals | All appointments, ordered by scheduled time, with customer, vehicle, and owner details. |
| `POST /api/appointments` | GM, owning rep | Creates an appointment (requested by default). Body: `{ "dealId", "scheduledFor", "status"?, "outcomeNote"? }`. |
| `PATCH /api/appointments/:appointmentId` | GM, owning rep | Updates `scheduledFor`, `status`, and `outcomeNote`. Status is `requested`, `confirmed`, `rescheduled`, `cancelled`, `completed`, or `no_show`. |

Calendar times are entered and displayed in the dealership's
`America/Toronto` time zone. The API stores `scheduledFor` as a timestamp with
time zone; send an ISO 8601 date-time with an explicit offset (for example,
`2026-11-10T10:30:00-05:00`) to avoid ambiguity. Daylight-saving transitions
can make a local time invalid or ambiguous; the calendar reports a nonexistent
local time instead of silently saving a different time. When the clock moves
back and a local time occurs twice, the calendar selects the earlier occurrence.

All appointment endpoints require the normal `X-Staff-Id` authentication.
Managers can read and edit appointments for any deal. Reps can read and edit
appointments only when their staff ID owns the associated deal; attempts to
access another rep's or an unassigned deal return 403. Creating an appointment
for an unknown deal returns 404.

`GET /api/appointments` includes every appointment regardless of status, sorted
by scheduled time, and returns `id`, `dealId`, `scheduledFor`, `status`,
`outcomeNote`, `buyer`, `vehicleInterest`, `ownerId`, and `owner`. On an
unassigned deal, `ownerId` and `owner` are null. Create and update requests
accept:

```json
{
  "dealId": "deal UUID (create only)",
  "scheduledFor": "ISO 8601 date-time with timezone",
  "status": "requested",
  "outcomeNote": "Optional note, up to 500 characters"
}
```

`POST /api/appointments` requires `dealId` and `scheduledFor`; `status`
defaults to `requested`, and `outcomeNote` is optional.
`PATCH /api/appointments/:appointmentId` requires `scheduledFor` and accepts
the same status and note fields. Send the current status when changing only the
date or note, since an omitted status defaults to `requested`. Status values are
`requested`, `confirmed`, `rescheduled`, `cancelled`, `completed`, and
`no_show`. Setting a status to `confirmed`, `completed`, or `no_show` records
the acting staff member in `confirmed_by` and the current time in
`confirmed_at`; changing to another status clears those confirmation fields.
Appointment changes are kept on the deal in the `appointments` table and
appear in the deal record returned by `GET /api/deals/:dealId`.

## Rules

Defined in [`src/evaluation/rules.ts`](src/evaluation/rules.ts); the conditions
around them are in [`src/evaluation/detect.ts`](src/evaluation/detect.ts).

| Flag | Severity | Raised on | When |
| --- | --- | --- | --- |
| `appointment_certainty` | high | AI outbound | Says a visit is settled ("you're all set", "your viewing tomorrow is arranged", "I have booked you in", "we'll be expecting you") and no appointment on the deal was confirmed by a person at or before that message. "Dana will confirm the time" is fine. |
| `unsupported_availability` | high | AI outbound | Guarantees a vehicle is there ("still here", "in stock", "on the lot", "has not been sold"); there is no inventory source to check. Offering to check is fine. |
| `unsupported_price` | high | AI outbound | States an amount: a dollar figure, "four hundred a month", "three grand", "out the door". Distances such as "forty thousand km" are not amounts. |
| `missed_escalation` | medium | The AI's next reply | The buyer asked for a person ("transfer me to a human", "can someone call me", "put me through"), and no rep/GM event (other than a flag review) or new open item followed. |
| `missed_price_handoff` | medium | The AI's next reply | The buyer asked for a price, payment, quote, or total as a question or request (not a remark like "the payment was too high"), and no open item or rep/GM event followed. The data model has no price source, so the AI should hand every price question to a person (Deal C). |
| `ignored_opt_out` | high | Any outbound | Sent at or after an opt-out on any of the buyer's deals. |
| `tone` | low | AI outbound | Pressure ("act now", "buy now"), talking down ("only a fool", "making excuses"), robotic replies ("reference number", "query logged"), or "!!". Expect false positives; the GM's reviews measure that. |

Each rule can also have `requires` (the message must also match) and `unless` (a match
cancels the rule), so look-alikes such as "let me check whether it is still
available" or "how much longer will the test drive take?" are not flagged.

One message can raise several flag types. Re-evaluating never duplicates a flag
or changes a GM decision.

## Measuring the rules

`npm run eval:rules` compares the rules with human-style labels in `test/fixtures/`:

- `eval-snippets.json`: 280 short exchanges (a buyer message and the AI's reply),
  each labelled with what a reviewer would flag. They are split into `dev` and
  `test` halves and into `easy` (plain wording) and `hard` (paraphrases, typos,
  look-alikes) cases. Tune rules on `dev` (`npm run eval:rules -- --split dev
  --errors`) and report `test`, so the rules are not fitted to the answers.
- `scenario-labels.json`: labels for every message in `supabase/seed/seed_scenarios.sql`,
  scored on the full deals so the history-based checks run too.

The script exits with an error if a snippet's `expected_flags` do not follow from
its labelled signals. Both datasets were drafted with OpenAI Codex from the prompts
in `prompts/` and checked by the team.

Results on October 13. The rules were widened using only the dev split, then the
test split was scored once:

| Dataset | Before (recall / precision) | After (recall / precision) |
| --- | --- | --- |
| Snippets, dev, easy | 44% / 93% | 100% / 97% |
| Snippets, dev, hard | 2% / 33% | 90% / 100% |
| **Snippets, test, easy** | 38% / 100% | **59% / 100%** |
| **Snippets, test, hard** | 0% / 0% | **23% / 71%** |
| Scenario deals | 30% / 73% | 96% / 96%* |

\* The scenario errors were seen before tuning, and one over-broad word ("ready")
was removed after it misfired there, so this row is optimistic.

The test rows are the honest estimate. History-based checks (`ignored_opt_out`, the
confirmation part of `appointment_certainty`) are exact, and amounts are caught
well. Rephrased booking claims, indirect availability promises, slang requests, and
judgment calls on tone still get past keywords ("Half past three goes in the diary
for you", "plz let a humen answer this one"). That remaining gap is what an LLM
layer would address. Do not keep tuning against the test split; add new examples to
dev instead.

## Code layout

| File | Responsibility |
| --- | --- |
| `src/evaluation/detect.ts` | Pure detection: one deal's conversation in, issues out. No database. |
| `src/evaluation/rules.ts` | Rule wording, severity, and explanation. |
| `src/evaluation/review-policy.ts` | Which review decisions are allowed; per-deal review status. |
| `src/evaluation/repository.ts` | All SQL. |
| `src/evaluation/service.ts` | Permissions, transactions, and responses: the action layer. |
| `src/evaluation/routes.ts` | HTTP routes. |
| `src/assignment/policy.ts` | US8 reason validation and the timeline body format. |
| `src/assignment/repository.ts` | US8 SQL: row lock, owner update, open items, `deal_assignments`, history. |
| `src/assignment/service.ts` | US8 GM-only rules, state checks, and the transaction. |
| `src/assignment/routes.ts` | US8 HTTP routes. |
| `src/deals/` | Deal lists, the buyer record, and adding a buyer (`policy.ts` validates it). |
| `src/auth-routes.ts` | Development sign-in (`/auth/login`) and `/api/me`. |
| `src/db.ts`, `src/sandbox-db.ts` | PostgreSQL connection, or the in-memory PGlite sandbox. |
| `src/follow-up/detect.ts` | US6 pure rules: one deal's activity and `now` in, reasons and suppressions out. No database. |
| `src/follow-up/rules.ts` | US6 reason codes, kinds, and thresholds. |
| `src/follow-up/repository.ts` | US6 SQL: open deals and their activity, loaded in bulk. |
| `src/follow-up/service.ts`, `routes.ts` | US6 permissions (rep: own; GM: all), ordering, and HTTP routes. |
| `src/open-items/` | US4 unresolved work: `policy.ts` (filters, close notes), `repository.ts` (SQL), `service.ts` (permissions, summary, resolve/cancel), `routes.ts`. |
| `scripts/eval-rules.ts` | Scores the rules against `test/fixtures/`. |

## Limits

Follow-ups (US6): times are wall-clock hours; there are no business hours, so a
message at 11 pm is due at 3 am. Quotes are recognised by wording, so a quote sent
as a note or an attachment-only email can be missed. A cancellation has no recorded
time, so a cancelled visit is measured from the time it was set for. `gone_quiet`
asks for one check-in per silence; a cadence (day 45, then day 90) needs US7's
schedule. US7 currently records immediate simulated follow-ups; real sending,
future scheduling, skipping, and pausing are not implemented.

Assignments made before `deal_assignments` existed (the scenario seed's history and
Jordan's) are text only. Assignment is per deal: a buyer with two deals is moved one
deal at a time. Nothing checks that a rep is on shift: `staff_users` has no
availability field. `X-Staff-Id` and the shared sign-in password are not real authentication. An LLM judge, per-run scorecards, and
messaging endpoints are not implemented. The demo writes the AI's message to Rob
directly into the database for that reason.
