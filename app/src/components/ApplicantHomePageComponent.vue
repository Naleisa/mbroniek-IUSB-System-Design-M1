<script setup lang="ts">
import { computed, inject } from 'vue';
import { dataLayerKey } from '../data/dataLayer';
import { applicantStatus, resumeStep } from '../data/intake';
import { demoDataKey, sessionKey } from '../session';
import StatusBadge from './StatusBadge.vue';

// The applicant's own status page (R6, R18, R16), visible without any coordinator action. The loading,
// error, and not-found states follow the base template's item detail page.
const dataLayer = inject(dataLayerKey)!;
const session = inject(sessionKey)!;
const demoData = inject(demoDataKey)!;

const status = computed(() => {
  void demoData.loading;
  return applicantStatus(dataLayer);
});
const outstanding = computed(() => status.value?.items.filter((item) => item.outstanding) ?? []);
const done = computed(() => status.value?.items.filter((item) => !item.outstanding) ?? []);
const nextStep = computed(() => resumeStep(dataLayer));

</script>

<template>
  <div class="container py-4">
    <div class="row justify-content-center">
      <div class="col-md-6 col-lg-5">
        <h1>Your application</h1>

        <div v-if="demoData.loading" class="alert alert-secondary" role="status">Loading your application…</div>

        <div v-else-if="demoData.error" class="alert alert-danger" role="alert">{{ demoData.error }}</div>

        <div v-else-if="!status" class="alert alert-warning" role="alert">
          We couldn't find your application.
          <router-link to="/applicant/sign-in" class="alert-link">Sign in again</router-link>
        </div>

        <template v-else>
          <div class="card mb-3">
            <div class="card-body">
              <p class="small mb-1">{{ status.agencyName }}</p>
              <p class="mb-3">{{ status.summary }}</p>
              <router-link
                v-if="status.lifecycleState === 'Intake In Progress'"
                :to="nextStep"
                class="btn btn-primary w-100"
              >
                Continue your application
              </router-link>
            </div>
          </div>

          <!-- A replacement the agency asked for (T40, Scenario 3 step 4): the item and the date it's due. -->
          <div v-for="needed in status.replacementsNeeded" :key="needed.item_key" class="card mb-3 border-warning">
            <div class="card-body">
              <h2 class="h5">
                <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>Replacement needed
              </h2>
              <p>
                {{ status.agencyName }} needs a new <strong>{{ needed.name }}</strong> by
                <strong>{{ needed.due_date }}</strong>.
              </p>
              <router-link
                :to="`/applicant/replacements/${needed.item_key}`"
                class="btn w-100"
                :class="status.lifecycleState === 'Intake In Progress' ? 'btn-outline-primary' : 'btn-primary'"
              >
                Upload replacement
              </router-link>
            </div>
          </div>

          <h2 class="h5">Still in progress</h2>
          <p v-if="outstanding.length === 0">Nothing is waiting on you or your agency right now.</p>
          <div v-for="item in outstanding" :key="item.item_key" class="card mb-2">
            <div class="card-body py-3">
              <div class="d-flex justify-content-between align-items-start gap-2">
                <strong>{{ item.name }}</strong>
                <StatusBadge :status="item.status" />
              </div>
              <div class="small mt-1">{{ item.waitingOn }}</div>
              <div v-if="item.replacement?.status === 'Submitted'" class="d-flex align-items-center gap-2 mt-2">
                <span class="small">Replacement:</span>
                <StatusBadge status="Pending" />
              </div>
            </div>
          </div>

          <template v-if="done.length">
            <h2 class="h5 mt-4">Done</h2>
            <div v-for="item in done" :key="item.item_key" class="card mb-2">
              <div class="card-body py-3">
                <div class="d-flex justify-content-between align-items-start gap-2">
                  <strong>{{ item.name }}</strong>
                  <StatusBadge :status="item.status" />
                </div>
                <div class="small mt-1">{{ item.waitingOn }}</div>
              </div>
            </div>
          </template>
        </template>

        <p class="small mt-4 mb-2">Signed in as <strong>{{ session?.display_name }}</strong></p>

      </div>
    </div>
  </div>
</template>
