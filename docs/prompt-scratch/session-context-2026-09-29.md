# Session Context — 2026-09-29

Handoff notes for picking the CareMatch build back up, written for Mike and for a future Claude session. Read this first, then `docs/design/tasks.md` for the live task list. Nothing here overrides the design docs; where they differ, the design docs win and this file is stale.

*Last refreshed after T66; since then T50 and T51 are Done (Phases 0–6 complete) and T52/T53 were dropped. Next: T54.*

## 1. Where things stand

| Phase | Tasks | Status |
|---|---|---|
| 0 — Setup | T1, T57, T2, T3, T4, T61 | All Done |
| 1 — Data layer, rules, audit | T5–T13, T58, T59 | All Done |
| 2 — Sign-in and access | T14–T19 | All Done |
| 3 — Mock vendors, jobs, outbox | T20–T28, T64, T60 | All Done (T29 dropped) |
| 4 — Applicant intake | T30–T40, T62 | All Done |
| 5 — Coordinator screens | T41–T49, T66 | All Done |
| 6 — Compliance report | T50, T51 | All Done |
| 7 — Acceptance and go/no-go | T54–T56, T63, T65 (T52, T53 dropped) | Not started |

- **Tests:** 49 Vitest files, 253 tests, all passing. Vitest prints an informational "fsModuleCache" speed tip; deliberately left off.
- **Git:** Mike commits and pushes himself, one commit per task. Last commit seen: `fcf16d8` "T49 outbox" (T66 may be committed since).
- **Live site:** app at https://naleisa.github.io/mbroniek-IUSB-System-Design-M1/#/ and docs at …/docs/ — both redeploy on every push to `main`.
- **Blocked / Questions table:** no open items.
- **Tasks added this session:** T62 (test-SSN hint), T63 (UAT guide), T64 (verify by hand), T65 (self-guided walkthrough, now an in-app `#/walkthrough` page opened in a second tab, a short overview rather than a test script), T66 (home page and navigation). Reworded along the way: T40, T44 (added "View document"), T46, T56, T60, T63. Follow-ups logged in manual-checks.md: T31 (phone/SSN formatting and digit limits), T41 (dashboard next steps), T48 (outbox newest-first).
- **Phase 7 order:** T54 accessibility and T55 Slow 3G checks → T56 go/no-go script → T63 UAT guide (also covers Spec Section 5 criteria 1–4; T52 and T53 were dropped for that reason) → T65 walkthrough. T56, T63, and T65 all depend on T66 (done).

## 2. How we work

### Per-task workflow (`docs/prompt-scratch/prompt-template`, updated this session)
1. **Mike types just the task ID** (e.g. "T50"); apply the full template. Implement **exactly one task**.
2. Read the task in tasks.md, its requirements in specification.md, its ADRs in plan.md, and design-system.md; confirm dependencies are Done.
3. **Restate findings briefly (1–5), then list decisions, each with a recommendation and why, and wait.** Mike usually answers "Go ahead" / "Yes". Flag anything the docs don't settle, and **flag gaps in the task list** (this session found several: manual verification → T64, viewing documents → T44, no home page → T66, dashboard "nothing needs attention" → T41 follow-up).
4. Build only what the task says; note other issues without fixing them. No new libraries, styles, or patterns.
5. Verify with `npx vue-tsc --noEmit`, `npm test`, and `npm run build` in `/app`.
6. Report in three parts: changes; plain-language explanation; acceptance criteria and **numbered manual-check steps at phone width with the data to enter and the URLs**.
7. Leave the status unchanged until Mike confirms ("Confirmed", "Confirm", "Completed"); then set it to Done in tasks.md and add a row to `docs/manual-checks.md`. Small fixes Mike asks for after a task is Done are logged as "T## (follow-up)" rows.

