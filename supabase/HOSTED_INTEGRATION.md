# Shared Supabase database integration

The Merto demo project is `mkgzhzdchczmqmoggzkt`. SQL files in Git do not deploy
themselves. Hosted schema changes must be applied explicitly.

## Applied schema

On October 13, 2026, the existing backend team's evaluation migration and scenario
seed were applied through Supabase SQL Editor, on top of the October 6 core schema:

| Migration | Purpose |
| --- | --- |
| `20261006000100_mvp_database.sql` | Six core staff/buyer/deal/history/appointment/task tables |
| `20261013000100_ai_evaluation.sql` | Evaluation results, evidence-backed flags, review metadata, and evaluation/review timeline event types |
| `20261017000100_deal_assignments.sql` | Structured assignment/transfer history; applied October 20, 2026 |
| `20261020000200_reply_drafts.sql` | Stored reply drafts, context, decisions, and timeline links; applied October 20, 2026 |
| `20261020000100_open_item_events.sql` | `open_item` timeline event type for resolving/cancelling open items (US4); **not yet applied** to the hosted project. Until it is, `POST /api/open-items/:id/resolve` and `/cancel` fail there with a check-constraint error |

The reply-draft migration was originally applied as `20261020000100_reply_drafts.sql`.
It was renumbered to `20261020000200_reply_drafts.sql` when integrating US4 to
avoid a duplicate migration version. Both October 20 migrations now preserve
`open_item` and `draft_review` in the timeline constraint. Do not rerun the
reply-draft table creation on the hosted project.

Both `seed/seed.sql` and `seed/seed_ai_evaluation.sql` are loaded. Together they
provide 3 staff, 8 buyers/deals, 28 timeline events, 3 appointments, and 5 tasks
before any application activity. The integration check additionally retains one
fictional buyer/deal, one evidence event, one evaluation, one flag, and two history
entries. It does not reset or overwrite the other sample scenarios.

Do not rerun these table-creation migrations against this project. These were
applied manually and do not populate the Supabase CLI migration ledger. Before
using CLI deployment, reconcile migration history against the actual schema or
use a fresh development project. Do not use `db reset` against the shared project.

### October 20 update: assignments and user-story scenarios

The missing `20261017000100_deal_assignments.sql` migration was applied using the
existing server-side PostgreSQL connection. `seed/seed_deal_assignments.sql` and
`seed/seed_scenarios.sql` were then loaded in the same transaction. The first adds
structured history for Hannah's existing transfer; the second adds Sofia and Tom
plus fictional scenario variants for the backend's buyer records, follow-ups,
unresolved work, and evaluation features.

The migration and both new seeds passed the local database suite before deployment.
A before/after comparison verified every pre-existing record was unchanged. Both
new seeds were rerun and verified to leave all records and timestamps unchanged.
The update did not reset the database or rerun the older migrations.

Current hosted counts immediately after the update (including the retained
integration-check fixture):

| Table | Rows |
| --- | ---: |
| `staff_users` | 5 |
| `buyers` | 37 |
| `deals` | 38 |
| `timeline_events` | 222 |
| `appointments` | 20 |
| `open_items` | 16 |
| `ai_evaluations` | 1 |
| `ai_flags` | 1 |
| `deal_assignments` | 1 |
| `reply_drafts` | 0 |

Counts grow as the application is used. A fresh load of all repository seeds has
36 buyers, 37 deals, and 219 timeline events; the extra buyer/deal and three events
above belong to the earlier hosted integration check. Evaluation scenarios contain
conversation inputs; they do not precompute evaluation results or manager reviews.

All ten application tables were checked to have RLS enabled with no SELECT
grants for `anon` or `authenticated`. The backend still connects using the
privileged server-side PostgreSQL connection.

For a fresh database, apply all migrations in filename order, followed by all
seed files in filename order. Local `supabase db reset` does this automatically.

## Server connection

