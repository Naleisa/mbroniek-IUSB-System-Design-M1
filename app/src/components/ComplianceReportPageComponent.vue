<script setup lang="ts">
import { computed, inject } from 'vue';
import { useRoute } from 'vue-router';
import { dataLayerKey } from '../data/dataLayer';
import { complianceReport } from '../data/report';
import { demoDataKey } from '../session';
import StatusBadge from './StatusBadge.vue';

// Compliance report (T50, R13, R2, ADR-14): one printable document per caregiver with every required
// item, its evidence, and its verification history. The browser's print dialog saves it as a PDF; the
// navbar, demo controls, and buttons are hidden when printing.
const dataLayer = inject(dataLayerKey)!;
const demoData = inject(demoDataKey)!;
const route = useRoute();

const caregiverId = computed(() => String(route.params.id ?? ''));
const report = computed(() => {
  void demoData.loading;
  return complianceReport(dataLayer, caregiverId.value);
});

function show(value: string): string {
  return value ? value.replace('T', ' ') : '—';
}

function print() {
  window.print();
}
</script>

<template>
  <section class="container py-4 compliance-report">
    <div class="d-print-none d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <router-link :to="`/caregivers/${caregiverId}`" class="btn btn-link ps-0">← Back to the record</router-link>
      <button v-if="report" type="button" class="btn btn-primary" @click="print">
        <i class="bi bi-printer me-1" aria-hidden="true"></i>Print or save as PDF
      </button>
    </div>

    <div v-if="demoData.loading" class="alert alert-secondary" role="status">Loading the report…</div>
    <div v-else-if="demoData.error" class="alert alert-danger" role="alert">{{ demoData.error }}</div>
    <div v-else-if="!report" class="alert alert-warning" role="alert">We couldn't find that caregiver.</div>

    <template v-else>
      <header class="mb-4">
        <h1 class="mb-1">Compliance report</h1>
        <p class="lead mb-2">{{ report.caregiverName }} · {{ report.agencyName }}</p>
        <dl class="row small mb-0">
          <dt class="col-5 col-md-3">Current status</dt>
          <dd class="col-7 col-md-9"><StatusBadge :status="report.lifecycleState" /></dd>
          <dt class="col-5 col-md-3">SSN</dt>
          <dd class="col-7 col-md-9">{{ report.ssnLast4 ? `Ending ${report.ssnLast4}` : '—' }}</dd>
          <dt class="col-5 col-md-3">Requirements</dt>
          <dd class="col-7 col-md-9">
            {{ report.templateName }}
            <div v-if="report.templateNote" class="text-body-secondary">{{ report.templateNote }}</div>
          </dd>
          <dt class="col-5 col-md-3">Generated</dt>
          <dd class="col-7 col-md-9">{{ show(report.generatedAt) }}</dd>
        </dl>
      </header>

      <div class="card mb-4 report-block">
        <div class="card-body">
          <h2 class="h5">Summary</h2>
          <p v-if="report.summary.complete" class="mb-0">
            All {{ report.summary.itemCount }} required items are verified and current.
          </p>
          <template v-else>
            <p class="mb-1">Not every required item is verified and current. Still needed:</p>
            <ul class="mb-0">
              <li v-for="blocker in report.summary.blockers" :key="blocker">{{ blocker }}</li>
            </ul>
          </template>
        </div>
      </div>

      <h2 class="h5">Required items</h2>
      <article v-for="item in report.items" :key="item.item_key" class="card mb-3 report-block">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
            <h3 class="h6 mb-0">{{ item.name }}</h3>
            <StatusBadge :status="item.status" />
          </div>
          <dl class="row small mb-2">
            <dt class="col-5 col-md-3">Source</dt>
            <dd class="col-7 col-md-9">{{ show(item.source) }}</dd>
            <dt class="col-5 col-md-3">Method</dt>
            <dd class="col-7 col-md-9">{{ show(item.method) }}</dd>
            <dt class="col-5 col-md-3">Ordered</dt>
            <dd class="col-7 col-md-9">{{ show(item.ordered_at) }}</dd>
            <dt class="col-5 col-md-3">Verified</dt>
            <dd class="col-7 col-md-9">{{ show(item.verified_date) }}</dd>
            <dt class="col-5 col-md-3">Expires</dt>
            <dd class="col-7 col-md-9">{{ show(item.expiration_date) }}</dd>
            <dt class="col-5 col-md-3">Result</dt>
            <dd class="col-7 col-md-9">{{ show(item.result) }}</dd>
            <dt class="col-5 col-md-3">Evidence</dt>
            <dd class="col-7 col-md-9">{{ show(item.evidence) }}</dd>
            <template v-if="item.notes">
              <dt class="col-5 col-md-3">Notes</dt>
              <dd class="col-7 col-md-9">{{ item.notes }}</dd>
            </template>
          </dl>
          <template v-if="item.checkHistory.length">
            <p class="small fw-medium mb-1">Check history</p>
            <ul class="small mb-2 ps-3">
              <li v-for="order in item.checkHistory" :key="order.orderedAt + order.result">
                Ordered {{ show(order.orderedAt) }} ·
                {{ order.completedAt ? `returned ${show(order.completedAt)}: ${order.result || '—'}` : 'no result yet' }}
              </li>
            </ul>
          </template>
          <template v-if="item.activity.length">
            <p class="small fw-medium mb-1">Item activity</p>
            <ul class="small mb-0 ps-3">
              <li v-for="entry in item.activity" :key="entry.when + entry.event + entry.details">
                {{ show(entry.when) }} · {{ entry.who }} · {{ entry.event }}<span v-if="entry.details">: {{ entry.details }}</span>
              </li>
            </ul>
          </template>
        </div>
      </article>

      <h2 class="h5 mt-4">Record history</h2>
      <p v-if="report.history.length === 0" class="small">No history recorded yet.</p>
      <ol v-else class="small ps-3">
        <li v-for="entry in report.history" :key="entry.when + entry.event + entry.details" class="mb-1">
          <strong>{{ show(entry.when) }}</strong> · {{ entry.who }} · {{ entry.event }}<span v-if="entry.details">: {{ entry.details }}</span>
        </li>
      </ol>
    </template>
  </section>
</template>
