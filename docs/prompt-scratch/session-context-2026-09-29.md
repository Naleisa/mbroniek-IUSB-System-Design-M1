# Session Context — 2026-09-29

Handoff notes for picking the CareMatch build back up, written for Mike and for a future Claude session. Read this first, then `docs/design/tasks.md` for the live task list. Nothing here overrides the design docs; where they differ, the design docs win and this file is stale.

## 1. Where things stand

| Phase | Tasks | Status |
|---|---|---|
| 0 — Setup | T1, T57, T2, T3, T4, T61 | All Done |
| 1 — Data layer, rules, audit | T5–T13 Done; **T58 In progress** (seed CSVs exist, test not written); **T59 Not started** | |
| 2 — Sign-in and access | T14, T15, T16, T17 Done; **T18, T19 Not started** | |
| 3 — Mock vendors, jobs, outbox | T20–T28, T60 | Not started (T29 dropped) |
| 4 — Applicant intake | T30–T40 | Not started |
| 5 — Coordinator screens | T41–T49 | Not started |
| 6 — Compliance report | T50, T51 | Not started |
| 7 — Acceptance and go/no-go | T52–T56 | Not started |

- **Tests:** 14 Vitest files, 61 tests, all passing.
- **Git:** everything committed. Last commit `81ed834` "T17 blocker fixing, applicant filter, and context saving". Mike commits and pushes himself, usually one commit per task.
- **Live site:** app at https://naleisa.github.io/mbroniek-IUSB-System-Design-M1/#/ and docs at https://naleisa.github.io/mbroniek-IUSB-System-Design-M1/docs/ — both redeploy on every push to `main`.
- **Blocked / Questions table:** no open items.

### Suggested next tasks, with what's already known

1. **T58 — caregiver seed test.** The CSVs are done. Write a Vitest test that loads the full seed (use the `import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true })` pattern from `agencyFilter.test.ts`) and checks: all 7 lifecycle states among Agency A caregivers, caregivers in both agencies, no `ssn` on caregiver rows and every token resolving to a 900-series SSN through `createVendorVault`, and seeded audit history for every Cleared caregiver (cg-06, cg-07, cg-12). Read unfiltered data with `createSystemDataLayer`.
2. **T59 — "Reset demo data".** Needs a data-layer method that clears storage (all `carematch:*` localStorage keys, the `carematch` IndexedDB documents store, the session) and reloads the seed; then a button (likely in the navbar, demo only). Clearing ends any signed-in session.
3. **T18 — documents behind the access filter.** `putDocument`/`getDocument`/`listDocuments` in `dataLayer.ts` are not filtered yet. Apply the same rule as tables using each document's `meta.agency_id` and `meta.caregiver_id`.
4. **T19 — access-separation suite.** Much is already covered by `agencyFilter.test.ts`, `applicantFilter.test.ts`, and `vault.test.ts`; T19 should add documents (after T18) and gather the proof in one suite.

## 2. How we work

### Per-task workflow (from `docs/prompt-scratch/prompt-template`)
1. Mike pastes the template with one task ID. Implement **exactly one task**.
2. Before coding, read the task in tasks.md, its requirements in specification.md, its ADRs and tech stack in plan.md, and design-system.md, and confirm every dependency is Done.
3. **Restate findings briefly (sections 1–5), then list decisions, each with a recommendation, and wait.** Mike usually answers "Recommendations are good". Ask whenever the documents don't settle something — Mike prefers questions to guesses.
4. Build only what the task says; note other issues without fixing them. Don't add libraries, styles, or patterns that aren't established.
5. Verify with `npx vue-tsc --noEmit`, `npm test`, and `npm run build` in `/app`.
6. Report in three parts: (1) changes, as a table of files; (2) a short plain-language explanation; (3) the acceptance criteria and exactly how to verify.
7. Leave the task's status unchanged. **Only after Mike confirms** ("Completed", "Confirmed done"), set it to Done in tasks.md and add a row to `docs/manual-checks.md` (Task | Date | Checked by: Mike Broniek | Steps | Result: Pass | Notes).

