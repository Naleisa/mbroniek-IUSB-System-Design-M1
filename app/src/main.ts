import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import './styles/theme.css';
import { createApp, reactive, ref } from 'vue';
import App from './App.vue';
import router from './router';
import { createBrowserBackend } from './data/browserBackend';
import { createCheckService } from './data/checks';
import { createDataLayer, createSystemDataLayer, dataLayerKey } from './data/dataLayer';
import { resumeStep } from './data/intake';
import { runDelayedCheckJob, runExpirationJob } from './data/jobs';
import { fetchSeedFiles } from './data/seed';
import { checkServiceKey, demoDataKey, sessionKey, type DemoDataState } from './session';

const app = createApp(App);

const backend = createBrowserBackend();
const dataLayer = createDataLayer(backend);
const demoData = reactive<DemoDataState>({ loading: true, error: '' });
// Jobs run once the seed is loaded, using the demo date when one is set (ADR-13). Changing the
// demo date reloads the page, so the jobs run again here.
dataLayer
  .loadSeed(fetchSeedFiles)
  .then(() => {
    const systemDataLayer = createSystemDataLayer(backend);
    runDelayedCheckJob(systemDataLayer, systemDataLayer.today());
    runExpirationJob(systemDataLayer, systemDataLayer.today());
  })
  .catch((error) => {
    console.error('There was a problem loading the demo seed data.', error);
    demoData.error = "We couldn't load the demo data. Please reload the page.";
  })
  .finally(() => {
    demoData.loading = false;
  });
app.provide(dataLayerKey, dataLayer);
app.provide(demoDataKey, demoData);
app.provide(checkServiceKey, createCheckService(backend, dataLayer));
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
  // Sign-in links land here and go on to the applicant's first unfinished intake step (R8, T38).
  if (to.path === '/applicant/resume') {
    return resumeStep(dataLayer);
  }
  return true;
});

app.use(router);
app.mount('#app');
