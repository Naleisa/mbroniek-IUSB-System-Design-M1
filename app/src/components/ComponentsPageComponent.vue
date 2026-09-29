<script setup lang="ts">
import { ref } from 'vue';
import logoUrl from '../assets/carematchlogo.png';
import FormField from './FormField.vue';
import StatusBadge from './StatusBadge.vue';

const itemStatuses = [
  'Pending',
  'Ordered',
  'Delayed',
  'Retryable',
  'Verified',
  'Expiring',
  'Expired',
  'Manual Verification',
];

const lifecycleStates = [
  'Intake In Progress',
  'Intake Complete',
  'Screening In Progress',
  'Eligible',
  'Cleared',
  'Not Current',
  'Review Required',
];

const firstName = ref('');
const middleName = ref('');
</script>

<template>
  <div class="container py-4">
    <h1>Components</h1>
    <p>A preview of the shared CareMatch components.</p>

    <section class="mb-5">
      <h2>Logo</h2>
      <img :src="logoUrl" alt="CareMatch" width="240" height="60" />
    </section>

    <section class="mb-5">
      <h2>Typography</h2>
      <p class="h1">Heading 1 — Roboto Bold, 32px</p>
      <p class="h2">Heading 2 — Roboto Medium, 24px</p>
      <p>Body — Roboto Regular, 16px. <a href="#/components">This is a link.</a></p>
    </section>

    <section class="mb-5">
      <h2>Buttons</h2>
      <div class="d-flex flex-wrap gap-2">
        <button type="button" class="btn btn-primary">Submit application</button>
        <button type="button" class="btn btn-outline-primary">Save draft</button>
      </div>
    </section>

    <section class="mb-5">
      <h2>Card</h2>
      <div class="card">
        <div class="card-body">
          <h3 class="h5 card-title">Criminal background check</h3>
          <p class="card-text">Required before anyone can work in a client's home.</p>
        </div>
      </div>
    </section>

    <section class="mb-5">
      <h2>Form field</h2>
      <FormField id="preview-first-name" v-model="firstName" label="First name" required />
      <FormField id="preview-middle-name" v-model="middleName" label="Middle name" />
    </section>

    <section class="mb-5">
      <h2>Status badges</h2>
      <h3 class="h5">Item statuses</h3>
      <div class="d-flex flex-wrap gap-2 mb-3">
        <StatusBadge v-for="status in itemStatuses" :key="status" :status="status" />
      </div>
      <h3 class="h5">Lifecycle states</h3>
      <div class="d-flex flex-wrap gap-2">
        <StatusBadge v-for="state in lifecycleStates" :key="state" :status="state" />
      </div>
    </section>
  </div>
</template>
