<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { dataLayerKey } from '../data/dataLayer';
import { agencyOutbox } from '../data/outbox';
import { demoDataKey } from '../session';

// Agency outbox (T49, ADR-06): every email and text sent in the coordinator's agency, each marked by
// channel. Nothing is really sent in the demo. Sign-in links are hidden from coordinators.
const dataLayer = inject(dataLayerKey)!;
const demoData = inject(demoDataKey)!;

type Filter = 'all' | 'email' | 'sms';
const filter = ref<Filter>('all');
const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
];

const messages = computed(() => {
  void demoData.loading;
  return agencyOutbox(dataLayer);
});
const shown = computed(() =>
  filter.value === 'all' ? messages.value : messages.value.filter((message) => message.channel === filter.value),
);
</script>

<template>
  <section class="container py-4">
    <router-link to="/dashboard" class="btn btn-link ps-0 mb-3">← Back to dashboard</router-link>
    <div class="d-flex justify-content-between align-items-center mb-1">
      <h1 class="mb-0">Agency outbox</h1>
      <span class="badge text-bg-light border">{{ shown.length }} shown</span>
    </div>
    <p>Emails and texts aren't sent in the demo. Every message your agency would send appears here instead.</p>

    <div class="btn-group mb-3" role="group" aria-label="Show messages by channel">
      <button
        v-for="option in filters"
        :key="option.value"
        type="button"
        class="btn btn-outline-primary btn-sm"
        :class="{ active: filter === option.value }"
        :aria-pressed="filter === option.value"
        @click="filter = option.value"
      >
        {{ option.label }}
      </button>
    </div>

    <div v-if="demoData.loading" class="alert alert-secondary" role="status">Loading messages…</div>
    <div v-else-if="demoData.error" class="alert alert-danger" role="alert">{{ demoData.error }}</div>
    <div v-else-if="shown.length === 0" class="alert alert-warning" role="alert">No messages yet.</div>

    <div v-else class="row g-3">
      <div v-for="message in shown" :key="message.id" class="col-12 col-lg-6">
        <article class="card h-100">
          <div class="card-body">
            <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
              <span class="badge rounded-pill border bg-secondary-subtle text-secondary-emphasis border-secondary-subtle fw-medium">
                <i class="bi me-1" :class="message.channel === 'sms' ? 'bi-phone' : 'bi-envelope'" aria-hidden="true"></i>
                {{ message.channel === 'sms' ? 'SMS' : 'Email' }}
              </span>
              <span class="small">{{ message.createdAt.replace('T', ' ') }}</span>
            </div>
            <p class="small mb-1">
              <strong>To:</strong> {{ message.recipientName }}
              <span v-if="message.recipientAddress">({{ message.recipientAddress }})</span>
            </p>
            <p v-if="message.caregiverName" class="small mb-2">
              <strong>About:</strong>
              <router-link :to="`/caregivers/${message.caregiverId}`">{{ message.caregiverName }}</router-link>
            </p>
            <h2 v-if="message.subject" class="h6 mb-1">{{ message.subject }}</h2>
            <p class="card-text text-break mb-0">{{ message.body }}</p>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
