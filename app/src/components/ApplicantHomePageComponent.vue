<script setup lang="ts">
import { inject } from 'vue';
import { useRouter } from 'vue-router';
import { dataLayerKey } from '../data/dataLayer';
import { sessionKey } from '../session';

// Placeholder until the applicant intake and status pages are built (T30–T39).
const dataLayer = inject(dataLayerKey)!;
const session = inject(sessionKey)!;
const router = useRouter();

function signOut() {
  dataLayer.signOut();
  session.value = undefined;
  router.push('/applicant/sign-in');
}
</script>

<template>
  <div class="container py-4">
    <h1>Your application</h1>
    <p>Signed in as <strong>{{ session?.display_name }}</strong></p>
    <button type="button" class="btn btn-outline-primary" @click="signOut">Sign out</button>
  </div>
</template>
