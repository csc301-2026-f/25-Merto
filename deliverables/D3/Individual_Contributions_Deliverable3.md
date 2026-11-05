# Merto — CSC301 Team 25 - Individual Contributions (D3)

> For each team member: name, role, and specific contributions. Be precise about what you did, not how much you wrote.

**Jikai Jason Li**, AI reply generation and deployment
> Replaced fixed reply templates with Groq-generated email and SMS drafts using the customer's messages and deal context (US14), while keeping the existing approve, edit, and reject flow. Added checks for outdated drafts, API error handling, database fields for generation details, and automated tests with mocked responses. Forked the team repo and deployed the frontend and backend on Vercel with the hosted Supabase database, including fixes for database connections and frontend requests. Updated the README with the new app URL, setup instructions, and a walkthrough of reply generation. Implementation: [US14 PR #14](https://github.com/csc301-2026-f/25-Merto/pull/14) and [deployment PR #15](https://github.com/csc301-2026-f/25-Merto/pull/15).

> Reviewed and merged [PR #20](https://github.com/csc301-2026-f/25-Merto/pull/20) for scheduled fork syncing and auto-deployment. Previously, during D2, reviewed and merged [PR #8](https://github.com/csc301-2026-f/25-Merto/pull/8) for open item resolution and the conversation view, and [PR #10](https://github.com/csc301-2026-f/25-Merto/pull/10) for README updates.

**Ethan Yang**, CI/CD and development environment
> Set up continuous integration with a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs on every pull request and every push to main. It has three parallel jobs: backend typecheck and tests, frontend lint and production build, and database migration and seed tests. The backend tests run against an in-memory database built from `supabase/migrations` and `supabase/seed`, so CI never touches the hosted Supabase. Added concurrency cancellation and job timeouts so stale or hung runs don't hold runners. Because secrets can't be added to the org repo, set up continuous deployment through a scheduled workflow (`sync-fork.yml`, every 15 minutes) that syncs main into Jason's fork, which Vercel then auto-deploys, following the TA-endorsed fork approach on Piazza. Wrote `ENVIRONMENT.md` covering local setup, environment variables for the backend, frontend and model service, how deployment works, and how to run the CI checks locally, and added the missing frontend `.env.example`. Implementation: [CI workflow commit fd2f42d](https://github.com/csc301-2026-f/25-Merto/commit/fd2f42d), [fork sync PR #20](https://github.com/csc301-2026-f/25-Merto/pull/20), [ENVIRONMENT.md PR #24](https://github.com/csc301-2026-f/25-Merto/pull/24), and [frontend env example PR #25](https://github.com/csc301-2026-f/25-Merto/pull/25).

> Reviewed and merged [PR #14](https://github.com/csc301-2026-f/25-Merto/pull/14) for US14 AI reply generation and [PR #23](https://github.com/csc301-2026-f/25-Merto/pull/23) for D3 contribution and deployment documentation. Previously, during D2, implemented open item resolution (US4) and the AI conversation view (US3) in [PR #8](https://github.com/csc301-2026-f/25-Merto/pull/8), and updated the README in [PR #10](https://github.com/csc301-2026-f/25-Merto/pull/10).

**[Name]**, [Role]
> [Specific contributions]

**[Name]**, [Role]
> [Specific contributions]

**[Name]**, [Role]
> [Specific contributions]
