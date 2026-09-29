# Plan — CareMatch

> Written after specification. Every decision here must trace back to a requirement ID.

## 1. Approach Summary
We will build a mobile-first, front-end-only web application as a working demo for a pilot with two partner agencies, ending in a go/no-go review. The demo connects to no external systems: a mock data layer inside the browser stands in for the backend, seeded from CSV files. We start with the core that everything else depends on: the data layer and seed data, the caregiver record, its lifecycle rules, and an audit log that can only be added to. On top of that we add demo sign-in and access separation between agencies, then simulated vendor checks with expiration and delay jobs, then the applicant intake, and finally the coordinator screens and compliance report. Background checks, exclusion lists, and state registries are simulated in the demo and can be swapped for real vendors after the pilot, and the data layer can be swapped for a hosted backend the same way.

## 1.5 Tech Stack
- Frontend: Vue 3 and Vue Router (hash-based URLs), built with Vite and TypeScript, styled with Bootstrap 5 themed to the CareMatch design system (palette, Roboto, Bootstrap Icons). Fonts, icons, and libraries are installed from npm and bundled, so the app makes no requests to outside sites at runtime. A static, mobile-first single-page app that runs in the phone's browser; no native app.
- Backend/DB (demo): None. A mock data layer inside the app provides records, sign-in, documents, notifications, and jobs. Seed data comes from CSV files in `/app/public/seed/`, parsed with PapaParse; records are kept in the browser's localStorage and document files in IndexedDB. A "Reset demo data" action reloads the seed.
- Hosting: GitHub Pages as static files; the app also runs locally with `npm run dev`.
- Other services/APIs: None at runtime. Email and SMS are written to an in-app outbox. Background check, OIG/SAM exclusion, and state registry are mocked vendor adapters running in the browser. The compliance report is a printable page saved with the browser's "Save as PDF". Vitest for logic tests; screens are verified by manual checks at phone size.
- After the demo (not used now): Supabase is the intended hosted backend for the pilot, replacing the mock data layer behind the same interface (ADR-21).

## 2. Key Decisions (ADRs)

