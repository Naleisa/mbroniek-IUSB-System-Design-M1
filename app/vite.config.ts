import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// GitHub Pages serves the site from /<repo name>/; the dev server stays at /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/mbroniek-IUSB-System-Design-M1/' : '/',
  plugins: [vue()],
}));
