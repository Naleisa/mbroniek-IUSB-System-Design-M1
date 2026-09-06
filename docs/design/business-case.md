# Business Case — Home Healthcare Caregiver Hiring Portal

## 1. Problem / Opportunity
Homecare agencies currently send workers, typically unsupervised, into homes of elderly and disabled clients, having used verification through email, spreadsheets, and paper files.  Credential gaps and disqualifying records only surface later or not at all.  Caregivers are easily lost to other agencies as manual checks are ran, incentivizing cutting corners in deserved safety of the clients.

## 2. Proposed Solution
A hiring portal built for home care with safety, verification, and credential checking in mind.  An agency can never advance a caregiver through a step in the hiring processes without them meeting the requirements they have set.  This will reduce hiring time and increase client safety, as the caregiver can produce credentials, which the system will verify, as needed.

## 3. Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| Do Nothing | Agencies continue to use job boards, such as Indeed and use paper and spreadsheets for tracking and verification. | Zero cost.  No changes in management or processes. | The problems compound as agencies grow and safety and security risks grow. |
| Build a verification-first portal | Built for home care hiring and credential verification. | Full control over hiring and verification.  Matches the proposed solution. | High development cost and long schedule. |
| Provide a hiring service | Sell verification as a service, manually with intent to turn repeat items into products | Validates demands before heavy build and brings in revenue to help build. | Doesn't scale and risks becoming a staffing company instead of software if product is not built |

## 4. Feasibility
*I treated this as open questions that need to be answered*

| Type | Assessment |
|------|------------|
| Operational — will people actually use/support this? | <ul><li>Do agencies believe this is a process that needs to change?</li><li>Will it cause workforce reduction?</li><li>Does it cause any legal or ethical issues such as systematic discrimination?</li><li>Will applicants be able to easily complete?</li><li>Will applicants trust an unfamiliar company with sensitive credentials such as SSN, license, etc?</li></ul> |
| Technical — can we build it with what we have/can get? | <ul><li>Will we be able to acquire the required integrations?  Do they exist?</li><li>Will we be able to have the proper security to store sensitive information?</li></ul> |
| Economic — does the payoff justify the cost? | <ul><li>Can we build and run this profitabily?</li><li>Is it worth what we'd charge?</li><li>What is the cost of simply not building this product?</li></ul> |
| Schedule — can it be done in a useful timeframe? | <ul><li>Is there a firm timetable for this to get to market?</li><li>Will an accelerated schedule pose risks?  Are they acceptable?</li></ul> |

## 5. Costs & Benefits

**Costs** (one-time + ongoing):

| Item | One-time | Ongoing/year |
|------|----------|----------------|
| Tangible | | Developer salaries, cloud hosting, verification vendor fees, audits |
| Intangible | | Opportunity cost, brand damage from verification failure, user frustration |
| Direct | | Engineering time, vendor fees |
| Indirect | | Insurance, accounting, office/admin, shared infrastructure |
| Fixed | | Salaries, base cloud spend, audits |
| Variable | | Potential verification fees, communication fees (SMS or email) |
| Developmental | Initial build, initial training/docs, legal review, security review | |
| Operational | | Maintenance, support, hosting, license fees, re-verification |

**Benefits** (tangible + intangible):

| Type | Benefit |
|---------|-------|
| Positive | More caregivers starting per dollar of recruiting spend |
| Positive | Client and family confidence |
| Cost-avoidance | Recruiter/administrator house not doing manual verification and data entry |
| Cost-avoidance | Not needing to hire more staff to do recruitment |
| Cost-avoidance | Avoided penalties of incorrect file during audit |
| Intangible | Improved staff job satisfaction |
| Intangible | Better information for management decisions |
| Intangible | Enhanced agency image |

**Payback period:**

| Method | Pricing | Notes |
|-------|-------|-----------|
| No charge | Free tier | Customer-acquisition cost |
| Fixed charge | Subscription per agency | Profit center.  Easy to sell, but decouples revenue from usage |
| Variable by resource usage | Per-verification cost | Matches variable costs, but penalizes agency for screening more, potentially lowering revenue |
| Variable by volume | Per hire | Aligns revenue with agency's value.  Pays when product works |

**ROI:** [(benefit − cost) / cost]

Needs to meet or exceed the minimum ROI hurdle.  Product makes money when agency is able to hire quicker and safer.

## 6. Priority & Urgency
- Screening is nondiscretionary.  Licensure, contracts, and exclusion-list checking aren't optional.  The agency has no choice on whether they do it, only on how they do it.  Product competes against doing it manually instead of not doing it at all.
- Product is discretionary.  Agencies can keep doing it by hand.  Goal is to absorb nondiscrentionary work.
- Caregiver demand is driven by demographics that already exist.  Hiring pressure is structural, not cyclical.
- Risk of competitor getting to market first and establishing category and integration relationships.

## 7. Recommendation
Proceed with option B (Verification-first portal).  Build with two partner agencies, and hold the full build behind a go/no-go review at the end of the pilot.

## 8. Approval

| Role | Name | Date | Decision |
|------|------|------|----------|
| CEO | Steve CEO | Beginning of product build and after pilot | Go / No-go based on recommendation |
| Partner Agencies | Agency A & B | End of pilot phase | Go / No-go based on feedback and viability of implementing feedback |

---

### Primary sources
- *Systems Analysis and Design*, 10th ed. (Cengage, 2017) — Ch. 2 "Analyzing the Business Case" and Toolkit Part C "Financial Analysis Tools"
- Personal knowledge of homecare industry