| ADR # | Decision | Traces to (R#) | Alternatives considered | Why this one |
|-------|----------|------------------|---------------------------|----------------|
| ADR-00 | Use the stack in Section 1.5: a Vue 3 static frontend with a mock data layer in the browser in place of a hosted backend for the demo. | All (R1–R26) | Supabase now; a local Node/Express server with a JSON file; Next.js on Vercel | The demo must not connect to any external system. A browser data layer needs no accounts, keys, or servers and runs anywhere static files can be served. **Tradeoff:** data lives only in the browser it was entered in, and rules are enforced in app code rather than a database — accepted for the demo because the data-layer interface (ADR-21) keeps the path to Supabase open for the pilot. |
| ADR-00a | The frontend is a static site with no server code and no API keys. Fonts, icons, and libraries are bundled from npm rather than loaded from CDNs. | R4, R5, C4, NFR Security | An app server that holds secrets; CDN-hosted fonts and libraries | With no keys there is nothing to leak from the browser or the public repo, and bundled assets keep the demo free of external requests and working offline. |
| ADR-01 | Build a working demo with mocked vendors behind one shared adapter interface. | R9, R10, R19–R21, R26, C3 | Integrate real vendors now; a clickable prototype | Proves the workflow without vendor contracts, legal review, or real personal data. A clickable prototype could not demonstrate R1, R4, or R5; a shared interface lets real vendors replace mocks after the pilot. |
| ADR-02 | Build in a new `/app` folder and leave the existing class template untouched. | R1, R4, R5 | Evolve the existing template in place | The template's single read-only CSV list cannot meet an append-only audit log (R1), per-agency access control (R4), or tokenized identifiers (R5). |
| ADR-03 | Indiana only, with one Home Health Aide requirement template, stored as seed data rather than hard-coded. | Scope, R2, R12, R14 (Spec D2, D3) | Multiple states and roles | Proves that requirement templates are data, while keeping the set of rules that must be confirmed for the pilot small. |
| ADR-04 | Demo users are applicants and coordinators only. The coordinator runs the compliance report; there is no template-editing screen. | R4, R6, R13 (Spec D4) | Add owner and platform-admin roles now | Covers every scenario in the specification with the fewest roles. Additional roles follow the pilot (Spec Q3). |
| ADR-05 | Applicants sign in with a magic link, which also serves as the resume link and stays valid for the configured 7-day resume window. In the demo the data layer generates the link and delivers it to the in-app outbox. Coordinators sign in with email and password checked against seeded demo accounts. | R4, R6, R8 (Spec D5) | Applicant passwords; SMS one-time codes | No password to remember on a phone supports the one-sitting completion goal, and SMS codes would require a real SMS vendor. Demo sign-in shows the flow but is not secure, which is acceptable with fake data only. |
| ADR-06 | A notification service creates every notification and writes it to one in-app outbox, marked as email or SMS. Nothing is sent. | R7, R10, R15, R25 (Spec D6) | Real email through Resend; real SMS through Twilio | Keeps the demo free of external systems while still proving notifications end to end. A real email or SMS sender can be added behind the same service for the pilot. |
| ADR-07 | Seed two demo agencies. | R4 (Spec D7) | A single agency | Separation between agencies cannot be demonstrated or tested with only one agency. |
| ADR-08 | Model the record lifecycle as an explicit state machine: Intake In Progress, Intake Complete, Screening In Progress, Eligible, Cleared, Not Current, and Review Required. Transitions occur only through lifecycle functions in the data layer that check the rules, and only a human can move a record to Cleared. | C1, C2, R12, R14, R17, R19, R23 | Rule checks in the screens | Screens never change state directly, so no screen can skip a rule, and a human-only Cleared transition keeps the system from making hiring decisions (C1). |
| ADR-09 | Item statuses are Pending, Ordered, Delayed, Retryable, Verified, Expiring, Expired, and Manual Verification. Every item stores its source, method, verification date, and expiration date. | R2, R9, R10, R11, R15, R16, R20, R21, R22 | A simple pass/fail flag per item | Distinct statuses let the worklist, elapsed-time display, and retry logic act on each case precisely, and the required fields give the compliance report complete evidence for every item. |
| ADR-10 | The audit log is a single append-only list of events. Every write goes through the data layer, which records an event for each change; the data layer offers no way to change or remove an event. | R1, C5 | Logging from each screen | One place writes every change, so no screen can forget to log. In the demo, browser storage could still be edited by hand in developer tools; the pilot backend must enforce this in the database. |
| ADR-11 | Tokenize identifiers. The full (fake, test-only) SSN is kept in a separate vault store in the data layer; the caregiver record keeps only a token and the last four digits. Only the vendor adapters read the full value — no screen displays it. | R5, C4, C7 | Store the SSN on the caregiver record | Keeps sensitive data out of everyday record reads and preserves the pattern the pilot's real vault will use. In the demo this demonstrates the design; it is not security. |
| ADR-12 | Mock vendors return results after a configurable delay, and reserved test SSNs (900-series, which are never issued) trigger each outcome:<br>• ending **0001** — Clear<br>• ending **0002** — Exclusion match<br>• ending **0003** — Never returns (Delayed)<br>• ending **0004** — Vendor failure (Retryable) | R9, R10, R19, R20, R21 | Coordinator enters results by hand | Every acceptance test can be run on demand and repeated with the same result. |
| ADR-13 | The delayed-check and expiration jobs run in the browser when the app loads and whenever the demo date changes. A demo-date control sets the date the app treats as today. | R15, R20, C6 | A timer that runs the jobs every hour; pg_cron on a hosted database | There is no server to run jobs, and the demo-date control lets expiring, expired, and delayed scenarios be shown in minutes instead of days. |
| ADR-14 | The compliance report is a printable page for one caregiver, listing every required item with its evidence and verification history, saved with the browser's "Save as PDF" and targeting under 30 seconds. | R2, R13, NFR Performance | A PDF library in the browser; a server-generated PDF | Needs no server and no extra library; a print stylesheet produces a clean document a surveyor can receive, filed or sent as-is. |
| ADR-15 | Uploads accept JPG, PNG, and PDF up to 10 MB, compressed on the phone before saving to IndexedDB. The applicant enters the expiration date; past dates are rejected in the form and again in the data layer. A coordinator can mark a document unreadable, which routes it to Manual Verification. | R11, R22, R24, NFR Performance | Automatic date extraction with OCR | OCR adds cost and error cases and is not needed to prove the workflow. Validating dates again in the data layer ensures R24 holds even if the form check is bypassed. |
| ADR-16 | Disclosure and authorization are two separate screens, each recorded with a timestamp and the version of its wording. If the applicant declines, screening stops, the record is kept, and the coordinator is notified. | R3, R25, C8, NFR Compliance | Consent checkbox inside the intake form | R3 requires documents separate from the application; versioned wording proves exactly what the applicant agreed to and when. |
| ADR-17 | Testing uses Vitest for lifecycle, rule, and data-layer logic. Screens, including each acceptance criterion in Spec Section 5, are verified by written manual checks at a phone-sized viewport (Chrome DevTools device mode), with results logged in `docs/manual-checks.md`. | R7, R14, R15, R19, R23, NFR Accessibility | Playwright end-to-end tests; Vitest component tests with Vue Test Utils | Keeps the demo's tooling small while the rules that carry the core promise stay automated. Screens change often during the demo and are faster to check by hand, and a phone viewport still verifies the mobile-first requirement directly. **Tradeoff:** screen checks are not repeated automatically, so the manual checklist must be rerun before the go/no-go review. |
| ADR-18 | Each agency has its own intake link. The link ties a new applicant record to that agency from the first step. | R4, R7, C7 | The applicant picks an agency from a list | The record is under the correct agency's access control from the moment it is created (R4). A public agency list would expose which agencies use the product (C7). |
| ADR-19 | When a required item on a Cleared record expires without a verified replacement, the expiration job moves the record from Cleared to Not Current and notifies the coordinator. Only a human can return the record to Cleared, after the replacement is verified. | C2, C6, R14, R15 | Leave the record Cleared and show a warning only | A warning alone would leave a caregiver Cleared with an expired required item, violating C2. Requiring a human to restore Cleared keeps the system from making hiring decisions (C1). |
| ADR-20 | Apply the CareMatch design system (`docs/design/design-system.md`) through one shared Bootstrap 5 theme and a small set of reusable components: buttons, cards, form fields, status badges, and a navbar with the logo. Status badges always pair a text label with an icon, never color alone. | R6, R18, R23, NFR Accessibility, NFR Branding | Tailwind CSS with a custom config; styling each screen by hand | The design system specifies Bootstrap spacing and grid, and the existing template already uses Bootstrap. Shared components keep status and error displays consistent across screens and make WCAG 2.1 AA contrast checkable in one place. |
| ADR-21 | All data access goes through one data-layer interface covering records, items, documents, consents, audit events, notifications, and sign-in. The demo implementation loads CSV seed files on first start into localStorage (documents in IndexedDB), and "Reset demo data" reloads them. Dates in the seed are written relative to today (for example `today+20`). | All (R1–R26), R1, R4, C7 | Screens read and write browser storage directly; JSON seed files; a local server | Screens never depend on how data is stored, so a hosted backend can replace the demo layer without rewriting them. CSV is easy to edit in a spreadsheet and matches the original template, and relative dates keep every scenario working on any day. |

