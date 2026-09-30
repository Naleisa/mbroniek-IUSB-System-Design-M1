import { createRouter, createWebHashHistory } from 'vue-router';
import LandingPageComponent from '../components/LandingPageComponent.vue';
import ComponentsPageComponent from '../components/ComponentsPageComponent.vue';
import SignInPageComponent from '../components/SignInPageComponent.vue';
import DashboardPageComponent from '../components/DashboardPageComponent.vue';
import CaregiverRecordPageComponent from '../components/CaregiverRecordPageComponent.vue';
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

const routes = [
  {
    path: '/',
    component: LandingPageComponent,
  },
  {
    path: '/components',
    component: ComponentsPageComponent,
  },
  {
    path: '/sign-in',
    component: SignInPageComponent,
  },
  {
    path: '/dashboard',
    component: DashboardPageComponent,
    meta: { requiresCoordinator: true },
  },
  {
    path: '/messages',
    component: AgencyOutboxPageComponent,
    meta: { requiresCoordinator: true },
  },
  {
    path: '/worklist',
    component: WorklistPageComponent,
    meta: { requiresCoordinator: true },
  },
  {
    path: '/caregivers/:id',
    component: CaregiverRecordPageComponent,
    meta: { requiresCoordinator: true },
  },
  {
    path: '/applicant/sign-in',
    component: ApplicantSignInPageComponent,
  },
  {
    path: '/outbox',
    component: OutboxPageComponent,
  },
  {
    path: '/auth',
    component: AuthPageComponent,
  },
  {
    path: '/applicant',
    component: ApplicantHomePageComponent,
    meta: { requiresApplicant: true },
  },
  {
    path: '/applicant/intake/identity',
    component: IdentityStepPageComponent,
    meta: { requiresApplicant: true },
  },
  {
    path: '/applicant/intake/needed',
    component: NeededStepPageComponent,
    meta: { requiresApplicant: true },
  },
  {
    path: '/applicant/intake/uploads',
    component: UploadsStepPageComponent,
    meta: { requiresApplicant: true },
  },
  {
    path: '/applicant/intake/disclosure',
    component: ConsentStepPageComponent,
    meta: { requiresApplicant: true, consentType: 'disclosure' },
  },
  {
    path: '/applicant/intake/authorization',
    component: ConsentStepPageComponent,
    meta: { requiresApplicant: true, consentType: 'authorization' },
  },
  {
    path: '/applicant/intake/review',
    component: ReviewStepPageComponent,
    meta: { requiresApplicant: true },
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
    meta: { requiresApplicant: true },
  },
  {
    path: '/apply/:agencySlug',
    component: IntakeStartPageComponent,
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
