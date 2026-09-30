<script setup lang="ts">
import { inject, ref } from 'vue';
import { useRoute } from 'vue-router';
import { dataLayerKey } from '../data/dataLayer';
import { demoDataKey } from '../session';
import FormField from './FormField.vue';

const dataLayer = inject(dataLayerKey)!;
// On a first visit the applicant accounts are still loading; asking for a link waits for them.
const demoData = inject(demoDataKey)!;
const route = useRoute();

// An expired link sends the applicant here with their email filled in (T38).
const email = ref(typeof route.query.email === 'string' ? route.query.email : '');
const sentTo = ref('');

function requestLink() {
  if (demoData.loading) {
    return;
  }
  const next = typeof route.query.next === 'string' ? route.query.next : undefined;
  dataLayer.requestSignInLink(email.value, next);
  // Same message either way, so the page never reveals which emails have applications.
  sentTo.value = email.value.trim();
}
</script>

<template>
  <div class="container py-4">
    <div class="row justify-content-center">
      <div class="col-md-6 col-lg-5">
        <h1>Applicant sign-in</h1>
        <div class="card">
          <div class="card-body">
            <p>Enter the email you applied with. We'll send you a link to sign in. No password needed.</p>
            <form novalidate @submit.prevent="requestLink">
              <FormField id="applicant-email" v-model="email" label="Email" type="email" required />
              <button type="submit" class="btn btn-primary w-100" :disabled="demoData.loading">
                {{ demoData.loading ? 'Loading demo data…' : 'Email me a sign-in link' }}
              </button>
            </form>
            <div v-if="sentTo" class="alert alert-success mt-3 mb-0" role="status">
              If that email matches an application, we've sent a sign-in link.
              <div class="mt-2">
                <router-link :to="{ path: '/outbox', query: { to: sentTo } }">Open demo outbox</router-link>
              </div>
            </div>
          </div>
        </div>
        <p class="small mt-3">
          Agency staff? <router-link to="/sign-in">Coordinator sign-in</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
