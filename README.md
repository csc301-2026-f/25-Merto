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

### Review unresolved work (US4)
1. Sign in as `karen`. On the manager home page, find **Unresolved work**. It shows how many items are open, how many are overdue, how many have no owner, and when the oldest was opened.
2. Items are listed longest-waiting first, with **overdue** and **no owner** labels. Click an item to open its buyer record.
3. In **Open items** on the buyer record, click **Resolve** and optionally describe how it was done, then click **Mark resolved**. Or click **Cancel item**, explain why it is no longer needed (required), then click **Cancel this item**.
4. Closed items move under **Closed** and stay visible, so finished and unfinished work are never confused. The decision is added to the deal timeline.
5. Return to the manager home page. The item is gone from Unresolved work and the count has dropped.
6. Sign in as `dana` and open one of her customers to see the unresolved items on her own deals. Sales representatives only see and close items on their own deals.

### Evaluate AI conversations (US5)

1. Sign in as `karen` and click **Run AI evaluation** on the manager home page. The message under the button reports how many conversations were evaluated, how many were flagged, and how many flags are new.
2. Review **Flags awaiting review**. The most severe flags come first. Each one shows the flag type and severity, the customer and owner, the reason, and the AI message that was flagged.
3. Click a flag to open the customer's record at that message. Flagged messages that still need attention have a red bar in the timeline; choose **Needs attention** to show only those. The **AI review** box shows the customer's evaluation status and when the conversation was last evaluated.
4. Check **AI evaluation metrics** for the number of evaluated and flagged conversations, the flag rate, and review results.

The evaluation checks every AI reply against seven rules from Merto's brief: telling a customer a visit is booked before anyone confirmed it, promising a vehicle is available, quoting a price, ignoring a request to speak to a person, answering a price question instead of handing it to staff, messaging a customer who opted out, and pushy or robotic wording. The rules are deterministic: the same conversation always gets the same result, and no AI model is called. Running the evaluation again keeps existing flags and review decisions. See the [rules](backend/README.md#rules) and [how they were measured](backend/README.md#measuring-the-rules) in the backend README.

### See who needs follow-up (US6)

1. Sign in as `dana`. **Needs follow-up** on the home page lists the representative's customers who are due a follow-up now, most overdue first.
2. Read the reasons under each customer. Each one says what happened and when. **customer waiting** means the customer is waiting on the team, such as a message nobody has answered or an overdue promise. **check in** means the customer has gone quiet, such as no reply 3 days after a quote or no contact 24 hours after a visit.
3. Open a customer. The **Follow up** section lists why a follow-up is due, or says that none is due.

A customer's message counts as answered only when a staff member responds with a message, call, or note; AI replies do not count. Customers who opted out and closed deals are never listed. A booked visit or a scheduled callback pauses the **check in** reasons but not the **customer waiting** ones, because a visit does not answer an open question. See the [follow-up rules](backend/README.md#follow-up-rules) in the backend README.

### Record a follow-up (US7)

1. Sign in as `dana` and open a customer under **Needs follow-up**. The list explains why each customer needs attention.
2. In **Follow up**, choose **Write a message**. Select a channel and enter a message or call notes.
3. Click **Record follow-up**. Check the confirmation and the new entry in the deal timeline.
4. Return Home to see the updated follow-up status. A contact reminder may clear, but an unresolved promise still needs to be resolved separately.

### Assign or transfer a buyer (US8)

1. Sign in as `karen`. On the manager home page, open a deal from the Unassigned list. If the list is empty, another tester may have assigned them all; use **Create customer** and choose "No rep (unassigned)" to add one.
2. In the deal controls, choose **Assign to:** and select a sales representative. A reason is required; the default is "Customer was not attended." You can change it. Click **Assign**.
3. Check the owner shown on the deal and the ownership history on the buyer record: it shows who assigned the deal, when, and why.
4. To move the deal, choose **Transfer to:**, select a different representative, type a new reason, and click **Transfer**. A transfer cannot be recorded without a reason.
5. Open the buyer record again. The history now shows who it was transferred from and to, with the reason, and any open items moved to the new owner. The conversation and earlier history stay on the deal.
6. Sign in as the new owner (for example `arjun`) to see the deal in their list. The previous owner no longer sees it. Delivered or lost deals cannot be reassigned.

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
