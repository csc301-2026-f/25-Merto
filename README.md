# Merto — CSC301 Team 25

## Partner Intro

Merto works at the infrastructure layer of automotive sales. Its goal is to maintain a shared buyer and deal history, including trade-ins, appointments, and promises, that can be accessed by the stakeholders involved in a sale.

| Name | Title | Point of contact | Email |
| --- | --- | --- | --- |
| Muneeb | Development team lead | Primary | admin@merto.ai |
| Oliver | Development team lead | Secondary | |

## Description about the project

The project is a standalone application that Merto plans to integrate into its product later. It helps dealership staff coordinate around the same buyer, review the AI's conversations with buyers, and find customers who need follow-up. The work was prioritized in this order: the manager/CRM dashboard, conversation evaluation, and the follow-up system.

The target users are dealership sales managers, salespeople and Business Development Centre (BDC) representatives, and finance managers. Sales managers are the primary users. The application aims to reduce information lost during buyer handoffs and give managers visibility into AI conversations and missed follow-ups.

This README describes the current version. The original scope is recorded in the [D1 project plan](deliverables/D1/planning.md).

## Key Features

1. **Manager/CRM dashboard:** Managers see store sales outcomes, deals that need attention, and AI flags waiting for review. They can search and sort all deals, create customers, assign or transfer ownership with a reason, and open a buyer's full record.
2. **Conversation evaluation:** Managers evaluate stored AI conversations with deterministic rules or the trained MPNet model, review each flag (confirm it, resolve it, or mark it a false positive with a reason), and flag AI replies the evaluator missed. Metrics are kept separately for each method.
3. **Learning from manager reviews:** Manager reviews become training labels for the MPNet classifier, with a second-opinion step and a quality gate before a retrained model is used. The hosted site replays a recorded run of this loop.
4. **Follow-up actions:** Representatives see which customers need follow-up and why, then record a simulated email, SMS, or call. Opted-out customers and others who should not be contacted are excluded.
5. **Reply draft review:** Representatives generate an AI reply through Groq from the customer's context, then approve, edit, or reject it before recording it as a simulated follow-up.
6. **Tasks:** Staff add tasks with optional due dates to a deal. Representatives see their open and overdue tasks on their home page and on a Tasks page.
7. **Sales statistics:** Managers see store-wide and per-representative sold/lost outcomes. Representatives see their own closed deals, filtered by outcome, with loss reasons.
8. **Appointment calendar:** Managers and representatives manage appointments in a calendar. Representatives see visit requests to confirm and visit outcomes to record.
9. **Scenario checks:** Managers run predefined dealership scenarios against an agent and read a scorecard of which store rules it followed or broke. Each run is reset, so nothing is saved.