### Mike's preferences
- Show expected changes before large document edits, and ask before rewriting design docs.
- Plain language; recommendations over surveys of options.
- Demo-friendly touches are welcome (demo account hints, readable outbox) but get proposed first.
- Mike keeps his own log in `docs/prompt-scratch/learned.md`; don't edit it.

### Environment
- Windows 11, VS Code extension, Git Bash + PowerShell, Node 24.
- `gh` CLI, Ruby, and Python are **not installed**; Docker is. Repo settings (Pages, security) have to be changed by Mike on github.com.
- Claude in Chrome tools were **not available** in this session; UI checks are Mike's manual checks.
- **Stop `npm run dev` before `npm ci`** — on Windows the dev server locks a rolldown binary and `npm ci` fails half-way, leaving `node_modules` gutted (re-run `npm ci` afterwards).
- Bash heredocs choke on apostrophes in long inline scripts; write scripts to the scratchpad with the Write tool and run them with `node`.

## 3. Decisions made this session

### Scope, stack, and hosting
- **Front end only, no external systems at runtime** (Spec D1, ADR-00). A mock data layer runs in the browser, seeded from CSV (ADR-21). Supabase is only the intended pilot backend.
- **Stack:** Vue 3, Vue Router **v4** (pinned — npm had installed v5), Vite 8, TypeScript **~5.9** (pinned — TypeScript 7 breaks vue-tsc), Bootstrap 5 (chosen over Tailwind to match the design system and template), Bootstrap Icons and Roboto (`@fontsource/roboto` 400/500/700) bundled from npm, PapaParse, Vitest 5.
- **Testing (ADR-17):** Vitest for logic; screens get **manual checks** at phone size in Chrome DevTools device mode, logged in `docs/manual-checks.md`. Playwright was removed from plan and tasks. Mike briefly asked to remove Vitest too, then reversed that.
- **TypeScript target is ES2020:** avoid `Array.at()` and other ES2022 methods (use `slice(-1)[0]`).
- **Hosting (T4):** `.github/workflows/deploy.yml` runs `npm ci`, `npm test`, `npm run build` in `/app` on Node 24, builds the docs with `actions/jekyll-build-pages` into `app/dist/docs`, and deploys to Pages. Vite `base` is `/mbroniek-IUSB-System-Design-M1/` for builds only (dev stays at `/`). Pages Source is "GitHub Actions"; secret scanning and push protection are on.
- **Docs site (T61, added this session):** `docs/_config.yml` (Primer theme, `baseurl: /mbroniek-IUSB-System-Design-M1/docs`, excludes `prompt-scratch`) and `docs/index.md` (links to each design doc and the manual checks log).

### Design documents changed this session
- **design-system.md:** Mike wrote it with Claude's help (brand principles, palette, Roboto sizes, logo usage, components, voice & tone). Typo "abovie" fixed. The palette table still says Primary `#f2545b` is for primary buttons, while Core Components uses `#a93f55` — intentionally left; `#a93f55` is what's built.
- **specification.md:** Section 6 gained Branding and WCAG 2.1 AA items and 3G targets; D1, D5, D6 rewritten for the front-end-only demo.
- **plan.md:** Tech stack rewritten for the browser data layer; ADRs 00, 00a, 05, 06, 08, 10, 11, 13, 14, 15, 17 revised; **ADR-20** (design system through one Bootstrap theme) and **ADR-21** (single data-layer interface, CSV seed, relative dates) added; risks and sequencing updated. The approval table still shows 2026-09-22 — the plan changed after sign-off and may need re-approval.
- **tasks.md:** tasks reworded for the data layer; **T57** (theme), **T58** (caregiver seed), **T59** (reset), **T60** (demo date), **T61** (docs site) added; T29 dropped; screen tasks use manual checks; Definition of Done requires a passing Vitest test or a logged manual check, shared design-system components, voice & tone, and no outside network requests.

