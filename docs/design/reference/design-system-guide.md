# How to Complete the Design System Doc

Write this **once per organization/brand**, not once per project. If your org already has one, use it — don't recreate it. If it doesn't exist yet, treat building it as its own small project (a quick business case → what/why → draft → approval) *before* any product's Design step depends on it.

---

## 1. Brand Principles
2–3 sentences capturing the personality the design should convey. This anchors every choice below — if a color or font doesn't fit these words, it doesn't belong.

**Example:**
> Friendly, uncluttered, and fast. We favor clarity over decoration — members should find a photo in two clicks, not admire the interface.

---

## 2. Color Palette
Keep it small — 3–7 colors max for a first version. More than that becomes unmanageable and inconsistent.

**Example:**

| Name | Hex | Use |
|---|---|---|
| Primary | #2E5EAA | Main brand color, primary buttons |
| Secondary | #F2A93B | Accents, links |
| Background | #FAFAFA | Page background |
| Text | #1A1A1A | Body text |

---

## 3. Typography
Pick one font family for headings, one for body (they can be the same font, different weights). Don't pick more than two font families total — more looks inconsistent, not sophisticated.

**Example:**

| Role | Font | Size | Weight |
|---|---|---|---|
| Heading 1 | Inter | 32px | Bold |
| Heading 2 | Inter | 22px | Semibold |
| Body | Inter | 16px | Regular |

---

## 4. Logo Usage
Prevents someone from stretching or recoloring the logo badly six months from now.

**Example:**
- File(s): `/assets/logo.svg`, `/assets/logo-white.svg`

---

## 5. Spacing & Grid
Pick a base unit and stick to multiples of it everywhere — this alone makes a UI look "designed" instead of ad hoc.

**Example:**
- Base unit: 8px
- Grid: 12-column, max content width 1200px
- Standard spacing scale: 8 / 16 / 24 / 32 / 48px (nothing in between)

---

## 6. Core Components
Document the handful of UI patterns that get reused everywhere, so every screen in the Design step pulls from the same set instead of reinventing buttons/cards each time.

**Example:**

| Component | Rules |
|---|---|
| Button (primary) | Primary color background, white text, 8px corner radius, 16px vertical padding |
| Card | White background, 1px border #E0E0E0, 16px padding, 8px corner radius |
| Form field | Label above input, error message in red below field on invalid submit |

You don't need every component defined on day one — add rows as new patterns come up in real projects, rather than trying to predict everything up front.

---

## 7. Voice & Tone
How the product "talks" — this keeps button labels and error messages consistent across screens and projects.

**Example:**
- Tone: casual, warm, brief. No corporate jargon.
- Example microcopy: button says "Add a photo," not "Submit Media Asset"; error says "That date can't be in the future" not "Invalid input: date_field violates constraint"

---

## 8. Accessibility Standards
A firm number here prevents "we'll deal with it later" — which usually means never.

**Example:**
- Minimum contrast ratio: 4.5:1 for body text (WCAG AA)
- Standard to meet: WCAG 2.1 AA

---

## 9. Version & Change Log
Design systems evolve. Log changes so old projects know which version they were built against, and new projects know what's current.

**Example:**

| Version | Date | Change | Approved by |
|---|---|---|---|
| 1.0 | 2026-09-01 | Initial version | Design lead |
| 1.1 | 2026-10-15 | Added error color, updated button padding | Design lead |

---

## How This Connects to Your Projects
- **specification.md (Constraints, Section 6):** reference the design system version — *"Branding: must comply with Design System v1.1."*
- **plan.md (Dependencies):** list the design system doc as a dependency, with a link.

## Quick Self-Check
- [ ] Brand Principles are specific enough to actually rule things out
- [ ] Color palette is 3–7 colors, not a rainbow
- [ ] No more than 2 font families
- [ ] Accessibility contrast ratio is a real number, not "we'll check later"
- [ ] Version is logged and dated