<script setup lang="ts">
import { computed } from 'vue';

// Status badges always pair a text label with an icon, never color alone (ADR-20).
const props = defineProps<{ status: string }>();

type Tone = 'success' | 'neutral' | 'warning' | 'danger';

const toneByStatus: Record<string, Tone> = {
  // Item statuses (ADR-09)
  Verified: 'success',
  Pending: 'neutral',
  Ordered: 'neutral',
  Delayed: 'warning',
  Expiring: 'warning',
  Retryable: 'warning',
  'Manual Verification': 'warning',
  Expired: 'danger',
  // Lifecycle states (ADR-08)
  Eligible: 'success',
  Cleared: 'success',
  'Intake In Progress': 'neutral',
  'Intake Complete': 'neutral',
  'Screening In Progress': 'neutral',
  'Not Current': 'danger',
  'Review Required': 'danger',
  // Coordinator dashboard highlights (T41)
  'Incomplete intake': 'warning',
  'Delayed check': 'warning',
  'Declined consent': 'danger',
};

const toneStyles: Record<Tone, { classes: string; icon: string }> = {
  success: {
    classes: 'bg-success-subtle text-success-emphasis border-success-subtle',
    icon: 'bi-check-circle',
  },
  neutral: {
    classes: 'bg-secondary-subtle text-secondary-emphasis border-secondary-subtle',
    icon: 'bi-clock',
  },
  warning: {
    classes: 'bg-warning-subtle text-warning-emphasis border-warning-subtle',
    icon: 'bi-exclamation-triangle',
  },
  danger: {
    classes: 'bg-danger-subtle text-danger-emphasis border-danger-subtle',
    icon: 'bi-x-octagon',
  },
};

const style = computed(() => toneStyles[toneByStatus[props.status] ?? 'neutral']);
</script>

<template>
  <span class="badge rounded-pill border fw-medium" :class="style.classes">
    <i class="bi me-1" :class="style.icon" aria-hidden="true"></i>{{ status }}
  </span>
</template>
