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

Both `seed/seed.sql` and `seed/seed_ai_evaluation.sql` are loaded. Together they
provide 3 staff, 8 buyers/deals, 28 timeline events, 3 appointments, and 5 tasks
before any application activity. The integration check additionally retains one
fictional buyer/deal, one evidence event, one evaluation, one flag, and two history
entries. It does not reset or overwrite the other sample scenarios.

Do not rerun either table-creation migration against this project. These were
applied manually and do not populate the Supabase CLI migration ledger. Before
using CLI deployment, reconcile migration history against the actual schema or
use a fresh development project. Do not use `db reset` against the shared project.

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

The hosted workflow was verified on October 13, 2026. The local database suite
contains 19 tests, and the backend suite contains 41 tests; both pass, as does
TypeScript checking. Local suites remain isolated from the hosted database.

This verifies database-backed backend functionality, not frontend integration or
real login security. The backend still accepts a development `X-Staff-Id` header;
Supabase Auth mapping and verified session identity remain separate work. RLS is
enabled on all eight tables and browser API roles have no table grants. The
privileged server-side PostgreSQL connection relies on backend permission checks.

The evaluation API, migration, and additional scenarios were supplied by the
backend team. This integration work adds hosted verification, database constraint
tests, and setup documentation. OpenAI Codex assisted with those additions.
