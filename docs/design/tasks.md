# Tasks — Home Healthcare Caregiver Hiring Portal

> Derived from the plan document. Each task is small, checkable, and traceable to a requirement.

## Task List

Phases follow plan.md Section 6. All new work lives in `/app` (ADR-02); no task changes or deletes the original template files at the repository root. Where a task says **reuse template**, it ports that pattern from the root template into `/app` rather than rewriting it from scratch — the originals stay untouched.

### Phase 0 — Project Setup

| ID | Task | Done when | Traces to (R# / ADR#) | Depends on | Status |
|----|------|-----------|--------------------------|------------|--------|
| T1 | Scaffold a Vue 3 + Vite + TypeScript + Tailwind CSS + Vue Router app in `/app`. Reuse template: port the hash-history router setup and route-table pattern from `app.js`, the viewport meta tag from `index.html`, and the navbar from `navbar-component.js` as single-file components restyled in Tailwind. | `/app` builds without errors and shows an empty home page at `#/` with the ported navbar, and `git status` shows no changes outside `/app`. | ADR-00, ADR-02 | — | Not started |
| T2 | Set up Vitest and Playwright (phone-sized viewport) in `/app`, each with one smoke test. | One Vitest test and one Playwright test that loads the home page at phone size both pass locally. | ADR-17 | T1 | Not started |
| T3 | Set up the Supabase project and Supabase CLI for local development, with `app/supabase/migrations` in the repo and environment files git-ignored in `/app/.gitignore`. | The local Supabase stack starts, a test connects to it with the anon key, and no environment file is tracked by git. | ADR-00, ADR-00a | T1 | Not started |
| T4 | Add a GitHub Actions workflow that builds `/app`, runs the tests, and deploys to GitHub Pages on every push to `main`; turn on secret scanning and push protection. | A push to `main` produces a green run and the Pages URL shows the home page with all assets loading, and the repository's security settings show secret scanning and push protection enabled. | ADR-00, ADR-00a | T2 | Not started |

### Phase 1 — Database Schema, Lifecycle Rules, and Audit Log

| ID | Task | Done when | Traces to (R# / ADR#) | Depends on | Status |
|----|------|-----------|--------------------------|------------|--------|
| T5 | Create the first core-table migration: agencies, user roles, settings, caregivers (lifecycle state, SSN token, last four digits), and requirement templates. | The migration applies on a clean reset and a schema test confirms the tables exist and the caregiver state allows exactly the seven ADR-08 states, including Not Current. | ADR-08, ADR-11, ADR-03, R4 | T3 | Not started |
| T6 | Create the second core-table migration: required items, documents, check orders, consents, and notifications. | A schema test confirms the tables exist, the item status allows exactly the eight ADR-09 statuses, and every item has source, method, verification date, and expiration date columns. | R2, ADR-09 | T5 | Not started |
| T7 | Seed the settings (30-day warning window, 3-business-day delayed threshold, 7-day resume window, mock vendor delay), two demo agencies, and one coordinator account per agency. | After a reset, a test reads all four settings and both agencies with their coordinators, and changing a setting row changes the value the database returns with no code change. | R8, R15, R20, ADR-07, ADR-12 | T6 | Not started |
| T8 | Seed the Indiana Home Health Aide requirement template, labeled as a sample pending confirmation against current Indiana rules. | After a reset, a test confirms the template and its required items exist and the template carries the sample label. | ADR-03, R12, R14 | T6 | Not started |
| T9 | Create the append-only audit events table, with triggers that log every change on every table and block updates and deletes on the audit table. | A test changes a caregiver record and finds the matching audit event, and attempts to update or delete an audit row fail. | R1, C5, ADR-10 | T6 | Not started |
| T10 | Create the lifecycle transition function covering every state in ADR-08. | Tests confirm every allowed transition succeeds, every other transition is refused, and no automated transition out of Review Required is accepted. | ADR-08, R17, C2 | T9 | Not started |
| T11 | Make Cleared a human-only transition that is refused, with a message naming the missing item, when any required item is incomplete or expired. | Tests confirm a coordinator can clear a fully verified record, a record with a missing or expired item is refused with that item named, and a system (non-human) caller is always refused. | C1, C2, R14, R23, ADR-08 | T10 | Not started |
| T12 | Create the eligibility check that moves a record to Eligible when every required item is verified and current. | A test verifies the last outstanding item and the record moves to Eligible — not Cleared — and a record with one expired item stays put. | R12, ADR-08 | T8, T10 | Not started |
| T13 | Store test SSNs in Supabase Vault, keeping only a token and the last four digits on the caregiver record, with a restricted function as the only way to read the full value. | A test stores an SSN and finds only a token and last four on the record, and the read function refuses anonymous and signed-in callers while allowing the service role. | R5, C4, C7, ADR-11 | T5 | Not started |

### Phase 2 — Sign-in, Roles, and Agency Separation

| ID | Task | Done when | Traces to (R# / ADR#) | Depends on | Status |
|----|------|-----------|--------------------------|------------|--------|
| T14 | Build coordinator sign-in with email and password. | A Playwright test signs in a seeded coordinator and lands on a placeholder dashboard, and a wrong password shows an error. | ADR-05, R4 | T2, T7 | Not started |
| T15 | Build applicant magic-link sign-in using Supabase's PKCE flow (sign-in code in the query string so it doesn't collide with the hash router), and configure Resend as Supabase Auth's email sender. | A Playwright test requests a link, follows it from the captured email, and lands signed in on the intended hash route, and a link request in the hosted project is delivered through Resend. | ADR-05, ADR-06, R8 | T3, T14 | Not started |
| T16 | Write row-level security policies on every table so coordinators see only their own agency's data. | A test signed in as Agency A's coordinator reads Agency A records and gets zero rows from each table for Agency B. | R4, C7, ADR-00 | T9, T14 | Not started |
| T17 | Write row-level security policies so applicants see only their own record, items, documents, and consents. | A test signed in as an applicant reads their own record and gets zero rows for another applicant's. | R4, R6 | T15, T16 | Not started |
| T18 | Create document storage buckets with per-agency and per-applicant access policies. | A test confirms a coordinator can read their own agency's files and an applicant can upload to and read only their own folder. | R4, R11, ADR-00a | T17 | Not started |
| T19 | Write the access-separation test suite covering tables and files. | The suite passes, proving Agency A's coordinator cannot read Agency B's records or files, one applicant cannot read another's, and no browser role can read the vault. | R4, R5, C7, ADR-07 | T13, T18 | Not started |

### Phase 3 — Mock Vendors, Scheduled Jobs, and Notifications

| ID | Task | Done when | Traces to (R# / ADR#) | Depends on | Status |
|----|------|-----------|--------------------------|------------|--------|
| T20 | Define the shared vendor adapter interface and build the mock background check adapter, returning results after the configured delay with the reserved test SSN outcomes. | Tests confirm SSNs ending 0001 return Clear, 0003 never return, and 0004 return a vendor failure, each after the configured delay. | ADR-01, ADR-12, R9, R10 | T7, T13 | Not started |
| T21 | Build the order-check function: set the item to Ordered with the order time, move a failed request to Retryable and allow a retry, and on a result attach it to the record, update the item, and create a notification. | Tests confirm 0001 ends Verified with source, method, and date filled and a notification created, and 0004 ends Retryable and returns to Ordered on retry. | R9, R10, R21, R2, ADR-11 | T12, T19, T20 | Not started |
| T22 | Build the mock OIG/SAM exclusion adapter, where a match moves the record to Review Required. | A test confirms an SSN ending 0002 moves the record to Review Required and later automated advancement is refused. | R19, R17, ADR-12 | T21 | Not started |
| T23 | Build the mock state registry adapter with a manual verification fallback. | Tests confirm the registry item is verified automatically when the registry is marked available and lands in Manual Verification when it is not. | R26, ADR-01 | T21 | Not started |
| T24 | Schedule an hourly pg_cron job that marks checks Delayed after the configured 3-business-day threshold. | A test runs the job and confirms an order placed four business days ago is Delayed while one placed two business days ago across a weekend is not. | R20, R16, ADR-13 | T21 | Not started |
| T25 | Schedule a daily pg_cron job that marks items Expiring (inside the 30-day window) or Expired and creates notifications. | A test runs the job and confirms items 29 days out become Expiring, past-date items become Expired, items 31 days out are unchanged, and notifications exist for each change. | R15, C6, ADR-13 | T7, T21 | Not started |
| T26 | Extend the daily job to move a Cleared record with an expired required item to Not Current and notify the coordinator. | A test runs the job and confirms a Cleared record with one expired item becomes Not Current with a coordinator notification, and a fully current Cleared record is untouched. | ADR-19, C2, C6, R14 | T11, T25 | Not started |
| T27 | Build the Edge Function that sends notification emails through Resend, triggered by a database webhook when a notification is created. | Inserting an email notification results in one Resend delivery and the notification marked sent, and a Resend failure is recorded rather than lost. | ADR-06, R7, R10, R15, R25 | T15, T21 | Not started |
| T28 | Create the SMS outbox table and log SMS-channel notifications to it instead of sending them. | A test confirms an SMS notification writes exactly one outbox row and makes no external call. | ADR-06 | T27 | Not started |
| T29 | Add a scheduled keep-alive so the Supabase free-tier project doesn't pause and stop the scheduled jobs. ⚠️ See Blocked / Questions. | A scheduled run succeeds and the project shows recent activity after seven idle days. | ⚠️ No direct trace — flagged | T4, T24 | Not started |

### Phase 4 — Applicant Intake, Consent, and Uploads

| ID | Task | Done when | Traces to (R# / ADR#) | Depends on | Status |
|----|------|-----------|--------------------------|------------|--------|
| T30 | Build the agency intake route, where each agency's link starts a partial record under that agency. | A Playwright test confirms Agency A's link creates an Intake In Progress record owned by Agency A only, an unknown link shows a not-found page, and no screen lists agencies. | ADR-18, R4, R7, C7 | T17, T15 | Not started |
| T31 | Build the identity and contact step, saving progress after each step and sending the SSN to the vault. | A Playwright test fills the step, reloads, and sees the data restored, and the database record holds only the SSN token and last four. | R5, R8, ADR-11 | T13, T30 | Not started |
| T32 | Build the "what you'll need and why" step, generated from the requirement template. | A Playwright test confirms every template item appears with its reason, and a test that changes the seeded template changes the list with no code change. | ADR-03, R18 | T8, T31 | Not started |
| T33 | Build document upload for JPG, PNG, and PDF up to 10 MB, compressed on the phone, with a required expiration date, recording the type and placing the item in Pending. | A Playwright test uploads a valid JPG and finds the item Pending with its type and date, and a 12 MB file and an unsupported format are each rejected with a message. | R11, ADR-15, NFR Performance | T18, T32 | Not started |
| T34 | Reject documents whose expiration date has already passed, on the phone and again on the server. | A Playwright test confirms the phone blocks a past date, and a direct server call with a past date is refused. | R24, ADR-15 | T33 | Not started |
| T35 | Build the separate disclosure screen and authorization screen, recording a timestamp and wording version for each. | A Playwright test passes through two distinct screens, and the database holds one consent row per screen with its timestamp and wording version. | R3, ADR-16, C8 | T31 | Not started |
| T36 | Handle a declined consent: stop screening, keep the record, and notify the coordinator. | A Playwright test declines authorization and confirms no check can be ordered, the record still exists, and a coordinator notification was created. | R25, ADR-16 | T27, T35 | Not started |
| T37 | Submit a complete intake to move the record to Intake Complete and notify the coordinator. | A Playwright test submits a complete intake and finds the record in Intake Complete with a coordinator notification, and an intake missing a required field cannot be submitted. | R7, ADR-08 | T33, T35, T27 | Not started |
| T38 | Let an applicant resume an abandoned intake by magic link within the 7-day resume window. ⚠️ See Blocked / Questions. | A Playwright test abandons intake, resumes by magic link, and returns to the last saved step, and a test past the configured window is refused with a clear message. | R8, ADR-05 | T31, T15 | Not started |
| T39 | Build the applicant status page showing outstanding items and what each is waiting on. Reuse template: adapt the loading, error, and empty-state pattern from `item-detail-page-component.js`. | A Playwright test signed in as an applicant sees each outstanding item with its current status and what it is waiting on, with no coordinator action. | R6, R18, R16 | T37, T21 | Not started |
| T40 | Build the credential replacement flow, where the applicant sees the requested item and due date and uploads a replacement. | A Playwright test with a seeded replacement request shows the item and due date on the status page, and the uploaded replacement lands Pending on that item. | R6, R11, R15, C6 | T25, T33, T39 | Not started |

### Phase 5 — Coordinator Screens

| ID | Task | Done when | Traces to (R# / ADR#) | Depends on | Status |
|----|------|-----------|--------------------------|------------|--------|
| T41 | Build the coordinator dashboard, listing caregivers by lifecycle state and highlighting incomplete intakes, declined consents, and delayed checks. Reuse template: adapt the list-with-states pattern from `collection-page-component.js`. | A Playwright test signed in as Agency A's coordinator sees seeded records grouped by state with the three highlights, and none of Agency B's records. | R4, R7, R8, R16, R20, R25 | T24, T36, T37 | Not started |
| T42 | Build the caregiver record view, showing each item's status, source, method, and dates, plus elapsed time for outstanding checks. Reuse template: adapt the route-parameter lookup, back link, and not-found state from `item-detail-page-component.js`. | A Playwright test opens a seeded record and sees every template item with its status, source, method, and dates, and an Ordered check shows its elapsed time. | R2, R16, ADR-09 | T41 | Not started |
| T43 | Add order-check and retry actions to the record view. | A Playwright test orders a check and sees the item move to Ordered, and a Retryable item returns to Ordered after retry. | R9, R21 | T42 | Not started |
| T44 | Add actions to mark a document verified, or unreadable (which sends it to Manual Verification). | A Playwright test marks one document verified with its method and date recorded, and marks another unreadable and finds it in Manual Verification. | R22, R2, ADR-15 | T42 | Not started |
| T45 | Add the Mark Cleared action, showing the refusal message from the lifecycle function. | A Playwright test clears a fully verified record, and on a record with a missing item sees the refusal message naming that item. | R23, R14, C1, ADR-08 | T11, T42 | Not started |
| T46 | Build the Review Required view, where a coordinator reviews an exclusion match and decides the next step manually. ⚠️ See Blocked / Questions. | A Playwright test opens a 0002 record, sees the match details with no automatic outcome offered, and the coordinator's decision is recorded in the audit log under their name. | R17, R19, C1 | T22, T42 | Not started |
| T47 | Build the expiration worklist, with an action to request a replacement from the caregiver. | A Playwright test sees each Expiring item with caregiver, item, and date, and requesting a replacement creates the request and a caregiver notification. | R15, C6, ADR-19 | T25, T40, T42 | Not started |
| T48 | Build the replacement review step, where the coordinator verifies a replacement by the same method as the original. | A Playwright test verifies a replacement and the item returns to current with the original method, and a Not Current record returns to Cleared only after the coordinator marks it Cleared. | R11, R15, C2, ADR-19 | T26, T44, T45, T47 | Not started |
| T49 | Build the SMS outbox page. | A Playwright test signed in as a coordinator sees the SMS messages logged for their agency only. | ADR-06, R4 | T28, T41 | Not started |

### Phase 6 — Compliance Report

| ID | Task | Done when | Traces to (R# / ADR#) | Depends on | Status |
|----|------|-----------|--------------------------|------------|--------|
| T50 | Build the Edge Function that generates a single-caregiver compliance report PDF with every required item, its evidence, and its verification history. | A test generates a PDF for a fully screened seeded caregiver containing every template item with source, method, dates, evidence, and audit history, and a request from another agency's coordinator is refused. | R13, R2, ADR-14 | T9, T21, T44 | Not started |
| T51 | Add a "Download compliance report" action to the record view. | A Playwright test clicks the action and receives the PDF within 30 seconds. | R13, ADR-14, NFR Performance | T42, T50 | Not started |

### Phase 7 — Acceptance and Go/No-Go

| ID | Task | Done when | Traces to (R# / ADR#) | Depends on | Status |
|----|------|-----------|--------------------------|------------|--------|
| T52 | Write phone-size Playwright tests for Spec Section 5 acceptance criteria 1 (intake creates a record and notifies) and 2 (incomplete record cannot be cleared). | Both tests pass against the deployed build. | R7, R14, R23, ADR-17 | T37, T45 | Not started |
| T53 | Write phone-size Playwright tests for Spec Section 5 acceptance criteria 3 (exclusion match locks the record) and 4 (expiration produces a warning). | Both tests pass against the deployed build. | R19, R15, ADR-17 | T46, T47 | Not started |
| T54 | Run an accessibility check (screen reader labels, contrast, one-handed layout) on the intake and status pages, and fix any issues found. | An automated accessibility scan reports no serious or critical issues on each intake step and the status page, and a manual screen-reader pass on a phone is logged with no open issues. | NFR Accessibility, ADR-17 | T39, T40 | Not started |
| T55 | Test intake on a throttled 3G connection and record the results. ⚠️ See Blocked / Questions. | A Playwright run on a throttled 3G profile completes intake, and per-step load and upload times are recorded in `docs/`. | NFR Performance, ADR-15 | T37 | Not started |
| T56 | Prepare a go/no-go demo script that walks through Scenarios 1–3 using the test SSNs. ⚠️ See Blocked / Questions. | A second person follows the script start to finish on the deployed build without help, and every step produces the outcome the script describes. | ⚠️ No direct trace — flagged | T51, T52, T53, T54, T55 | Not started |

**Status values:** Not started · In progress · Done · Blocked

## Definition of Done (applies to every task)
- Matches its linked requirement's acceptance criteria in the specification.
- Reviewed by a human before marked done
- No task marked done without a test passing

## Blocked / Questions
| Task | Blocker | Raised | Resolved |
|------|---------|--------|----------|
| T29 | No requirement, ADR, or constitution item covers a keep-alive; the closest link is the plan's free-tier risk. A pg_cron job can't wake a paused project, so the keep-alive would need an external scheduler (e.g., GitHub Actions) — the option ADR-13 rejected for jobs. Decide whether to add an ADR, or drop the task and move to a paid tier for the pilot. | 2026-09-22 | |
| T56 | Traces only to plan Section 6 step 7 and the business case's go/no-go recommendation, not to an R#, ADR#, or C#. Decide whether to accept that trace or add one. | 2026-09-22 | |
| T38 | Supabase magic links expire after at most 24 hours, so a single link can't stay valid for 7 days as ADR-05 states. Proposed reading: the partial record is kept for 7 days and the applicant can request a fresh magic link any time in that window. Confirm and update ADR-05 if accepted. | 2026-09-22 | |
| T10, T46 | Neither the specification nor the plan says where a record may go after Review Required (e.g., back to Screening In Progress, or closed). The transition function and the Review Required view both need this. | 2026-09-22 | |
| T55 | The specification says interaction time must be "acceptable" on a low-end Android phone over 3G but gives no number, so there is no pass/fail threshold. Set a target per step. | 2026-09-22 | |
| T1–T56 | `.github/copilot-instructions.md` at the repository root tells AI assistants to keep the CSV-driven template and not switch frameworks, which conflicts with building `/app`. ADR-02 says root files stay untouched. Decide how assistants working in `/app` should be guided. | 2026-09-22 | |
| T4 | Deploying `/app` to GitHub Pages replaces whatever the repository's Pages site serves today. Confirm nothing depends on the current Pages site. | 2026-09-22 | |
