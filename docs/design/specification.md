
# [Product/Service Name] — Specification

---

## 0. Constitution

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

1. Staffing & Compliance Coordinator (Primary) - Typically one person doing many jobs at a small agency.  Frequently not a compliance specialist and sometimes new to the role.  Must be able to learn the product in a week.

2. The caregiver applicant - Typically on a phone, applying to several agencies at once and going with whoever is able to get all steps completed first.  Is never trained on the product outside of potential knowledge base articles.

3. Owner (buyer) - Cares about proving compliance on demand and whether clients are being taken care of by enough caregivers.  Needs reporting and knowing that the system is doing it's job.

**What problem do they have today?**

- Verification is sequential when it could be parallel.  Impossible to answer the question of "what is this caregiver waiting on" without going through multiple systems and spreadsheets.
- Completeness is assessed typically from memory, without guidelines to make sure it's being done accurately.
- File is complete on hire day and expirations don't get noticed until someone decides to check or when a surveyor does.
- Only way to increase screening speed is by skipping steps.

**Why now / why us?**

Options for caregivers and admins alike are limited to hiring portals that are used for non-caregiver functionality such as Indeed or LinkedIn.  The systems do not give the ability for staffing coordinators to be able to easily find caregivers who have all the requirements verified.  Market is wide open due to lack of competitors.

**What does success look like?**

- 75% of applicants complete intake in one sitting on mobile.
- At any moment, 90% of caregiver files are complete and current.
- A complete compliance file can be produce in under 30 seconds, unassisted.

---

## 2. Scope

**In scope**

- Applicant intake (mobile-first)
- Document capture with expiration dates
- Requirement templates per role/state
- Background check ordering and status against vendor
- Federal exclusion screening (OIG, SAM)
- State registry verification
- Caregiver record with an explicit lifecycle state
- Append only audit log
- Role-based access

**Out of scope**

- Sourcing, job board syndication
- Interview scheduling and calendaring
- EVV, payroll, billing
- Training content and competency testing
- Cross-agency applicant sharing
- Acting as a reporting agency
- Automated hiring decisions, scoring, ranking
- Native mobile app

---

## 3. User Scenarios

**Scenario 1: Applicant completing intake from a mobile phone**

- Actor: Caregiver applicant

- Trigger: Taps an applicant link from a job board, text, or other locations as posted by agency.

- Steps:
1. Caregiver lands on intake.
2. Caregiver enters identity and contact basics.
3. Caregiver is informed what documents are needed and why.
4. Caregiver photographs credentials and uploads.
5. Caregiver grants screening consent with disclosures.
6. Caregiver returns back to a status page.

- Success outcome: A record exists in a completed intake pipeline.  Required items are present or pending.  Coordinator is notified and applicant can see their own status without calling agency or us.

- Failure outcome:  Caregiver abandons mid-flow.  Partial record retained.  Resumable link issued.  Coordinator sees incomplete intake.

**Scenario 2: Coordinator orders checks and tracks status**

- Actor: Staffing Coordinator

- Trigger: Caregiver fully completes intake for coordinator's agency, and the coordinator is notified.

- Steps:
1. Coordinator opens record and sees full list of required items for the role, derived from requirement template.
2. Each item shows it's current state.
3. Coordinator initiates outstanding external checks.
4. Record moves to screening in progress.  Items show what it is waiting on and when it was ordered.
5. Results arrive independently with notification when received.
6. When every required item is verified and current, the record becomes eligible for cleared.
7. Coordinator reviews and marks record as cleared.

- Success outcome: All required items return verified and current.  Record reaches cleared with every item having a source, method, verification date, and expiration date.  Coordinator doesn't follow up with external parties to check for status.

- Failure outcome: A check stalls or fails to submit.

**Scenario 3: A credential expires on an active caregiver**

- Actor: System, staffing coordinator, and caregiver

- Trigger: A stored required item on an active caregiver's record enters expiration warning window.

- Steps:
1. The system marks items as expiring.  The caregiver's record reflects this without anyone opening it.
2. The caregiver appears on a worklist for the coordinator with specific item and expiration date.
3. The coordinator is notified by active channels such as email.
4. Caregiver is prompted for replacement for the specific item and by when they need to produce it.
5. The caregiver submits the replacement.  It's captured, recorded, and verified by the same method as original.
6. Item returns to current.

- Success outcome: The replacement is verified before expiration date passes.  Record never leaves cleared, client work is not interrupted.  Audit shows record of chain of events.

- Failure outcome: Expiration date passes without a verified replacement.

---

## 4. Requirements (EARS notation)

Patterns:

