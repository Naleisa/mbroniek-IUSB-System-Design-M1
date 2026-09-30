<script setup lang="ts">
import { computed, inject, reactive, ref } from 'vue';
import { dataLayerKey } from '../data/dataLayer';
import { expirationWorklist, requestReplacement, type WorklistRow } from '../data/worklist';
import { demoDataKey, sessionKey } from '../session';
import StatusBadge from './StatusBadge.vue';

// Expiration worklist (T47, R15, C6, Scenario 3): each Expiring item with its caregiver and date, and an
// action to ask the caregiver for a replacement. Items that have already expired are listed below.
const dataLayer = inject(dataLayerKey)!;
const demoData = inject(demoDataKey)!;
const session = inject(sessionKey)!;

const refresh = ref(0);
const worklist = computed(() => {
  void demoData.loading;
  void refresh.value;
  return expirationWorklist(dataLayer);
});
const messages = reactive<Record<string, string>>({});

function request(row: WorklistRow) {
  const result = requestReplacement(dataLayer, row.itemId, {
    role: 'coordinator',
    name: session.value?.display_name ?? 'Coordinator',
  });
  messages[row.itemId] = result.ok ? '' : result.reason;
  refresh.value += 1;
}

function replacementLabel(row: WorklistRow): string {
  if (!row.replacement) {
    return '';
  }
  return row.replacement.status === 'Submitted'
    ? 'Replacement uploaded: review it'
    : `Replacement requested, due ${row.replacement.dueDate}`;
}
</script>

<template>
  <section class="container py-4">
    <router-link to="/dashboard" class="btn btn-link ps-0 mb-3">← Back to dashboard</router-link>
    <div class="d-flex justify-content-between align-items-center mb-1">
      <h1 class="mb-0">Expiration worklist</h1>
      <span class="badge text-bg-light border">{{ worklist.expiring.length }} expiring</span>
    </div>
    <p>Credentials that expire within the warning window, soonest first.</p>

    <div v-if="demoData.loading" class="alert alert-secondary" role="status">Loading the worklist…</div>
    <div v-else-if="demoData.error" class="alert alert-danger" role="alert">{{ demoData.error }}</div>

    <template v-else>
      <template v-for="section in [
        { title: 'Expiring', rows: worklist.expiring, empty: 'Nothing is expiring in the warning window.' },
        { title: 'Already expired', rows: worklist.expired, empty: 'Nothing has expired.' },
      ]" :key="section.title">
        <h2 class="h5 mt-4">{{ section.title }}</h2>
        <p v-if="section.rows.length === 0" class="small">{{ section.empty }}</p>
        <div class="row g-3">
          <div v-for="row in section.rows" :key="row.itemId" class="col-12 col-md-6 col-lg-4">
            <article class="card h-100">
              <div class="card-body d-flex flex-column">
                <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
                  <router-link :to="`/caregivers/${row.caregiverId}`" class="fw-medium">{{ row.caregiverName }}</router-link>
                  <StatusBadge :status="row.status" />
                </div>
                <p class="mb-1">{{ row.itemName }}</p>
                <p class="small mb-2">
                  {{ row.status === 'Expired' ? 'Expired' : 'Expires' }} {{ row.expirationDate }} ({{ row.when }})
                </p>
                <p v-if="row.replacement" class="small mb-0">
                  <i class="bi bi-arrow-repeat me-1" aria-hidden="true"></i>{{ replacementLabel(row) }}
                </p>
                <button
                  v-else
                  type="button"
                  class="btn btn-outline-primary btn-sm w-100 mt-auto"
                  @click="request(row)"
                >
                  Request replacement
                </button>
                <div v-if="messages[row.itemId]" class="alert alert-warning small mt-2 mb-0" role="alert">
                  {{ messages[row.itemId] }}
                </div>
              </div>
            </article>
          </div>
        </div>
      </template>
    </template>
  </section>
</template>