## 3. Components / Building Blocks

| Component | Purpose | Related requirements |
|-----------|---------|------------------------|
| Applicant intake | Mobile-first flow where the applicant enters identity and contact details, learns which documents are needed and why, and uploads credential photos. Saves progress so the flow can be resumed. | R7, R8, R11, R18, R24, NFR Accessibility, NFR Performance |
| Applicant status page | Shows the applicant their own record: outstanding items, what each is waiting on, and any replacement requested with its due date. | R6, R15, R18 |
| Disclosure and authorization screens | Two standalone screens that present the background-check disclosure and capture authorization, recording timestamp and wording version. | R3, R25, C8, NFR Compliance |
| Coordinator dashboard | Lists caregivers for the coordinator's agency by lifecycle state, including incomplete intakes, declined consents, and delayed checks. | R4, R7, R8, R16, R20, R25 |
| Caregiver record view | Shows one caregiver's required items with status, source, method, and dates; lets the coordinator order checks, mark documents unreadable, and request the Cleared transition. | R2, R9, R12, R14, R16, R17, R22, R23 |
| Expiration worklist | Lists every item inside the warning window, with the caregiver, item, and expiration date. | R15, C6 |
| Credential replacement flow | Asks the caregiver for a specific replacement item with a due date, accepts the upload, and verifies it by the same method as the original (Spec Scenario 3). | R6, R11, R15, C6 |
| Compliance report | Printable page for one caregiver with every required item, its evidence, and its verification history, saved as PDF through the browser. | R2, R13 |
| Data layer and seed data | One interface for all data (ADR-21), with a browser-storage implementation, a CSV seed loader that resolves relative dates, and a "Reset demo data" action. | All, R1, R4, C7 |
| Demo controls | "Reset demo data" and the demo-date control, available from the navbar in the demo only. | R15, R20, C6 (ADR-13, ADR-21) |
| Lifecycle/transition service | Data-layer functions that enforce the record state machine, refuse invalid transitions with a message naming the missing item, move Cleared records with an expired item to Not Current, and reserve Cleared for a human. | C1, C2, C6, R12, R14, R17, R19, R23 |
| Vendor adapters (background, exclusion, registry) | One shared interface with mock implementations for background check, OIG/SAM exclusion, and state registry, including a manual-verification path for the registry. | R9, R10, R19, R20, R21, R26, C3 |
| Scheduled jobs | Jobs that run on app load and when the demo date changes, flagging delayed checks and expiring or expired items and moving any Cleared record with an expired required item to Not Current. | R14, R15, R16, R20, C2, C6 |
| Notification service and outbox | Creates notifications and writes email and SMS messages, including demo sign-in links, to one in-app outbox. | R7, R8, R10, R15, R25 |
| Audit log | Append-only list of events written by the data layer on every change. | R1, C5 |
| Token vault | Separate data-layer store holding full fake identifiers; records hold only a token and last four digits. | R5, C4, C7 |
| Document storage | IndexedDB store for credential photos and PDFs, tagged by agency and applicant. | R2, R4, R11, R22, R24, NFR Security |
| Access control | Demo sign-in plus a data-layer filter that limits every record, file, and report to users with a role on that agency. | R4, R6, C7, NFR Security |
| Design system and shared UI components | Bootstrap 5 theme and reusable components (buttons, cards, form fields, status badges, navbar with logo) that apply the CareMatch design system on every screen. | R6, R18, R23, NFR Accessibility, NFR Branding (ADR-20) |
| Requirement template seed data | The Indiana Home Health Aide template, loaded from CSV seed files, that defines which items each record requires. | R2, R12, R14 (Spec D2, D3) |

