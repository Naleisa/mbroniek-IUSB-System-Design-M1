<script setup lang="ts">
import { inject, ref } from 'vue';
import { useRouter } from 'vue-router';
import logoUrl from '../assets/carematchlogo.png';
import { dataLayerKey } from '../data/dataLayer';
import { fetchSeedFiles } from '../data/seed';
import { sessionKey } from '../session';

const dataLayer = inject(dataLayerKey)!;
const session = inject(sessionKey)!;
const router = useRouter();

// Demo control (ADR-21): an inline confirmation, not a browser pop-up.
const confirmingReset = ref(false);
const resetting = ref(false);
const resetError = ref('');

async function resetDemoData() {
  resetting.value = true;
  resetError.value = '';
  try {
    await dataLayer.resetDemoData(fetchSeedFiles);
    session.value = undefined;
    confirmingReset.value = false;
    router.push({ path: '/', query: { reset: 'done' } });
  } catch {
    resetError.value = "We couldn't reset the demo data. Please try again.";
  } finally {
    resetting.value = false;
  }
}
</script>

<template>
  <nav class="navbar sticky-top bg-white border-bottom px-3">
    <router-link class="navbar-brand py-2" to="/">
      <!-- 160 x 40 keeps the logo above its 120px minimum width without stretching it -->
      <img :src="logoUrl" alt="CareMatch" width="160" height="40" />
    </router-link>

    <div class="ms-auto d-flex flex-wrap align-items-center justify-content-end gap-2 py-1">
      <button
        v-if="!confirmingReset"
        type="button"
        class="btn btn-outline-primary btn-sm"
        @click="confirmingReset = true"
      >
        Reset demo data
      </button>
      <template v-else>
        <span class="small">Reset all demo data?</span>
        <button type="button" class="btn btn-outline-primary btn-sm" :disabled="resetting" @click="resetDemoData">
          Yes, reset
        </button>
        <button
          type="button"
          class="btn btn-outline-primary btn-sm"
          :disabled="resetting"
          @click="confirmingReset = false"
        >
          Cancel
        </button>
      </template>
      <span v-if="resetError" class="small text-danger-emphasis w-100 text-end" role="alert">{{ resetError }}</span>
    </div>
  </nav>
</template>
