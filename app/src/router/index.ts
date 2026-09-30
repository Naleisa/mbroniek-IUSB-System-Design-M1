import { createRouter, createWebHashHistory } from 'vue-router';
import LandingPageComponent from '../components/LandingPageComponent.vue';
import ComponentsPageComponent from '../components/ComponentsPageComponent.vue';
import SignInPageComponent from '../components/SignInPageComponent.vue';
import DashboardPageComponent from '../components/DashboardPageComponent.vue';
import CaregiverRecordPageComponent from '../components/CaregiverRecordPageComponent.vue';
import ComplianceReportPageComponent from '../components/ComplianceReportPageComponent.vue';
import WorklistPageComponent from '../components/WorklistPageComponent.vue';
import AgencyOutboxPageComponent from '../components/AgencyOutboxPageComponent.vue';
import ApplicantSignInPageComponent from '../components/ApplicantSignInPageComponent.vue';
import OutboxPageComponent from '../components/OutboxPageComponent.vue';
import AuthPageComponent from '../components/AuthPageComponent.vue';
import ApplicantHomePageComponent from '../components/ApplicantHomePageComponent.vue';
import IntakeStartPageComponent from '../components/IntakeStartPageComponent.vue';
import IdentityStepPageComponent from '../components/IdentityStepPageComponent.vue';
import NeededStepPageComponent from '../components/NeededStepPageComponent.vue';
import UploadsStepPageComponent from '../components/UploadsStepPageComponent.vue';
import ConsentStepPageComponent from '../components/ConsentStepPageComponent.vue';
import ReviewStepPageComponent from '../components/ReviewStepPageComponent.vue';
import ReplacementPageComponent from '../components/ReplacementPageComponent.vue';
import WalkthroughPageComponent from '../components/WalkthroughPageComponent.vue';

const routes = [
  {
    path: '/',
    component: LandingPageComponent,
  },
  {
    path: '/components',
    component: ComponentsPageComponent,
    meta: { title: 'Components' },
  },
  {
    path: '/sign-in',
    component: SignInPageComponent,
    meta: { title: 'Coordinator sign-in' },
  },
  {
    path: '/dashboard',
    component: DashboardPageComponent,
    meta: { requiresCoordinator: true, title: 'Dashboard' },
  },
  {
    path: '/messages',
    component: AgencyOutboxPageComponent,
    meta: { requiresCoordinator: true, title: 'Agency outbox' },
  },
  {
    path: '/worklist',
    component: WorklistPageComponent,
    meta: { requiresCoordinator: true, title: 'Expiration worklist' },
  },
  {
    path: '/caregivers/:id/report',
    component: ComplianceReportPageComponent,
    meta: { requiresCoordinator: true, title: 'Compliance report' },
  },
  {
    path: '/caregivers/:id',
    component: CaregiverRecordPageComponent,
    meta: { requiresCoordinator: true, title: 'Caregiver record' },
  },
  {
    path: '/applicant/sign-in',
    component: ApplicantSignInPageComponent,
    meta: { title: 'Applicant sign-in' },
  },
  {
    path: '/outbox',
    component: OutboxPageComponent,
    meta: { title: 'Demo outbox' },
  },
  {
    path: '/auth',
    component: AuthPageComponent,
    meta: { title: 'Signing you in' },
  },
  {
    path: '/applicant',
    component: ApplicantHomePageComponent,
    meta: { requiresApplicant: true, title: 'Your application' },
  },
  {
    path: '/applicant/intake/identity',
    component: IdentityStepPageComponent,
    meta: { requiresApplicant: true, title: 'About you' },
  },
  {
    path: '/applicant/intake/needed',
    component: NeededStepPageComponent,
    meta: { requiresApplicant: true, title: "What you'll need" },
  },
  {
    path: '/applicant/intake/uploads',
    component: UploadsStepPageComponent,
    meta: { requiresApplicant: true, title: 'Add your documents' },
  },
  {
    path: '/applicant/intake/disclosure',
    component: ConsentStepPageComponent,
    meta: { requiresApplicant: true, consentType: 'disclosure', title: 'Background check disclosure' },
  },
  {
    path: '/applicant/intake/authorization',
    component: ConsentStepPageComponent,
    meta: { requiresApplicant: true, consentType: 'authorization', title: 'Authorization for background checks' },
  },
  {
    path: '/applicant/intake/review',
    component: ReviewStepPageComponent,
    meta: { requiresApplicant: true, title: 'Review and submit' },
  },
  {
    // Never shown: the guard in main.ts sends the applicant on to their next unfinished step.
    path: '/applicant/resume',
    component: ApplicantHomePageComponent,
    meta: { requiresApplicant: true },
  },
  {
    path: '/applicant/replacements/:itemKey',
    component: ReplacementPageComponent,
    meta: { requiresApplicant: true, title: 'Upload a replacement' },
  },
  {
    // Opened in a second tab beside the app, so it has no navbar (T65).
    path: '/walkthrough',
    component: WalkthroughPageComponent,
    meta: { title: 'Walkthrough', bare: true },
  },
  {
    path: '/apply/:agencySlug',
    component: IntakeStartPageComponent,
    meta: { title: 'Apply' },
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// Each page has its own browser title, so screen readers and tabs say where you are (T54).
router.afterEach((to) => {
  document.title = typeof to.meta.title === 'string' ? `${to.meta.title} · CareMatch` : 'CareMatch';
});

export default router;
