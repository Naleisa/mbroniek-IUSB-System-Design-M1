<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { dataLayerKey } from '../data/dataLayer';
import { intakeChecklist, submitIntake } from '../data/intake';

// Intake step: review and submit (R7, ADR-08). A complete intake moves to Intake Complete and the
// agency's coordinators are emailed; an incomplete one can't be submitted and says what's missing.
const dataLayer = inject(dataLayerKey)!;
const user = dataLayer.getSignedInUser();
const agencyName = user ? (dataLayer.get('agencies', user.agency_id)?.name ?? 'Your agency') : 'Your agency';

// Bumped after submitting so the checklist and record re-read from the data layer.
const submits = ref(0);
const checklist = computed(() => {
  void submits.value;
  return intakeChecklist(dataLayer);
});
const caregiver = computed(() => {
  void submits.value;
  return user?.caregiver_id ? dataLayer.get('caregivers', user.caregiver_id) : undefined;
});
const submitted = computed(() => caregiver.value && caregiver.value.lifecycle_state !== 'Intake In Progress');
const missing = ref<string[]>([]);

function submit() {
  const result = submitIntake(dataLayer, { role: 'applicant', name: user?.display_name ?? 'Applicant' });
  missing.value = result.ok ? [] : result.missing;
  submits.value += 1;
}
</script>

<template>
  <div class="container py-4">
    <div class="row justify-content-center">
      <div class="col-md-6 col-lg-5">
        <h1>Review and submit</h1>
        <div class="card">
          <div class="card-body">
            <template v-if="submitted">
              <p class="mb-3" role="status">
                <i class="bi bi-check-circle me-1" aria-hidden="true"></i>
                <strong>Your application was submitted on {{ caregiver!.state_changed_at.slice(0, 10) }}.</strong>
                {{ agencyName }} has been notified.
              </p>
              <!-- T39 turns the applicant page into the status page. -->
              <router-link to="/applicant" class="btn btn-primary w-100">Go to your application</router-link>
            </template>

            <template v-else>
              <p>Check that everything is here, then submit your application to {{ agencyName }}.</p>
              <ul class="list-unstyled mb-3">
                <li v-for="line in checklist" :key="line.key" class="d-flex gap-2 mb-2">
                  <i
                    class="bi mt-1"
                    :class="line.done ? 'bi-check-circle text-success-emphasis' : 'bi-exclamation-triangle text-warning-emphasis'"
                    aria-hidden="true"
                  ></i>
                  <div>
                    <div>
                      {{ line.label }}
                      <span class="visually-hidden">{{ line.done ? '(done)' : '(not done yet)' }}</span>
                    </div>
                    <router-link v-if="!line.done" :to="line.route" class="small">{{ line.todo }}</router-link>
                  </div>
                </li>
              </ul>

              <div v-if="missing.length" class="alert alert-warning" role="alert">
                <p class="mb-1">Your application can't be submitted yet:</p>
                <ul class="mb-0 ps-3">
                  <li v-for="item in missing" :key="item">{{ item }}</li>
                </ul>
              </div>

              <button type="button" class="btn btn-primary w-100" @click="submit">Submit my application</button>
              <router-link to="/applicant/intake/authorization" class="btn btn-outline-primary w-100 mt-2">
                Back
              </router-link>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
