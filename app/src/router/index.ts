import { createRouter, createWebHashHistory } from 'vue-router';
import LandingPageComponent from '../components/LandingPageComponent.vue';
import ComponentsPageComponent from '../components/ComponentsPageComponent.vue';

const routes = [
  {
    path: '/',
    component: LandingPageComponent,
  },
  {
    path: '/components',
    component: ComponentsPageComponent,
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
