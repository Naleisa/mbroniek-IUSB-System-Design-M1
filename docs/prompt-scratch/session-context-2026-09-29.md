# Session Context — 2026-09-29

Handoff notes for picking the CareMatch build back up, written for Mike and for a future Claude session. Read this first, then `docs/design/tasks.md` for the live task list. Nothing here overrides the design docs; where they differ, the design docs win and this file is stale.

*Last refreshed during T31 (identity step built, awaiting Mike's confirmation).*

## 1. Where things stand

| Phase | Tasks | Status |
|---|---|---|
| 0 — Setup | T1, T57, T2, T3, T4, T61 | All Done |
| 1 — Data layer, rules, audit | T5–T13, T58, T59 | All Done |
| 2 — Sign-in and access | T14–T19 | All Done |
| 3 — Mock vendors, jobs, outbox | T20–T28, T64, T60 | All Done (T29 dropped) |
| 4 — Applicant intake | T30 Done; **T31 built, awaiting confirmation**; T62, T32–T40 Not started | |
| 5 — Coordinator screens | T41–T49 | Not started |
| 6 — Compliance report | T50, T51 | Not started |
| 7 — Acceptance and go/no-go | T52–T56, T63 | Not started |

- **Tests:** 30 Vitest files, 147 tests, all passing. Vitest prints an informational "fsModuleCache" speed tip; it was deliberately left off.
- **Git:** Mike commits and pushes himself, one commit per task. Last commit `ce18f4f` "T30 applicant intake initial screen".
- **Live site:** app at https://naleisa.github.io/mbroniek-IUSB-System-Design-M1/#/ and docs at https://naleisa.github.io/mbroniek-IUSB-System-Design-M1/docs/ — both redeploy on every push to `main`.
- **Blocked / Questions table:** no open items.
- **Tasks added this session:** T62 (test-SSN hint on the SSN field, after T31), T63 (UAT guide for the whole demo, last), T64 (verify an item by hand; done). T44, T46, T56, T60, and T63 were reworded to match.

## 2. How we work

### Per-task workflow (from `docs/prompt-scratch/prompt-template`)
1. **Mike now just types the task ID** (for example "T32"); apply the full prompt template. Implement **exactly one task**.
2. Before coding, read the task in tasks.md, its requirements in specification.md, its ADRs and tech stack in plan.md, and design-system.md, and confirm every dependency is Done.
3. **Restate findings briefly (sections 1–5), then list decisions, each with a recommendation, and wait.** Mike usually answers "Go ahead" or "Recommendations are good". Ask whenever the documents don't settle something — Mike prefers questions to guesses. Flag gaps in the task list (e.g. the missing manual-verification path became T64).
4. Build only what the task says; note other issues without fixing them. Don't add libraries, styles, or patterns that aren't established.
5. Verify with `npx vue-tsc --noEmit`, `npm test`, and `npm run build` in `/app`.
6. Report in three parts: (1) changes; (2) a short plain-language explanation; (3) the acceptance criteria and exactly how to verify (screen tasks: numbered manual-check steps at phone width).
7. Leave the task's status unchanged. **Only after Mike confirms** ("Completed", "Confirmed", "Complete"), set it to Done in tasks.md and add a row to `docs/manual-checks.md` (Task | Date | Checked by: Mike Broniek | Steps | Result: Pass | Notes).

### Mike's preferences
- Show expected changes before large document edits, and ask before rewriting design docs.
- Plain language; recommendations with the reason for each, not surveys of options.
- Demo-friendly touches are welcome (demo account hints, readable outbox) but get proposed first.
- Mike keeps his own log in `docs/prompt-scratch/learned.md`; don't edit it.

### Environment
- Windows 11, VS Code extension, Git Bash + PowerShell, Node 24.
- `gh` CLI, Ruby, and Python are **not installed**; Docker is. Repo settings (Pages, security) have to be changed by Mike on github.com.
- Claude in Chrome tools were **not available**; UI checks are Mike's manual checks.
- **Stop `npm run dev` before `npm ci`** — on Windows the dev server locks a rolldown binary and `npm ci` fails half-way.
- Bash heredocs choke on apostrophes and `\s`-style escapes in long inline scripts; write scripts to the scratchpad with the Write tool and run them with `node`.

## 3. Decisions made this session

### Scope, stack, and hosting
- **Front end only, no external systems at runtime** (Spec D1, ADR-00). A mock data layer runs in the browser, seeded from CSV (ADR-21). Supabase is only the intended pilot backend.
- **Stack:** Vue 3, Vue Router **v4** (pinned), Vite 8, TypeScript **~5.9** (pinned — TypeScript 7 breaks vue-tsc), Bootstrap 5, Bootstrap Icons and Roboto bundled from npm, PapaParse, Vitest 5.
- **Testing (ADR-17):** Vitest for logic; screens get **manual checks** at phone size in Chrome DevTools device mode, logged in `docs/manual-checks.md`.
- **TypeScript target is ES2020:** avoid `Array.at()` and other ES2022 methods (use `slice(-1)[0]`).
- **Hosting (T4, T61):** `.github/workflows/deploy.yml` runs `npm ci`, `npm test`, `npm run build` in `/app`, builds the docs with `actions/jekyll-build-pages` into `app/dist/docs`, and deploys to Pages. Vite `base` is `/mbroniek-IUSB-System-Design-M1/` for builds only.

### Design documents
- **design-system.md:** palette table still says `#f2545b` for primary buttons while Core Components uses `#a93f55` — intentionally left; `#a93f55` is what's built.
- **plan.md:** ADR-20 (design system) and ADR-21 (data layer) added earlier; settings list now includes "Mock state registry available: true (R26)". The approval table still shows 2026-09-22.
- **tasks.md:** see section 1 for tasks added this session.

### Design system as built (`app/src/styles/theme.css`, preview at `#/components`)
- Bootstrap "primary" = **#a93f55** (hover **#843142**); **#f2545b** only in the logo. Background #f3f7f0, text #19323c, H1 32px/700, H2 24px/500.
- Primary button = `.btn-primary`; secondary = `.btn-outline-primary`; card = `.card`.
- **`FormField.vue`:** label above, asterisk when required, `v-model`. **T31 added optional props:** `autocomplete`, `inputmode` (phone keyboard), `help` (grey text under the field), `error` (Bootstrap `is-invalid` + `invalid-feedback`, linked by `aria-describedby`).
- **`StatusBadge.vue`:** icon + text, four tones (success / neutral / warning / danger).
- One primary button per screen; plain, warm wording; demo notices use the warning-subtle style.

### Data layer (`app/src/data/`)
- **`dataLayer.ts` — `DataLayer` interface:**
  - `list`, `get` — filtered by who is signed in. `insert`, `update` — need an `Actor { role, name }` and add an audit event. System jobs use `{ role: 'system', name: 'CareMatch' }`.
  - `storeSsn(caregiverId, ssn, actor)` — the only way to save an SSN (900-series only).
  - `putDocument` (requires `meta.caregiver_id`; sets `agency_id` itself), `getDocument`, `listDocuments` — filtered like tables (T18).
  - Sign-in: `signIn`, `requestSignInLink` (ignores blank emails), `signInWithLink`, `signOut`, `getSignedInUser`.
  - **Intake (T30):** `startIntake(agencySlug)` creates an Intake In Progress caregiver, a "New applicant" user, **one Pending required item per template item**, signs them in, and audits "Record created: Started intake from the … link". `agencyNameForIntake(slug)` names one agency only. `emailInUse(email, exceptUserId)` (T31).
  - **Outbox lookup (T30):** `outboxFor(email)` — messages to that address, newest first; works signed out.
  - **Demo date (T60):** `today()` (demo date at the current clock time, or real now), `getDemoDate()`, `setDemoDate(date | undefined)`. Stored as `carematch:demo_date`; Reset clears it. **Always use `dataLayer.today()`, never `new Date()`,** except seed loading.
  - `loadSeed`, `resetDemoData` (T59: fetches seed first, then clears everything incl. documents, session, demo date).
- **Factories:** `createDataLayer(backend)` (filtered, for screens) and `createSystemDataLayer(backend)` (unfiltered, for jobs and vendor results). `createVendorVault(backend)` is for vendor adapters only.
- **Access filter:**
  - Coordinator: own agency's rows plus shared tables (`settings`, `requirement_templates`, `template_items`).
  - Applicant: own caregiver record and its rows, messages to them, own user and agency, shared tables. `check_orders` and `audit_events` hidden.
  - **Signed out (T30): only the shared tables; documents none; every write refused** ("Please sign in before making changes."). Signed-out pages use narrow functions (`startIntake`, `outboxFor`, `agencyNameForIntake`).
  - Tests that need the whole seed use `createSystemDataLayer`, and get sign-in tokens from `outboxFor('maria.gonzalez@example.com')`.
- **Lifecycle (`lifecycle.ts`):** 11 allowed transitions; `transitionCaregiver` returns `{ ok, caregiver } | { ok: false, reason }`; `findBlockingItems` gates Eligible and Cleared; `checkEligibility` moves Screening In Progress→Eligible as the system.
- **Vendors (`vendors.ts`, T20/T22/T23):** shared `VendorAdapter.order({ caregiver_id, ssn_token })` → `VendorResult { outcome: clear | match | failure | unavailable, label, vendor, reference, detail }`. Mocks: `createMockBackgroundCheck`, `createMockExclusionCheck(…, 'OIG' | 'SAM')`, `createMockRegistryCheck(…, isAvailable)`. SSN endings: 0001/other Clear, 0002 match (exclusion only), 0003 never returns, 0004 failure. Registry clear label is "Active".
- **Checks (`checks.ts`):**
  - `createBackgroundCheckVendor`, `createExclusionCheckVendor(backend, list)`, `createRegistryCheckVendor(backend)` read the delay (`mock_vendor_delay_seconds`) and `state_registry_available` from settings.
  - `orderCheck(dataLayer, systemDataLayer, vendor, itemId, actor)` — only Pending/Retryable items; sets Ordered, adds a `check_orders` row per attempt; the result is recorded later as CareMatch via the system layer: clear → Verified (1-year expiration, except registry keeps the certificate's date) + `checkEligibility`; failure → Retryable; match → Manual Verification + Review Required; unavailable → Manual Verification. Coordinators are emailed each result.
  - `verifyManually(dataLayer, itemId, { note, expirationDate }, actor)` (T64) — coordinator only, Manual Verification items only; sets Verified, method "Manual verification", evidence = note, future expiration required; then `checkEligibility`.
- **Jobs (`jobs.ts`):** `runDelayedCheckJob(systemDataLayer, today)` (Ordered ↔ Delayed after 3 business days, weekdays only, reversible) and `runExpirationJob(systemDataLayer, today)` (Verified ↔ Expiring ↔ Expired, 30-day window, expiration day still valid; forward moves email the caregiver and coordinators; then any Cleared record with an Expired item → Not Current with a coordinator email; never restores Cleared). Both run in `main.ts` after the seed loads, with `systemDataLayer.today()`.
- **Notifications (`notifications.ts`, T27/T28):** `sendEmail` and `sendSms` (blank subject) are the only writers to the outbox; `coordinatorsOf(systemDataLayer, agencyId)`. Nothing is sent.
- **Intake (`intake.ts`, T31):** `saveIdentityStep(dataLayer, fields, actor)` validates all fields first (plain-language errors keyed by field), updates the caregiver, stores the SSN via `storeSsn`, and renames the applicant user and sets its email. `normalizeSsn` accepts digits with or without dashes.

### Screens and routes (`app/src/router/index.ts`, guards in `main.ts`)

| Route | Component | Notes |
|---|---|---|
| `#/` | `LandingPageComponent` | Home; shows "Demo data is back to its starting point." after a reset |
| `#/components` | `ComponentsPageComponent` | Design-system preview (not linked) |
| `#/sign-in` | `SignInPageComponent` | Coordinator email + password; lists demo accounts |
| `#/dashboard` | `DashboardPageComponent` | Placeholder; coordinator only |
| `#/applicant/sign-in` | `ApplicantSignInPageComponent` | Request magic link; "Open demo outbox" |
| `#/outbox?to=email` | `OutboxPageComponent` | Demo inbox via `outboxFor`; emails only; link shown as a button |
| `#/auth?token=…&next=…` | `AuthPageComponent` | Follows the magic link |
| `#/applicant` | `ApplicantHomePageComponent` | Placeholder; applicant only |
| `#/apply/:agencySlug` | `IntakeStartPageComponent` | "Apply to {agency}" + "Start my application"; unknown slug → not-found message, no agency named |
| `#/applicant/intake/identity` | `IdentityStepPageComponent` | "About you" step (T31); saves then goes to `#/applicant` until T32 exists |

- **Navbar:** logo; **Demo date** field (today to 2 years out; changing it reloads the page so both jobs re-run), **Back to today** (only while set), **Reset demo data** with inline confirmation, and a "Demo date active" notice.
- The signed-in user is shared through `sessionKey` (`app/src/session.ts`); pages set it on sign-in, intake start, and identity save.

### Seed data (`app/public/seed/`, see its README)
- 12 CSVs; agencies Hoosier Home Care (`agency-a`, slug `hoosier-home-care`) and Riverbend Caregivers (`agency-b`, slug `riverbend-caregivers`); 13 caregivers; dates relative to today.
- Settings (5): `warning_window_days` 30, `delayed_threshold_business_days` 3, `resume_window_days` 7, `mock_vendor_delay_seconds` 10, `state_registry_available` true.
- **Demo accounts:** coordinators `dana.whitfield@hoosierhomecare.example` and `marcus.lee@riverbendcaregivers.example`, password `demo1234`. Applicants `firstname.lastname@example.com` sign in by magic link.
- Key caregivers: Linda Brooks cg-05 (Eligible), Robert King cg-06 (Cleared, CPR expiring in 20 days), Grace Kim cg-07 (Cleared, clean), Samuel Okafor cg-08 (Not Current, TB expired), Olivia Martin cg-09 (Review Required, 0002), Aisha Patel cg-03 (Delayed, 0003), Tom Nguyen cg-04 (0004 Retryable + registry Manual Verification), Ethan Walker cg-10 (declined authorization), Hannah Schultz cg-11 (checks just ordered), James Carter cg-02 (Intake Complete, Pending checks).

### Test conventions
- Tests live next to the code as `*.test.ts`, use `createMemoryBackend()`, and load real seed files with the `import.meta.glob('../../public/seed/*.csv', …)` pattern.
- Unfiltered reads: `createSystemDataLayer(backend)`. Applicant sign-in in tests: `requestSignInLink` then take the token from `outboxFor(email)[0].body`.
- Time: `vi.useFakeTimers()` (mock vendors), fixed `Date` values passed to jobs (e.g. Monday 2026-10-05), `vi.useFakeTimers({ now })` for `today()`.

## 4. Things later tasks must remember

- **Next step routing:** T31's identity page and T30's start page push to fixed routes; when T32 exists, the identity step should continue to it, and T38 needs a "last saved step" to resume to (not stored yet).
- **T62:** add the info-icon test-SSN hint under the SSN field in `IdentityStepPageComponent` using FormField's `help` area pattern (tap, not hover).
- **T33:** write the `documents` table row and the stored file (`putDocument`) with the same id; the applicant's 8 required items already exist from `startIntake`.
- **T37:** submitting moves Intake In Progress → Intake Complete (applicant transition) and emails coordinators via `sendEmail` + `coordinatorsOf`.
- **T43:** decide whether a Delayed check can be reordered (`orderCheck` accepts only Pending/Retryable today).
- **T44 / T46:** call `verifyManually` for Manual Verification items; T46's false-match path also verifies the matched exclusion item.
- **T45:** show the `reason` from `transitionCaregiver` as-is.
- **T47:** replacement request can use `sendSms` and/or `sendEmail`.
- **T49:** the coordinator outbox is limited to their agency and labels email vs SMS; SMS rows have a blank subject.
- **Demo date:** a mock check waiting for its 10-second result is lost if the page reloads (including a demo-date change); the delayed job later marks it Delayed.
- **Starting an intake** signs out whoever was signed in.
- **Seeded documents** have metadata but no image files — show them as samples.
- **Browser storage** can be edited in DevTools — accepted for the demo (ADR-10, ADR-11).
- If the browser holds an older seed, use "Reset demo data" (or clear site data) and reload.

## 5. Open offers not yet taken
- A root `CLAUDE.md` capturing section 2 so new sessions get the workflow automatically.
- A demo-applicants hint on `#/applicant/sign-in`, like the coordinator page has.
- Pinning newer GitHub Action versions in `deploy.yml`.
- Turning on Vitest's `fsModuleCache` to silence its speed tip.