### Design system as built (`app/src/styles/theme.css`, preview at `#/components`)
- Bootstrap CSS-variable overrides (no Sass). Bootstrap "primary" = **#a93f55** (white text 5.95:1; hover **#843142**); **#f2545b** only in the logo (white on it is 3.4:1, fails AA). Background #f3f7f0, text #19323c, H1 32px/700, H2 24px/500, body 16px/400.
- Primary button = `.btn-primary`; secondary = `.btn-outline-primary` (hover tint #f2e2e6); card = `.card` (white, #dee2e6 border).
- Shared components: `FormField.vue` (label above, asterisk and `required` when required, `v-model`) and `StatusBadge.vue` (icon + text, four tones: success — Verified/Eligible/Cleared; neutral — Pending/Ordered/intake and screening states; warning — Delayed/Expiring/Retryable/Manual Verification; danger — Expired/Not Current/Review Required; unknown statuses fall back to neutral).
- One primary button per screen; error messages plain and warm.
- Logo: `app/src/assets/carematchlogo.png` (1200×300, copied from `docs/design/`), shown at 160×40 in the navbar.

### Data layer (`app/src/data/`)
- **`dataLayer.ts` — `DataLayer` interface:**
  - `list(table)`, `get(table, id)` — filtered by who is signed in (see access filter).
  - `insert(table, row, actor)`, `update(table, id, changes, actor)` — every write needs an `Actor { role: 'coordinator' | 'applicant' | 'system', name }` and adds an audit event. System jobs use `{ role: 'system', name: 'CareMatch' }`.
  - `storeSsn(caregiverId, ssn, actor)` — the only way to save an SSN.
  - `putDocument(document, actor)`, `getDocument(id)`, `listDocuments()` — IndexedDB (not yet filtered — T18).
  - `signIn(email, password)`, `requestSignInLink(email, next?)`, `signInWithLink(token)`, `signOut()`, `getSignedInUser()`.
  - `loadSeed(getSeedFiles, today?)` — runs once (marker `carematch:seeded`), parses every CSV before writing any, resolves relative dates, gives id-less rows ids like `consents-1`, moves seed SSNs into the vault, and adds no audit events.
- **Factories:** `createDataLayer(backend)` (filtered, for screens; provided to the app via `dataLayerKey`) and `createSystemDataLayer(backend)` (unfiltered, for jobs T24/T25 only). `createVendorVault(backend)` in `vault.ts` is for vendor adapters (T20) only. None of the jobs or adapters are wired into `main.ts` yet.
- **Storage:** `storageBackend.ts` interface; `browserBackend.ts` uses localStorage key `carematch:<table>` per table and IndexedDB database `carematch` with store `documents`; `memoryBackend.ts` is for tests.
- **Tables:** the 12 seed tables plus internal ones — `audit_events` (append only), `ssn_vault` (never readable through the data layer), `session` (one row, signed-in user id), `sign_in_links` (tokens; written directly so they never reach the audit log), `notifications` (outbox; starts empty).
- **Audit log (T9):** events `Created`, `Updated` (details list `field: old → new`), `Document stored`, `SSN stored` (last four only), `Signed in`, `Signed out`; fields match the seed columns plus `table` and `record_id`. `insert`/`update` refuse `audit_events`; there is no delete.
- **Vault (T13):** `storeSsn` accepts only `9xx-xx-xxxx`; tokens look like `tok_<uuid>`; `list`/`get` refuse `ssn_vault`; `insert`/`update` refuse `ssn_vault` and any `ssn` field on caregivers.
- **Access filter (T16, T17):**
  - Signed-in **coordinator:** only their agency's rows (agency from `id` for agencies, `agency_id`, the row's caregiver, or the user for sign-in audit events) plus shared tables (`settings`, `requirement_templates`, `template_items`). Rows with no agency (e.g. `sign_in_links`) are hidden.
  - Signed-in **applicant:** only their caregiver record and rows with their `caregiver_id`, notifications addressed to them, their own user row and agency, and shared tables. `check_orders` and `audit_events` are always hidden from applicants.
  - Writes follow the same rule ("You can only change records for your own agency." / "You can only change your own application.").
  - **Signed out: unfiltered until T30** (see blocker resolutions).
