import { createRouter, createWebHashHistory } from 'vue-router';
import LandingPageComponent from '../components/LandingPageComponent.vue';
import ComponentsPageComponent from '../components/ComponentsPageComponent.vue';
import SignInPageComponent from '../components/SignInPageComponent.vue';
import DashboardPageComponent from '../components/DashboardPageComponent.vue';
import ApplicantSignInPageComponent from '../components/ApplicantSignInPageComponent.vue';
import OutboxPageComponent from '../components/OutboxPageComponent.vue';
import AuthPageComponent from '../components/AuthPageComponent.vue';
import ApplicantHomePageComponent from '../components/ApplicantHomePageComponent.vue';
import IntakeStartPageComponent from '../components/IntakeStartPageComponent.vue';
import IdentityStepPageComponent from '../components/IdentityStepPageComponent.vue';

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
    path: '/apply/:agencySlug',
    component: IntakeStartPageComponent,
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
