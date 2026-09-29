import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import './styles/theme.css';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { createBrowserBackend } from './data/browserBackend';
import { createDataLayer, dataLayerKey } from './data/dataLayer';
import { fetchSeedFiles } from './data/seed';

const app = createApp(App);

const dataLayer = createDataLayer(createBrowserBackend());
dataLayer.loadSeed(fetchSeedFiles).catch((error) => {
  console.error('There was a problem loading the demo seed data.', error);
});
app.provide(dataLayerKey, dataLayer);

app.use(router);
app.mount('#app');