From the repository root:

```sh
npm --prefix backend ci
```

Create `backend/.env` using the connection URL from the project's **Connect →
Direct → Session pooler** dialog when using IPv4. Replace the password placeholder
locally and percent-encode special characters in the password. The file is ignored
by Git. Never put this URL in frontend code or a committed document.

The connection must verify TLS. Add the following parameters to the URL:

```text
?sslmode=verify-full&sslrootcert=certs/supabase-ca.crt
```

`backend/certs/supabase-ca.crt` is a public CA certificate downloaded from the
project dashboard's **Database → Settings → SSL configuration** download link.
It is not a password or a private key. Replace it from that same dashboard if
Supabase rotates its CA. The relative path assumes commands run from `backend`,
as npm does with `--prefix backend`. Use an absolute certificate path if running
the backend from another working directory.

This follows [Supabase's certificate verification guidance](https://supabase.com/docs/guides/platform/ssl-enforcement).
Certificate verification is enabled; no `rejectUnauthorized: false` bypass is used.

## Repeatable hosted workflow check

```sh
npm --prefix backend run check:hosted
```

The check uses the real PostgreSQL connection and existing HTTP routes to:

1. Create/reuse a clearly fictional `Integration Check Buyer` deal with an AI
   message claiming an appointment is booked when no human confirmed it.
2. Evaluate that deal and save an `appointment_certainty` flag.
3. Record Karen's `confirmed_issue` review and the matching timeline entry.
4. Close the backend HTTP server and database pool, create fresh instances, and
   verify the same saved evaluation, flag, review note, and history are returned.
5. Re-evaluate without duplicating flags/history or overwriting the review.
6. Verify the hosted constraints reject duplicate flags, inconsistent review
   metadata, and evidence from another deal. Invalid-write checks use savepoints
   and leave the fixture unchanged.

The fixture deal ID is `39000000-0000-0000-0000-000000000001`. Subsequent checks
reuse it. If someone manually changes its review, the check fails rather than
overwrite that decision. It never falls back to an in-memory database.

Inspect saved data in [Table Editor](https://supabase.com/dashboard/project/mkgzhzdchczmqmoggzkt/editor)
or run the read-only SQL in `demo/evaluation.sql`.

## Validation and remaining boundary

The original evaluation/review persistence workflow was verified on October 13,
2026. On October 20, all 27 current database tests and the backend TypeScript check
passed. Hosted checks covered the rep list, structured assignment history, buyer
record, unresolved-work overview, follow-up list, and cross-deal opt-out
suppression. A transfer with structured history and moved tasks was exercised
inside a transaction and rolled back, leaving the seeded deal unchanged.
Local database tests remain isolated from the hosted database.

US7's immediate simulated follow-up action was also checked against hosted
Supabase on October 20: it recorded an attributed timeline event, recalculated
the due status, and returned the same event for a repeated request. This check
ran inside a transaction that was rolled back, so no follow-up was left on the
shared sample buyer. The action uses the existing timeline table and needs no
additional hosted migration.

US11's reply-draft migration was applied on October 20. The new table has RLS
enabled with browser-role access revoked. Hosted verification prepared drafts,
saved an edited approval, rejected another draft, blocked sending that rejection,
and recorded the approved reply through US7 with retry deduplication. All test
drafts, review events, and follow-up messages were rolled back; pre-existing
records were unchanged. No seed script or manual setup is needed for this feature.

This verifies database-backed backend functionality, not frontend integration or
real login security. The backend still accepts a development `X-Staff-Id` header;
Supabase Auth mapping and verified session identity remain separate work. RLS is
enabled on all ten tables and browser API roles have no table grants. The
privileged server-side PostgreSQL connection relies on backend permission checks.

The evaluation API, migration, and additional scenarios were supplied by the
backend team. This integration work adds hosted verification, database constraint
tests, and setup documentation. OpenAI Codex assisted with those additions.
