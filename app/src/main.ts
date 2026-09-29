import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import './styles/theme.css';
import { createApp, ref } from 'vue';
import App from './App.vue';
import router from './router';
import { createBrowserBackend } from './data/browserBackend';
import { createDataLayer, createSystemDataLayer, dataLayerKey } from './data/dataLayer';
import { runDelayedCheckJob, runExpirationJob } from './data/jobs';
import { fetchSeedFiles } from './data/seed';
import { sessionKey } from './session';

const app = createApp(App);

const backend = createBrowserBackend();
const dataLayer = createDataLayer(backend);
// Jobs run once the seed is loaded (ADR-13). Today's real date is used until the demo-date control (T60).
dataLayer
  .loadSeed(fetchSeedFiles)
  .then(() => {
    const systemDataLayer = createSystemDataLayer(backend);
    runDelayedCheckJob(systemDataLayer, new Date());
    runExpirationJob(systemDataLayer, new Date());
  })
  .catch((error) => {
    console.error('There was a problem loading the demo seed data.', error);
  });
app.provide(dataLayerKey, dataLayer);
app.provide(sessionKey, ref(dataLayer.getSignedInUser()));

// Coordinator and applicant pages send anyone without that role to the matching sign-in (ADR-05).
router.beforeEach((to) => {
  const role = dataLayer.getSignedInUser()?.role;
  if (to.meta.requiresCoordinator && role !== 'coordinator') {
    return '/sign-in';
  }
  if (to.meta.requiresApplicant && role !== 'applicant') {
    return { path: '/applicant/sign-in', query: { next: to.fullPath } };
  }
  return true;
});

app.use(router);
app.mount('#app');
