# Repeatable database tests

From the repository root, using Node.js 20 or newer:

```sh
npm --prefix supabase/tests ci
npm --prefix supabase/tests test
```

The test package is isolated in this directory so it does not prescribe the
frontend/backend package setup. Commit `package-lock.json` with the test files.

Tests run the real migration files (in filename order), the real seed, and the
real demo queries in a fresh in-memory PostgreSQL instance using PGlite. Each test
gets its own database. They require no Supabase account, password, Docker, or paid
API key and never connect to or modify the hosted demo.

Coverage includes repeatable seeding, the six demo queries, closed-deal filtering,
transfer history/task ownership/rollback, failed-transaction rollback, invalid
references and statuses, human event attribution, appointment confirmation,
task resolution, cross-deal opt-out detection, and the current API access boundary.
The evaluation-storage checks cover successful evaluation/flag insertion, unique
evaluations/flags, different flag types on one message, evidence belonging to the
same deal, pending flags with invalid review metadata, reviewed flags missing a
reviewer or timestamp, allowed values, failed-write rollback, and repeatable
loading of every scenario seed. There are currently 24 tests. Rejected writes are
checked for PostgreSQL error codes: `23505` (unique), `23503` (foreign key), and
`23514` (check constraint).

## Limits

These are PostgreSQL schema and query tests. They do not simulate the full Supabase
platform, Auth, REST API, frontend, or Rep/GM policies. The two API roles are created
locally to check grants and row-level security. Changes involving Supabase-specific
services or extensions also need validation against a local or development Supabase
instance. Appointment checks validate stored confirmation metadata; they do not
enforce the order of earlier state transitions. Opt-out checks detect violations;
they do not block writes or send messages.