- **Lifecycle (`lifecycle.ts`, T10–T12):**
  - `LIFECYCLE_TRANSITIONS` — 11 allowed moves: Intake In Progress→Intake Complete (applicant); Intake Complete→Screening In Progress (coordinator); Screening In Progress→Eligible (system); Screening/Eligible/Cleared/Not Current→Review Required (system); Eligible→Cleared and Not Current→Cleared (coordinator); Cleared→Not Current (system); Review Required→Screening In Progress (coordinator).
  - `transitionCaregiver(dataLayer, id, toState, actor)` returns `{ ok: true, caregiver }` or `{ ok: false, reason }` (never throws; reasons are plain language for T45 to display). Updates `lifecycle_state` and `state_changed_at` through the audited `update`.
  - `findBlockingItems()` gates both Eligible and Cleared: every template item must exist, be Verified or Expiring, and not be past its expiration date; reasons are "(missing)", "(expired)", "(not verified yet)".
  - `checkEligibility(dataLayer, caregiverId)` moves Screening In Progress→Eligible as the system; call it after verifying an item (T21 vendor results, T44 document review).
- **Types (`types.ts`):** `LIFECYCLE_STATES`, `ITEM_STATUSES`, `USER_ROLES`, `CONSENT_TYPES`, `CONSENT_DECISIONS`, `NOTIFICATION_CHANNELS` (each with a type and, for states and statuses, an `is…()` check), plus `Agency`, `User`, `Setting`, `Caregiver`, `RequirementTemplate`, `TemplateItem`, `RequiredItem`, `DocumentRecord`, `CheckOrder`, `Consent`, `Notification`, `Actor`, `AuditEvent`. Field names match stored columns; values are text.
- **Dates (`relativeDates.ts`):** `resolveRelativeDate` (`today`, `today±N`, optional ` HH:MM`) and `formatLocalDateTime` (local `YYYY-MM-DDTHH:MM`).

### Screens and routes (`app/src/router/index.ts`, guards in `main.ts`)

| Route | Component | Notes |
|---|---|---|
| `#/` | `LandingPageComponent` | Empty home page |
| `#/components` | `ComponentsPageComponent` | Design-system preview (not linked) |
| `#/sign-in` | `SignInPageComponent` | Coordinator email + password; lists demo accounts; links to applicant sign-in |
| `#/dashboard` | `DashboardPageComponent` | Placeholder "Signed in as … · agency" + Sign out; coordinator only |
| `#/applicant/sign-in` | `ApplicantSignInPageComponent` | Request magic link; same message whether or not the email exists; "Open demo outbox" |
| `#/outbox?to=email` | `OutboxPageComponent` | Minimal demo outbox; hides the raw link and shows an "Open sign-in link" button |
| `#/auth?token=…&next=…` | `AuthPageComponent` | Follows the magic link, then goes to `next` |
| `#/applicant` | `ApplicantHomePageComponent` | Placeholder "Signed in as …" + Sign out; applicant only (redirects to sign-in with `next`) |

- The signed-in user is shared through `sessionKey` in `app/src/session.ts` (a Vue `ref`); pages set it on sign-in and clear it on sign-out.
- The navbar shows only the logo (link home). Later tasks add their own links.

### Seed data (`app/public/seed/`, see its README for the full cast)
- 12 CSVs: agencies (Hoosier Home Care `agency-a`, Riverbend Caregivers `agency-b`), users, settings, requirement_templates (Indiana HHA, marked sample), template_items (8 items with applicant reasons), caregivers (13; cg-01–cg-10 Hoosier covering all 7 states, cg-11–cg-13 Riverbend), required_items (104, ids like `ri-cg-01-photo_id`), documents (53 metadata rows, no image files), check_orders (36, including open, failed, registry-unavailable, and possible-match cases), consents (24, one declined), replacement_requests (1, Robert King), audit_events (62).
- Dates are relative (`today+20`, `today-3 10:05`), resolved on first load.
- Settings: `warning_window_days` 30, `delayed_threshold_business_days` 3, `resume_window_days` 7, `mock_vendor_delay_seconds` 10.
- Test SSN endings (ADR-12): 0001 Clear, 0002 exclusion match, 0003 never returns, 0004 vendor failure.
- **Demo accounts:** coordinators `dana.whitfield@hoosierhomecare.example` and `marcus.lee@riverbendcaregivers.example`, password `demo1234`. Applicants `firstname.lastname@example.com` (e.g. `maria.gonzalez@example.com`) sign in by magic link.
- Key scenario caregivers: Linda Brooks cg-05 (Eligible), Robert King cg-06 (Cleared, CPR expiring, replacement requested), Grace Kim cg-07 (Cleared, clean), Samuel Okafor cg-08 (Not Current, TB expired), Olivia Martin cg-09 (Review Required, 0002), Aisha Patel cg-03 (delayed 0003), Tom Nguyen cg-04 (vendor failure 0004 + registry manual verification), Ethan Walker cg-10 (declined authorization), Hannah Schultz cg-11 (checks just ordered).

