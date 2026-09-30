# Acceptance Checks — Spec Section 5

Phone-size manual checks for the four acceptance criteria in the specification (Section 5), run on the **deployed build** (ADR-17). Results are logged in [manual-checks.md](manual-checks.md).

- Criteria 1 and 2: T52
- Criteria 3 and 4: T53 (to be added)

## Before you start

1. **Use the deployed build:** <https://naleisa.github.io/mbroniek-IUSB-System-Design-M1/#/>. Make sure the latest push to `main` has a green "Deploy to GitHub Pages" run.
2. **Phone size:** in Chrome, open DevTools (F12), turn on device mode (Ctrl+Shift+M), and pick **iPhone 12 Pro**.
3. **Start clean:** click **Reset demo data** in the navbar, then **Yes, reset**. Check that the **Demo date** shows today (click **Back to today** if a demo date is set).
4. **Have a photo ready:** any JPG on your computer. You'll use it for each of the five documents.

Demo accounts: coordinator **dana.whitfield@hoosierhomecare.example**, password **demo1234**.

---

## Criterion 1 — Intake creates a record and notifies

| Test | Pass condition |
|---|---|
| Submit intake with all required fields from a mobile browser | Record exists in Intake Complete and the coordinator is notified |

**Applicant data to use**

| Field | Value |
|---|---|
| First name | Nina |
| Last name | Lopez |
| Email | nina.lopez@example.com |
| Mobile phone | 5745550142 (shows as (574) 555-0142) |
| Date of birth | 04/12/1990 |
| Social Security number | 900300001 (shows as 900-30-0001) |
| Document expiration dates | 06/30/2030 |

**Steps**

1. On the home page, tap **Try applying**.
   *Expect:* "Apply to Hoosier Home Care".
2. Tap **Start my application**.
   *Expect:* "About you".
3. Fill in every field from the table and tap **Save and continue**.
   *Expect:* "What you'll need", listing five items to upload and three checks.
4. Tap **Continue**.
   *Expect:* "Add your documents" with five cards.
5. For each of the five cards, choose the JPG, enter **06/30/2030**, and tap **Save document**.
   *Expect:* each card shows **Pending** with the file name, "JPG", and the date.
6. Tap **Continue**.
   *Expect:* "Background check disclosure". Tap **I've read this**.
7. *Expect:* "Authorization for background checks". Tap **I authorize these checks**.
8. *Expect:* "Review and submit", with every line checked. Tap **Submit my application**.
   *Expect:* "Your application was submitted on [today]. Hoosier Home Care has been notified."
9. In the navbar, tap **Sign out**. On the home page, tap **Coordinator sign-in** and sign in as Dana.
10. **Record check:** on the dashboard, find **Nina Lopez** under **Intake Complete**.
11. **Notification check:** tap **Agency outbox**.
    *Expect:* an **Email** to Dana Whitfield titled **"New application: Nina Lopez"** saying she "submitted a complete application to Hoosier Home Care. It's ready for screening."

**Result:** Pass / Fail — date, and notes if it failed.

---

## Criterion 2 — Incomplete record cannot be cleared

| Test | Pass condition |
|---|---|
| Remove one required item; attempt to mark Cleared | Transition refused. Message names the specific missing item |

The app has no screen for deleting a required item (items come from the requirement template), so this check removes one directly from browser storage with a single console command.

**Steps**

1. **Reset demo data** (navbar), then sign in as Dana.
2. Open **Linda Brooks** (under **Eligible**) with **View record**.
   *Expect:* every required item is Verified, and the **Clearing** card shows **Mark Cleared**.
3. **Remove one required item.** Open the DevTools **Console** tab, paste this line, and press Enter:

   ```js
   const k = 'carematch:required_items'; localStorage.setItem(k, JSON.stringify(JSON.parse(localStorage.getItem(k)).filter((row) => row.id !== 'ri-cg-05-tb_test')));
   ```

   This deletes Linda's **TB test result** item.
4. Reload the page.
   *Expect:* Linda's **TB test result** card now shows **Missing**.
5. In the **Clearing** card, tap **Mark Cleared**, then **Yes, mark Cleared**.
   *Expect:* the move is refused with **"This record can't be cleared yet. Still needed: TB test result (missing)."**, and Linda stays **Eligible**.
6. **Everyday version (no console):** go back to the dashboard and open **Aisha Patel** (under **Screening In Progress**). Tap **Mark Cleared**, then **Yes, mark Cleared**.
   *Expect:* refused with **"This record can't be cleared yet. Still needed: Criminal background check (not verified yet)."**
7. Tap **Reset demo data** when you're done, to put Linda's item back.

**Result:** Pass / Fail — date, and notes if it failed.
