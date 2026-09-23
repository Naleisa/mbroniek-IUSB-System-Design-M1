We will now complete tasks.md, which is the current template, based on plan.md and specification.md.  The plan has been reviewed and approved, so treat it's ADRs, components, and sequencing as fixed.

Use tasks-guide.md as the guide for creating the tasks.  Adapt my task list below to the template's structure.  Give each task an ID (T1, T2...), start it with a verb, fill in "Traces to (R#, ADR#) and "Depends on" and set every status to not started.  Keep the template's definition of done and blocked and questions section.

Keep these rules in mind:
- Follow plan.md's section 6 sequencing.  The phases below are already in that order, and the task order and dependencies should match it.
- Every task must be small enough to finish in udner a day, with a one-sentence "done" that someone else could check.  Split any of items that are too big, and merge any that are too small to stand alone.
- Every task traces to atleast one R#, ADR#, or C#.  If one of mine doesn't flag it rather than inventing a trace.
- The new app lives in /app.  Don't create tasks that change or delete the old template files at the repo root (ADR-02).
- We want to make sure we're mindful of the template code that exists in the workspace.  We will pull information from the template to reuse and don't want to rewrite if not necessary.
- Because every task needs a passing test to be done, make a test part of each task's "done", or a dd a separate test task right after it.
- Don't write any code.  This step only produces tasks.md

## Task List

### Phase 0 - Project Setup
* Scaffold a Vue 3 + Vite + TypeScript + Tailwind + Vue Router (hash URLs) app in /app, with an empty home page that builds and runs
* Set up a Supabase project and the Supabase CLI for local development, with a supabase/migrations folder in the repo and environment files git-ignored
* Add a GitHub Actions workflow that builds /app and deploys it to GitHub Pages on every push to main, and turn on GitHub secret scanning and push protection.
* Set up Vitest and Playwright (with a phone-sized viewport) with one passing smoke test each.

### Phase 1 - Database schema, lifecyle rules, and audit log
* Create a migration for core tables: agencies, user roles, caregivers, requirement templates, required items, documents, check orders, consents, notifications, and a settings table.
* Seed the settings (30-day warning window, 3-business-day delayed threshold, 7-day resume link) so they can be changed without code.
* Seed two demo agencies, one coordinator account per agency, and the Indiana Home Health Aide requirement template, clearly labeled as sample
* Create the append-only audit events table, with triggers that log every change and block updates and eletes on the audit table, and a test proving it can't be edited.
* Create the lifecycle transition function covering every state, with tests for allowed and refused transitions.
* Make cleared a human-only transition that is refused with a message naming the missing item when any item is incomplete or expired, and test it
* Create the eligibility check that moves a record to eligible when every required item is verified an current
* Store test SSNs in Supabase Vault, keeping only a token and the last four digits on the caregiver record, with a restricted function as the only way to read the full value.

### Phase 2 - Sign-in, roles, and agency separation
* Set up a coordinator sign-in with email and password
* Set up an applicant magic-link sign-in using Supabase's PKCE flow, so the sign-in code arrives in the query string and doesn't collide with the hash router.
* Configure Resend as Supabase Auth's email sender.
* Write row-level security policies on every table so coordinators see only their own agency and applicants only see their own record.
* Create storage buckets for documents with per-agency acccess policies.
* Write tests proving that agency a's coordinator can't read agency b's records or files, and that one applicant can't read another's

### Phase 3 - Mock vendors, schedules jobs, and notifications
* Define the shared vendor adapter interface
* Build the mock background check adapter, with the reserved test SSN outcomes
* Build the order check function that sets the item to ordered and records the time, moves a failed request to retryable, and allows a retry
* Build the mock OIG/SAM exclusion adapter, where a match moves the record to Review Required
* Build the mock state registry adapter with a manual verification fallback
* Schedule an hourly pg_cron job that marks checks delayed after 3 business days.
* Schedule a daily pg_cron job that marks items expiring (30 days) or expired, moves cleared records with an expired item to not current, and creates notifications
* Build the Edge Function that sends notification emails through Resend, triggered by a database webhook, and log SMS messages to an outbox table.
* Add a scheduled keep-alive function so the Supabase free-tier project doesn't pause and stop the scheduled jobs

### Phase 4 - Appllicant intake, consent, and uploads
* Build the agency intake route that starts a partial record under that agency
* Build the identity and contact step, saving progress after each step and sending the SSN to the vault
* Build the "what you'll need and why" step, generated from the requirement template
* Build document upload for JPG, PNG and PDF up to 10 MB, with compression on the phone and a required expiration date
* Reject documents whose expiration date has already passed, on the phone and again on the server, and test both
* Build the separate disclosure screen and authorization screen, recording a timestamp and wording version for each
* Handle a declined consent: stop screening, keep the record, and notify the coordinator
* Submit a complete intake to create the record in Intake Complete and notify the coordinator.
* Let an applicant resume an abandoned intake through the magic link within 7 days.
* Build the applicant status page showing outstanding items and what each is waiting on.
* Build the credential replacement flow, where the applicant sees the requested item and due date and uploads a replacement

### Phase 5 — Coordinator screens
* Build the coordinator dashboard, listing caregivers by lifecycle state and highlighting incomplet intakes, declined consents and delayed checks
* Build the caregiver record view, showing each item's status, source, method and dates, plus elapsed time for outstanding checks
* Add order check and retry buttons to the record view
* Add actions to mark a document verified, or unreadable (which sends it to Manual Verification)
* Add the "Mark Cleared" action, which shows the refusal message from the lifecycle function
* Build the Review Required view, where a coordinator reviews an exclusion match and decides the next step manually
* Build the expiration worklist, with an action to request a replacement from the caregiver
* Build the replacement review step, where the coordinator verifies a replacement by the same method as the original
* Build the SMS outbox page

### Phase 6 — Compliance report
* Build the Edge Function that generates a single-caregiver compliance report PDF with every item, its evidence and its history, in under 30 seconds.
* Add a "Download compliance report" button to the record view.

### Phase 7 — Acceptance and go/no-go
* Write Playwright tests at phone size for all four acceptance criteria in Spec Section 5.
* Run an accessibility check (screen reader labels, contrast, one-handed layout) on the intake and status pages, and fix any issues found.
* Test intake on a throttled 3G connection and record the results.
* Prepare a go/no-go demo script that walks through Scenarios 1–3 using the test SSNs.

When finished, run the tasks guide's Quick Self-Check and show each box with a pass or fail note.