# Session Context — 2026-09-29

Handoff notes for picking the CareMatch build back up. Read this first, then `docs/design/tasks.md` for the live task list.

## Where things stand

- **Phase 0 (setup):** done — T1, T57, T2, T3, T4, T61.
- **Phase 1 (data layer, rules, audit):** done except **T58** (In progress: seed CSVs exist, test not written) and **T59** ("Reset demo data" button, not started).
- **Phase 2 (sign-in, access):** T14, T15, T16, T17 done. **T18** (documents behind the access filter) and **T19** (access-separation test suite) not started.
- **Phases 3–7:** not started.
- **Tests:** 14 Vitest files, 61 tests, all passing (`npm test` in `/app`).
- **Blocked / Questions table:** no open items. All decisions recorded there.
- **Uncommitted at end of session:** T17 code (`app/src/data/dataLayer.ts`, `app/src/data/applicantFilter.test.ts`), blocker resolutions (`docs/design/tasks.md`, `docs/design/specification.md`), `docs/manual-checks.md`, and this file.

### Suggested next tasks

1. **T58** — write the caregiver seed test (all 7 states in Agency A, both agencies, SSNs in the vault, audit history for Cleared). Depends on T8, T9, T13 — all done.
2. **T59** — "Reset demo data" button. Depends on T3, T58.
3. **T18** then **T19** to finish Phase 2.

## How we work (the per-task workflow)

- Mike pastes `docs/prompt-scratch/prompt-template` with one task ID. Implement **exactly one task**.
- Before coding: read the task in tasks.md, its requirements in specification.md, its ADRs in plan.md, and design-system.md; confirm dependencies are Done. **Restate findings briefly and list decisions with a recommendation for each, then wait for approval.** Stop and ask when documents don't answer something.
- Don't build or fix anything outside the task — note issues instead.
- After building: run `npx vue-tsc --noEmit`, `npm test`, `npm run build`. Report with (1) changes, (2) plain-language explanation, (3) how to verify.
- **Only mark a task Done after Mike confirms**, then log it in `docs/manual-checks.md` (Task, Date, Checked by "Mike Broniek", Steps, Result, Notes).
- Mike prefers seeing expected changes before large document edits.
- Stop `npm run dev` before `npm ci` on Windows — the dev server locks a file in `node_modules`.

## Key decisions made this session

### Scope and stack
- **Front end only, no external systems at runtime** (Spec D1, ADR-00). Mock data layer in the browser seeded from CSV (ADR-21). Supabase is only the intended pilot backend later.
- **Stack:** Vue 3, Vue Router **v4** (pinned), Vite, TypeScript **~5.9** (pinned; TS 7 breaks vue-tsc), Bootstrap 5 (not Tailwind), Bootstrap Icons and Roboto bundled from npm (no CDNs, no Google Fonts), PapaParse, Vitest 5.
- **Testing (ADR-17):** Vitest for logic; screens get **manual checks** at phone size in Chrome DevTools device mode, logged in `docs/manual-checks.md`. Playwright was removed. TS target is ES2020 (no `Array.at()`).
- **Hosting:** GitHub Pages via Actions (`.github/workflows/deploy.yml`). App at https://naleisa.github.io/mbroniek-IUSB-System-Design-M1/#/ and docs at `/docs/` (T61, Jekyll via `actions/jekyll-build-pages`, `docs/prompt-scratch/` excluded). Vite `base` is `/mbroniek-IUSB-System-Design-M1/` for builds only.

### Design system
- Bootstrap "primary" is **#a93f55** (white text on #f2545b fails contrast); **#f2545b** is used only in the logo.
- Status badges pair icon + text in four tones: success (Verified, Eligible, Cleared), neutral (Pending, Ordered, intake/screening states), warning (Delayed, Expiring, Retryable, Manual Verification), danger (Expired, Not Current, Review Required).
- Theme is CSS-variable overrides in `app/src/styles/theme.css` (no Sass). Preview page at `#/components`.

