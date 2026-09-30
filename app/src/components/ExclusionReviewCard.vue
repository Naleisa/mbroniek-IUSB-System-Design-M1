<script setup lang="ts">
import { computed, inject, reactive, ref } from 'vue';
import { CONFIRMED_MATCH, POSSIBLE_MATCH, reviewExclusionMatch, type ExclusionDecision } from '../data/checks';
import { dataLayerKey } from '../data/dataLayer';
import type { CaregiverRecord } from '../data/record';
import { formatLocalDateTime } from '../data/relativeDates';
import { sessionKey } from '../session';
import FormField from './FormField.vue';

// Review Required (T46, R17, R19, C1): the coordinator compares the match with the caregiver's details
// and decides. Both choices look the same, so no outcome is suggested, and nothing happens automatically.
const props = defineProps<{ record: CaregiverRecord }>();
const emit = defineEmits<{ changed: [] }>();

const dataLayer = inject(dataLayerKey)!;
const session = inject(sessionKey)!;
const today = dataLayer.today();
const oneYearOut = formatLocalDateTime(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())).slice(0, 10);

const possible = computed(() => props.record.items.filter((item) => item.result === POSSIBLE_MATCH));
const confirmed = computed(() => props.record.items.filter((item) => item.result === CONFIRMED_MATCH));

const form = reactive<{ decision: ExclusionDecision | ''; note: string; expirationDate: string }>({
  decision: '',
  note: '',
  expirationDate: oneYearOut,
});
const message = ref('');

function choose(decision: ExclusionDecision) {
  form.decision = decision;
  form.note = '';
  form.expirationDate = oneYearOut;
  message.value = '';
}

function save() {
  if (!form.decision) {
    return;
  }
  const result = reviewExclusionMatch(
    dataLayer,
    props.record.id,
    form.decision,
    { note: form.note, expirationDate: form.expirationDate },
    { role: 'coordinator', name: session.value?.display_name ?? 'Coordinator' },
  );
  if (!result.ok) {
    message.value = result.reason;
    return;
  }
  form.decision = '';
  emit('changed');
}
</script>

<template>
  <div class="card mb-4 border-danger-subtle">
    <div class="card-body">
      <h2 class="h5">Review the exclusion match</h2>

      <template v-if="confirmed.length && !possible.length">
        <p v-for="item in confirmed" :key="item.item_key" class="mb-0" role="status">
          <strong>{{ item.name }}:</strong> {{ item.notes }}
        </p>
      </template>

      <template v-else>
        <p>
          An exclusion list returned a possible match. Compare it with {{ record.name }}'s details, then decide. Nothing
          moves on until you do.
        </p>
        <div v-for="item in possible" :key="item.item_key" class="border rounded p-2 mb-3 small">
          <strong>{{ item.name }}</strong>
          <dl class="row mb-0 mt-1">
            <dt class="col-5">Source</dt>
            <dd class="col-7">{{ item.source }}</dd>
            <dt class="col-5">Vendor note</dt>
            <dd class="col-7">{{ item.notes || '—' }}</dd>
            <dt class="col-5">Checked</dt>
            <dd class="col-7">{{ item.ordered_at ? item.ordered_at.replace('T', ' ') : '—' }}</dd>
            <dt class="col-5">Reference</dt>
            <dd class="col-7">{{ item.evidence || '—' }}</dd>
          </dl>
        </div>
        <dl class="row small mb-3">
          <dt class="col-5">Caregiver</dt>
          <dd class="col-7">{{ record.name }}</dd>
          <dt class="col-5">Date of birth</dt>
          <dd class="col-7">{{ record.dateOfBirth || '—' }}</dd>
        </dl>

        <div v-if="!form.decision" class="d-grid gap-2">
          <button type="button" class="btn btn-outline-primary" @click="choose('not-a-match')">It's not a match</button>
          <button type="button" class="btn btn-outline-primary" @click="choose('confirm-match')">Confirm the match</button>
        </div>

        <form v-else class="border rounded p-3" novalidate @submit.prevent="save">
          <p class="mb-2">
            <strong>{{ form.decision === 'not-a-match' ? "It's not a match" : 'Confirm the match' }}</strong>
          </p>
          <div class="mb-3">
            <label class="form-label" for="review-note">
              {{
                form.decision === 'not-a-match'
                  ? "How did you confirm it's not a match?"
                  : 'Why are you confirming the match?'
              }}<span class="ms-1" aria-hidden="true">*</span>
            </label>
            <textarea id="review-note" v-model="form.note" class="form-control" rows="3" required></textarea>
          </div>
          <FormField
            v-if="form.decision === 'not-a-match'"
            id="review-expires"
            v-model="form.expirationDate"
            label="Expiration date for the exclusion check"
            type="date"
            required
          />
          <p class="small">
            {{
              form.decision === 'not-a-match'
                ? 'This sends the record back to Screening In Progress and marks the exclusion check verified by hand.'
                : 'The record stays in Review Required and cannot be cleared.'
            }}
          </p>
          <button type="submit" class="btn btn-outline-primary w-100">Save decision</button>
          <button type="button" class="btn btn-outline-primary w-100 mt-2" @click="form.decision = ''">Cancel</button>
        </form>

        <div v-if="message" class="alert alert-warning mt-3 mb-0" role="alert">{{ message }}</div>
      </template>
    </div>
  </div>
</template>
