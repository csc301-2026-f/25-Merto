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

- Backend: `DATABASE_URL`, `DEV_LOGIN_PASSWORD`, `GROQ_API_KEY`, and, when the
  model service is deployed, `MERTO_MODEL_URL` and `MERTO_MODEL_TOKEN`.
- Frontend: `BACKEND_URL` (the deployed backend's address), and
  `BACKEND_PROTECTION_BYPASS` if the backend has Deployment Protection on.
- Model service: `MERTO_MODEL_TOKEN` and `VERCEL_SUPPORT_LARGE_FUNCTIONS=1`.

### How a change reaches production

Vercel's free plan cannot deploy from an organization repository, so the Vercel
projects are on a team member's personal account and deploy from the fork
[jasonnn404/25-Merto](https://github.com/jasonnn404/25-Merto). The
[`sync-fork.yml`](.github/workflows/sync-fork.yml) workflow runs on the fork
every 15 minutes, copies the latest `main` from this repository, and Vercel
deploys each new commit. A merge to `main` is therefore live within about 15
minutes plus the build time.

GitHub's built-in token cannot sync commits that change files in
`.github/workflows/`. After such a change is merged, the fork owner has to click
**Sync fork** on GitHub once.

Database migrations are not applied by any workflow. Apply new files in
`supabase/migrations` to the hosted database by hand, following
[hosted database setup](supabase/HOSTED_INTEGRATION.md).

## Continuous integration

### `ci.yml`

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request
and every push to `main`. It has three jobs that run at the same time:

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

Runs only on the fork, not in this repository. See
[How a change reaches production](#how-a-change-reaches-production).

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
