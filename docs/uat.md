# User Acceptance Testing — CareMatch Demo

This guide checks the whole demo against the specification: Scenarios 1–3, every requirement R1–R26, the four Spec Section 5 acceptance criteria, both agencies, every test SSN ending, "Reset demo data", and the demo date (T63). Run it on the **deployed build** and record each result in the log at the end.

## Before you start

- **App:** <https://naleisa.github.io/mbroniek-IUSB-System-Design-M1/#/>
- **Phone view:** in Chrome, open DevTools (F12), turn on device mode (Ctrl+Shift+M), and choose **iPhone 12 Pro**. Run everything in the same browser window.
- **Start clean:** click **Reset demo data** in the navbar, then **Yes, reset**. Do this again wherever a case says **Reset first**.
- **Demo date:** it should show today. Click **Back to today** whenever a case finishes with a moved date.
- **A photo:** have any JPG on your computer. You'll use it for every upload.
- **Sign-in links only work in the browser that asked for them.** All demo data lives in this browser, so open every link from the **demo outbox** in the same window.

**Accounts**

| Role | Sign in with |
|---|---|
| Coordinator, Agency A (Hoosier Home Care) | dana.whitfield@hoosierhomecare.example / demo1234 |
| Coordinator, Agency B (Riverbend Caregivers) | marcus.lee@riverbendcaregivers.example / demo1234 |
| Applicants | firstname.lastname@example.com, by email link from **Applicant sign-in** → **Open demo outbox** |

**Test SSNs** (900-series numbers are never issued to real people; the last four digits decide what the mock checks return)

| Ending | Outcome |
|---|---|
| 0001 | Clear |
| 0002 | Exclusion match: the record goes to Review Required |
| 0003 | Never returns: the check shows as Delayed after 3 business days |
| 0004 | Vendor failure: the check can be ordered again |

**New applicants used in this guide**

| Name | Email | Mobile phone | Date of birth | SSN |
|---|---|---|---|---|
| Nina Lopez | nina.lopez@example.com | 5745550142 | 04/12/1990 | 900300001 |
| Priya Shah | priya.shah@example.com | 5745550177 | 09/03/1988 | 900320002 |

Document expiration dates: use **06/30/2030** unless a case says otherwise.

---

## A. Applicant — Scenario 1

### UAT-01 Agency link and first visit
**Role:** applicant (signed out) · **Start:** Reset first, then open the app in a **private/incognito window** (a first visit).
1. Open `#/apply/hoosier-home-care`.
   **Expect:** "Loading…" briefly, then **"Apply to Hoosier Home Care"** with **Start my application**.
2. Open `#/apply/not-a-real-agency`.
   **Expect:** "We can't find that application link", with no agency named or listed.
3. Close the private window.

**Result:** ☐ Pass ☐ Fail

### UAT-02 About you, and the SSN kept tokenized
**Role:** applicant · **Start:** home page, signed out.
1. Tap **Try applying**, then **Start my application**.
   **Expect:** "About you".
2. Tap **Save and continue** with everything blank.
   **Expect:** a message under every field.
3. Tap **Test SSNs** under the SSN field.
   **Expect:** the four endings and what each does.
4. Fill in Nina Lopez from the table and tap **Save and continue**.
   **Expect:** the phone shows as (574) 555-0142 and the SSN as 900-30-0001 while typing; then "What you'll need".
5. DevTools → Application → Local Storage → `carematch:caregivers`: find Nina's row.
   **Expect:** `ssn_token` and `ssn_last4: 0001`, and **no full SSN** anywhere in the row.

**Result:** ☐ Pass ☐ Fail

### UAT-03 What you'll need
**Role:** applicant (Nina) · **Start:** after UAT-02.
1. Read "What you'll need".
   **Expect:** "You'll upload" lists Government photo ID, Home Health Aide certification, TB test result, CPR and First Aid certification, Driver's license; "We'll check for you" lists the criminal background, OIG, and SAM checks; each has a plain-language reason.

**Result:** ☐ Pass ☐ Fail

### UAT-04 Uploads, with rejections
**Role:** applicant (Nina) · **Start:** after UAT-03. In PowerShell, make a 12 MB test file: `fsutil file createnew big-photo.jpg 12582912`.
1. Tap **Continue**.
   **Expect:** "Add your documents" with five cards.
