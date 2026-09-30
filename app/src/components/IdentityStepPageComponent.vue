<script setup lang="ts">
import { computed, inject, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { dataLayerKey } from '../data/dataLayer';
import {
  formatPhoneInput,
  formatSsnInput,
  PHONE_DIGITS,
  saveIdentityStep,
  SSN_DIGITS,
  type IdentityErrors,
  type IdentityFields,
} from '../data/intake';
import { sessionKey } from '../session';
import FormField from './FormField.vue';

// Intake step: identity and contact (Scenario 1, step 2). Saved progress is shown again after a reload (R8);
// the full SSN never comes back to the screen, only its last four (R5, ADR-11).
const dataLayer = inject(dataLayerKey)!;
const session = inject(sessionKey)!;
const router = useRouter();

const caregiver = computed(() => {
  const caregiverId = dataLayer.getSignedInUser()?.caregiver_id;
  return caregiverId ? dataLayer.get('caregivers', caregiverId) : undefined;
});

const saved = caregiver.value;
const fields = reactive<IdentityFields>({
  first_name: saved?.first_name ?? '',
  last_name: saved?.last_name ?? '',
  email: saved?.email ?? '',
  phone: saved?.phone ?? '',
  date_of_birth: saved?.date_of_birth ?? '',
  ssn: '',
});
const errors = ref<IdentityErrors>({});

// Phone and SSN take their shape as they're typed, so the expected format is obvious.
watch(
  () => fields.phone,
  (value) => {
    const formatted = formatPhoneInput(value);
    if (formatted !== value) {
      fields.phone = formatted;
    }
  },
);
watch(
  () => fields.ssn,
  (value) => {
    const formatted = formatSsnInput(value);
    if (formatted !== value) {
      fields.ssn = formatted;
    }
  },
);

const ssnOnFile = computed(() => caregiver.value?.ssn_last4 ?? '');

function saveAndContinue() {
  const result = saveIdentityStep(dataLayer, fields, {
    role: 'applicant',
    name: `${fields.first_name} ${fields.last_name}`.trim() || 'New applicant',
  });
  if (!result.ok) {
    errors.value = result.errors;
    return;
  }
  errors.value = {};
  session.value = dataLayer.getSignedInUser();
  // The "what you'll need" step comes next in T32; until then the applicant lands on their home page.
  router.push('/applicant');
}
</script>

<template>
  <div class="container py-4">
    <div class="row justify-content-center">
      <div class="col-md-6 col-lg-5">
        <h1>About you</h1>
        <div class="card">
          <div class="card-body">
            <p>We use this to confirm who you are and to reach you about your application.</p>
            <form novalidate @submit.prevent="saveAndContinue">
              <FormField
                id="first-name"
                v-model="fields.first_name"
                label="First name"
                autocomplete="given-name"
                required
                :error="errors.first_name"
              />
              <FormField
                id="last-name"
                v-model="fields.last_name"
                label="Last name"
                autocomplete="family-name"
                required
                :error="errors.last_name"
              />
              <FormField
                id="email"
                v-model="fields.email"
                label="Email"
                type="email"
                autocomplete="email"
                inputmode="email"
                required
                :error="errors.email"
              />
              <FormField
                id="phone"
                v-model="fields.phone"
                label="Mobile phone"
                type="tel"
                autocomplete="tel"
                inputmode="tel"
                placeholder="(574) 555-0142"
                :max-digits="PHONE_DIGITS"
                required
                :error="errors.phone"
              />
              <FormField
                id="date-of-birth"
                v-model="fields.date_of_birth"
                label="Date of birth"
                type="date"
                autocomplete="bday"
                required
                :error="errors.date_of_birth"
              />
              <FormField
                id="ssn"
                v-model="fields.ssn"
                label="Social Security number"
                autocomplete="off"
                inputmode="numeric"
                placeholder="900-12-3456"
                :max-digits="SSN_DIGITS"
                :required="!ssnOnFile"
                :help="ssnOnFile ? `SSN on file ending in ${ssnOnFile}. Leave this blank to keep it.` : ''"
                :error="errors.ssn"
              />
              <button type="submit" class="btn btn-primary w-100">Save and continue</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
