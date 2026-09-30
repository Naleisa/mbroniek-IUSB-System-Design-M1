<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import NavbarComponent from './components/NavbarComponent.vue';

// Accessibility (T54, WCAG 2.1 AA): a skip link past the navbar, and after each page change focus
// moves to the new page's main heading so screen readers announce it. The first page load is left alone.
const main = ref<HTMLElement | null>(null);
const router = useRouter();
const route = useRoute();

function focusMain() {
  const heading = main.value?.querySelector<HTMLElement>('h1');
  const target = heading ?? main.value;
  if (target) {
    target.setAttribute('tabindex', '-1');
    target.focus();
  }
}

let firstNavigation = true;
router.afterEach(async () => {
  if (firstNavigation) {
    firstNavigation = false;
    return;
  }
  await nextTick();
  focusMain();
});
</script>

<template>
  <div class="d-flex flex-column min-vh-100">
    <a href="#" class="visually-hidden-focusable btn btn-primary m-2 position-absolute" @click.prevent="focusMain">
      Skip to main content
    </a>
    <NavbarComponent v-if="!route.meta.bare" />
    <main ref="main" class="flex-grow-1 overflow-auto">
      <router-view />
    </main>
  </div>
</template>