2. On Government photo ID, choose **big-photo.jpg**.
   **Expect:** "This file is 12.0 MB. Choose one that's 10 MB or smaller."
3. Choose your real JPG, type a past date such as **01/01/2020**.
   **Expect:** "This document expired on 2020-01-01. Please upload a current one." and nothing saves.
4. Enter **06/30/2030** and tap **Save document**.
   **Expect:** **Pending** with the file name, JPG, and the date.
5. Do the same for the other four cards.

**Result:** ☐ Pass ☐ Fail

### UAT-05 Separate consent screens, then submit
**Role:** applicant (Nina) · **Start:** after UAT-04.
1. Tap **Continue**.
   **Expect:** a page on its own, "Background check disclosure", naming Hoosier Home Care, with a sample-wording note. Tap **I've read this**.
2. **Expect:** a second page, "Authorization for background checks". Tap **I authorize these checks**.
3. **Expect:** "Review and submit" with every line checked. Tap **Submit my application**.
   **Expect:** "Your application was submitted on [today]. Hoosier Home Care has been notified."
4. Tap **Go to your application**.
   **Expect:** "Submitted. Waiting for Hoosier Home Care to start your checks." and each item's "waiting on" line.
5. Sign out (navbar). Sign in as **Dana**.
   **Expect:** Nina Lopez on the dashboard under **Intake Complete**.
6. Tap **Agency outbox**.
   **Expect:** an Email **"New application: Nina Lopez"**.

**Result:** ☐ Pass ☐ Fail

### UAT-06 Declining consent
**Role:** applicant (Maria Gonzalez) · **Start:** signed out.
1. **Applicant sign-in** → `maria.gonzalez@example.com` → **Open demo outbox** → **Open sign-in link**.
   **Expect:** Maria's next unfinished step opens.
2. Go to `#/applicant/intake/disclosure`, tap **I've read this**; on the authorization page tap **I don't authorize**, then **Yes, I don't authorize**.
   **Expect:** "You didn't authorize the background checks on [today]. Your application is saved, and Hoosier Home Care has been told."
3. Sign out. Sign in as Dana → **Agency outbox**.
   **Expect:** "Maria Gonzalez declined background check authorization".
4. Open Maria's record; tap **Order check** on the Criminal background check.
   **Expect:** "Checks can't be ordered: Maria Gonzalez declined authorization." Maria's record still exists, unchanged.

**Result:** ☐ Pass ☐ Fail

### UAT-07 Resume by link, and link expiry
**Role:** applicant (new) · **Start:** Reset first.
1. **Try applying** → **Start my application**, fill in Nina Lopez, **Save and continue**, **Continue**, upload only the **Government photo ID**, then leave.
2. Open `#/outbox?to=nina.lopez@example.com`.
   **Expect:** "Continue your CareMatch application", working for 7 days.
3. Tap **Open sign-in link**.
   **Expect:** "Add your documents", with the photo ID Pending.
4. Set the navbar **Demo date** to 8 days from today. Open the outbox link again.
   **Expect:** "This sign-in link has expired. Please request a new one." **Request a new sign-in link** opens sign-in with Nina's email filled in.
5. Click **Back to today**.

**Result:** ☐ Pass ☐ Fail

### UAT-08 Status page, seen without a coordinator
**Role:** applicants · **Start:** Reset first. Sign in each applicant by email link.
1. **aisha.patel@example.com**
   **Expect:** "Your checks are in progress." and the background check **Delayed**: "Taking longer than usual. Started 8 days ago."
2. **tom.nguyen@example.com**
   **Expect:** background check "Waiting on Hoosier Home Care to try again"; HHA certification "…to check it by hand".
3. **olivia.martin@example.com**
   **Expect:** "Hoosier Home Care is reviewing your checks. They'll contact you." The words "exclusion" and "match" don't appear.
4. **robert.king@example.com**
   **Expect:** "You're cleared to work with Hoosier Home Care." and a **Replacement needed** card with the item and due date.

**Result:** ☐ Pass ☐ Fail

---

