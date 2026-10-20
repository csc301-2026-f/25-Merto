# Supabase database prototype

This is a small prototype for one fictional dealership. The base seed has
3 staff, 4 buyers/deals, 10 timeline events, 2 appointments, and 4 tasks.
Hannah's history shows a transfer from Arjun to Dana without losing his notes.
The evaluation seed expands it to 8 buyers/deals; the hosted integration check
adds one clearly fictional fixture. See [hosted integration](../HOSTED_INTEGRATION.md).

## Database development

- [Data contract](../DATA_CONTRACT.md): fields, relationships, states, query results,
  and integration decisions for the backend team.
- [Repeatable tests](../tests/README.md): run the real SQL in isolated PostgreSQL
  instances without touching the hosted demo.

## Hosted demo

The migration and seed were applied to the **Merto** demo project on October 6, 2026.
The evaluation migration and seed were applied on October 13, 2026. The backend
evaluation/review workflow has been checked against this database, including
persistence across backend server/connection restart. `evaluation.sql` inspects
saved evaluations, manager reviews, and the check's timeline.

- [SQL Editor](https://supabase.com/dashboard/project/mkgzhzdchczmqmoggzkt/sql)
- [Table Editor](https://supabase.com/dashboard/project/mkgzhzdchczmqmoggzkt/editor)
- [Schema visualization](https://supabase.com/dashboard/project/mkgzhzdchczmqmoggzkt/database/schemas)

Do not rerun the table-creation migration in this project. The setup instructions
below are for a fresh database.

## Set up a fresh database using Supabase SQL Editor

In your team's Supabase development project:

1. Open **SQL Editor** and run the contents of
   `supabase/migrations/20261006000100_mvp_database.sql` once.
2. Run `supabase/migrations/20261013000100_ai_evaluation.sql` once, then
   `supabase/migrations/20261017000100_deal_assignments.sql` once.
3. Run `supabase/seed/seed.sql`, then `supabase/seed/seed_ai_evaluation.sql`, then
   `supabase/seed/seed_deal_assignments.sql`.
4. Run each query in `supabase/demo/queries.sql` separately and show its results.
5. Optionally run the entire `supabase/demo/transfer.sql` file to show an atomic
   ownership transfer with preserved history. It rolls back after displaying the
   result, so you can run it again.

The migration creates tables and is not intended to be rerun on existing tables.
The seed can be rerun without duplicating records; it does not reset edited rows.
SQL Editor applies SQL directly; it does not record a CLI migration as applied.
Before later adopting CLI deployment for that project, reconcile migration history
or use a fresh development project to avoid attempting to create the tables twice.

## Local alternative

If you have the Supabase CLI and Docker installed, from the repository root:

```sh
supabase start
supabase db reset
```

`db reset` recreates the local database and loads `supabase/seed/*.sql`; it removes
local database edits. Open local Studio at `http://127.0.0.1:54323` and use its SQL
Editor to run the demo queries. No Merto credentials or paid AI key is needed.

## Current boundary

This does not yet implement Supabase Auth logins, Rep/GM access policies, automatic
audit logging, follow-up scheduling, LLM-based conversation
scoring, uploads, or F&I/delivery records. The backend implements rule-based
evaluation and GM-only transfers using a development identity header. Row level
security is enabled and `anon`/`authenticated` table access is revoked, so the demo
is accessible through SQL Editor and the privileged backend connection rather than the browser Data API.
Add and test authentication and authorization before connecting a frontend.

The transfer file demonstrates a transaction, not an application endpoint. The
production action layer should enforce permissions and write ownership, task, audit,
and timeline changes together. This prototype is intentionally smaller than the
full October 5 project brief.