## 4. Dependencies & Assumptions
- External services/tools needed:
  - None at runtime — the demo connects to no external systems.
  - Build time: Node.js and npm packages (Vue, Vite, TypeScript, Bootstrap, Bootstrap Icons, Roboto font package, PapaParse, Vitest)
  - GitHub Pages and GitHub Actions for hosting and deployment
  - Two partner agencies for the pilot (represented by two seeded demo agencies during the build)
  - After the demo: Supabase and an email provider for the pilot backend
- Configurable settings (all adjustable in `settings.csv` without code changes):
  - Expiration warning window: 30 days (R15)
  - Delayed-check threshold: 3 business days (R20)
  - Resume link validity: 7 days (R8)
  - Mock vendor delay (ADR-12)
- Assumptions being made (unverified — confirm before real use):
  - ⚠️ The Indiana Home Health Aide requirements in the template are a sample and must be checked against current Indiana rules (Spec Q1).
  - ⚠️ Real background-check, exclusion, and registry vendors offer APIs that fit the shared adapter interface (Spec Q2).
  - ⚠️ The data-layer interface is close enough to a hosted backend that the pilot can replace it without rewriting screens (ADR-21).
  - ⚠️ Applicants will trust the process with sensitive data such as SSNs and licenses.
  - ⚠️ Agencies want to change their current hiring and verification process.
  - ⚠️ Retention and deletion periods by record type are pending legal review (Spec Q4).
- Open questions carried from the business case feasibility assessment (Section 4):
  - **Operational:** Do agencies believe this process needs to change? Will it cause workforce reduction? Does it create legal or ethical issues such as systematic discrimination? Will applicants be able to complete intake easily? Will applicants trust an unfamiliar company with sensitive credentials?
  - **Technical:** Can we acquire the required integrations, and do they exist? Can we provide adequate security for sensitive information?
  - **Economic:** Can we build and run this profitably? Is it worth what we would charge? What is the cost of not building it?
  - **Schedule:** Is there a firm timetable to market? Would an accelerated schedule pose risks, and are they acceptable?