## B. Coordinator — Scenario 2

### UAT-09 Dashboard and agency separation
**Role:** coordinators · **Start:** Reset first.
1. Sign in as **Dana**.
   **Expect:** 10 caregivers grouped by state; **Needs attention**: Incomplete intake 2, Declined consent 1, Delayed check 1; next steps on each card (for example Olivia: "Review the possible exclusion match").
2. Sign out; sign in as **Marcus**.
   **Expect:** only Hannah Schultz, David Reyes, Chloe Adams.
3. Open `#/caregivers/cg-01` (an Agency A record).
   **Expect:** "We couldn't find that caregiver."

**Result:** ☐ Pass ☐ Fail

### UAT-10 Order checks: Clear and the registry (0001)
**Role:** Dana · **Start:** Nina submitted (UAT-02 to UAT-05; if you reset since, repeat them).
1. Open **Nina Lopez** (Intake Complete). On **Criminal background check**, tap **Order check**.
   **Expect:** **Ordered**, "Ordered today", and the record moves to **Screening In Progress**.
2. Wait about 10 seconds.
   **Expect:** **Verified**, with a verified date, an expiration date, and "Mock vendor result BG-…" as evidence.
3. Order the **OIG**, **SAM**, and **Home Health Aide certification** (registry) checks.
   **Expect:** each returns Verified; the registry result says **Active** and keeps the certificate's date.
4. **Agency outbox**.
   **Expect:** a result email for each check.

**Result:** ☐ Pass ☐ Fail

### UAT-11 Document review and eligibility
**Role:** Dana · **Start:** after UAT-10.
1. On Nina's Government photo ID, tap **View document**.
   **Expect:** your photo appears.
2. Tap **Mark verified** on the photo ID, TB test, CPR and First Aid, and driver's license.
   **Expect:** each becomes Verified with Method "Document review" and dates; after the last one, the record becomes **Eligible**.

**Result:** ☐ Pass ☐ Fail

### UAT-12 Mark Cleared and the compliance report
**Role:** Dana · **Start:** after UAT-11.
1. In **Clearing**, tap **Mark Cleared** → **Yes, mark Cleared**.
   **Expect:** Nina is **Cleared**, "Cleared on [today]".
2. Tap **Compliance report**.
   **Expect:** "All 8 required items are verified and current"; every item with source, method, dates, result, and evidence; check history; record history with your actions under Dana Whitfield.
3. Tap **Print or save as PDF**.
   **Expect:** the preview shows only the report (no navbar, demo date, or buttons).

**Result:** ☐ Pass ☐ Fail

### UAT-13 Vendor failure and retry (0004)
**Role:** Dana · **Start:** any time after a Reset.
1. Open **Tom Nguyen**. His background check is **Retryable** ("Vendor failure").
2. Tap **Retry**.
   **Expect:** **Ordered**; about 10 seconds later it is **Retryable** again (0004 always fails), and the Agency outbox has the failure email.

**Result:** ☐ Pass ☐ Fail

### UAT-14 A check that never returns (0003)
**Role:** Dana · **Start:** after a Reset.
1. Open **Aisha Patel**.
   **Expect:** background check **Delayed**, "Ordered 8 days ago"; on the dashboard her card shows **Delayed check**.
2. Tap **Order again**.
   **Expect:** **Ordered** again, with a note that the earlier order stays on file.

**Result:** ☐ Pass ☐ Fail

### UAT-15 Registry unavailable, unreadable document, and verify by hand
**Role:** Dana · **Start:** after a Reset.
1. Open **Tom Nguyen**. His HHA certification is **Manual Verification**: "State registry unavailable. Verify the certificate by hand."
2. Tap **Verify by hand**, enter "Called the Indiana aide registry; certificate is active.", keep a future date, **Save as verified**.
   **Expect:** Verified with Method **Manual verification**, your note as evidence, and the date.
3. Open **James Carter**. On **CPR and First Aid certification**, tap **Mark unreadable** → **Yes, mark unreadable**.
   **Expect:** **Manual Verification** with "The document couldn't be read. Verify it by hand."

**Result:** ☐ Pass ☐ Fail

