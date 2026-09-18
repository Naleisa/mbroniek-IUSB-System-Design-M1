
# [Product/Service Name] — Specification

---

## 0. Constitution (fill once per project, reuse across specs)

Non-negotiable principles this product must never violate, regardless of feature.

| # | Principle | Why it exists |
|--|-----------|----------------|
| 1 | The system never makes a hiring decision. | Discrimination |
| 2 | No caregiver reaches "cleared" with missing or expired required items. | Core promise |
| 3 | Software is a workflow layer, not reporting agency | Core promise |
| 4 | Identifiers are minimized and tokenized | Security |
| 5 | Audit record is append only | Usability |
| 6 | Verification has a shelf life | Usability |
| 7 | Applicant and agency data is theirs and not ours | Trust |
| 8 | Verification laws are followed to only share required information | Legal |

---

## 1. Problem & Intent

**Who is this for?**

(Name the specific user, not "everyone.")

**What problem do they have today?**

(Describe the pain, not the solution.)

**Why now / why us?**

**What does success look like?**

(A measurable outcome, not a feature list — e.g. "80% of new users complete setup in under 3 minutes.")

---

## 2. Scope

**In scope** — what this version must do.

**Out of scope** — what it explicitly will NOT do (this list prevents scope creep and over-building).

---

## 3. User Scenarios

Write each as a short story: who, what they're trying to do, what "done" looks like.

**Scenario 1: [name]**

- Actor:

- Trigger:

- Steps:

- Success outcome:

- Failure outcome:

  

*(Repeat for each core scenario. 3–5 is typical for a first spec.)*

---

## 4. Requirements (EARS notation)

Use [EARS](https://alistairmavin.com/ears/) (Easy Approach to Requirements Syntax) so requirements are consistent and unambiguous.

Patterns:

-  **Ubiquitous:**  *The system shall [always do X].*

-  **Event-driven:**  *When [trigger], the system shall [response].*

-  **State-driven:**  *While [state], the system shall [response].*

-  **Unwanted behavior:**  *If [condition], then the system shall [response].*

-  **Optional:**  *Where [feature is present], the system shall [response].*

  

| ID | Requirement | Pattern |

|----|-------------|---------|

| R1 | When a user submits the signup form with a valid email, the system shall create an account and send a confirmation email. | Event |

| R2 | | |

---

## 5. Acceptance Criteria

For each requirement, define the test that proves it's done. If you can't write a pass/fail test, the requirement is still too vague.

| Requirement | Test | Pass condition |

|-------------|------|-----------------|

| R1 | Submit form with valid email | Account exists in DB; email received within 60s |

---

## 6. Constraints & Non-Functional Requirements

-  **Performance:**

-  **Security/Privacy:**

-  **Accessibility:**

-  **Compliance/Legal:**

-  **Budget/Timeline:**

---

## 7. Open Questions

Anything unresolved. Don't let AI or a builder guess silently — list it and get an answer before build starts.

| Question | Owner | Status |

|----------|-------|--------|

| | | Open / Resolved |

---

## 8. Plan (derived from this spec — separate document once approved)

Once the spec above is approved, translate it into:

-  **`plan.md`** — the approach and key decisions, each traced back to a requirement ID above

-  **`tasks.md`** — atomic, ordered, checkable tasks derived from the plan

Do not skip from spec straight to a build without reviewing the plan first.

---

## 9. Approval

| Role | Name | Date | Signed off? |

|------|------|------|-------------|

| Spec owner | | | |

| Reviewer | | | |

---

### Primary sources this template draws on

- [GitHub Spec Kit](https://github.com/github/spec-kit) — open-source spec/plan/tasks toolkit

- [Spec-Driven Development methodology](https://github.com/github/spec-kit/blob/main/spec-driven.md) — GitHub's explainer

- [EARS notation](https://alistairmavin.com/ears/) — requirements syntax

- [Microsoft: Spec-Driven Development for AI-Native Engineering](https://developer.microsoft.com/blog/spec-driven-development-ai-native-engineering/)