-  **Ubiquitous:**
	- The system shall always maintain an append-only audit record of every event.
	- The system shall record, for each required item, its source, verification method, date, and expiration date.
	- The system shall present background check disclosure and authorization as documents separate from the application.
	- The system shall restrict access to caregiver records to users with an assigned role on that agency.
	- The system shall store identifiable numbers used for screening in tokenized form only.
	- The system shall make a caregiver's own status visible to the caregiver without coordinator intervention.

-  **Event-driven:**
	- When an applicant submits an intake with all required fields completed, the system shall create a caregiver record in Intake Complete and notify the coordinator.
	- When an applicant abandons intake before submission, the system shall retain a partial record and issue a resumable link valid for a period.
	- When a coordinator orders a background check, the system shall transmit the request to the screening vendor and set the check status to Ordered.
	- When a screening result is received, the system shall attach it to the caregiver record and update the status of the item.
	- When a document is uploaded, the system shall record its type, capture its expiration date, and place it in pending.
	- When all required items are verified and current, the system shall make the record eligible for cleared.
	- When an admin requests a compliance report, the system shall produce a single document containing every required item, along with evidence and verification history.

-  **State-driven:**
	- While a caregiver record has any incomplete or expired items, the system shall prevent transition to cleared.
	- While a required item is within its expiration warning window, the system shall display it as expiring and include it on the worklist.
	- While a background check is outstanding, the system shall display its elapsed time.
	- While a caregiver record is in review required, the system shall prevent any automated status advancement.
	- While an applicant's intake is incomplete, the system shall display the outstanding items and what each is waiting on.

-  **Unwanted behavior:**
	- If a screening result matches an exclusion list, the system shall place the record in review required.
	- If a vendor doesn't return a result within the configured threshold, the system shall set the check to delayed.
	- If a vendor request fails, the system shall retain the order in a retryable state.
	- If an uploaded document is unreadable, the system will route it to manual verification, instead of dropping it or advancing it.
	- If a coordinator attempts to advance a record with missing items, the system shall refuse the transition and give appropriate feedback.
	- If a document's expiration has already passed at upload, then the system shall reject it.
	- If an applicant declines screening consent, the system shall stop screening and notify the coordinator without discarding the record.

-  **Optional:**
	- When a state registry is available, the system shall query it automatically, and when it's not it will track a manual verification

---

## 5. Acceptance Criteria

| Requirement | Test | Pass Condition |
|--|--|--|
| Intake creates a record and notifies | Submit intake with all required fields from a mobile browser | Record exists in intake complete and the coordinator is notified |
| Incomplete record cannot be cleared | Remove one required item; attempt to mark Cleared | Transition refused.  Message names the specific missing item |
| Exclusion match locks the record | Submit an identity known to match exclusion list | Record enters review required. |
| Expiration produces a warning | Set an expiration date inside the warning window | Item shows on expiring worklist; caregiver is notified |

---

## 6. Constraints & Non-Functional Requirements

-  **Performance:**
	- Interaction time is acceptable on low-end Android phone over 3g
	- Max upload size and accepted formats
	- Behavior on an interrupted upload
	- Export generation time for single caregiver vs full roster

-  **Security/Privacy:**
	- Encryption at all times
	- PII minimization
	- RBAC across all roles
	- Retention and deletion rules by record type and outcome
	- Vendor review for security and privacy rules

-  **Accessibility:**
	- Mobile first, one handed
	- Screen reader support
	- Plain language
	- Tolerance for older devices

-  **Compliance/Legal:**
	- Disclosure, authorization from caregivers
	- Guidance on criminal history
	- OIG, SAM, Medicaid list screening
	- Retention minimums and maximums

-  **Budget/Timeline:**
	- Schedule pressure may cut scope but not correctness

---

## 7. Open Questions

*TBD*

---

## 8. Plan 
Once the spec above is approved, translate it into:

-  **`plan.md`** — the approach and key decisions, each traced back to a requirement ID above

-  **`tasks.md`** — atomic, ordered, checkable tasks derived from the plan

Do not skip from spec straight to a build without reviewing the plan first.

---

## 9. Approval

| Role  | Name | Date | Signed-off |
|--|--|--|--|
| CEO | Steve CEO |  |  |
| Legal | Legal Team | | |
| UX | UX Team | | |
| PM | Mike Broniek | | |

---

### Primary sources this template draws on

- [GitHub Spec Kit](https://github.com/github/spec-kit) — open-source spec/plan/tasks toolkit

- [Spec-Driven Development methodology](https://github.com/github/spec-kit/blob/main/spec-driven.md) — GitHub's explainer

- [EARS notation](https://alistairmavin.com/ears/) — requirements syntax

- [Microsoft: Spec-Driven Development for AI-Native Engineering](https://developer.microsoft.com/blog/spec-driven-development-ai-native-engineering/)
