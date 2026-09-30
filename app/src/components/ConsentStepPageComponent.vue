<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { consentWording, CONSENT_WORDING_VERSION } from '../data/consentWording';
import { dataLayerKey } from '../data/dataLayer';
import { currentConsent, declineAuthorization, recordConsent } from '../data/intake';
import type { ConsentType } from '../data/types';

// Intake steps: the background check disclosure and the authorization, each its own screen apart from
// the application (R3, ADR-16). Each answer is saved with the time and the wording version shown.
const dataLayer = inject(dataLayerKey)!;
const route = useRoute();
const router = useRouter();

const type = computed(() => route.meta.consentType as ConsentType);
const user = dataLayer.getSignedInUser();
const agencyName = user ? (dataLayer.get('agencies', user.agency_id)?.name ?? 'Your agency') : 'Your agency';
const wording = computed(() => consentWording(type.value, agencyName));

// Bumped after saving so the "accepted on" line re-reads from the data layer.
const saves = ref(0);
const accepted = computed(() => {
  void saves.value;
  const consent = currentConsent(dataLayer, type.value);
  return consent && consent.decision !== 'declined' ? consent : undefined;
});
// A declined authorization (R25): screening stops, the application is kept, and the agency is told.
const declined = computed(() => {
  void saves.value;
  const consent = currentConsent(dataLayer, type.value);
  return type.value === 'authorization' && consent?.decision === 'declined' ? consent : undefined;
});
const confirmingDecline = ref(false);
const error = ref('');
// Both screens share this component, so a message from one screen doesn't carry over to the other.
watch(type, () => {
  error.value = '';
  confirmingDecline.value = false;
});

function decline() {
  const result = declineAuthorization(dataLayer, { role: 'applicant', name: user?.display_name ?? 'Applicant' });
  if (!result.ok) {
    error.value = result.reason;
    return;
  }
  confirmingDecline.value = false;
  saves.value += 1;
}

const next = computed(() =>
  type.value === 'disclosure' ? '/applicant/intake/authorization' : '/applicant/intake/review',
);
const back = computed(() => (type.value === 'disclosure' ? '/applicant/intake/uploads' : '/applicant/intake/disclosure'));

function accept() {
  const result = recordConsent(
    dataLayer,
    type.value,
    type.value === 'disclosure' ? 'acknowledged' : 'granted',
    { role: 'applicant', name: user?.display_name ?? 'Applicant' },
  );
  if (!result.ok) {
    error.value = result.reason;
    return;
  }
  saves.value += 1;
  router.push(next.value);
}
</script>

<template>
  <div class="container py-4">
    <div class="row justify-content-center">
      <div class="col-md-6 col-lg-5">
        <h1>{{ wording.heading }}</h1>
        <div class="card">
          <div class="card-body">
            <p v-for="paragraph in wording.paragraphs" :key="paragraph">{{ paragraph }}</p>
            <p class="small text-body-secondary mb-3">
              Sample wording for this demo ({{ CONSENT_WORDING_VERSION }}). It would need legal review before real use.
            </p>

            <div v-if="error" class="alert alert-warning" role="alert">
              {{ error }}
              <router-link to="/applicant/intake/disclosure" class="alert-link">Go to the disclosure</router-link>
            </div>

            <template v-if="accepted">
              <p class="mb-3" role="status">
                <i class="bi bi-check-circle me-1" aria-hidden="true"></i>
                You {{ type === 'disclosure' ? 'read this' : 'gave your authorization' }} on
                {{ accepted.recorded_at.slice(0, 10) }}.
              </p>
              <router-link :to="next" class="btn btn-primary w-100">Continue</router-link>
            </template>
            <template v-else-if="declined">
              <p class="mb-3" role="status">
                You didn't authorize the background checks on {{ declined.recorded_at.slice(0, 10) }}. Your application
                is saved, and {{ agencyName }} has been told.
              </p>
              <button type="button" class="btn btn-outline-primary w-100" @click="accept">
                I've changed my mind and authorize
              </button>
            </template>
            <template v-else>
              <button type="button" class="btn btn-primary w-100" @click="accept">
                {{ type === 'disclosure' ? "I've read this" : 'I authorize these checks' }}
              </button>
              <template v-if="type === 'authorization'">
                <button
                  v-if="!confirmingDecline"
                  type="button"
                  class="btn btn-outline-primary w-100 mt-2"
                  @click="confirmingDecline = true"
                >
                  I don't authorize
                </button>
                <div v-else class="border rounded p-3 mt-2" role="alert">
                  <p class="mb-2">
                    If you don't authorize these checks, your screening will stop. Your application is kept, and
                    {{ agencyName }} will be told.
                  </p>
                  <button type="button" class="btn btn-outline-primary w-100" @click="decline">
                    Yes, I don't authorize
                  </button>
                  <button type="button" class="btn btn-outline-primary w-100 mt-2" @click="confirmingDecline = false">
                    Cancel
                  </button>
                </div>
              </template>
            </template>
            <router-link :to="back" class="btn btn-outline-primary w-100 mt-2">Back</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
