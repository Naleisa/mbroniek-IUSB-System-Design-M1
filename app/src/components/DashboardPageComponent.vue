<script setup lang="ts">
import { computed, inject } from 'vue';
import { useRouter } from 'vue-router';
import { coordinatorDashboard, type Highlight } from '../data/dashboard';
import { dataLayerKey } from '../data/dataLayer';
import { demoDataKey, sessionKey } from '../session';
import StatusBadge from './StatusBadge.vue';

// Coordinator dashboard (T41): the agency's caregivers grouped by lifecycle state, with incomplete
// intakes, declined consents, and delayed checks highlighted. Adapted from the base template's
// collection page (count badge, loading/error/empty states, card grid).
const dataLayer = inject(dataLayerKey)!;
const session = inject(sessionKey)!;
const demoData = inject(demoDataKey)!;
const router = useRouter();

const dashboard = computed(() => {
  void demoData.loading;
  return coordinatorDashboard(dataLayer);
});
const highlightOrder: Highlight[] = ['Incomplete intake', 'Declined consent', 'Delayed check'];

function signOut() {
  dataLayer.signOut();
  session.value = undefined;
  router.push('/sign-in');
}
</script>

<template>
  <section class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-1">
      <h1 class="mb-0">Dashboard</h1>
      <span class="badge text-bg-light border">{{ dashboard.total }} caregivers</span>
    </div>
    <p>
      {{ dashboard.agencyName }} · Signed in as <strong>{{ session?.display_name }}</strong>
    </p>

    <div v-if="demoData.loading" class="alert alert-secondary" role="status">Loading caregivers…</div>

    <div v-else-if="demoData.error" class="alert alert-danger" role="alert">{{ demoData.error }}</div>

    <div v-else-if="dashboard.total === 0" class="alert alert-warning" role="alert">
      No caregivers yet. New applications from your agency's intake link will appear here.
    </div>

    <template v-else>
      <div class="card mb-4">
        <div class="card-body">
          <h2 class="h5">Needs attention</h2>
          <div class="d-flex flex-wrap gap-3">
            <div v-for="label in highlightOrder" :key="label" class="d-flex align-items-center gap-2">
              <StatusBadge :status="label" />
              <strong>{{ dashboard.counts[label] }}</strong>
            </div>
          </div>
        </div>
      </div>

      <section v-for="group in dashboard.groups" :key="group.state" class="mb-4">
        <h2 class="h5 d-flex align-items-center gap-2">
          <StatusBadge :status="group.state" />
          <span class="small fw-normal">{{ group.cards.length }}</span>
        </h2>
        <div class="row g-3">
          <div v-for="card in group.cards" :key="card.id" class="col-12 col-md-6 col-lg-4">
            <article class="card h-100">
              <div class="card-body">
                <h3 class="h6 mb-2">{{ card.name }}</h3>
                <ul v-if="card.highlights.length" class="list-unstyled mb-0">
                  <li v-for="highlight in card.highlights" :key="highlight.label + highlight.detail" class="mb-1">
                    <StatusBadge :status="highlight.label" />
                    <span class="small ms-1">{{ highlight.detail }}</span>
                  </li>
                </ul>
                <p v-else class="small mb-0">Nothing needs attention.</p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </template>

    <button type="button" class="btn btn-outline-primary" @click="signOut">Sign out</button>
  </section>
</template>