### Mike's preferences
- Show expected changes before large document edits; ask before rewriting design docs.
- Plain language; recommendations with reasons, not surveys.
- Demo-friendly touches are welcome but proposed first.
- "The scratch prompt" means `docs/prompt-scratch/prompt-template`; "the context file" means this file.
- Mike keeps his own log in `docs/prompt-scratch/learned.md`; don't edit it.
- When giving manual checks, include what to type (e.g. Nina Lopez, `nina.lopez@example.com`, `5745550142`, `04/12/1990`, SSN `900300001`) and the URLs.

### Environment
- Windows 11, VS Code extension, Git Bash + PowerShell, Node 24. No `gh`, Ruby, or Python.
- **Stop `npm run dev` before `npm ci`.**
- **Bash heredocs mangle apostrophes and backslash escapes (`\D` became `D` twice).** Write edit scripts to the scratchpad with the Write tool and run them with `node`, or use the Edit tool directly for anything with regex escapes.

## 3. Decisions and design

### Scope, stack, hosting
- Front end only, no external systems at runtime (Spec D1, ADR-00); mock data layer in the browser (ADR-21).
- Vue 3, Vue Router v4, Vite 8, TypeScript ~5.9 (target ES2020, no `Array.at()`), Bootstrap 5, Bootstrap Icons, Roboto, PapaParse, Vitest 5.
- ADR-17: Vitest for logic; screens get manual checks at phone size, logged in `docs/manual-checks.md`.
- GitHub Pages via Actions; docs built with jekyll-build-pages into `app/dist/docs`; the docs link only works on the deployed site.

### Design system as built
- Bootstrap primary **#a93f55**; background #f3f7f0; text #19323c; one primary button per screen; secondary = `btn-outline-primary`.
- **`FormField.vue`** props: `id`, `label`, `type`, `required`, `autocomplete`, `inputmode`, `error`, `help`, `placeholder`, `maxDigits` (blocks typed digits past the limit; pastes are trimmed by the page), `min` (dates).
- **`StatusBadge.vue`**: icon + text, four tones; also knows "Incomplete intake" / "Delayed check" (warning) and "Declined consent" (danger).
- Pages that load data follow the base template's pattern: grey loading alert, red error alert, yellow not-found/empty alert (via `demoDataKey`).

### Data layer (`app/src/data/`)
- **`dataLayer.ts`** — `DataLayer`:
  - `list`, `get` (filtered), `insert`, `update` (need an `Actor`; audited). System jobs: `{ role: 'system', name: 'CareMatch' }`.
  - `storeSsn`; `putDocument` / `getDocument` / `listDocuments` (filtered; **refuses documents whose expiration date is before today**, as do `insert`/`update` on `documents`).
  - Sign-in: `signIn`, `requestSignInLink` (default landing `/applicant/resume`; ignores blank emails), `issueResumeLink`, `signInWithLink` (expired links return the email), `signOut`, `getSignedInUser`.
  - Narrow functions for signed-out or cross-role needs: `startIntake(slug)`, `agencyNameForIntake(slug)`, `outboxFor(email)` (newest first; same-minute messages in reverse sending order), `emailInUse`, `notifyMyCoordinators(subject, body)`.
  - Demo date: `today()`, `getDemoDate()`, `setDemoDate()`. **Always use `dataLayer.today()`, never `new Date()`** (seed loading excepted).
  - `loadSeed`, `resetDemoData`.
