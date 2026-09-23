# How to Complete plan.md

Write this **after** the specification. The specification provides the *what* and *why* while the plan.md says *how* — including risks.

Every line in plan.md should be traceable back to a requirement ID (R1, R2...) in the specification. If you write something that doesn't trace back to anything, you need to decide whether it belongs here.

---

## 1. Approach Summary
2–4 sentences. No jargon, no code. Someone non-technical should understand the concept and shape of the solution.

**Example:**
> We'll build a single-page web app with a public grid view and a detail view for each item. An admin-only form handles uploads. Data is stored in a hosted database; images are stored as files, not links.

---

## 1.5 Tech Stack
List the actual tools/services you'll use. Keep it to and outline of names, frameworks, etc. We will cover justification for these choices in Section 2.

**Example:**
- Frontend: React, Tailwind
- Backend/DB: Supabase (Postgres + Auth + Storage)
- Hosting: Railway
- Other services/APIs: OpenAI inference

---

## 2. Key Decisions (ADRs)
An ADR (Architecture Decision Record) is one row per meaningful choice. Write it any time you pick one option over a real alternative.

Fill in:
- **Decision** — what you chose
- **Traces to (R#)** — which requirement(s) this decision maps to in the specification
- **Alternatives considered** — at least one real option you didn't pick
- **Why this one** — the actual reason, written concisely. Avoid "it was easier" or "we like it" — explain the tradeoff.

**Example:**

| ADR # | Decision | Traces to (R#) | Alternatives considered | Why this one |
|---|---|---|---|---|
| ADR-00 | Frontend: React; Backend/DB: Supabase | R1–R5 (all) | Next.js+Postgres, Firebase | Team familiarity, built-in auth, fast to prototype |
| ADR-01 | Store images as uploaded files, not pasted URLs | R3 | Let admin paste an image URL | More reliable — no broken links if the source disappears |

**Test for whether you need an ADR:** if someone six months from now might ask "wait, why didn't we just do X instead?" — write it down now.

---

## 3. Components / Building Blocks
List the major pieces of the system by name and purpose. No code, no implementation detail — just what it is and what it does. Each component should trace back to at least one requirement.

**Example:**

| Component | Purpose | Related requirements |
|---|---|---|
| Grid view | Shows all items on the homepage | R1 |
| Detail view | Shows one item's full info | R2 |
| Upload form | Lets an admin add a new item | R3 |
| Items table (DB) | Stores item data | R1, R2, R3 |

---

## 4. Dependencies & Assumptions
**Dependencies** — anything external you need that isn't yours to control (a service, an API, a team, an authentication system).
**Assumptions** — anything you're taking on faith that hasn't been verified. Flag these clearly so they don't get discovered late.

**Example:**
- External services/tools needed: Supabase account, image hosting via Supabase Storage
- Assumptions being made: assuming under 10,000 items total — if this grows past that, pagination needs to be added

---

## 5. Risks
A risk is something that *might* go wrong, not something that already has. For each one: how likely, how bad if it happens, and what you'll do about it.

**Example:**

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Large image uploads slow the site | Medium | Medium | Resize/compress images on upload | Dev team |
| Admin forgets to fill in a required field | High | Low | Add form validation before submit | Dev team |

**How to fill "Likelihood" and "Impact":** just use Low/Medium/High — you don't need a formal scoring model for a small project. The point is forcing yourself to think about it before it happens, not precise measurement.

---

## 6. Sequencing
What gets built first, and why. Usually: riskiest or most uncertain part first, then things that other parts depend on.

**Example:**
> 1. Items table (everything else depends on it)
> 2. Grid view (proves data can be read and displayed)
> 3. Upload form (proves data can be written)
> 4. Detail view (lowest risk, do last)

---

## 7. Review & Approval
Whoever is accountable for the project signs off before tasks.md gets written. For a class project this might just be you and an instructor or teammate.

---

## Quick Self-Check Before Moving to tasks.md
- [ ] Every ADR cites a requirement ID
- [ ] Every component maps to at least one requirement
- [ ] Every risk has a mitigation, not just a description
- [ ] Sequencing reflects the riskiest/most uncertain work first
- [ ] Section 7 is signed off

If any box is unchecked, don't start defining tasks yet.
