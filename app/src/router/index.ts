import { createRouter, createWebHashHistory } from 'vue-router';
import LandingPageComponent from '../components/LandingPageComponent.vue';

const routes = [
  {
    path: '/',
    component: LandingPageComponent,
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
