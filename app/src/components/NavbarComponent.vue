<script setup lang="ts">
import { inject, ref } from 'vue';
import { useRouter } from 'vue-router';
import logoUrl from '../assets/carematchlogo.png';
import { dataLayerKey } from '../data/dataLayer';
import { formatLocalDateTime } from '../data/relativeDates';
import { fetchSeedFiles } from '../data/seed';
import { sessionKey } from '../session';

const dataLayer = inject(dataLayerKey)!;
const session = inject(sessionKey)!;
const router = useRouter();

// Signed-in navigation (T66): each role's main page and Sign out, so nobody has to remember URLs.
function signOut() {
  dataLayer.signOut();
  session.value = undefined;
  router.push('/');
}

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
    // Reset also clears the demo date, so the app is back on the real today.
    demoDate.value = undefined;
    confirmingReset.value = false;
    router.push({ path: '/', query: { reset: 'done' } });
  } catch {
    resetError.value = "We couldn't reset the demo data. Please try again.";
  } finally {
    resetting.value = false;
  }
}

// Demo date (ADR-13, T60): the date the app treats as today, from the real today up to two years out.
// Changing it reloads the page, so both jobs run again at start-up and every screen reads fresh data.
const realToday = formatLocalDateTime(new Date()).slice(0, 10);
const latestDemoDate = formatLocalDateTime(new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000)).slice(0, 10);
const demoDate = ref(dataLayer.getDemoDate());

function changeDemoDate(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  if (!value || value < realToday || value > latestDemoDate) {
    return;
  }
  dataLayer.setDemoDate(value === realToday ? undefined : value);
  window.location.reload();
}

function backToToday() {
  dataLayer.setDemoDate(undefined);
  window.location.reload();
}
</script>

<template>
  <nav class="navbar sticky-top bg-white border-bottom px-3 d-print-none">
    <router-link class="navbar-brand py-2" to="/">
      <!-- 160 x 40 keeps the logo above its 120px minimum width without stretching it -->
      <img :src="logoUrl" alt="CareMatch" width="160" height="40" />
    </router-link>

    <div v-if="session" class="d-flex flex-wrap align-items-center gap-2 py-1">
      <router-link v-if="session.role === 'coordinator'" to="/dashboard" class="btn btn-link btn-sm">Dashboard</router-link>
      <router-link v-else-if="session.role === 'applicant'" to="/applicant" class="btn btn-link btn-sm">
        Your application
      </router-link>
      <button type="button" class="btn btn-link btn-sm" @click="signOut">Sign out</button>
    </div>

    <div class="ms-auto d-flex flex-wrap align-items-end justify-content-end gap-2 py-1">
      <div>
        <label for="demo-date" class="form-label small mb-0">Demo date</label>
        <input
          id="demo-date"
          type="date"
          class="form-control form-control-sm"
          :value="demoDate ?? realToday"
          :min="realToday"
          :max="latestDemoDate"
          @change="changeDemoDate"
        />
      </div>
      <button v-if="demoDate" type="button" class="btn btn-outline-primary btn-sm" @click="backToToday">
        Back to today
      </button>
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
      <span
        v-if="demoDate"
        class="badge border bg-warning-subtle text-warning-emphasis border-warning-subtle text-wrap fw-normal"
        role="status"
      >
        <i class="bi bi-exclamation-triangle" aria-hidden="true"></i>
        Demo date active: the app is treating {{ demoDate }} as today.
      </span>
      <span v-if="resetError" class="small text-danger-emphasis w-100 text-end" role="alert">{{ resetError }}</span>
    </div>
  </nav>
</template>