[Dashboard prototype (Figma Make)](https://www.figma.com/make/h6Sdmrc6AsJxeOVEOwmGn5/Manager-Analytics-Dashboard--Copy-?fullscreen=1)

The planned data source is a scoped API provided by Merto. The application does not connect to a Merto API yet: it uses the team's own database schema (`supabase/migrations`) and fictional buyer, deal, and conversation scenarios (`supabase/seed`).

## Deployed Application / Access Instructions

Open [Merto](https://25-merto.vercel.app/login) in a browser. No local installation is required. A development copy that runs the `dev` branch is listed under [Deployment and GitHub Workflow](#deployment-and-github-workflow).

Demo usernames are `karen` (General Manager) and `dana`, `arjun`, `sofia`, or `tom` (sales representatives). The demo password is `test`. Click **Sign out** to switch accounts.

The application uses fictional customer and deal data. Changes to the hosted database are shared between demo users, so a customer may already have been updated by another tester.

### Manager home and deals

1. Sign in as `karen`. **Home** shows **Store sales outcomes**, **Deals Need Attention**, and **Flags Awaiting Review**.
2. Open **Deal details** in the sidebar. It lists every deal with its owner or **Unassigned**. Use the search bar to find a customer, vehicle, or representative, and sort by deal age.
3. Click a deal to expand it, then click **View Full Record** to open the buyer record: customer details, tasks, ownership history, open items, appointments, the conversation timeline, and the deal's AI review.

### Review unresolved work (US4)

1. Sign in as `karen`. On **Home**, find **Deals Need Attention**. It shows how many items are open, how many are overdue, how many have no owner, and when the oldest was opened.
2. Items are listed longest-waiting first, with **overdue** and **no owner** labels. Click an item to open its buyer record.
3. In **Open Items** on the buyer record, click **Resolve** and optionally describe how it was done, then click **Mark resolved**. Or click **Cancel item**, explain why it is no longer needed (required), then click **Cancel this item**.
4. Closed items move under **Closed** and stay visible, so finished and unfinished work are never confused. The decision is added to the deal timeline.
5. Return to **Home**. The item is gone from Deals Need Attention and the count has dropped.
6. Sign in as `dana` and open one of her customers to see the unresolved items on her own deals. Sales representatives only see and close items on their own deals.

### Evaluate AI conversations (US5)

1. Sign in as `karen` and open **AI review**. Choose an evaluator if more than one is offered, then click **Run AI evaluation**. The message under the button reports how many conversations were evaluated, how many were flagged, and how many flags are new.
2. **Results** shows the number of evaluated and flagged conversations, the flag rate, and review results, including false-positive reasons and flags added by a manager.
3. **Flag Details** lists flags awaiting review, most severe first. Each shows the flag type and severity, the customer and owner, the reason, and the flagged AI message. The same queue appears as **Flags Awaiting Review** on Home.
4. Click a flag to open the customer's record at that message. Flagged messages that still need attention have a red bar in the timeline; choose **Needs attention** to show only those.
5. In the record's **AI Review** box, review each flag: **Confirm issue**, **Mark resolved**, or **Mark false positive**. A false positive needs a reason: misread the wording, staff already handled it, visit was already confirmed, not a problem for us, or other (with a note).
6. If the evaluator missed a problem, click **Flag this reply** under an AI reply (or **Add another flag**), choose what is wrong, and save. The flag is recorded as a confirmed issue added by a manager.

The evaluation checks every AI reply against seven rules from Merto's brief: telling a customer a visit is booked before anyone confirmed it, promising a vehicle is available, quoting a price, ignoring a request to speak to a person, answering a price question instead of handing it to staff, messaging a customer who opted out, and pushy or robotic wording. The default evaluator is deterministic and calls no model. When the trained MPNet service is configured, **AI review** offers deterministic and MPNet choices, with separate flags, reviews and metrics. The trained MPNet weights are committed in this repository under `model-service/weights/mpnet-v3` and checked at build time; see [model deployment](model-service/README.md) and the [local CRM demo](backend/ml/LOCAL_CRM_DEMO.md). See also the [rules](backend/README.md#rules) and [how they were measured](backend/README.md#measuring-the-rules).

### Learn from manager reviews (US5)

1. Sign in as `karen`, open **AI review**, and choose the MPNet evaluator.
2. On the hosted site, **Learning from GM reviews (recorded demo)** replays one recorded local run. Click through the steps in order: **1. Simulate GM reviews**, **2. Give the remaining second opinions**, **3. Retrain classifier from reviews**, and **4. Preview: re-run AI evaluation with the current model**.
3. After step 1, **Second opinion needed** lists reviews that strongly disagree with the model. Another manager must agree or disagree before those reviews count.
4. The replay calls neither the model nor the database, so it changes no data. Refresh the page to start over.

The same loop runs live, with a real classifier refit, in the local model demo (`npm run demo:model` in `backend/`). For real reviews, `npm run eval:export-labels` turns manager reviews into a label snapshot with safeguards against wrong or repeated reviews; retraining stays an offline step a person starts. See [GM reviews as training labels](backend/README.md#gm-reviews-as-training-labels).

### See who needs follow-up (US6)

1. Sign in as `dana`. **Needs follow-up** on Home lists the representative's customers who are due a follow-up now, most overdue first.
2. Read the reasons under each customer. Each one says what happened and when. **customer waiting** means the customer is waiting on the team, such as a message nobody has answered or an overdue promise. **check in** means the customer has gone quiet, such as no reply 3 days after a quote or no contact 24 hours after a visit.
3. Open a customer. The **Follow up** section lists why a follow-up is due, or says that none is due.

A customer's message counts as answered only when a staff member responds with a message, call, or note; AI replies do not count. Customers who opted out and closed deals are never listed. A booked visit or a scheduled callback pauses the **check in** reasons but not the **customer waiting** ones, because a visit does not answer an open question. See the [follow-up rules](backend/README.md#follow-up-rules) in the backend README.

### Record a follow-up (US7)

1. Sign in as `dana` and open a customer under **Needs follow-up**.
2. In **Follow up**, choose **Write a message**. Select a channel and enter a message or call notes.
3. Click **Record follow-up**. Check the confirmation and the new entry in the deal timeline.
4. Return Home to see the updated follow-up status. A contact reminder may clear, but an unresolved promise still needs to be resolved separately.

### Assign or transfer a buyer (US8)

1. Sign in as `karen` and open **Deal details**. Click a deal marked **Unassigned** to expand it. If none is left, another tester may have assigned them all; use **Create customer** and choose "No rep (unassigned)" to add one.
2. Choose a representative under **Assign to:**, type the reason (required), and click **Assign**.
3. Click **View Full Record**. **Ownership History** shows who assigned the deal, when, and why.
4. To move an assigned deal, expand it, choose a different representative under **Transfer to:**, type a new reason, and click **Transfer**. A transfer cannot be recorded without a reason.
5. Open the buyer record again. The history shows who it was transferred from and to, with the reason, and any open items moved to the new owner. The conversation and earlier history stay on the deal.
6. Sign in as the new owner (for example `arjun`) to see the deal under **My Book**. The previous owner no longer sees it. Delivered or lost deals cannot be reassigned.

### Generate and review a reply (US14 / US11)

1. Sign in as `dana`, open a customer who currently needs follow-up, and choose **Use a suggested draft** in the **Follow up** section.
2. Choose email or SMS and click **Generate reply** (requires a backend Groq API key; see [setup](backend/README.md#setup)). Review the customer context, recent messages, and suggested reply.
3. Choose **Approve**, change the text and choose **Save edits and approve**, or choose **Reject**. Rejected drafts cannot be sent.
4. For an approved draft, click **Record follow-up** to record a simulated send. Approval alone does not record customer contact.
5. Check the deal timeline for the review decision and follow-up. Earlier drafts are available under **Earlier drafts** when more than one has been saved.

Drafts use the customer's recent messages, vehicle interest, appointments, and open tasks. Try draft review before recording a manual follow-up for the same customer, or use a different eligible customer: recording a follow-up can clear the reminder and make new drafts unavailable. If generation fails or reaches the provider's usage limit, retry later or use **Write a message**.

### Manage tasks

1. Sign in as `dana` and open a customer from **My Book** or **Needs follow-up**.
2. In **Tasks**, type a task under **New task**, optionally set **Due**, and click **Add task**. Managers can add tasks the same way from a buyer record.
3. Return Home. **My tasks** shows open tasks, soonest due first, with how many are overdue or due later today.
4. Open **Tasks** in the sidebar. Switch between **To do**, **Completed**, and **All**. Tick a task's checkbox to mark it done, or untick it to reopen it.

### View sales statistics

1. Sign in as `karen` and open **Statistics**. **Store sales outcomes** shows sold and lost deals and the sale rate with a chart. **Sales representatives** compares each representative's sold, lost, and closed deals and sale rate.
2. Sign in as `dana` and open **Statistics**. **Closed deals** summarizes her own outcomes. In **Deal history**, filter by **All outcomes**, **Sold**, or **Lost**, read the recorded loss reasons, and open any deal.

### Find customers (My Book)

1. Sign in as `dana` and open **My Book**. It lists the representative's own customers.
2. Search by customer or vehicle, and sort by deal age (newest or oldest first).

### Create a customer

1. Open **Create customer** as a manager or representative, fill in the buyer and vehicle details, and save. A manager can choose who owns the deal; a representative owns the customers they create.
2. If the email or phone already belongs to a buyer, the new deal is added to that buyer. The confirmation shows the stored name, and a warning appears if the name you typed was different, so staff can check it is the same person.

### Manage appointments

1. Open **Calendar** from either the manager or representative view. Dates and times are shown in Toronto time.
2. Click **New appointment**, select a customer, and enter the date, time, status, and any notes. Click **Create appointment**.
3. Select the appointment in the calendar or click **Edit appointment** in the day's list. Update its details and click **Save changes**.
4. Representatives see **Appointments to confirm** and **Visit outcomes to record** on Home. Clicking a visit request opens it in the calendar with a summary of the requested appointment.

### Run scenario checks (US13)

1. Sign in as `karen` and open **Scenarios** in the sidebar. The page lists eleven scenarios, each with the store's AI mode and a **What is checked** list. Seven come from the Merto brief; four are judgement scenarios where several responses are acceptable (a vague visit time, "not right now", an upset buyer, a price question and a visit request in one message).
2. Open **A visit is requested, not booked (Deal J)** and click **Run with careful**. The scorecard shows **Passed** with 8 of 8 checks: the agent tells the buyer a person will confirm the visit, and the run log shows the visit recorded as a request, never as booked, at the time the buyer asked for.
3. Choose `eager` in the **Agent** menu at the top and click **Run with eager** on the same scenario. The scorecard shows **Failed** with 5 of 8 checks: the agent told the buyer "You're all set for Monday at 10 am!", and the rule flags that exact message as appointment certainty.
4. Click **Compare all agents** to run all eleven scenarios for both agents. A table lines up the results: `careful` passes all eleven scenarios and `eager` passes none.
5. Optional, off by default: a live AI model can be compared too. In `backend/.env`, set `SCENARIO_AI_LIVE=true`, a model name, and a key (or a local model address, which needs no key), then restart the backend. A `model` agent appears; the page asks for confirmation before each live run, and the scorecard shows the model name, prompt version, and token use. See `backend/README.md` for the settings.

Every run is reset afterwards, so nothing is saved and no customer is contacted. By default the two agents are rule-based stand-ins, so no AI model is called, and the scores come from fixed rules: the same scenario always gives the same result. The `model` agent is the only part that calls a model, and the checks that score it are still fixed rules. Only the General Manager can use this page. Scenario times are set in UTC, so the run log shows the requested visit shifted into Toronto time.

### Current limitations

- Emails, SMS messages, and calls are simulated; no real customers are contacted. Scheduling a follow-up for later is not implemented.
- AI reply generation requires `GROQ_API_KEY` on the backend and is subject to provider quotas. Conversation evaluation is separate: it uses deterministic rules by default, optionally MPNet, and runs when a manager triggers it.
- The hosted site cannot retrain the MPNet classifier; it replays a recorded run of the review-learning demo.
- The app uses the team's Supabase database and fictional scenarios rather than a live Merto API.
- Scenario checks use fixed rules. They judge wording and behavior only and do not measure reply speed. The live AI model agent is optional and off by default, so the app and its tests run without any paid key. The model is told the store's rules in its prompt, so a pass shows it follows given rules, not that it knows car sales itself.

## Local Development Instructions

Requires Node.js 20.19 or newer. In `backend/`, run `npm install` and then `npm run dev` (API on http://localhost:3001). In a second terminal, do the same in `mertofrontend/` and open http://localhost:3000. Sign in as `karen` (manager) or `dana`, `arjun`, `sofia`, or `tom` (sales representatives); the development password is `test`.

Without a `DATABASE_URL`, the backend uses an in-memory database loaded from `supabase/migrations` and `supabase/seed`, so all data resets when the backend restarts. AI conversation flags appear only after an evaluation run: signed in as `karen`, open **AI review** and click **Run AI evaluation**. Running it again only adds flags for new problems.

Run the same checks as CI before opening a pull request:

| Folder | Commands |
| --- | --- |
| `backend/` | `npm run typecheck`, `npm test` (API, business rules, and permissions; no backend or database setup needed) |
| `mertofrontend/` | `npm run lint`, `npm test` (component tests with Vitest; no backend needed), `npm run build` |
| `supabase/tests/` | `npm test` (migrations and seed data) |

Developer documentation:

- [ENVIRONMENT.md](ENVIRONMENT.md): setup, every environment variable, both deployments, and the CI workflows.
- [backend/README.md](backend/README.md): the REST API, business rules, evaluation, and scripts. The full API reference is [backend/openapi.yaml](backend/openapi.yaml) (OpenAPI 3).
- [supabase/DATA_CONTRACT.md](supabase/DATA_CONTRACT.md) and [supabase/HOSTED_INTEGRATION.md](supabase/HOSTED_INTEGRATION.md): the database schema and how to set up a hosted database.
- [model-service/README.md](model-service/README.md): the optional MPNet evaluator and its deployment.

## Development requirements

Merto recommended the following technologies based on its existing stack.

| Component | Recommended technologies |
| --- | --- |
| Frontend | Next.js, React, TypeScript |
| Backend and database | Supabase, PostgreSQL |

The team uses Next.js and React with TypeScript for the frontend, a TypeScript/Express REST API for the backend, and PostgreSQL on Supabase for the database, with an in-memory PostgreSQL (PGlite) sandbox for local development and tests. Conversation evaluation offers deterministic TypeScript rules and an optional separate CPU-only Python MPNet service. The trained evaluator needs no paid model API.

## Deployment and GitHub Workflow

The frontend and Express backend are deployed on Vercel, with PostgreSQL hosted on Supabase. The frontend connects to the backend through server-side requests, and the backend connects to the hosted database.

Vercel automatically deploys the frontend and backend to two environments:

| Environment | Source branch | Frontend | Access |
| --- | --- | --- | --- |
| Development (Vercel Preview) | `dev` | [Dev preview](https://merto-d4.vercel.app?_vercel_share=1IR3ItfqSFotKw7BLQNCUTI4vcxd29OS) | Merto dev demo sign-in |
| Production (release) | `main` | [Production sign-in](https://25-merto.vercel.app/login) | Merto demo sign-in |

The development copy has its own database with the same fictional data, so changes there never touch production.

The [fork sync workflow](.github/workflows/sync-fork.yml) mirrors the team's `main` and `dev` branches to the corresponding branches in Jason's fork, `jasonnn404/25-Merto`. Vercel deploys when those branches update. The fork runs the workflow on a 15-minute schedule and supports manual runs. GitHub can delay scheduled runs. See the [deployment guide](ENVIRONMENT.md#deployed-app) for branch setup, configuration, and verification.

To reproduce the deployment:

1. Create two Vercel projects from the fork's `main` branch: a Next.js project with root directory `mertofrontend`, and an Express project with root directory `backend`. The backend entry point and configuration are in `backend/index.ts` and `backend/vercel.json`.
2. Apply all migrations in `supabase/migrations` to the hosted Supabase database and load the fictional demo data for a fresh demo database. See [hosted database setup](supabase/HOSTED_INTEGRATION.md).
3. Set backend environment variables using [backend/.env.example](backend/.env.example): `DATABASE_URL`, `DEV_LOGIN_PASSWORD` for demo sign-in, and `GROQ_API_KEY` for reply generation. `GROQ_MODEL` is optional. The entry point uses Supabase transaction pooling and supports the bundled CA certificate for verified TLS.
4. Set `BACKEND_URL` in the frontend project's environment to the deployed backend origin. If the backend has Vercel deployment protection enabled, also set the server-only `BACKEND_PROTECTION_BYPASS` value. Keep credentials in deployment environment settings, outside the repository and browser code.
5. Deploy both projects, then open the frontend URL and check sign-in, deal loading, and **Generate reply** on a customer due for follow-up. For optional MPNet evaluation, configure the separate model service using its [deployment instructions](model-service/README.md). To add the development environment, follow [Development deployment](ENVIRONMENT.md#development-deployment).

The team uses Git and GitHub for code, GitHub Issues to track tasks, and Discord for daily communication. Each task has an owner and an expected completion date, and outstanding work is reviewed in weekly meetings.

Every change goes through a pull request:

1. Create a branch from `dev` and commit as you work.
2. Open a pull request into `dev` and ask another team member to review it. CI runs the backend, frontend, and database checks on every pull request.
3. After approval and passing CI, merge into `dev`. Verify the change on the development deployment.
4. When `dev` is ready to release, open a pull request from `dev` into `main`. After review and passing CI, merge it with a merge commit to preserve branch history. The fork sync deploys it to production.

## Maintenance and Handoff

This section is for Merto or a future team taking over the project.

**What there is to hand over**

| Part | Where it lives now | What the new owner needs |
| --- | --- | --- |
| Code | This repository (`csc301-2026-f/25-Merto`) | A copy or transfer of the repository |
| Frontend and backend hosting | Two Vercel projects (production and the `dev` Preview) on a team member's personal account, deploying from the fork `jasonnn404/25-Merto` | Recreate the projects on Merto's Vercel account from Merto's copy of the repository (see the deployment steps above and [ENVIRONMENT.md](ENVIRONMENT.md)), or transfer them. A Vercel account that can deploy from an organization repository no longer needs the fork or `sync-fork.yml`. |
| Databases | Two Supabase projects: production and development | Transfer the projects, or create new ones and apply `supabase/migrations` and `supabase/seed` |
| MPNet evaluator (optional) | A separate Vercel project from `model-service/` | Redeploy it with a new `MERTO_MODEL_TOKEN`; the weights are already in the repository under `model-service/weights/mpnet-v3` |
| Secrets | Deployment settings only, never in the repository | New values for `DATABASE_URL`, `DEV_LOGIN_PASSWORD`, `GROQ_API_KEY`, `MERTO_MODEL_TOKEN`, and the Vercel protection bypass values. [backend/.env.example](backend/.env.example) lists every variable. |

**Before real use**

- Replace the shared demo sign-in with real authentication (see [Known limitations](#known-limitations)) and remove `DEV_LOGIN_PASSWORD` from production.
- Connect the app to Merto's own data instead of the fictional seed data. [supabase/DATA_CONTRACT.md](supabase/DATA_CONTRACT.md) describes the tables and fields the app reads and writes.

**Routine maintenance**

- Database changes are new files in `supabase/migrations`. No workflow applies them: apply each new migration to the development database first, then to production, before deploying code that depends on it.
- When a route changes, update [backend/openapi.yaml](backend/openapi.yaml) and the backend README in the same pull request.
- To retrain the MPNet classifier from manager reviews, export labels with `npm run eval:export-labels` and follow [GM reviews as training labels](backend/README.md#gm-reviews-as-training-labels). If the review-learning demo changes, re-record the hosted replay with `npm run demo:record-replay`.
- Keep the CI checks passing and every job's timeout in place; see [Continuous integration](ENVIRONMENT.md#continuous-integration).

## Non-Functional Requirements

### Accessibility

We ran Lighthouse (Chrome DevTools, Navigation mode, Desktop, Accessibility category) on the deployed app on 2026-11-06, signed in as the manager for the pages behind sign-in:

| Page | Accessibility score | Screenshot |
| --- | --- | --- |
| Sign-in (`/login`) | 100 | [lighthouse-login.png](deliverables/D3/nfr/lighthouse-login.png) |
| Manager home (`/manager`) | 100 | [lighthouse-manager-home.png](deliverables/D3/nfr/lighthouse-manager-home.png) |
| Deal page (`/manager/deal-details/<deal ID>`) | 100 | [lighthouse-deal-page.png](deliverables/D3/nfr/lighthouse-deal-page.png) |
| Scenario checks (`/manager/scenarios`) | 98 | [lighthouse-scenarios.png](deliverables/D3/nfr/lighthouse-scenarios.png) |

Lighthouse notes that automatic checks detect only a subset of accessibility issues, so these scores are evidence of intentional effort, not a guarantee. What the interface does:

- Form fields use real `<label>` elements linked with `htmlFor`, and the sign-in form sets `autocomplete` on both fields. The page language is set to English.
- Errors from forms and actions are announced with `role="alert"`.
- Interactive elements are native buttons, links, inputs, and selects (there are no clickable `div` or `span` elements), so they can be reached with Tab and activated with Enter or Space.
- The app has a light mode and a dark mode.

### Security

- **Input validation.** The backend validates every request on the server: IDs must be valid UUIDs, required fields must be present, values must come from fixed lists where that applies, and free-text fields have length limits. Bad input returns a 400 with a clear message.
- **Parameterized queries.** Values from users are always passed to the database as bound parameters (`$1`, `$2`, …). The only text built into SQL is fixed column and table names from our own code.
- **Permissions on the server.** Each request is matched to a staff member and their role is looked up in the database. Only a General Manager can assign or transfer a deal, review AI flags, or run scenario checks, and a sales representative can only see and change their own deals. This is checked in the service layer and covered by automated tests, so it does not depend on what the interface shows.
- **Secrets.** API keys and the database connection string are server-side environment variables set in the deployment settings, never in `NEXT_PUBLIC_` variables or browser code. The repository contains only [`.env.example`](backend/.env.example) templates with empty placeholders. The session cookie is `httpOnly`, `sameSite=lax`, and `secure` in production.
- **Paid model calls.** The optional live scenario model is off unless explicitly enabled, asks for confirmation before each run, and is limited per hour. Provider errors are reduced to short messages that never include the key.

### Error handling

Expected errors return a short, readable message and a matching status code. Unexpected errors return a generic `{"error":"Internal server error."}` and the details are logged on the server, so stack traces never reach the client. These are real responses from the backend:

| Situation | Request | Status | Response |
| --- | --- | --- | --- |
| Not signed in | `GET /api/deals` | 401 | `{"error":"Send X-Staff-Id with a staff member ID."}` |
| A sales representative tries a manager action | `POST /api/deals/<deal ID>/assign` | 403 | `{"error":"Only a GM can assign a buyer."}` |
| Required field missing | `POST /api/deals/<deal ID>/assign` without a reason | 400 | `{"error":"reason is required."}` |
| Malformed ID | `GET /api/deals/not-a-uuid` | 400 | `{"error":"dealId must be a UUID."}` |
| Deal already assigned | `POST /api/deals/<deal ID>/assign` on an owned deal | 409 | `{"error":"This deal is already assigned to Dana Kowalski. Use transfer instead."}` |
| Unknown route | `GET /api/nope` | 404 | `{"error":"Route not found."}` |

### Known limitations

- Sign-in is a development stand-in: the demo accounts share one password, and the backend trusts the staff ID sent with each request. Real authentication (Supabase Auth) is planned.
- The backend does not yet rate-limit sign-in attempts or set extra security headers.

## Coding Standards and Guidelines

- **TypeScript everywhere, in strict mode.** The backend and frontend both compile with `"strict": true`; CI runs the backend type check and the frontend build on every pull request.
- **Linting.** The frontend uses ESLint with the Next.js configuration (`npm run lint`), and CI fails on lint errors.
- **Structure.** The backend is split by feature (for example `deals/`, `follow-up/`, `evaluation/`, `scenarios/`), each with its routes, service logic, and validation. Permissions and validation live in the service layer, not in the routes or the interface.
- **Tests with every change.** New business logic comes with backend tests, new UI behavior with frontend component tests, and schema changes with database tests. Tests use the in-memory database and never touch the hosted one.
- **Clean code.** We follow the clean coding principles from CSC301: descriptive naming, short and focused functions, no magic numbers or duplicated logic, and clear module boundaries. Configuration such as URLs, keys, and the dealership time zone comes from environment variables, not code.
- **Reviews.** Every pull request is reviewed by another team member before it is merged, and the description says what changed and how it was checked.

## Licenses

We agreed with Merto on Option 3 of the course IP options: the code is shared only with Merto under an open-source license, and we do not distribute it to any other entity or individual. The repository does not include a license file yet; the specific license will be added once Merto confirms it.

The pretrained model used by the MPNet evaluator has its own license; see [model-service/licenses](model-service/licenses).

## Project History

How the product changed between deliverables, and why, is recorded in [deliverables/](deliverables): the [D1 plan](deliverables/D1/planning.md), the [D2 review](deliverables/D2/iteration-02-review.md), and the [D3 product evolution report](deliverables/D3/product-evolution.md).