### UAT-16 Incomplete record can't be cleared
**Role:** Dana · **Start:** after a Reset.
1. Open **Aisha Patel**; tap **Mark Cleared** → **Yes, mark Cleared**.
   **Expect:** refused: "This record can't be cleared yet. Still needed: Criminal background check (not verified yet)."
2. Open **Linda Brooks** (Eligible). In the DevTools **Console**, paste and press Enter:
   ```js
   const k = 'carematch:required_items'; localStorage.setItem(k, JSON.stringify(JSON.parse(localStorage.getItem(k)).filter((row) => row.id !== 'ri-cg-05-tb_test')));
   ```
   Reload the page.
   **Expect:** Linda's **TB test result** shows **Missing**.
3. Tap **Mark Cleared** → **Yes, mark Cleared**.
   **Expect:** refused: "This record can't be cleared yet. Still needed: TB test result (missing)." Linda stays Eligible.
4. **Reset demo data** to put the item back.

**Result:** ☐ Pass ☐ Fail

### UAT-17 Exclusion match (0002) and Review Required
**Role:** applicant, then Dana · **Start:** Reset first.
1. Apply as **Priya Shah** (SSN 900320002): About you, upload all five documents, read the disclosure, authorize, **Submit**.
2. Sign in as Dana; open **Priya Shah**; **Order check** on the **OIG exclusion check**; wait about 10 seconds.
   **Expect:** the record moves to **Review Required**; the OIG check is **Manual Verification** with "Possible match".
3. **Expect:** a **Review the exclusion match** card with the match details and Priya's date of birth, two equal buttons, and **no Mark Cleared**. Order another check (for example the background check) and wait for it to come back.
   **Expect:** the record **stays in Review Required** (nothing advances it automatically).
4. Tap **It's not a match**, enter a note, keep the date, **Save decision**.
   **Expect:** Priya returns to **Screening In Progress**, and her OIG check shows **Verified** with Method **Manual verification**.

**Result:** ☐ Pass ☐ Fail

---

## C. Credential expiry — Scenario 3

