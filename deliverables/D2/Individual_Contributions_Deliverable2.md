# Merto — CSC301 Team 25

## Luis

1. **Description:** Worked on frontend, designed frontend handler for requests to backend.
2. **Details:** Created the login screen, handled whether a manger or rep is attempting to login. Created manager's home view, and the frontend's ability to take information from the backend to display deals that are both assigned and unassigned. Create the manager's ability to create new deals and an in-depth view for any given deal.

## Maiyue (Bobby)

1. **Description:** Backend developer; owned AI conversation evaluation (US5) and follow-up detection (US6), and connected the frontend to the backend.
2. **Details:**
   - US5: added the `ai_evaluations` and `ai_flags` tables and the scenario seed; built the evaluation API (run, per-deal result, dry-run preview, flag queue, manager review, metrics) with deterministic rules for the seven flag types in Merto's brief; added the **Run AI evaluation** button on the manager dashboard.
   - Built a labelled dataset of 280 AI-reply snippets (dev/test split) and labels for 29 seeded deals, plus `npm run eval:rules`, which reports precision and recall for each flag type.
   - US6: `GET /api/follow-ups/due` and per-deal follow-up status, giving a reason for every listed buyer and skipping buyers who opted out.
   - Deals API: deal list, buyer creation that reuses an existing buyer's record, development sign-in, and structured assignment history for US8.
   - Connected Luis's manager and rep screens to the backend; added the buyer record page and the rep follow-up list.
   - Documented the backend API in `backend/README.md`.

## Jikai Jason Li

1. **Description:** Worked on the database, follow-up actions, reply draft review, and deployment.
2. **Details:**
   - Set up the initial Supabase database schema, migrations, and sample data. Added database tests, setup documentation, and checks for the hosted backend connection.
   - Built the follow-up action feature (US7), including the backend and rep interface for recording simulated follow-ups in the deal history.
   - Built reply draft review (US11), allowing reps to generate, approve, edit, or reject drafts and record simulated sends. Added tests for both features.
   - Deployed the frontend and backend and added access instructions and feature walkthroughs to the README.

## Rachel

1. **Description:** Worked on backend, specifically US6: Appointment tracking, which allows managers and sales reps to schedule, view, and update appointments with their customers.
2. **Details:** 
   - Implemented appointment creation and tracking feature that allows sale reps and managers to create an appointment with their customers and track its status [requested, confirmed, completed, rescheduled, cancelled, no show]
   - Enforced role-based access control, allowing managers to manage all appointments and sales reps to access only appointments associated with their own deals.
   - Added a calendar inteface with a monthly view, daily agenda, and appointment creation and editing forms.
   - Documented the appointment tracking and calendar feature walkthroughs in `backend/README.md`