### Test conventions
- Tests live next to the code as `*.test.ts` and use `createMemoryBackend()`.
- Load real seed files with Vite `?raw` imports (e.g. `import caregiversCsv from '../../public/seed/caregivers.csv?raw'`) or the `import.meta.glob` pattern for all of them.
- Edit a copy of the seed text to create a case (e.g. `requiredItemsCsv.replace(...)` or dropping a row) rather than adding fixture files.
- Use `vi.useFakeTimers()` / `vi.setSystemTime()` for time-based cases (see `signInLinks.test.ts`).

### Blocker resolutions (all recorded in tasks.md)
- **Signed-out access (T30, T49):** signed-out reads will return only the shared tables; `startIntake(agencySlug)` will create the record and sign the new applicant in; the demo outbox will switch to a purpose-built lookup by email. **Built in T30.**
- **3G targets (T55):** on Chrome DevTools Slow 3G, each intake step loads in 5 seconds or less and a compressed photo upload saves in 10 seconds or less (also in Spec Section 6).
- **T56 trace:** business case §7 and plan §6 step 7.
- **Review Required exit (T10, T46):** coordinator only, back to Screening In Progress for a false match; a real match stays in Review Required.
- Earlier: T29 keep-alive dropped; T38 Supabase link limit no longer applies; the old copilot instructions file was removed; replacing the template on Pages was confirmed.

## 4. Things later tasks must remember

- **Demo date (T60):** "today" is currently `new Date()` in several places — audit `occurred_at`, `state_changed_at` (lifecycle), expiration checks in `findBlockingItems`, sign-in link creation and expiry, and `loadSeed`'s default. T60's demo-date control needs one shared "today" source that all of these use, or moving the date won't change them.
- **Notifications (T27):** T15 writes the sign-in email directly into `notifications` from `requestSignInLink`; T27's notification service should take that over.
- **Vendor adapters (T20):** create the vendor vault from the same backend in `main.ts` and give it only to adapters; SSN outcome comes from the last four digits.
- **Jobs (T24, T25, T26):** use `createSystemDataLayer` so they see every agency; act as the `system` actor; T26 uses `transitionCaregiver(..., 'Not Current', system)`.
- **Item verification (T21, T44):** call `checkEligibility` after verifying an item.
- **Clear screen (T45):** show the `reason` from `transitionCaregiver` as-is.
- **Outbox (T49):** the current `#/outbox` is an unrestricted demo page; T49 builds the coordinator version limited to their agency.
- **Seeded documents** have metadata but no image files — screens should show them as samples.
- **Browser storage** (including the vault and audit log) can be edited in DevTools — accepted for the demo (ADR-10, ADR-11). `list('users')` exposes demo coordinator passwords to coordinator screens (fake data).
- If the browser holds an older seed, clear site data once (DevTools > Application > Storage > Clear site data) and reload.

## 5. Open offers not yet taken
- A root `CLAUDE.md` capturing section 2 so new sessions get the workflow automatically.
- A demo-applicants hint on `#/applicant/sign-in`, like the coordinator page has.
- Pinning newer GitHub Action versions in `deploy.yml` (currently checkout@v4, setup-node@v4, configure-pages@v5, jekyll-build-pages@v1, upload-pages-artifact@v3, deploy-pages@v4).