### UAT-18 Expiring worklist and caregiver notified
**Role:** Dana · **Start:** Reset first.
1. Set the navbar **Demo date** to **150 days** from today (the page reloads).
2. Sign in as Dana → **Expiration worklist**.
   **Expect:** several items under **Expiring**, each with caregiver, item, and date (for example Robert King's criminal background check).
3. Open `#/outbox?to=robert.king@example.com`.
   **Expect:** an email "Your Criminal background check expires soon".
4. Click **Back to today**.

**Result:** ☐ Pass ☐ Fail

### UAT-19 Replacement requested, uploaded, and verified (record stays Cleared)
**Role:** Robert, then Dana · **Start:** Reset first.
1. Dana → **Expiration worklist**.
   **Expect:** Robert King, CPR and First Aid certification, **Expiring**, "Replacement requested, due …".
2. Sign out. Sign in as **Robert** by email link → **Upload replacement** → your JPG, a date 2 years out → **Upload replacement**.
   **Expect:** "Replacement uploaded on … Waiting on Hoosier Home Care to review it." and he is still cleared.
3. Sign in as Dana → open **Robert King** → on the CPR card, **View replacement**, then **Verify replacement**.
   **Expect:** Verified, Method **Document review** unchanged, the new expiration date; Robert stays **Cleared**.

**Result:** ☐ Pass ☐ Fail

### UAT-20 Not Current, and back to Cleared
**Role:** Dana, then Samuel · **Start:** Reset first.
1. Set the **Demo date** 25 days from today. Sign in as Dana.
   **Expect:** Robert King is now **Not Current**; the Agency outbox has "Robert King is Not Current".
2. Click **Back to today**.
   **Expect:** Robert stays **Not Current** (only a coordinator restores Cleared).
3. **Reset demo data**. As Dana, open **Expiration worklist** → **Request replacement** on Samuel Okafor's TB test.
   **Expect:** "Replacement requested, due [14 days out]"; the Agency outbox shows an **Email** and an **SMS** to Samuel.
4. Sign in as **Samuel** by email link → **Upload replacement** → JPG, a future date.
5. Sign in as Dana → open **Samuel Okafor** → **Verify replacement**.
   **Expect:** the TB test is Verified, but Samuel is **still Not Current**.
6. **Mark Cleared** → **Yes, mark Cleared**.
   **Expect:** Samuel is **Cleared**.

**Result:** ☐ Pass ☐ Fail

---

## D. Across the app

### UAT-21 Audit record
**Role:** Dana · **Start:** after any case that changed a record (for example UAT-12).
1. Open that caregiver's **Compliance report**.
   **Expect:** the record history lists each change with when, who (name and role), and what changed.
2. Look through the record view, report, and dashboard.
   **Expect:** no way to edit or delete history anywhere.

**Result:** ☐ Pass ☐ Fail

### UAT-22 Agency outbox
**Role:** Dana · **Start:** after UAT-20 step 3.
1. **Agency outbox** → tap **SMS**, then **Email**, then **All**.
   **Expect:** each message marked Email or SMS; sign-in links show as "[sign-in link hidden]".
2. Sign in as Marcus → `#/messages`.
   **Expect:** none of Agency A's messages.

**Result:** ☐ Pass ☐ Fail

### UAT-23 Reset demo data
**Role:** anyone · **Start:** after several cases have changed data.
1. Click **Reset demo data** → **Yes, reset**.
   **Expect:** the home page says "Demo data is back to its starting point."; you're signed out; the Demo date is today; Dana's dashboard is back to 10 caregivers with Robert Cleared, Samuel Not Current, and Olivia in Review Required.

**Result:** ☐ Pass ☐ Fail

---

## Coverage

| Requirement | Cases |
|---|---|
| R1 Append-only audit record | UAT-12, UAT-21 |
| R2 Source, method, date, expiration per item | UAT-10, UAT-11, UAT-12 |
| R3 Separate disclosure and authorization | UAT-05 |
| R4 Access by agency | UAT-09, UAT-22 |
| R5 Tokenized SSN | UAT-02 |
| R6 Caregiver sees own status | UAT-05, UAT-08 |
| R7 Submit creates Intake Complete and notifies | UAT-05 |
| R8 Partial record kept; resumable link | UAT-07 |
| R9 Order sets Ordered | UAT-10 |
| R10 Result attached and item updated | UAT-10 |
| R11 Upload records type, expiration, Pending | UAT-04 |
| R12 All verified → eligible | UAT-11 |
| R13 Compliance report | UAT-12 |
| R14 No Cleared with incomplete or expired items | UAT-16, UAT-20 |
| R15 Expiring shown and on the worklist | UAT-18, UAT-19 |
| R16 Elapsed time for outstanding checks | UAT-08, UAT-14 |
| R17 No automated advancement from Review Required | UAT-17 |
| R18 Outstanding items and what each waits on | UAT-03, UAT-05, UAT-08 |
| R19 Exclusion match → Review Required | UAT-17 |
| R20 Delayed after the threshold | UAT-08, UAT-14 |
| R21 Failed request stays retryable | UAT-13 |
| R22 Unreadable → Manual Verification | UAT-15 |
| R23 Refuse advancing with missing items | UAT-16 |
| R24 Reject already-expired documents | UAT-04 |
| R25 Declined consent stops screening, notifies, keeps record | UAT-06 |
| R26 Registry automatic, or manual verification | UAT-10, UAT-15 |

| Spec Section 5 criterion | Case |
|---|---|
| 1. Intake creates a record and notifies | UAT-05 |
| 2. Incomplete record cannot be cleared | UAT-16 |
| 3. Exclusion match locks the record | UAT-17 |
| 4. Expiration produces a warning | UAT-18 |

| Also covered | Cases |
|---|---|
| Test SSN 0001 / 0002 / 0003 / 0004 | UAT-10 / UAT-17 / UAT-14 / UAT-13 |
| Agency A / Agency B | UAT-09 to UAT-20 / UAT-09, UAT-22 |
| Reset demo data | UAT-23 (and throughout) |
| Demo date | UAT-07, UAT-18, UAT-20 |
| Scenario 1 / 2 / 3 | Section A / Section B / Section C |

## Results log

| Date | Tester | Build (commit) | Passed | Failed | Notes |
|---|---|---|---|---|---|
| | | | | | |
