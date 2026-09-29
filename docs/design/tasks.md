# Tasks — CareMatch

> Derived from the plan document. Each task is small, checkable, and traceable to a requirement.

## Task List

Phases follow plan.md Section 6. All new work lives in `/app` (ADR-02); no task changes or deletes the original template files at the repository root. Where a task says **reuse template**, it ports that pattern from the root template into `/app` rather than rewriting it from scratch — the originals stay untouched. The demo is front end only and connects to no external systems (ADR-00); every task that stores or reads data goes through the data layer (ADR-21).

### Phase 0 — Project Setup

| ID | Task | Done when | Traces to (R# / ADR#) | Depends on | Status |
|----|------|-----------|--------------------------|------------|--------|
| T1 | Scaffold a Vue 3 + Vite + TypeScript + Bootstrap 5 + Vue Router app in `/app`. Reuse template: port the hash-history router setup and route-table pattern from `app.js`, the viewport meta tag from `index.html`, and the navbar from `navbar-component.js` as single-file components styled with the CareMatch theme, with the navbar showing `carematchlogo.png` in place of "Mike's App". | `/app` builds without errors and shows an empty home page at `#/` with the ported navbar and CareMatch logo, and `git status` shows no changes outside `/app`. | ADR-00, ADR-02, ADR-20 | — | Done |
| T57 | Build the CareMatch Bootstrap theme and shared components per design system Sections 2–6: palette, Roboto typography, logo, primary and secondary buttons, card, form field, and a status badge that pairs a text label with an icon. Bundle Roboto and Bootstrap Icons from npm rather than loading them from Google Fonts or a CDN. | Manual check: a component preview page shows every component, Chrome's Lighthouse accessibility audit reports no contrast failures (WCAG 2.1 AA, 4.5:1 for body text), and the DevTools Network panel shows no requests to outside sites. | ADR-20, ADR-00a, NFR Accessibility, NFR Branding | T1 | Not started |
| T2 | Set up Vitest in `/app` with one smoke test. | One Vitest smoke test passes locally with `npm test`. | ADR-17 | T1 | Done |
| T3 | Create the data-layer interface and its browser-storage implementation: localStorage for records, IndexedDB for documents, and a seed loader that parses the CSV files in `/app/public/seed/` with PapaParse on first start and resolves relative dates (`today+N`, `today-N`). | A Vitest test loads a small test seed, resolves `today+20` to the correct date, reads the rows back through the interface, and a second start does not reload the seed over saved data. | ADR-21, ADR-00 | T1 | Not started |
| T4 | Add a GitHub Actions workflow that builds `/app`, runs the tests, and deploys to GitHub Pages on every push to `main`; turn on secret scanning and push protection. | A push to `main` produces a green run and the Pages URL shows the home page with all assets loading, and the repository's security settings show secret scanning and push protection enabled. | ADR-00, ADR-00a | T2 | Not started |

### Phase 1 — Data Layer, Seed Data, Lifecycle Rules, and Audit Log

| ID | Task | Done when | Traces to (R# / ADR#) | Depends on | Status |
|----|------|-----------|--------------------------|------------|--------|
| T5 | Define the data-model types for agencies, user roles, settings, caregivers (lifecycle state, SSN token, last four digits), and requirement templates. | Type checking passes and a test confirms the caregiver state allows exactly the seven ADR-08 states, including Not Current. | ADR-08, ADR-11, ADR-03, R4 | T3 | Not started |
| T6 | Define the data-model types for required items, documents, check orders, consents, and notifications. | A test confirms the item status allows exactly the eight ADR-09 statuses, and every item has source, method, verification date, and expiration date fields. | R2, ADR-09 | T5 | Not started |
| T7 | Seed the settings (30-day warning window, 3-business-day delayed threshold, 7-day resume window, mock vendor delay), two demo agencies, and one coordinator account per agency in `settings.csv`, `agencies.csv`, and `users.csv`. | After "Reset demo data", a test reads all four settings and both agencies with their coordinators, and changing a value in `settings.csv` changes the value the data layer returns with no code change. | R8, R15, R20, ADR-07, ADR-12, ADR-21 | T6 | In progress |
| T8 | Seed the Indiana Home Health Aide requirement template in `requirement_templates.csv` and `template_items.csv`, labeled as a sample pending confirmation against current Indiana rules, with a plain-language reason for each item. | After a reset, a test confirms the template and its required items exist and the template carries the sample label. | ADR-03, R12, R14, R18 | T6 | In progress |
| T58 | Seed demo caregivers in `caregivers.csv`, `required_items.csv`, `consents.csv`, `replacement_requests.csv`, and `audit_events.csv`: fake caregivers across both agencies, at least one in each lifecycle state, 900-series test SSNs, and dates relative to today. | After a reset, a test finds all seven lifecycle states in Agency A, caregivers in both agencies, only 900-series SSNs (held in the vault, not on the record), and audit history for every Cleared caregiver. | ADR-07, ADR-12, ADR-21, R1, R2 | T8, T9, T13 | In progress |
| T59 | Add a "Reset demo data" action that clears browser storage and reloads the seed. | Manual check: change a record, click "Reset demo data", and see the record back at its seeded values. | ADR-21 | T3, T58 | Not started |
| T9 | Create the append-only audit log in the data layer, recording an event for every write and offering no way to change or remove an event. | A test changes a caregiver record and finds the matching audit event, and the data-layer interface has no update or delete operation for audit events. | R1, C5, ADR-10 | T6 | Not started |
| T10 | Create the lifecycle transition function covering every state in ADR-08. | Tests confirm every allowed transition succeeds, every other transition is refused, and no automated transition out of Review Required is accepted. | ADR-08, R17, C2 | T9 | Not started |
| T11 | Make Cleared a human-only transition that is refused, with a message naming the missing item, when any required item is incomplete or expired. | Tests confirm a coordinator can clear a fully verified record, a record with a missing or expired item is refused with that item named, and a system (non-human) caller is always refused. | C1, C2, R14, R23, ADR-08 | T10 | Not started |
| T12 | Create the eligibility check that moves a record to Eligible when every required item is verified and current. | A test verifies the last outstanding item and the record moves to Eligible — not Cleared — and a record with one expired item stays put. | R12, ADR-08 | T8, T10 | Not started |
| T13 | Store test SSNs in the data layer's separate vault store, keeping only a token and the last four digits on the caregiver record, with the vendor adapters as the only readers of the full value. | A test stores an SSN and finds only a token and last four on the record, and no read used by screens returns the full value. | R5, C4, C7, ADR-11 | T5 | Not started |

### Phase 2 — Demo Sign-in, Roles, and Agency Separation

| ID | Task | Done when | Traces to (R# / ADR#) | Depends on | Status |
|----|------|-----------|--------------------------|------------|--------|
| T14 | Build demo coordinator sign-in with email and password checked against the seeded accounts. | Manual check: sign in as a seeded coordinator and land on a placeholder dashboard; a wrong password shows an error. | ADR-05, R4 | T2, T7, T57 | Not started |
| T15 | Build applicant magic-link sign-in: requesting a link writes it to the in-app outbox, the sign-in screen offers a demo link to the outbox, and following the link signs the applicant in on the intended hash route. | Manual check: request a link, open it from the outbox, and land signed in on the intended route. | ADR-05, ADR-06, R8 | T3, T14 | Not started |
| T16 | Add the data-layer agency filter so coordinators read only their own agency's data. | A test signed in as Agency A's coordinator reads Agency A records and gets zero rows from each store for Agency B. | R4, C7, ADR-21 | T9, T14 | Not started |
| T17 | Extend the filter so applicants read only their own record, items, documents, and consents. | A test signed in as an applicant reads their own record and gets zero rows for another applicant's. | R4, R6, ADR-21 | T15, T16 | Not started |
| T18 | Store documents in IndexedDB tagged with agency and applicant, behind the same access filter. | A test confirms a coordinator can read their own agency's files and an applicant can upload and read only their own. | R4, R11, ADR-15, ADR-21 | T17 | Not started |
| T19 | Write the access-separation test suite covering records and files. | The suite passes, proving Agency A's coordinator cannot read Agency B's records or files, one applicant cannot read another's, and no screen-facing read returns a full SSN from the vault. | R4, R5, C7, ADR-07 | T13, T18 | Not started |

### Phase 3 — Mock Vendors, Jobs, and Outbox

| ID | Task | Done when | Traces to (R# / ADR#) | Depends on | Status |
|----|------|-----------|--------------------------|------------|--------|
| T20 | Define the shared vendor adapter interface and build the mock background check adapter, returning results after the configured delay with the reserved test SSN outcomes. | Tests confirm SSNs ending 0001 return Clear, 0003 never return, and 0004 return a vendor failure, each after the configured delay. | ADR-01, ADR-12, R9, R10 | T7, T13 | Not started |
| T21 | Build the order-check function: set the item to Ordered with the order time, move a failed request to Retryable and allow a retry, and on a result attach it to the record, update the item, and create a notification. | Tests confirm 0001 ends Verified with source, method, and date filled and a notification created, and 0004 ends Retryable and returns to Ordered on retry. | R9, R10, R21, R2, ADR-11 | T12, T19, T20 | Not started |
| T22 | Build the mock OIG/SAM exclusion adapter, where a match moves the record to Review Required. | A test confirms an SSN ending 0002 moves the record to Review Required and later automated advancement is refused. | R19, R17, ADR-12 | T21 | Not started |
| T23 | Build the mock state registry adapter with a manual verification fallback. | Tests confirm the registry item is verified automatically when the registry is marked available and lands in Manual Verification when it is not. | R26, ADR-01 | T21 | Not started |
| T24 | Build the delayed-check job, run on app load and when the demo date changes, that marks checks Delayed after the configured 3-business-day threshold. | A test runs the job and confirms an order placed four business days ago is Delayed while one placed two business days ago across a weekend is not. | R20, R16, ADR-13 | T21 | Not started |
| T25 | Build the expiration job, run on app load and when the demo date changes, that marks items Expiring (inside the 30-day window) or Expired and creates notifications. | A test runs the job and confirms items 29 days out become Expiring, past-date items become Expired, items 31 days out are unchanged, and notifications exist for each change. | R15, C6, ADR-13 | T7, T21 | Not started |
| T26 | Extend the expiration job to move a Cleared record with an expired required item to Not Current and notify the coordinator. | A test runs the job and confirms a Cleared record with one expired item becomes Not Current with a coordinator notification, and a fully current Cleared record is untouched. | ADR-19, C2, C6, R14 | T11, T25 | Not started |
| T60 | Add a demo-date control to the navbar that sets the date the app treats as today and re-runs both jobs. | Manual check: move the demo date forward past a seeded expiration date and see the item become Expired; return the date to today and see the seeded state again. | ADR-13, R15, R20, C6 | T24, T25, T59 | Not started |
| T27 | Build the notification service that writes each email notification to the in-app outbox. | A test confirms creating an email notification writes exactly one outbox row marked email and makes no network request. | ADR-06, R7, R10, R15, R25 | T21 | Not started |
| T28 | Log SMS-channel notifications to the same outbox, marked SMS. | A test confirms an SMS notification writes exactly one outbox row marked SMS and makes no network request. | ADR-06 | T27 | Not started |

### Phase 4 — Applicant Intake, Consent, and Uploads

| ID | Task | Done when | Traces to (R# / ADR#) | Depends on | Status |
|----|------|-----------|--------------------------|------------|--------|
| T30 | Build the agency intake route, where each agency's link starts a partial record under that agency. | Manual check: Agency A's link starts intake, an unknown link shows a not-found page, and no screen lists agencies. A Vitest test confirms the link creates an Intake In Progress record owned by Agency A only. | ADR-18, R4, R7, C7 | T17, T15 | Not started |
| T31 | Build the identity and contact step, saving progress after each step and sending the SSN to the vault. | Manual check: fill the step, reload, and see the data restored. A Vitest test confirms the stored record holds only the SSN token and last four. | R5, R8, ADR-11 | T13, T30 | Not started |
| T32 | Build the "what you'll need and why" step, generated from the requirement template. | Manual check: every template item appears with its reason; after changing an item in `template_items.csv` and using "Reset demo data", the list shows the change with no code change. | ADR-03, R18 | T8, T31 | Not started |
| T33 | Build document upload for JPG, PNG, and PDF up to 10 MB, compressed on the phone, with a required expiration date, recording the type and placing the item in Pending. | Manual check: upload a valid JPG and see the item Pending with its type and date; a 12 MB file and an unsupported format are each rejected with a message. | R11, ADR-15, NFR Performance | T18, T32 | Not started |
| T34 | Reject documents whose expiration date has already passed, in the form and again in the data layer. | Manual check: the form blocks a past date. A Vitest test confirms a direct data-layer call with a past date is refused. | R24, ADR-15 | T33 | Not started |
| T35 | Build the separate disclosure screen and authorization screen, recording a timestamp and wording version for each. | Manual check: intake passes through two distinct screens. A Vitest test confirms the data layer holds one consent row per screen with its timestamp and wording version. | R3, ADR-16, C8 | T31 | Not started |
| T36 | Handle a declined consent: stop screening, keep the record, and notify the coordinator. | Manual check: decline authorization and confirm no check can be ordered, the record still exists, and a coordinator notification appears in the outbox. | R25, ADR-16 | T27, T35 | Not started |
| T37 | Submit a complete intake to move the record to Intake Complete and notify the coordinator. | Manual check: submit a complete intake and see the record in Intake Complete with a coordinator notification in the outbox; an intake missing a required field cannot be submitted. | R7, ADR-08 | T33, T35, T27 | Not started |
| T38 | Let an applicant resume an abandoned intake by magic link within the 7-day resume window. | Manual check: abandon intake, open a new link from the outbox, and return to the last saved step; a link used after the window (moved with the demo-date control) is refused with a clear message. | R8, ADR-05 | T31, T15, T60 | Not started |
| T39 | Build the applicant status page showing outstanding items and what each is waiting on. Reuse template: adapt the loading, error, and empty-state pattern from `item-detail-page-component.js`. | Manual check: signed in as an applicant, see each outstanding item with its current status and what it is waiting on, with no coordinator action. | R6, R18, R16 | T37, T21 | Not started |
| T40 | Build the credential replacement flow, where the applicant sees the requested item and due date and uploads a replacement. | Manual check: signed in as a caregiver with a seeded replacement request (Robert King, cg-06), the status page shows the item and due date, and an uploaded replacement lands Pending on that item. | R6, R11, R15, C6 | T25, T33, T39 | Not started |

### Phase 5 — Coordinator Screens

| ID | Task | Done when | Traces to (R# / ADR#) | Depends on | Status |
|----|------|-----------|--------------------------|------------|--------|
| T41 | Build the coordinator dashboard, listing caregivers by lifecycle state and highlighting incomplete intakes, declined consents, and delayed checks. Reuse template: adapt the list-with-states pattern from `collection-page-component.js`. | Manual check: signed in as Agency A's coordinator, see seeded records grouped by state with the three highlights, and none of Agency B's records. | R4, R7, R8, R16, R20, R25 | T24, T36, T37 | Not started |
| T42 | Build the caregiver record view, showing each item's status, source, method, and dates, plus elapsed time for outstanding checks. Reuse template: adapt the route-parameter lookup, back link, and not-found state from `item-detail-page-component.js`. | Manual check: open a seeded record and see every template item with its status, source, method, and dates; an Ordered check shows its elapsed time. | R2, R16, ADR-09 | T41 | Not started |
| T43 | Add order-check and retry actions to the record view. | Manual check: order a check and see the item move to Ordered; a Retryable item returns to Ordered after retry. | R9, R21 | T42 | Not started |
| T44 | Add actions to mark a document verified, or unreadable (which sends it to Manual Verification). | Manual check: mark one document verified and see its method and date recorded; mark another unreadable and find it in Manual Verification. | R22, R2, ADR-15 | T42 | Not started |
| T45 | Add the Mark Cleared action, showing the refusal message from the lifecycle function. | Manual check: clear a fully verified record; on a record with a missing item, see the refusal message naming that item. | R23, R14, C1, ADR-08 | T11, T42 | Not started |
| T46 | Build the Review Required view, where a coordinator reviews an exclusion match and decides the next step manually. ⚠️ See Blocked / Questions. | Manual check: open a 0002 record and see the match details with no automatic outcome offered; the coordinator's decision appears in the audit log under their name. | R17, R19, C1 | T22, T42 | Not started |
| T47 | Build the expiration worklist, with an action to request a replacement from the caregiver. | Manual check: see each Expiring item with caregiver, item, and date; requesting a replacement creates the request and a caregiver notification in the outbox. | R15, C6, ADR-19 | T25, T40, T42 | Not started |
| T48 | Build the replacement review step, where the coordinator verifies a replacement by the same method as the original. | Manual check: verify a replacement and see the item return to current with the original method; a Not Current record returns to Cleared only after the coordinator marks it Cleared. | R11, R15, C2, ADR-19 | T26, T44, T45, T47 | Not started |
| T49 | Build the outbox page, showing email and SMS messages. | Manual check: signed in as a coordinator, see only their agency's messages, each marked email or SMS. | ADR-06, R4 | T28, T41 | Not started |

### Phase 6 — Compliance Report

| ID | Task | Done when | Traces to (R# / ADR#) | Depends on | Status |
|----|------|-----------|--------------------------|------------|--------|
| T50 | Build the printable single-caregiver compliance report page with every required item, its evidence, and its verification history, and a print stylesheet for "Save as PDF". | Manual check: open the report for a fully screened seeded caregiver and find every template item with source, method, dates, evidence, and audit history; another agency's coordinator is refused; and the print preview hides the navbar and demo controls. | R13, R2, ADR-14 | T9, T21, T44 | Not started |
| T51 | Add a "Compliance report" action to the record view that opens the report ready to print or save as PDF. | Manual check: click the action and the complete report loads within 30 seconds. | R13, ADR-14, NFR Performance | T42, T50 | Not started |

### Phase 7 — Acceptance and Go/No-Go

| ID | Task | Done when | Traces to (R# / ADR#) | Depends on | Status |
|----|------|-----------|--------------------------|------------|--------|
| T52 | Write and run phone-size manual checks for Spec Section 5 acceptance criteria 1 (intake creates a record and notifies) and 2 (incomplete record cannot be cleared). | Both checks pass on the deployed build and the results are logged in `docs/manual-checks.md`. | R7, R14, R23, ADR-17 | T37, T45 | Not started |
| T53 | Write and run phone-size manual checks for Spec Section 5 acceptance criteria 3 (exclusion match locks the record) and 4 (expiration produces a warning). | Both checks pass on the deployed build and the results are logged in `docs/manual-checks.md`. | R19, R15, ADR-17 | T46, T47 | Not started |
| T54 | Run an accessibility check (screen reader labels, contrast against WCAG 2.1 AA at 4.5:1 for body text per design system Section 8, one-handed layout) on the intake and status pages, and fix any issues found. | Manual check: Chrome's Lighthouse accessibility audit reports no contrast or labeling failures on each intake step and the status page, and a screen-reader pass on a phone is logged with no open issues. | NFR Accessibility, ADR-17 | T39, T40 | Not started |
| T55 | Test intake by hand with Chrome DevTools throttled to a 3G profile and record the results. ⚠️ See Blocked / Questions. | Manual check: intake completes on the throttled profile, and per-step load and upload times are recorded in `docs/`. | NFR Performance, ADR-15 | T37 | Not started |
| T56 | Prepare a go/no-go demo script that walks through Scenarios 1–3 in one browser using the test SSNs, "Reset demo data", and the demo-date control. ⚠️ See Blocked / Questions. | A second person follows the script start to finish on the deployed build without help, and every step produces the outcome the script describes. | ⚠️ No direct trace — flagged | T51, T52, T53, T54, T55, T59, T60 | Not started |

**Status values:** Not started · In progress · Done · Blocked

## Definition of Done (applies to every task)
- Matches its linked requirement's acceptance criteria in the specification.
- Reviewed by a human before marked done
- No task marked done without a passing check: a Vitest test for logic, or for screens a completed manual check logged in `docs/manual-checks.md` (ADR-17)
- Manual checks are done at phone size in Chrome DevTools device mode
- Screens use the shared design-system components, and labels and messages follow its voice & tone (ADR-20)
- Makes no network request outside the app itself (ADR-00, ADR-00a)

## Blocked / Questions
| Task | Blocker | Raised | Resolved |
|------|---------|--------|----------|
| T29 | No requirement, ADR, or constitution item covers a keep-alive; the closest link is the plan's free-tier risk. A pg_cron job can't wake a paused project, so the keep-alive would need an external scheduler (e.g., GitHub Actions) — the option ADR-13 rejected for jobs. Decide whether to add an ADR, or drop the task and move to a paid tier for the pilot. | 2026-09-22 | 2026-09-29 — Task dropped. The demo has no hosted backend that can pause (ADR-00). |
| T56 | Traces only to plan Section 6 step 7 and the business case's go/no-go recommendation, not to an R#, ADR#, or C#. Decide whether to accept that trace or add one. | 2026-09-22 | |
| T38 | Supabase magic links expire after at most 24 hours, so a single link can't stay valid for 7 days as ADR-05 states. Proposed reading: the partial record is kept for 7 days and the applicant can request a fresh magic link any time in that window. Confirm and update ADR-05 if accepted. | 2026-09-22 | 2026-09-29 — The demo generates its own sign-in links (ADR-05), so no Supabase limit applies. Revisit when the pilot backend is chosen. |
| T10, T46 | Neither the specification nor the plan says where a record may go after Review Required (e.g., back to Screening In Progress, or closed). The transition function and the Review Required view both need this. | 2026-09-22 | |
| T55 | The specification says interaction time must be "acceptable" on a low-end Android phone over 3G but gives no number, so there is no pass/fail threshold. Set a target per step. | 2026-09-22 | |
| T1–T56 | `.github/copilot-instructions.md` at the repository root tells AI assistants to keep the CSV-driven template and not switch frameworks, which conflicts with building `/app`. ADR-02 says root files stay untouched. Decide how assistants working in `/app` should be guided. | 2026-09-22 | 2026-09-29 — The file was removed from the repository. |
| T4 | Deploying `/app` to GitHub Pages replaces whatever the repository's Pages site serves today. Confirm nothing depends on the current Pages site. | 2026-09-22 | |
