<script setup lang="ts">
import { computed, inject, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { dataLayerKey } from '../data/dataLayer';
import { caregiverRecord } from '../data/record';
import { checkServiceKey, demoDataKey, sessionKey } from '../session';
import StatusBadge from './StatusBadge.vue';

// Caregiver record view (T42, Scenario 2): every template item with its status, source, method, and
// dates, and elapsed time for outstanding checks (R2, R16). Adapted from the base template's item
// detail page: the id from the route, a back link, and a not-found state.
const dataLayer = inject(dataLayerKey)!;
const demoData = inject(demoDataKey)!;
const checkService = inject(checkServiceKey)!;
const session = inject(sessionKey)!;
const route = useRoute();

// Bumped when an order is placed and again when its result arrives, so the record re-reads.
const refresh = ref(0);
const record = computed(() => {
  void demoData.loading;
  void refresh.value;
  return caregiverRecord(dataLayer, String(route.params.id ?? ''));
});

// Order check / Retry / Order again (T43, R9, R21). Refusals show on the item's card.
const orderMessages = reactive<Record<string, string>>({});
function order(itemId: string, itemKey: string) {
  const result = checkService.order(itemId, { role: 'coordinator', name: session.value?.display_name ?? 'Coordinator' });
  if (!result.ok) {
    orderMessages[itemKey] = result.reason;
    return;
  }
  orderMessages[itemKey] = '';
  refresh.value += 1;
  void result.result.then(() => {
    refresh.value += 1;
  });
}

function show(value: string): string {
  return value ? value.replace('T', ' ') : '—';
}
</script>

<template>
  <section class="container py-4">
    <router-link to="/dashboard" class="btn btn-link ps-0 mb-3">← Back to dashboard</router-link>

    <div v-if="demoData.loading" class="alert alert-secondary" role="status">Loading the record…</div>

    <div v-else-if="demoData.error" class="alert alert-danger" role="alert">{{ demoData.error }}</div>

    <div v-else-if="!record" class="alert alert-warning" role="alert">We couldn't find that caregiver.</div>

    <template v-else>
      <div class="card mb-4">
        <div class="card-body">
          <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
            <h1 class="mb-0">{{ record.name }}</h1>
            <StatusBadge :status="record.lifecycleState" />
          </div>
          <dl class="row mb-0 small">
            <dt class="col-5 col-md-3">Email</dt>
            <dd class="col-7 col-md-9">{{ show(record.email) }}</dd>
            <dt class="col-5 col-md-3">Phone</dt>
            <dd class="col-7 col-md-9">{{ show(record.phone) }}</dd>
            <dt class="col-5 col-md-3">SSN</dt>
            <dd class="col-7 col-md-9">{{ record.ssnLast4 ? `Ending ${record.ssnLast4}` : '—' }}</dd>
            <dt class="col-5 col-md-3">Requirements</dt>
            <dd class="col-7 col-md-9">
              {{ record.templateName }}
              <div v-if="record.templateIsSample" class="text-body-secondary">{{ record.templateNote }}</div>
            </dd>
            <dt class="col-5 col-md-3">Authorization</dt>
            <dd class="col-7 col-md-9">
              <StatusBadge v-if="record.authorizationDeclined" status="Declined consent" />
              <span :class="{ 'ms-1': record.authorizationDeclined }">{{ record.authorization }}</span>
            </dd>
            <template v-if="record.replacement">
              <dt class="col-5 col-md-3">Replacement</dt>
              <dd class="col-7 col-md-9">{{ record.replacement }}</dd>
            </template>
          </dl>
        </div>
      </div>

      <h2 class="h5">Required items</h2>
      <div class="row g-3">
        <div v-for="item in record.items" :key="item.item_key" class="col-12 col-lg-6">
          <article class="card h-100">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                <h3 class="h6 mb-0">{{ item.name }}</h3>
                <StatusBadge :status="item.status" />
              </div>
              <p v-if="item.elapsed" class="small mb-2">
                <i class="bi bi-clock me-1" aria-hidden="true"></i><strong>{{ item.elapsed }}</strong>
              </p>
              <dl class="row mb-0 small">
                <dt class="col-5">Source</dt>
                <dd class="col-7">{{ show(item.source) }}</dd>
                <dt class="col-5">Method</dt>
                <dd class="col-7">{{ show(item.method) }}</dd>
                <dt class="col-5">Ordered</dt>
                <dd class="col-7">{{ show(item.ordered_at) }}</dd>
                <dt class="col-5">Verified</dt>
                <dd class="col-7">{{ show(item.verified_date) }}</dd>
                <dt class="col-5">Expires</dt>
                <dd class="col-7">{{ show(item.expiration_date) }}</dd>
                <template v-if="item.result">
                  <dt class="col-5">Result</dt>
                  <dd class="col-7">{{ item.result }}</dd>
                </template>
                <template v-if="item.evidence">
                  <dt class="col-5">Evidence</dt>
                  <dd class="col-7">{{ item.evidence }}</dd>
                </template>
                <template v-if="item.notes">
                  <dt class="col-5">Notes</dt>
                  <dd class="col-7">{{ item.notes }}</dd>
                </template>
              </dl>
              <template v-if="item.orderAction">
                <button type="button" class="btn btn-outline-primary btn-sm w-100 mt-3" @click="order(item.id, item.item_key)">
                  {{ item.orderAction }}
                </button>
                <p v-if="item.status === 'Delayed'" class="small text-body-secondary mt-1 mb-0">
                  Places a new order. The earlier one stays on file.
                </p>
              </template>
              <div v-if="orderMessages[item.item_key]" class="alert alert-warning small mt-2 mb-0" role="alert">
                {{ orderMessages[item.item_key] }}
              </div>
            </div>
          </article>
        </div>
      </div>
    </template>
  </section>
</template>
