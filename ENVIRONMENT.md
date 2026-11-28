# Environment

How to set up Merto on your own machine, which settings each part reads, how the
app is deployed, and how to run the same checks as the CI workflows before you push.

## Requirements

- Node.js 20 or newer (CI uses Node.js 20). Check with `node -v`.
- npm, which comes with Node.js.
- Git.
- Optional: Python 3.12, only if you run the MPNet model service locally. Docker is
  only needed to reproduce the model deployment check.

No Docker, Supabase account, or API key is needed to run the app or the tests
locally. Two features need extra setup: AI reply generation needs a Groq API key,
and the MPNet evaluator needs the model service (see
[Environment variables](#environment-variables)).

## Project layout

The repository has three separate npm packages and one Python service. Each npm
package has its own `package.json` and `package-lock.json`, so install and run
each one in its own folder.

| Folder | What it is | Local port |
| --- | --- | --- |
| `backend/` | TypeScript/Express REST API | 3001 |
| `mertofrontend/` | Next.js frontend | 3000 |
| `supabase/tests/` | Tests for the database migrations and seed | none |
| `model-service/` | Python 3.12 MPNet evaluator, deployed separately (optional) | 3086 with `npm run demo:model` |

## Run the app

In one terminal:

```sh
cd backend
npm ci
npm run dev
```

In a second terminal:

```sh
cd mertofrontend
npm ci
npm run dev
```

Open http://localhost:3000 and sign in as `karen` (manager) or `dana`, `arjun`,
`sofia`, or `tom` (sales representatives). The password is `test`.

`npm ci` installs the exact versions in `package-lock.json`. Use `npm install`
only when you are adding or upgrading a package, and commit the updated
`package-lock.json` with your change.

### Run with the MPNet model (optional)

To try the MPNet evaluator locally, set up the Python environment once as described
in the [model service README](model-service/README.md), then run
`npm run demo:model` in `backend/`. It starts the model service, the backend, and
the frontend together. See the [local CRM demo](backend/ml/LOCAL_CRM_DEMO.md).

## Environment variables

None are required for local development. Without them, the backend starts an
in-memory PostgreSQL database built from `supabase/migrations` and
`supabase/seed`, and its data resets every time the backend restarts.

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and fill in only what you need.
`.env` is ignored by Git; never commit a real database URL, password, or key.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | unset (in-memory database) | Connection string for the team's Supabase database. See the [backend README](backend/README.md) for the TLS options to add. |
| `PORT` | `3001` | Port the API listens on. |
| `DEV_LOGIN_PASSWORD` | `test` with the in-memory database; sign-in is off with a real database unless this is set | Shared password for the development sign-in. This is not real authentication. |
| `GROQ_API_KEY` | unset | Server-only key for AI reply generation. Without it, **Generate reply** shows a setup error (503); the rest of the app works. Create one at [Groq Console](https://console.groq.com/keys). |
| `GROQ_MODEL` | `openai/gpt-oss-20b` | Optional Groq model override. It must support chat completions with `reasoning_effort`. |
| `DEALERSHIP_TIME_ZONE` | `America/Toronto` | IANA time zone used by backend appointment metrics and scenario scheduling. Set the same value as the frontend setting. |
| `MERTO_MODEL_URL` | unset (deterministic rules only) | HTTPS origin of the MPNet model service, with no path. With this and `MERTO_MODEL_TOKEN` set, **AI Review** offers both Deterministic and MPNet. |
| `MERTO_MODEL_TOKEN` | unset | Shared secret for the model service. It must match the model service's own `MERTO_MODEL_TOKEN`. |

`npm run demo:model` also reads `MERTO_DEMO_FRONTEND_PORT`, `MERTO_DEMO_API_PORT`,
`MERTO_DEMO_MODEL_PORT` (defaults 3000, 3001, 3086), and `MERTO_DEMO_PYTHON`, if
the default ports are taken or Python is somewhere else.

Never put any of these in frontend code or in a `NEXT_PUBLIC_` variable.

### Frontend

| Variable | Default | Purpose |
| --- | --- | --- |
| `BACKEND_URL` | `http://localhost:3001` | Where the frontend sends its server-side requests to the backend. |
| `BACKEND_PROTECTION_BYPASS` | unset | Only for deployments where the backend has Vercel Deployment Protection on. Sent as the `x-vercel-protection-bypass` header. |
| `NEXT_PUBLIC_DEALERSHIP_TIME_ZONE` | `America/Toronto` | IANA time zone used to enter and display dealership dates. Keep it aligned with backend `DEALERSHIP_TIME_ZONE`. |

Set them only if you need to, for example
`BACKEND_URL=http://localhost:4000 npm run dev`, or put them in
`mertofrontend/.env.local`, which Git also ignores.

### Model service

| Variable | Purpose |
| --- | --- |
| `MERTO_MODEL_TOKEN` | Bearer token that every request must send. Set the same value on the backend. |
| `VERCEL_SUPPORT_LARGE_FUNCTIONS` | Set to `1` on Vercel; the weights and PyTorch exceed the standard function size. |

## Deployed app

The app runs as separate Vercel projects plus a hosted Supabase database:

| Part | Vercel project | URL |
| --- | --- | --- |
| Frontend (`mertofrontend/`) | `25-merto` | https://25-merto.vercel.app |
| Backend (`backend/`) | `25-merto-backend` | https://25-merto-backend.vercel.app (`/health`) |
| Model service (`model-service/`) | separate project, see the [model service README](model-service/README.md) | |

Each project's variables are set in its Vercel settings, not in files in the
repository:

- Backend: `DATABASE_URL`, `DEV_LOGIN_PASSWORD`, `DEALERSHIP_TIME_ZONE`, `GROQ_API_KEY`, and, when the
  model service is deployed, `MERTO_MODEL_URL` and `MERTO_MODEL_TOKEN`.
- Frontend: `BACKEND_URL` (the deployed backend's address),
  `NEXT_PUBLIC_DEALERSHIP_TIME_ZONE` (matching backend setting), and
  `BACKEND_PROTECTION_BYPASS` if the backend has Deployment Protection on.
- Model service: `MERTO_MODEL_TOKEN` and `VERCEL_SUPPORT_LARGE_FUNCTIONS=1`.

### How changes reach Vercel

Vercel's free plan cannot deploy from an organization repository, so the Vercel
projects are on a team member's personal account and deploy from the fork
[jasonnn404/25-Merto](https://github.com/jasonnn404/25-Merto). The
[`sync-fork.yml`](.github/workflows/sync-fork.yml) workflow runs on the fork and
syncs `main` to `main` and `dev` to `dev`. Vercel deploys updates to `main` as
Production and updates to `dev` as Preview. The workflow is scheduled every
15 minutes. GitHub can delay scheduled jobs, and Vercel adds build time. The
fork owner can also run **Sync fork from org repo** from the fork's Actions tab.

GitHub's built-in token cannot sync commits that change files in
`.github/workflows/`. After such a change is merged, the fork owner has to sync
the affected branch manually once. The scheduled workflow runs from the fork's
default branch, `main`.

### Development deployment

Open feature pull requests into `dev`. After review and passing CI, merge and
verify the result on Preview. To release, open a `dev` → `main` pull request and
use a merge commit after review and passing CI. If a hotfix goes directly to
`main`, merge `main` back into `dev` through a pull request.

| Part | Vercel `dev` branch URL |
| --- | --- |
| Frontend | [Dev sign-in](https://merto-d4.vercel.app/login) |
| Backend | [Dev health endpoint](https://25-merto-backend-git-dev-jasonnn404s-projects.vercel.app/health) |

Vercel Authentication protects both branch URLs. For course review, send the
TA the frontend's Vercel Shareable Link and dev demo credentials privately.
The Shareable Link opens the Merto sign-in page without a Vercel account. The
TA then signs in with the dev demo credentials. Keep the Shareable Link and
password out of the public repository.

To set up or restore the environment:

1. Provision a separate Supabase project for development. Apply the files in
   `supabase/migrations` in filename order, followed by the fictional data in
   `supabase/seed` in filename order. Keep the existing production database URL
   and frontend backend URL scoped to Production.
2. Ensure `dev` exists in the team repository and Jason’s fork. For a new fork,
   create its `dev` branch from the upstream `dev` commit. Vercel needs to see
   that branch before saving branch-scoped variables.
3. On the backend, scope `DATABASE_URL` and a separate `DEV_LOGIN_PASSWORD` to
   the `dev` Preview branch. Use the dev Supabase connection URL and a dev demo
   password. Set a Preview `GROQ_API_KEY` for reply generation and match
   `DEALERSHIP_TIME_ZONE` with the frontend’s `NEXT_PUBLIC_DEALERSHIP_TIME_ZONE`
   if overriding the default `America/Toronto`.
4. On the frontend, set `BACKEND_URL` to the dev backend origin. If the backend
   has Deployment Protection, set the frontend’s server-side
   `BACKEND_PROTECTION_BYPASS` to the backend’s automation bypass secret. Scope
   both to the `dev` Preview branch.
5. Merge a follow-up change into the team's `dev` branch. Verify the fork sync
   and both Preview deployments pick up the same commit. Check `/health`, sign
   in, open a seeded deal, and verify the TA’s Shareable Link in a signed-out
   browser. Apply any new migrations to the dev database before deploying code
   that depends on them.

### Production database rollout

Database migrations are not applied by any workflow. Apply new files in
`supabase/migrations` to the hosted database by hand, following
[hosted database setup](supabase/HOSTED_INTEGRATION.md).

For the flag resolution rollout on the shared database:

1. Before merging the backend change, apply
   [the nullable resolution columns](supabase/migrations/20261123000100_flag_resolution.sql).
2. Merge the backend change and verify that Vercel is serving it.
3. Apply
   [the resolution backfill and checks](supabase/migrations/20261123000200_enforce_flag_resolution.sql)
   after the new backend is live. This fills in resolutions recorded by the previous
   backend and preserves resolution metadata already written by the new backend.

## Continuous integration

### `ci.yml`

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request
and every push to `main` or `dev`. It has three jobs that run at the same time:

| Job | Commands |
| --- | --- |
| Backend | `npm ci`, `npm run typecheck`, `npm test` in `backend/` |
| Frontend | `npm ci`, `npm run lint`, `npm run build` in `mertofrontend/` |
| Database | `npm ci`, `npm test` in `supabase/tests/` |

The results appear at the bottom of the pull request and in the repository's
**Actions** tab. CI uses no secrets and never connects to the hosted database.

Each job has a 10-minute timeout. All of them normally finish in about a minute,
so a job that reaches 10 minutes is almost certainly stuck (for example, a test
that never ends) and is stopped and marked as failed. A newer push to the same
branch cancels the run that is still in progress.

### `model-deployment.yml`

[`.github/workflows/model-deployment.yml`](.github/workflows/model-deployment.yml)
runs only on pull requests that change `model-service/`,
`backend/src/evaluation/`, or the workflow itself, and can also be started by hand
from the **Actions** tab. It builds the model service's Docker image, runs it with
a hard 2 GiB memory limit on one CPU, and checks its predictions against the frozen
test set. It has a 20-minute timeout and uploads a verification report as a run
artifact. It uses a placeholder token, not a real secret.

### `sync-fork.yml`

Runs only on the fork. See [How changes reach Vercel](#how-changes-reach-vercel).

### Run the CI checks locally

Run these from the repository root before you open a pull request:

```sh
(cd backend && npm ci && npm run typecheck && npm test)
(cd mertofrontend && npm ci && npm run lint && npm run build)
(cd supabase/tests && npm ci && npm test)
```

If you changed `model-service/`, you can also build the same image as the model
workflow with `docker build -t merto-mpnet model-service`, or run the local checks
in the [model service README](model-service/README.md).

If a check passes locally but fails in CI, first check your Node.js version, then
make sure `package-lock.json` is committed and matches `package.json`.
