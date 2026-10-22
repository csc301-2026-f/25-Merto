# Merto — CSC301 Team 25

## Partner Intro

Merto works at the infrastructure layer of automotive sales. Its goal is to maintain a shared buyer and deal history, including trade-ins, appointments, and promises, that can be accessed by the stakeholders involved in a sale.

| Name | Title | Point of contact | Email |
| --- | --- | --- | --- |
| Muneeb | Development team lead | Primary | admin@merto.ai |
| Oliver | Development team lead | Secondary | |

## Description about the project

The project is a standalone application that Merto plans to integrate into its product later. It will help employees coordinate around the same buyer, review AI conversations, and identify customers who need follow-up. The work is prioritized in this order: the manager/CRM dashboard, conversation evaluation, and the follow-up system.

The target users are dealership sales managers, salespeople and Business Development Centre (BDC) representatives, and finance managers. Sales managers are the primary users. The application aims to reduce information lost during buyer handoffs and give managers visibility into AI conversations and missed follow-ups.

The features below describe the current D2 version. The original scope is recorded in the [D1 project plan](deliverables/D1/planning.md).

## Key Features

1. **Manager/CRM dashboard:** Managers can view assigned and unassigned deals, create deals, assign or transfer ownership, and review buyer details, conversation history, and unresolved work.
2. **Conversation evaluation:** Managers can run rule-based checks on stored AI conversations, review flagged replies and their reasons, and view evaluation metrics.
3. **Follow-up actions:** Representatives can see which customers need follow-up and why, then record a simulated email, SMS, or call in the deal history. Eligibility checks exclude opted-out customers and other customers who should not currently be contacted.
4. **Reply draft review:** Representatives can prepare a template-based reply, review the customer context, approve, edit, or reject the draft, and record an approved reply as a simulated follow-up.
5. **Appointment calendar:** Managers and representatives can view appointments in a calendar and track appointments for deals.

[Dashboard prototype (Figma Make)](https://www.figma.com/make/h6Sdmrc6AsJxeOVEOwmGn5/Manager-Analytics-Dashboard--Copy-?fullscreen=1)

The planned data source is a scoped API provided by Merto. The application does not connect to a Merto API yet: it uses the team's own database schema (`supabase/migrations`) and fictional buyer, deal, and conversation scenarios (`supabase/seed`).

## Deployed Application / Access Instructions

Open [Merto](https://merto-frontend.vercel.app/login) in a browser. No local installation is required.

Demo usernames are `karen` (manager) and `dana`, `arjun`, `sofia`, or `tom` (sales representatives). The demo password is `test`. Click **Sign out** to switch accounts.

The application uses fictional customer and deal data. Changes to the hosted database are shared between demo users, so a customer may already have been updated by another tester.

### Review deals and AI conversations

1. Sign in as `karen`. The manager home page lists assigned and unassigned deals.
2. Open a deal to inspect the buyer record, conversation timeline, and unresolved items. Use the manager's deal controls to assign or transfer ownership.
3. Return to the manager home page and click **Run AI evaluation**. Review **Flags awaiting review** and the reasons given for flagged replies.

### Record a follow-up (US7)

1. Sign in as `dana` and open a customer under **Needs follow-up**. The list explains why each customer needs attention.
2. In **Follow up**, choose **Write a message**. Select a channel and enter a message or call notes.
3. Click **Record follow-up**. Check the confirmation and the new entry in the deal timeline.
4. Return Home to see the updated follow-up status. A contact reminder may clear, but an unresolved promise still needs to be resolved separately.

### Review a suggested reply (US11)

1. Open a customer who currently needs follow-up and choose **Use a suggested draft** in the **Follow up** section.
2. Choose email or SMS and click **Prepare draft**. Review the customer context, recent messages, and suggested reply.
3. Choose **Approve**, change the text and choose **Save edits and approve**, or choose **Reject**. Rejected drafts cannot be sent.
4. For an approved draft, click **Record follow-up** to record a simulated send. Approval alone does not record customer contact.
5. Check the deal timeline for the review decision and follow-up. Earlier drafts are available under **Earlier drafts** when more than one has been saved.

Try draft review before recording a manual follow-up for the same customer, or use a different eligible customer: recording a follow-up can clear the reminder and make new drafts unavailable.

### Manage appointments

1. Open **Calendar** from either the manager or representative view. Dates and times are shown in Toronto time.
2. Click **New appointment**, select a customer, and enter the date, time, status, and any notes. Click **Create appointment**.
3. Select the appointment in the calendar or click **Edit appointment** in the day's list. Update its details and click **Save changes**.

### D2 limitations

- Emails, SMS messages, and calls are simulated; no real customers are contacted. Scheduling a follow-up for later is not implemented.
- Suggested replies use templates rather than a live AI model. Conversation evaluation uses deterministic rules and runs when a manager triggers it.
- The app uses the team's Supabase database and fictional scenarios rather than a live Merto API.

## Local Development Instructions

Requires Node.js 20 or newer. In `backend/`, run `npm install` and then `npm run dev` (API on http://localhost:3001). In a second terminal, do the same in `mertofrontend/` and open http://localhost:3000. Sign in as `karen` (manager) or `dana`, `arjun`, `sofia`, or `tom` (sales representatives); the development password is `test`.

Without a `DATABASE_URL`, the backend uses an in-memory database loaded from `supabase/migrations` and `supabase/seed`, so all data resets when the backend restarts. AI conversation flags appear only after an evaluation run: signed in as `karen`, click **Run AI evaluation** on the manager dashboard, and the flagged replies appear under "Flags awaiting review". Running it again only adds flags for new problems. Evaluations are not yet scheduled to run on their own. See the [backend README](backend/README.md) for the full API, tests (`npm test`), and connecting to the team's Supabase database.

## Development requirements

Merto recommended the following technologies based on its existing stack.

| Component | Recommended technologies |
| --- | --- |
| Frontend | Next.js, React, TypeScript |
| Backend and database | Supabase, PostgreSQL |

The team uses Next.js and React with TypeScript for the frontend, a TypeScript/Express REST API for the backend, and PostgreSQL on Supabase for the database, with an in-memory PostgreSQL (PGlite) sandbox for local development and tests. Conversation evaluation uses deterministic TypeScript rules rather than Python or a paid AI model.

## Deployment and Github Workflow

The frontend and Express backend are deployed on Vercel, with PostgreSQL hosted on Supabase. The frontend connects to the backend through server-side requests, and the backend connects to the hosted database. Users access the application through the frontend link above.

The team plans to use Git and GitHub for code collaboration, GitHub Issues to track tasks, and Discord for daily communication and task updates. Each task will have an owner and an expected completion date, with outstanding work reviewed during weekly meetings.

The general Github Workflow is outlined as follows:
1. Create branch, checkout locally
2. Write code and commit frequently
3. When the entire task is complete, push branch to remote
4. Submit a Pull Request to be reviewed by another team member
5. Discuss the changes made. If there are no issues, merge
6. Re-build application

## Coding Standards and Guidelines

Our coding guidelines will follow the clean coding principles introduced in CSC301: descriptive naming, short and focused functions, avoiding magic numbers and duplicated logic, and clear module boundaries and interfaces. Team-specific formatting conventions will be agreed upon before implementation.

## Licenses

We have agreed with Merto on Option 3 of the course IP options: the code will only be shared with Merto under an open-source license, and we will not distribute it to any other entity or individual. A specific license file will be added once confirmed with Merto.

<!-- TODO (D3): uncomment and fill in this section.
## D3 Improvement Highlight
-->
