<script setup lang="ts">
import { inject, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { dataLayerKey } from '../data/dataLayer';
import { sessionKey } from '../session';

// Follows an applicant's magic link (ADR-05).
const dataLayer = inject(dataLayerKey)!;
const session = inject(sessionKey)!;
const route = useRoute();
const router = useRouter();

const error = ref('');
const email = ref('');

onMounted(() => {
  const token = typeof route.query.token === 'string' ? route.query.token : '';
  const result = dataLayer.signInWithLink(token);
  if (!result.ok) {
    error.value = result.reason;
    email.value = result.email ?? '';
    return;
  }
  session.value = result.user;
  router.replace(result.next);
});
</script>

<template>
  <div class="container py-4">
    <div class="row justify-content-center">
      <div class="col-md-6 col-lg-5">
        <h1>Signing you in</h1>
        <div v-if="error" class="alert alert-danger" role="alert">
          {{ error }}
          <div class="mt-2">
            <router-link :to="{ path: '/applicant/sign-in', query: email ? { email } : {} }">
              Request a new sign-in link
            </router-link>
          </div>
        </div>
        <p v-else>One moment…</p>
      </div>
    </div>
  </div>
</template>
