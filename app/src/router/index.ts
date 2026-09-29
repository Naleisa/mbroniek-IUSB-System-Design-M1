import { createRouter, createWebHashHistory } from 'vue-router';
import LandingPageComponent from '../components/LandingPageComponent.vue';
import ComponentsPageComponent from '../components/ComponentsPageComponent.vue';
import SignInPageComponent from '../components/SignInPageComponent.vue';
import DashboardPageComponent from '../components/DashboardPageComponent.vue';

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
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
