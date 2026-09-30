<script setup lang="ts">
import { computed, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { dataLayerKey } from '../data/dataLayer';
import { demoDataKey, sessionKey } from '../session';

// Agency intake link (ADR-18): the link names one agency, and the record starts under it.
// An unknown link names no agency and offers no list of them (C7).
const dataLayer = inject(dataLayerKey)!;
const session = inject(sessionKey)!;
const demoData = inject(demoDataKey)!;
const route = useRoute();
const router = useRouter();

const agencySlug = computed(() => String(route.params.agencySlug ?? ''));
// On a first visit the demo data is still loading, so the agency is looked up again once it arrives.
const agencyName = computed(() => {
  void demoData.loading;
  return dataLayer.agencyNameForIntake(agencySlug.value);
});

function startApplication() {
  if (!dataLayer.startIntake(agencySlug.value)) {
    return;
  }
  session.value = dataLayer.getSignedInUser();
  router.push('/applicant/intake/identity');
}
</script>

<template>
  <div class="container py-4">
    <div class="row justify-content-center">
      <div class="col-md-6 col-lg-5">
        <template v-if="demoData.loading">
          <h1>Loading…</h1>
          <div class="alert alert-secondary" role="status">Loading the application…</div>
        </template>
        <div v-else-if="demoData.error" class="alert alert-danger" role="alert">{{ demoData.error }}</div>
        <template v-else-if="agencyName">
          <h1>Apply to {{ agencyName }}</h1>
          <div class="card">
            <div class="card-body">
              <p>
                Thanks for your interest in caregiving with {{ agencyName }}. The application takes a few minutes on
                your phone, and your progress is saved as you go.
              </p>
              <button type="button" class="btn btn-primary w-100" @click="startApplication">Start my application</button>
            </div>
          </div>
        </template>
        <template v-else>
          <h1>We can't find that application link</h1>
          <div class="card">
            <div class="card-body">
              <p class="mb-0">
                Please check the link your agency shared with you, or ask them to send it again.
              </p>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