- **Access filter:** coordinators see their agency plus shared tables; applicants see their own record, messages to them, and shared tables (no `check_orders` or audit log); **signed out sees only shared tables, no documents, and every write is refused**. Tests needing the whole seed use `createSystemDataLayer`.
- **`lifecycle.ts`:** 11 transitions; `transitionCaregiver`; `findBlockingItems` (missing / expired / not verified yet); `checkEligibility`; **`clearRecord`** (T45: checks items first so refusals always name what's needed; from Screening, Eligible, or Not Current).
- **`vendors.ts`:** shared `VendorAdapter`; mocks for background check, OIG/SAM exclusion, and registry; `TEST_SSN_OUTCOMES` (0001 Clear, 0002 match, 0003 never returns, 0004 failure).
- **`checks.ts`:**
  - `orderCheck` — Pending, Retryable, or **Delayed** (orders again, earlier order kept); needs the latest authorization **granted**; refuses unsubmitted applications; the first order on Intake Complete moves the record to Screening In Progress.
  - **`createCheckService(backend, dataLayer)`** — how screens order checks (`checkServiceKey`); `vendorForItem` picks the vendor by method.
  - `verifyManually` (T64), `verifyDocument` / `markUnreadable` (T44), `reviewExclusionMatch` (T46: "not a match" moves back to Screening, verifies matched items by hand, then eligibility; "confirm" records "Confirmed match", final), `verifyReplacement` (T48: keeps original method, uses replacement's date, closes request, never changes record state), `latestAuthorization`, `latestDocumentFor`.
- **`jobs.ts`:** delayed-check job (3 business days, reversible) and expiration job (30-day window; forward moves email caregiver + coordinators; Cleared with an Expired item → Not Current). Both run on load in `main.ts`.
- **`notifications.ts`:** `sendEmail`, `sendSms` (blank subject), `coordinatorsOf`. Nothing is sent.
- **`intake.ts`:** identity step (`saveIdentityStep`, formatting helpers, `PHONE_DIGITS`/`SSN_DIGITS`), `whatYoullNeed`, uploads (`uploadDocument`, `checkUploadFile`, `checkExpirationDate`), consents (`recordConsent`, `currentConsent`, `declineAuthorization`), `intakeChecklist`, `submitIntake`, `resumeStep`, `applicantStatus`, `uploadReplacement`.
- **`consentWording.ts`:** disclosure and authorization text, version `v1.0` (sample; needs legal review).
- **`dashboard.ts`** (`coordinatorDashboard`: groups by state, three highlights, next steps), **`record.ts`** (`caregiverRecord`), **`worklist.ts`** (`expirationWorklist`, `requestReplacement` — email + SMS, due on expiration date or +14 days if expired), **`outbox.ts`** (`agencyOutbox`, sign-in links hidden from coordinators).
- **`compressImage.ts`** (in `src/`): canvas compression, 1600px, JPEG 80%.
- Uploaded files live **only in the browser**: IndexedDB `carematch` / `documents` (the file) plus `carematch:documents` in Local Storage (the details), same `doc-…` id. Seeded documents have no file ("Sample document: no image in the demo").

### Screens and routes

| Route | Page | Notes |
|---|---|---|
| `#/` | Home (T66) | Three ways in; "Try applying" demo shortcut to Hoosier Home Care (accepted ADR-18 exception); signed-in banner; docs link |
| `#/sign-in` | Coordinator sign-in | Demo accounts listed |
| `#/dashboard` | Coordinator dashboard | Grouped by state, highlights, next steps, links to worklist and outbox |
| `#/caregivers/:id` | Record view | Header, Clearing card (Mark Cleared) or Review-the-match card, item cards with Order/Retry/Order again, View document, Mark verified/unreadable, Verify by hand, replacement review |
| `#/worklist` | Expiration worklist | Expiring and Already expired; Request replacement |
| `#/messages` | Agency outbox | Email/SMS labels, filters, sign-in links hidden |
| `#/apply/:agencySlug` | Intake start | Unknown slug → not-found |
| `#/applicant/intake/identity` → `needed` → `uploads` → `disclosure` → `authorization` → `review` | Intake steps | Submit on review |
| `#/applicant/resume` | Redirect | Sends the applicant to their next unfinished step |
| `#/applicant` | Applicant status page | Summary, "Replacement needed" card, items with waiting-on lines |
| `#/applicant/replacements/:itemKey` | Upload a replacement | |
| `#/applicant/sign-in`, `#/auth`, `#/outbox?to=email` | Magic-link sign-in and the applicant demo inbox | |
| `#/components` | Design-system preview | Not linked |

- **Navbar:** logo; Dashboard or Your application + Sign out when signed in; Demo date, Back to today, Reset demo data.
- Injection keys (`src/session.ts`): `sessionKey`, `demoDataKey` (loading/error), `checkServiceKey`.

### Seed data
- Agencies: Hoosier Home Care (`agency-a`, `hoosier-home-care`) and Riverbend Caregivers (`agency-b`, `riverbend-caregivers`).
- Settings (5): warning window 30, delayed threshold 3, resume window 7, mock vendor delay 10 s, `state_registry_available` true.
- Coordinators: `dana.whitfield@hoosierhomecare.example`, `marcus.lee@riverbendcaregivers.example`, password `demo1234`. Applicants `firstname.lastname@example.com` by magic link.
- Key caregivers: Maria cg-01 (Intake In Progress, no authorization), James cg-02 (Intake Complete, pending checks, documents uploaded), Aisha cg-03 (Delayed 0003), Tom cg-04 (Retryable 0004 + registry Manual Verification), Linda cg-05 (Eligible), Robert cg-06 (Cleared, CPR Expiring, replacement Requested), Grace cg-07 (Cleared, clean), Samuel cg-08 (Not Current, TB Expired), Olivia cg-09 (Review Required, OIG possible match), Ethan cg-10 (declined authorization), Hannah cg-11 / David cg-12 / Chloe cg-13 (Agency B).
- A useful new applicant for manual checks: Nina Lopez, `nina.lopez@example.com`, `5745550142`, `04/12/1990`, SSN `900300001`.

### Test conventions
- `*.test.ts` next to the code, `createMemoryBackend()`, the `import.meta.glob('../../public/seed/*.csv', …)` seed pattern.
- Applicant sign-in in tests: request a link, then find the sign-in email **by subject** in `outboxFor(email)` (other messages can share the same minute).
- Time: `vi.useFakeTimers()` for vendors; fixed dates passed to jobs; `vi.useFakeTimers({ now, toFake: ['Date'] })` for `today()`.

## 4. Things later tasks must remember
- **T50 compliance report:** coordinator-only, one caregiver; every template item with source, method, dates, evidence, and **verification history from the audit log** (`audit_events` rows with `record_id` = the item id, plus the record's own events); another agency's coordinator is refused (the filtered data layer already returns nothing); print stylesheet hides the navbar and buttons for "Save as PDF" (ADR-14, no PDF library).
- **T51:** a "Compliance report" button on the record view; target under 30 seconds.
- **T54–T55:** manual checks for accessibility (WCAG 2.1 AA), and Slow 3G timings (5 s per intake step, 10 s per compressed upload), recorded in `docs/`.
- **T56:** go/no-go demo script, including the test SSN list (`TEST_SSN_OUTCOMES`).
- **T63:** exhaustive UAT guide in `docs/uat.md`, mapping R1–R26 and Section 5.
- **T65:** in-app `#/walkthrough` page, a short overview; add an "Open the walkthrough in a new tab" button to the home page; link from the docs home page.
- Known demo limits: a mock check waiting on its 10-second result is lost on page reload (the delayed job later marks it Delayed; "Order again" recovers it); starting an intake signs out whoever was signed in; editing mid-number in the phone/SSN fields moves the cursor to the end; browser storage can be edited in DevTools.
- Registry replacements keep the item's method but are reviewed, not re-queried (T48 note).

## 5. Open offers not yet taken
- A root `CLAUDE.md` capturing section 2.
- A demo-applicants hint on `#/applicant/sign-in`.
- Newer GitHub Action versions in `deploy.yml`.
- Vitest `fsModuleCache`.
- "Order all outstanding checks" on the record view (Scenario 2, step 3).
- A "reject replacement and ask again" action.
