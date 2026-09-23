# How to Complete tasks.md

Write this **after** the plan. The plan lays out *how* you'll build it and in what order.The task document breaks that into the smallest checkable steps.

Every task should trace back to a requirement (R#) or a decision (ADR#) from earlier documents. If a task doesn't trace to anything, ask why you're doing it.

---

## Task List

Fill one row per task. Rules for a good task:

- **Small** — finishable in under a day. If it feels bigger, split it up.
- **Checkable** — someone else could look at it and say whether it is done or not.
- **Ordered** — follows the plan sequencing.

Columns:
- **ID** — T1, T2, T3... 
- **Task** — one clear action that starts with a verb
- **Traces to** — the requirement or ADR this task exists to satisfy
- **Depends on** — which task(s) must be done first (use "—" if none)
- **Status** — see status key below

**Example**, building on the collection-display app from plan.md:

| ID | Task | Traces to (R# / ADR#) | Depends on | Status |
|---|---|---|---|---|
| T1 | Create items table in database | ADR-00 | — | Not started |
| T2 | Build grid view showing all items | R1 | T1 | Not started |
| T3 | Build detail view for one item | R2 | T1 | Not started |
| T4 | Build admin upload form | R3, ADR-01 | T1 | Not started |
| T5 | Add form validation to upload form | R3 | T4 | Not started |
| T6 | Test: upload item → confirm it appears in grid | R3 | T2, T4 | Not started |

**Status values:** Not started · In progress · Done · Blocked

**How to split a task that's too big:**
Bad: *"Build the app"* — too vague, not checkable, can't estimate.
Better: split by screen/feature (like T2, T3, T4 above).

**Test for the right size:** if you can't say in one sentence what "done" looks like, the task is still too big.

---

## Definition of Done
This applies to *every* task, so you don't have to repeat it per row. Don't change this section per project — it's your quality bar.

- Matches its linked requirement's acceptance criteria in the specification.
- Reviewed by a human before marked done
- No task marked done without a test passing

---

## Blocked / Questions
Use this any time a task can't proceed — missing info, a decision not yet made, an external dependency not ready. Don't just leave the task "not completed" silently. Record the reason why.

**Example:**

| Task | Blocker | Raised | Resolved |
|---|---|---|---|
| T4 | Unclear if admin needs login, or just a hidden URL — not decided in plan.md | 2026-09-10 | |

Once resolved, note the resolution and date, and update plan.md if the answer changes a decision recorded there (e.g. becomes a new ADR).

---

## Quick Self-Check Before You Start Building
- [ ] Every task traces to a requirement or ADR
- [ ] Every task is small enough to finish in under a day
- [ ] Order matches plan.md's sequencing (riskiest/most depended-on first)
- [ ] No task is vague enough that "done" is a judgment call
- [ ] Blocked items are logged, not silently skipped

If any box is unchecked, refine the task list before writing code.
