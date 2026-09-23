# Plan — Home Healthcare Caregiver Hiring Portal

> Written after specification. Every decision here must trace back to a requirement ID.

## 1. Approach Summary
We will build a mobile-first web application as a working demo for a pilot with two partner agencies, ending in a go/no-go review. We start with the core that everything else depends on: the caregiver record, its lifecycle rules, and an audit log that can only be added to. On top of that we add sign-in and access separation between agencies, then simulated vendor checks with scheduled expiration and delay checks, then the applicant intake, and finally the coordinator screens and compliance report. Background checks, exclusion lists, and state registries are simulated in the demo and can be swapped for real vendors after the pilot.

## 1.5 Tech Stack
- Frontend: Vue 3 and Vue Router (hash-based URLs), built with Vite and TypeScript, styled with Tailwind CSS. A static, mobile-first single-page app that runs in the phone's browser; no native app.
- Backend/DB: Supabase — Postgres database, Auth (magic link for applicants, email and password for coordinators), Storage for document photos, row-level security, pg_cron for scheduled jobs, Vault for tokenized identifiers, and Edge Functions for anything that needs a secret (sending email, reading the vault, generating the report).
- Hosting: GitHub Pages for the frontend; Supabase for the backend and database.
- Other services/APIs: Resend for email (also used as Supabase Auth's email sender). SMS mocked into an in-app outbox. Background check, OIG/SAM exclusion, and state registry provided by mocked vendor adapters. A PDF library running in a Supabase Edge Function for the compliance report. Vitest and Playwright for testing.

## 2. Key Decisions (ADRs)

| ADR # | Decision | Traces to (R#) | Alternatives considered | Why this one |
|-------|----------|------------------|---------------------------|----------------|
| ADR-00 | Use the stack in Section 1.5: Vue 3 static frontend on GitHub Pages; Supabase for database, auth, storage, jobs, secrets, and server functions. | All (R1–R26), R4 in particular | Next.js on Vercel; Django + Postgres | Row-level security enforces per-agency access inside the database (R4). One backend service covers auth, storage, scheduled jobs, secrets, and data. Vue matches the existing tooling, and a static frontend on GitHub Pages is free and simple to deploy. **Tradeoff:** with no app server, every rule and secret must live in Supabase — accepted deliberately, because it keeps enforcement in one place. |
| ADR-00a | The frontend is a static site with no server code. The Supabase public (anon) key in the browser is safe by design because row-level security decides what each user can see. Service-role and Resend keys live only in Edge Function secrets — never in the frontend or the repository. | R4, R5, C4, NFR Security | An app server that holds secrets | Fewer moving parts to build, deploy, and secure, with no secret ever reachable from the browser or the public repo. |
| ADR-01 | Build a working demo with mocked vendors behind one shared adapter interface. | R9, R10, R19–R21, R26, C3 | Integrate real vendors now; a clickable prototype | Proves the workflow without vendor contracts, legal review, or real personal data. A clickable prototype could not demonstrate R1, R4, or R5; a shared interface lets real vendors replace mocks after the pilot. |
| ADR-02 | Build in a new `/app` folder and leave the existing class template untouched. | R1, R4, R5 | Evolve the existing template in place | The CSV-based template cannot meet an append-only audit log (R1), per-agency access control (R4), or tokenized identifiers (R5). |
| ADR-03 | Indiana only, with one Home Health Aide requirement template, stored as seed data rather than hard-coded. | Scope, R2, R12, R14 (Spec D2, D3) | Multiple states and roles | Proves that requirement templates are data, while keeping the set of rules that must be confirmed for the pilot small. |
| ADR-04 | Demo users are applicants and coordinators only. The coordinator runs the compliance report; there is no template-editing screen. | R4, R6, R13 (Spec D4) | Add owner and platform-admin roles now | Covers every scenario in the specification with the fewest roles. Additional roles follow the pilot (Spec Q3). |
| ADR-05 | Applicants sign in with an email magic link, which also serves as the 7-day resume link. Coordinators sign in with email and password. | R4, R6, R8 (Spec D5) | Applicant passwords; SMS one-time codes | No password to remember on a phone supports the one-sitting completion goal, and SMS codes would require a real SMS vendor. |
| ADR-06 | Real email through Resend, sent by a Supabase Edge Function triggered by a database webhook whenever a notification is created. SMS is logged to an in-app outbox, not sent. | R7, R10, R15, R25 (Spec D6) | Real SMS through Twilio | Avoids SMS cost and phone-number registration during the demo while still proving notifications end to end. |
| ADR-07 | Seed two demo agencies. | R4 (Spec D7) | A single agency | Separation between agencies cannot be demonstrated or tested with only one agency. |
| ADR-08 | Model the record lifecycle as an explicit state machine: Intake In Progress, Intake Complete, Screening In Progress, Eligible, Cleared, Not Current, and Review Required. Transitions occur only through database functions that check the rules, and only a human can move a record to Cleared. | C1, C2, R12, R14, R17, R19, R23 | Rule checks in the screens | A check in the database cannot be skipped by any screen or by a future bug, and a human-only Cleared transition keeps the system from making hiring decisions (C1). |
| ADR-09 | Item statuses are Pending, Ordered, Delayed, Retryable, Verified, Expiring, Expired, and Manual Verification. Every item stores its source, method, verification date, and expiration date. | R2, R9, R10, R11, R15, R16, R20, R21, R22 | A simple pass/fail flag per item | Distinct statuses let the worklist, elapsed-time display, and retry logic act on each case precisely, and the required fields give the compliance report complete evidence for every item. |
| ADR-10 | The audit log is a single events table. Database triggers write an event on every change and block updates and deletes on the audit table itself. | R1, C5 | Logging from application code | Triggers cannot be forgotten or bypassed, so no change can escape the log and no log entry can be altered. |
| ADR-11 | Tokenize identifiers. The full (fake, test-only) SSN is stored in Supabase Vault; the caregiver record keeps only a token and the last four digits. Only an Edge Function or a restricted database function can read the full value — the browser never can. | R5, C4, C7 | Encrypted column on the caregiver record | Keeps sensitive data separate from everyday record reads, so routine screens and queries never touch the full identifier. |
| ADR-12 | Mock vendors return results after a configurable delay, and reserved test SSNs trigger each outcome:<br>• ending **0001** — Clear<br>• ending **0002** — Exclusion match<br>• ending **0003** — Never returns (Delayed)<br>• ending **0004** — Vendor failure (Retryable) | R9, R10, R19, R20, R21 | Coordinator enters results by hand | Every acceptance test can be run on demand and repeated with the same result. |
| ADR-13 | Run scheduled jobs in Supabase pg_cron: the delayed-check job hourly and the expiration check daily. | R15, R20, C6 | Scheduled GitHub Actions workflow | pg_cron runs next to the data, needs no secrets outside Supabase, and is more reliable on timing. |
| ADR-14 | The compliance report is a PDF generated by a Supabase Edge Function for one caregiver, listing every required item with its evidence and verification history, targeting generation in under 30 seconds. | R2, R13, NFR Performance | Printable web page | A PDF is what a surveyor expects to receive and can be filed or sent as-is. |
| ADR-15 | Uploads accept JPG, PNG, and PDF up to 10 MB, compressed on the phone before upload. The applicant enters the expiration date; past dates are rejected on the phone and again on the server. A coordinator can mark a document unreadable, which routes it to Manual Verification. | R11, R22, R24, NFR Performance | Automatic date extraction with OCR | OCR adds cost and error cases and is not needed to prove the workflow. Server-side date validation ensures R24 holds even if the phone check is bypassed. |
| ADR-16 | Disclosure and authorization are two separate screens, each recorded with a timestamp and the version of its wording. If the applicant declines, screening stops, the record is kept, and the coordinator is notified. | R3, R25, C8, NFR Compliance | Consent checkbox inside the intake form | R3 requires documents separate from the application; versioned wording proves exactly what the applicant agreed to and when. |
| ADR-17 | Testing uses Vitest for lifecycle and rule logic, and Playwright at a phone-sized viewport for each acceptance criterion in Spec Section 5. | R7, R14, R15, R19, R23, NFR Accessibility | Manual click-through testing | Automated tests are repeatable before every release, and a phone viewport verifies the mobile-first requirement directly. |
| ADR-18 | Each agency has its own intake link. The link ties a new applicant record to that agency from the first step. | R4, R7, C7 | The applicant picks an agency from a list | The record is under the correct agency's access control from the moment it is created (R4). A public agency list would expose which agencies use the product (C7). |
| ADR-19 | When a required item on a Cleared record expires without a verified replacement, the daily expiration job moves the record from Cleared to Not Current and notifies the coordinator. Only a human can return the record to Cleared, after the replacement is verified. | C2, C6, R14, R15 | Leave the record Cleared and show a warning only | A warning alone would leave a caregiver Cleared with an expired required item, violating C2. Requiring a human to restore Cleared keeps the system from making hiring decisions (C1). |

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
| Compliance report | Edge Function that produces a single PDF of every required item, its evidence, and its verification history for one caregiver. | R2, R13 |
| Lifecycle/transition service | Database functions that enforce the record state machine, refuse invalid transitions with a message naming the missing item, move Cleared records with an expired item to Not Current, and reserve Cleared for a human. | C1, C2, C6, R12, R14, R17, R19, R23 |
| Vendor adapters (background, exclusion, registry) | One shared interface with mock implementations for background check, OIG/SAM exclusion, and state registry, including a manual-verification path for the registry. | R9, R10, R19, R20, R21, R26, C3 |
| Scheduled jobs | pg_cron jobs that flag delayed checks hourly and expiring or expired items daily, moving any Cleared record with an expired required item to Not Current. | R14, R15, R16, R20, C2, C6 |
| Notification service and SMS outbox | Creates notifications, sends email through Resend via an Edge Function, and logs SMS to an in-app outbox. | R7, R10, R15, R25 |
| Audit log | Append-only events table written by database triggers on every change. | R1, C5 |
| Token vault | Stores full identifiers in Supabase Vault; records hold only a token and last four digits. | R5, C4, C7 |
| Document storage | Supabase Storage buckets for credential photos and PDFs, scoped per agency. | R2, R4, R11, R22, R24, NFR Security |
| Access control | Supabase Auth plus row-level security policies that limit every record, file, and report to users with a role on that agency. | R4, R6, C7, NFR Security |
| Requirement template seed data | The Indiana Home Health Aide template, loaded as data, that defines which items each record requires. | R2, R12, R14 (Spec D2, D3) |

## 4. Dependencies & Assumptions
- External services/tools needed:
  - Supabase (Postgres, Auth, Storage, Vault, pg_cron, Edge Functions)
  - GitHub Pages and GitHub Actions for hosting and deployment
  - Resend for email delivery
  - Two partner agencies for the pilot (represented by two seeded demo agencies during the build)
- Configurable settings (all three adjustable without code changes):
  - Expiration warning window: 30 days (R15)
  - Delayed-check threshold: 3 business days (R20)
  - Resume link validity: 7 days (R8)
- Assumptions being made (unverified — confirm before real use):
  - ⚠️ The Indiana Home Health Aide requirements in the template are a sample and must be checked against current Indiana rules (Spec Q1).
  - ⚠️ Real background-check, exclusion, and registry vendors offer APIs that fit the shared adapter interface (Spec Q2).
  - ⚠️ Supabase, Resend, and GitHub free tiers are sufficient for the pilot.
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
| Personal-data breach exposes applicant identifiers or documents (R4, R5, C4, C7, NFR Security) | Low | High | Use only fake, test-only data in the demo. Enforce row-level security on every table and bucket; tokenize SSNs in Vault (ADR-11); encrypt in transit and at rest; add automated tests proving one agency cannot read another's records. | Dev team |
| Secrets accidentally committed to the public repository (R5, NFR Security) | Medium | High | Keep only the anon key in the frontend (ADR-00a); store service and Resend keys as Edge Function secrets; git-ignore environment files; enable GitHub secret scanning and push protection; rotate any exposed key immediately. | Dev team |
| Hitting free-tier limits on Supabase, Resend, or GitHub (R11, R13, NFR Performance, NFR Budget) | Medium | Medium | Compress uploads on the phone and cap them at 10 MB (ADR-15); keep seed data small; monitor usage dashboards; budget for a paid tier before the pilot goes live. | PM |
| Mock vendors hide real integration problems (R9, R10, R19–R21, R26, C3) | High | Medium | Model the adapter interface on published vendor API documentation; make mocks cover delay, failure, and match cases (ADR-12); evaluate at least one real vendor API before the go/no-go review (Spec Q2). | Dev team |
| Legal exposure around disclosure and discrimination (C1, C8, R3, R25, NFR Compliance) | Medium | High | The system never scores, ranks, or decides; only a human can mark Cleared (ADR-08). Keep disclosure standalone and versioned (ADR-16); show only the information required; obtain legal review before any real applicant data is used. | Legal Team |
| Applicants abandon intake on mobile (R8, R18, NFR Accessibility, NFR Performance) | Medium | High | Password-free magic-link sign-in that doubles as the resume link (ADR-05); save progress at each step; compress uploads; use plain language; test every flow at phone size (ADR-17); measure against the 75% one-sitting goal during the pilot. | UX Team |
| Partner agencies do not adopt the portal (R6, R13, R15) | Medium | High | Involve both agencies early and gather feedback throughout; design coordinator screens to be learnable within one week; make the go/no-go review explicitly based on agency feedback. | PM |
| Schedule pressure cuts correctness (C2, R14, R23, NFR Budget) | Medium | High | Build lifecycle rules and the audit log first (Section 6); require all acceptance tests to pass before the go/no-go review; when time is short, cut scope (e.g., report styling, registry automation) — never rules. | PM |

## 6. Sequencing
Build order follows dependencies, with the riskiest and most foundational work first:

1. **Database schema, lifecycle rules, and audit log** — Every other component depends on the caregiver record, and these rules carry the core promise (C2, R1, R14). Building them first also protects correctness from schedule pressure.
2. **Sign-in, roles, and two demo agencies** — Access separation (R4) must be in place before any screen reads real records, and it is the highest-impact security risk.
3. **Mock vendor adapters and scheduled jobs** — Exercises the most uncertain behavior (results, delays, failures, expirations) before screens are built on top of it (R9, R10, R15, R19–R21).
4. **Applicant intake, consent, and uploads** — Creates records through the real flow once the rules and access controls exist (R3, R7, R8, R11, R24, R25).
5. **Coordinator dashboard, record view, and worklist** — Surfaces the workflow already enforced underneath (R12, R15, R16, R22, R23).
6. **Compliance report** — Depends on complete item evidence and history, so it is built last (R13).
7. **Acceptance test pass and pilot go/no-go review** — Run every Spec Section 5 acceptance criterion at phone size, then hold the go/no-go review with the partner agencies.

## 7. Review & Approval
| Reviewer | Date | Approved? |
|----------|------|-----------|
| Steve CEO (CEO) | 2026-09-22 | Yes |
| Legal Team | 2026-09-22 | Yes |
| UX Team | 2026-09-22 | Yes |
| Mike Broniek (PM) | 2026-09-22 | Yes |

**Gate:** Do not generate tasks until this plan is done.