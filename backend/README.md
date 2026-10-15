# Merto backend: evaluation and assignment

A TypeScript/Express REST API for US5 (evaluate AI conversations), US8 (assign or
transfer a buyer, see below), and the deterministic checks required by section 10 of the Merto brief, including its
example that an open item is created when the buyer asks for a price. It reads the
database team's tables (see [`supabase/DATA_CONTRACT.md`](../supabase/DATA_CONTRACT.md))
and stores results in `ai_evaluations` and `ai_flags`. No paid AI key is used:
deterministic rules decide what to flag, and a GM makes the final call.

## Run it

Requires Node.js 20 or newer. From this folder:

```sh
npm install
npm run demo    # walks through the whole flow over HTTP and prints each step
npm test        # rule unit tests + API tests
npm run dev     # API on http://localhost:3001
```

Without `DATABASE_URL`, the server, demo, and tests use an in-memory sandbox
loaded from `supabase/migrations` and `supabase/seed`, the same steps as
`supabase db reset`. Nothing is sent anywhere, and the sandbox resets on restart.
To use the team's Supabase database, copy `.env.example` to `.env` and set
`DATABASE_URL` to its server-side connection string. That database must already
have both migrations applied. Never commit `.env`.

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

## Endpoints

All responses are JSON. Errors are `{ "error": "..." }` with 400 (bad input),
401 (unknown caller), 403 (role not allowed), 404, or 409 (review not allowed
from the flag's current status).

| Method and path | Who | What it does |
| --- | --- | --- |
| `POST /api/evaluations/run` | GM | Nightly job: evaluates every deal with AI activity. Returns `buyer`, `dealId`, `result`, `evaluatedAt`, `newFlags` per deal. Safe to rerun. |
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

Only a GM can assign or transfer. The database is not changed: who and when come
from the timeline event's `actor_id` and `created_at`; from, to, and why are in its
`body` (`Assigned Nina Shah to Dana Kowalski: <reason>` or
`Transferred Hannah Clarke from Arjun Mehta to Dana Kowalski: <reason>`).

| Method and path | Who | What it does |
| --- | --- | --- |
| `GET /api/deals/unassigned` | GM | Open deals with no owner, oldest first. |
| `POST /api/deals/:dealId/assign` | GM | Body `{ "toUserId", "reason" }`. Only for an unassigned deal. Moves a `new` deal to `assigned`. |
| `POST /api/deals/:dealId/transfer` | GM | Same body. Only for an assigned deal. |
| `GET /api/deals/:dealId/assignments` | GM, owning rep | Current owner and every assignment/transfer event. |

Rules: `reason` is required (max 500 characters, line breaks collapsed). The target
must be an existing staff member with role `rep` (400 for a GM, 404 if unknown).
Assigning an owned deal, transferring an unassigned one, transferring to the current
owner, and reassigning a delivered or lost deal are all 409. Open items move to the
new owner in the same transaction; resolved ones keep theirs. Events, appointments,
and the timeline stay on the deal. Two simultaneous changes to one deal are
serialised by a row lock, so only one succeeds.

## Rules

Defined in [`src/evaluation/rules.ts`](src/evaluation/rules.ts); the conditions
around them are in [`src/evaluation/detect.ts`](src/evaluation/detect.ts).

| Flag | Severity | Raised on | When |
| --- | --- | --- | --- |
| `appointment_certainty` | high | AI outbound | Says the visit is booked ("you're all set", "see you then") and no appointment on the deal was confirmed by a person at or before that message. |
| `unsupported_availability` | high | AI outbound | Guarantees a vehicle is there ("definitely here", "in stock"); there is no inventory source to check. |
| `unsupported_price` | high | AI outbound | Contains a dollar amount, a per-month figure, or "out the door". |
| `missed_escalation` | medium | The AI's next reply | The buyer asked for a person, and no rep/GM event (other than a flag review) or new open item followed. |
| `missed_price_handoff` | medium | The AI's next reply | The buyer asked a question about price ("how much", "payment", "out the door", "quote" with a `?`), and no open item or rep/GM event followed. The data model has no price source, so the AI should hand every price question to a person (Deal C). |
| `ignored_opt_out` | high | Any outbound | Sent at or after an opt-out on any of the buyer's deals. |
| `tone` | low | AI outbound | "Hurry", "act now", "last chance", "!!" and similar. Expect false positives; the GM's reviews measure that. |

One message can raise several flag types. Re-evaluating never duplicates a flag
or changes a GM decision.

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
| `src/assignment/repository.ts` | US8 SQL: row lock, owner update, open items, history. |
| `src/assignment/service.ts` | US8 GM-only rules, state checks, and the transaction. |
| `src/assignment/routes.ts` | US8 HTTP routes. |
| `src/db.ts`, `src/sandbox-db.ts` | PostgreSQL connection, or the in-memory PGlite sandbox. |

## Limits

Assignment history is free text in the timeline until the database has a structured
assignment table, so it cannot be queried by from/to/reason. Nothing checks that a
rep is on shift: `staff_users` has no availability field. `X-Staff-Id` is not real authentication. An LLM judge, per-run scorecards, and
messaging endpoints are not implemented. The demo writes the AI's message to Rob
directly into the database for that reason.
