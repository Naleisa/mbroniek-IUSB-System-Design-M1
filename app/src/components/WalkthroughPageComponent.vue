<script setup lang="ts">
// Self-guided walkthrough (T65): a short overview of how CareMatch works, opened in a second tab beside
// the app. Each "Open" link targets the app's tab (named "carematch-app" by the home page button), so the
// app changes screens without reloading and this page stays put. It is an overview, not a test script;
// the full checks are in the UAT guide (T63).
const APP_WINDOW = 'carematch-app';
const appUrl = (route: string) => `${import.meta.env.BASE_URL}#${route}`;

interface Step {
  title: string;
  why: string;
  do: string[];
  open?: { route: string; label: string };
}

const steps: Step[] = [
  {
    title: 'Start fresh',
    why: 'The demo keeps its data in your browser. Resetting puts every fictional caregiver back where the story begins.',
    do: ['In the app tab, click Reset demo data in the navbar, then Yes, reset.'],
    open: { route: '/', label: 'Open the home page' },
  },
  {
    title: 'Apply as a caregiver',
    why: 'Applicants start from their agency’s link and apply on their phone, one short step at a time.',
    do: [
      'Tap Start my application.',
      'About you: Nina Lopez, nina.lopez@example.com, 5745550142, 04/12/1990, SSN 900300001 (a test number that comes back Clear).',
      'What you’ll need lists each item and why. Tap Continue.',
      'Add your documents: use the same photo for all five, each expiring 06/30/2030.',
      'Read the disclosure, give your authorization, then Submit my application.',
    ],
    open: { route: '/apply/hoosier-home-care', label: 'Open the application' },
  },
  {
    title: 'See your own status',
    why: 'Applicants can check where things stand without calling the agency. Each item says what it’s waiting on.',
    do: ['Tap Go to your application after submitting, then Sign out in the navbar.'],
    open: { route: '/applicant', label: 'Open the status page' },
  },
  {
    title: 'Sign in as the agency',
    why: 'Coordinators see only their own agency. New applications arrive in Intake Complete, and the dashboard points out what needs attention.',
    do: ['Sign in as dana.whitfield@hoosierhomecare.example with password demo1234.', 'Find Nina Lopez under Intake Complete.'],
    open: { route: '/sign-in', label: 'Open coordinator sign-in' },
  },
  {
    title: 'Order the checks',
    why: 'Background, exclusion list, and registry checks are ordered from the record. Results come back on their own, about 10 seconds later in the demo.',
    do: [
      'Open Nina’s record with View record.',
      'Tap Order check on the criminal background, OIG, SAM, and Home Health Aide certification items, then wait a few seconds.',
    ],
    open: { route: '/dashboard', label: 'Open the dashboard' },
  },
  {
    title: 'Verify documents and clear',
    why: 'A caregiver can only be cleared once every required item is verified and current, and only a person can clear them.',
    do: [
      'Tap Mark verified on the photo ID, TB test, CPR and First Aid, and driver’s license. Nina becomes Eligible.',
      'Tap Mark Cleared, then Yes, mark Cleared.',
    ],
  },
  {
    title: 'Print the proof',
    why: 'One report shows every item with its evidence and history, ready to save as a PDF for a surveyor.',
    do: ['On Nina’s record, tap Compliance report, then Print or save as PDF.'],
  },
  {
    title: 'Keep credentials current',
    why: 'Credentials expire. The worklist shows what’s coming due so the agency can ask for a replacement before it lapses.',
    do: ['Look at Robert King’s CPR and First Aid certification, expiring soon with a replacement already requested.'],
    open: { route: '/worklist', label: 'Open the expiration worklist' },
  },
  {
    title: 'See what was sent',
    why: 'Nothing is really emailed or texted in the demo. Every message the system would send appears in the outbox instead.',
    do: ['Filter by Email or SMS.'],
    open: { route: '/messages', label: 'Open the agency outbox' },
  },
  {
    title: 'Try the demo controls',
    why: 'The Demo date lets you jump ahead to see credentials expire and checks go overdue; Reset demo data starts everything over.',
    do: [
      'Set the Demo date in the navbar a few months ahead and look at the worklist again, then click Back to today.',
      'Click Reset demo data whenever you want to start again.',
    ],
  },
];
</script>

<template>
  <div class="container py-4">
    <div class="row justify-content-center">
      <div class="col-lg-8">
        <h1>CareMatch walkthrough</h1>
        <p>
          A 15-minute tour of how CareMatch works, from an application to a cleared caregiver. Keep this page open
          beside the app: each <strong>Open</strong> link switches the app tab to that screen.
        </p>
        <p class="small text-body-secondary">
          Everything here is fictional and stays in your browser. Sign-in links only work in the browser that asked for
          them. Want to check everything in detail? That's the user acceptance testing guide in the project docs.
        </p>

        <ol class="list-unstyled">
          <li v-for="(step, index) in steps" :key="step.title" class="card mb-3">
            <div class="card-body">
              <h2 class="h5">{{ index + 1 }}. {{ step.title }}</h2>
              <p class="mb-2">{{ step.why }}</p>
              <ul class="small mb-2">
                <li v-for="action in step.do" :key="action">{{ action }}</li>
              </ul>
              <a v-if="step.open" :href="appUrl(step.open.route)" :target="APP_WINDOW" class="btn btn-outline-primary btn-sm">
                <i class="bi bi-box-arrow-up-right me-1" aria-hidden="true"></i>{{ step.open.label }}
              </a>
            </div>
          </li>
        </ol>
      </div>
    </div>
  </div>
</template>
