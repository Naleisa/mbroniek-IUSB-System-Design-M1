# CareMatch Demo Seed Data

These CSV files are loaded into the browser the first time the demo starts, and again whenever someone clicks "Reset demo data" (ADR-21). All data is fake.

## Relative dates

Dates are written relative to the day the demo runs, so every scenario works on any day:

- `today+20` means 20 days from today, and `today-5` means 5 days ago.
- A time can follow the date: `today-3 10:05`.
- The demo-date control changes what "today" means (ADR-13).

## Test SSNs

Every SSN is in the 900 series, which is never issued to real people. The last four digits pick the mock vendor outcome (ADR-12):

| Ending | Outcome |
|--------|---------|
| 0001 | Clear |
| 0002 | Exclusion match |
| 0003 | Never returns (Delayed) |
| 0004 | Vendor failure (Retryable) |

The loader moves each SSN into the vault store and keeps only a token and the last four digits on the caregiver record (ADR-11).

## Files

| File | Contents |
|------|----------|
| `agencies.csv` | The two demo agencies and their intake link slugs |
| `users.csv` | One coordinator per agency (password `demo1234`) and an applicant login for each caregiver (magic link only) |
| `settings.csv` | Warning window, delayed-check threshold, resume window, mock vendor delay, and whether the mock state registry is available |
| `requirement_templates.csv` | The Indiana Home Health Aide template, marked as a sample |
| `template_items.csv` | The template's required items, with the plain-language reason shown to applicants |
| `caregivers.csv` | 13 caregivers, with at least one in each lifecycle state |
| `required_items.csv` | Each caregiver's items with status, source, method, dates, and evidence; ids look like `ri-cg-01-photo_id` |
| `documents.csv` | One row per seeded upload (file name, type, expiration). Seeded documents have no image file |
| `check_orders.csv` | One row per vendor or registry check that was ordered, with its result; open orders have no `completed_at` |
| `consents.csv` | Disclosure and authorization decisions, including one declined authorization |
| `replacement_requests.csv` | Open replacement requests for expiring items |
| `audit_events.csv` | History for caregivers past screening, used by the compliance report |

## Demo caregivers

| ID | Name | Agency | State | Shows |
|----|------|--------|-------|-------|
| cg-01 | Maria Gonzalez | Hoosier | Intake In Progress | Partly finished intake |
| cg-02 | James Carter | Hoosier | Intake Complete | Ready for the coordinator to order checks |
| cg-03 | Aisha Patel | Hoosier | Screening In Progress | Delayed background check (0003) |
| cg-04 | Tom Nguyen | Hoosier | Screening In Progress | Vendor failure to retry (0004); registry down, manual verification |
| cg-05 | Linda Brooks | Hoosier | Eligible | Waiting for a coordinator to mark Cleared |
| cg-06 | Robert King | Hoosier | Cleared | CPR and First Aid expiring; replacement requested (Scenario 3) |
| cg-07 | Grace Kim | Hoosier | Cleared | Fully current; clean compliance report |
| cg-08 | Samuel Okafor | Hoosier | Not Current | TB test expired without a replacement |
| cg-09 | Olivia Martin | Hoosier | Review Required | OIG exclusion match (0002) |
| cg-10 | Ethan Walker | Hoosier | Intake In Progress | Declined authorization; screening stopped |
| cg-11 | Hannah Schultz | Riverbend | Screening In Progress | Checks just ordered |
| cg-12 | David Reyes | Riverbend | Cleared | Second agency's cleared caregiver |
| cg-13 | Chloe Adams | Riverbend | Intake Complete | Second agency's new intake |
