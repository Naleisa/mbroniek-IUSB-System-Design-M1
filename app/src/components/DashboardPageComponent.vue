<script setup lang="ts">
import { computed, inject } from 'vue';
import { useRouter } from 'vue-router';
import { dataLayerKey } from '../data/dataLayer';
import { sessionKey } from '../session';

// Placeholder until the coordinator dashboard is built (T41).
const dataLayer = inject(dataLayerKey)!;
const session = inject(sessionKey)!;
const router = useRouter();

const agencyName = computed(() =>
  session.value ? (dataLayer.get('agencies', session.value.agency_id)?.name ?? '') : '',
);

function signOut() {
  dataLayer.signOut();
  session.value = undefined;
  router.push('/sign-in');
}
</script>

<template>
  <div class="container py-4">
    <h1>Dashboard</h1>
    <p>
      Signed in as <strong>{{ session?.display_name }}</strong>
      <span v-if="agencyName"> · {{ agencyName }}</span>
    </p>
    <button type="button" class="btn btn-outline-primary" @click="signOut">Sign out</button>
  </div>
</template>