### Data layer (`app/src/data/`)
- `dataLayer.ts`: generic `list/get/insert/update`, documents, `storeSsn`, sign-in, `loadSeed`. Seed loads once (marker `carematch:seeded`), resolves `today±N [HH:MM]` dates, gives id-less rows generated ids.
- **Audit log (T9):** every write requires an `Actor { role, name }` and appends an event (`Created`/`Updated`/`Document stored`/`SSN stored`/`Signed in`/`Signed out`) with `table` and `record_id`. `audit_events` can't be written directly; no delete exists. Seeding adds no events.
- **Vault (T13):** full SSNs only in `ssn_vault`; data layer can't read it. `createVendorVault(backend).readSsn(token)` is for vendor adapters (T20) only. Only 900-series SSNs accepted. Seed SSNs move to the vault on load.
- **Access filter (T16, T17):** signed-in coordinator sees only their agency (plus shared settings/template); signed-in applicant sees only their own application, messages, account, agency, and shared tables — never check orders or the audit log. Writes follow the same rule. `createSystemDataLayer(backend)` is unfiltered, for jobs (T24, T25) only.
- **Lifecycle (`lifecycle.ts`, T10–T12):** 11 allowed transitions; moves into Cleared are coordinator-only; Review Required exits only to Screening In Progress by a coordinator (false match); system exclusion match can move Screening/Eligible/Cleared/Not Current to Review Required. `findBlockingItems()` (missing / expired / not verified yet) gates both Eligible and Cleared. `checkEligibility()` is to be called after verifying items (T21, T44).
- **Sign-in:** coordinators by email + `demo1234` at `#/sign-in` → `#/dashboard` (placeholder). Applicants by magic link at `#/applicant/sign-in` → demo outbox `#/outbox?to=email` → `#/auth?token=…&next=…` → `#/applicant` (placeholder). Links last `resume_window_days` (7), only lead to in-app routes, and tokens never reach the audit log. Outbox shows the link as a button, not raw text. Session in the `session` table; shared Vue state via `sessionKey` in `app/src/session.ts`.

### Seed data (`app/public/seed/`, README there)
- 12 CSVs: agencies, users, settings, requirement_templates, template_items, caregivers (13, all lifecycle states in Hoosier Home Care), required_items (stable ids like `ri-cg-01-photo_id`), documents (53, no image files), check_orders (36), consents, replacement_requests, audit_events.
- Test SSN endings: 0001 Clear, 0002 exclusion match, 0003 never returns, 0004 vendor failure.
- Demo applicant emails: `firstname.lastname@example.com` (e.g. maria.gonzalez@example.com).

### Blocker resolutions (all in tasks.md)
- **Signed-out access (T30, T49):** signed-out reads will return only shared tables; `startIntake(agencySlug)` creates the record and signs the applicant in; demo outbox gets an email lookup. **Built in T30** — until then signed-out reads are unfiltered.
- **3G targets (T55):** on DevTools Slow 3G, each intake step ≤ 5 s, compressed photo upload ≤ 10 s (also in Spec Section 6).
- **T56 trace:** business case §7 and plan §6 step 7.
- **Review Required exit (T10, T46):** coordinator-only, back to Screening In Progress.

## Known gaps carried forward

- Browser storage (including the vault and audit log) can be edited in DevTools — accepted for the demo (ADR-10, ADR-11).
- `list('users')` exposes demo coordinator passwords to coordinator screens (fake data).
- Documents in IndexedDB aren't filtered yet (T18).
- Outbox page and signed-out reads unfiltered until T30.
- The plan's approval table still shows 2026-09-22; ADR-20 and ADR-21 and the demo-scope rewrite came after — may need re-approval.
- If the browser still has an old seed, clear site data once (DevTools > Application > Storage > Clear site data).
- A `CLAUDE.md` capturing the workflow above was offered but not created.