## 5. Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
|------|------------|--------|------------|-------|
| Personal-data breach exposes applicant identifiers or documents (R4, R5, C4, C7, NFR Security) | Low | Low (demo) | Use only fake, test-only data with 900-series SSNs in the demo; data never leaves the viewer's browser. Keep the vault pattern (ADR-11) and agency filter (ADR-21) so the pilot backend enforces the same rules; add automated tests proving one agency cannot read another's records. | Dev team |
| Secrets accidentally committed to the public repository (R5, NFR Security) | Low | Low | The demo has no API keys (ADR-00a). Enable GitHub secret scanning and push protection now so the pilot backend starts protected. | Dev team |
| Browser storage limits are reached (R11, NFR Performance) | Medium | Medium | Keep document files in IndexedDB rather than localStorage; compress uploads on the phone and cap them at 10 MB (ADR-15); keep seed data small; offer "Reset demo data" (ADR-21). | Dev team |
| Demo data lives in one browser, so an applicant on a phone and a coordinator on a laptop do not see each other's changes (ADR-00) | High | Medium | Run the demo script with both roles in one browser (sign out and back in); seed every lifecycle state so no cross-device flow is needed; state in the go/no-go review that shared data arrives with the pilot backend. | PM |
| Rules are enforced in app code rather than a database during the demo (R1, R4, C2, C5) | Medium | Medium | Route every read and write through the data layer (ADR-21); cover lifecycle, audit, and access rules with Vitest tests; move enforcement into the database for the pilot. | Dev team |
| Mock vendors hide real integration problems (R9, R10, R19–R21, R26, C3) | High | Medium | Model the adapter interface on published vendor API documentation; make mocks cover delay, failure, and match cases (ADR-12); evaluate at least one real vendor API before the go/no-go review (Spec Q2). | Dev team |
| Legal exposure around disclosure and discrimination (C1, C8, R3, R25, NFR Compliance) | Medium | High | The system never scores, ranks, or decides; only a human can mark Cleared (ADR-08). Keep disclosure standalone and versioned (ADR-16); show only the information required; obtain legal review before any real applicant data is used. | Legal Team |
| Applicants abandon intake on mobile (R8, R18, NFR Accessibility, NFR Performance) | Medium | High | Password-free magic-link sign-in that doubles as the resume link (ADR-05); save progress at each step; compress uploads; use warm, plain-language copy per the design system (ADR-20); test every flow at phone size (ADR-17); measure against the 75% one-sitting goal during the pilot. | UX Team |
| Partner agencies do not adopt the portal (R6, R13, R15) | Medium | High | Involve both agencies early and gather feedback throughout; design coordinator screens to be learnable within one week using consistent, predictable components (ADR-20); make the go/no-go review explicitly based on agency feedback. | PM |
| Schedule pressure cuts correctness (C2, R14, R23, NFR Budget) | Medium | High | Build lifecycle rules and the audit log first (Section 6); require all acceptance tests to pass before the go/no-go review; when time is short, cut scope (e.g., report styling, registry automation) — never rules. | PM |

## 6. Sequencing
Build order follows dependencies, with the riskiest and most foundational work first:

1. **Data layer, seed data, lifecycle rules, and audit log** — Every other component depends on the data layer and the caregiver record, and these rules carry the core promise (C2, R1, R14). Building them first also protects correctness from schedule pressure.
2. **Demo sign-in, roles, and two demo agencies** — Access separation (R4) must be in place before any screen reads records.
3. **Mock vendor adapters, jobs, outbox, and demo-date control** — Exercises the most uncertain behavior (results, delays, failures, expirations) before screens are built on top of it (R9, R10, R15, R19–R21).
4. **Applicant intake, consent, and uploads** — Creates records through the real flow once the rules and access controls exist (R3, R7, R8, R11, R24, R25).
5. **Coordinator dashboard, record view, and worklist** — Surfaces the workflow already enforced underneath (R12, R15, R16, R22, R23).
6. **Compliance report** — Depends on complete item evidence and history, so it is built last (R13).
7. **Acceptance test pass and pilot go/no-go review** — Run every Spec Section 5 acceptance criterion as a manual check at phone size, then hold the go/no-go review with the partner agencies.

## 7. Review & Approval
| Reviewer | Date | Approved? |
|----------|------|-----------|
| Steve CEO (CEO) | 2026-09-22 | Yes |
| Legal Team | 2026-09-22 | Yes |
| UX Team | 2026-09-22 | Yes |
| Mike Broniek (PM) | 2026-09-22 | Yes |

**Gate:** Do not generate tasks until this plan is done.
