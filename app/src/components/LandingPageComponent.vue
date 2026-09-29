<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();
</script>

<template>
  <div class="container py-4">
    <div v-if="route.query.reset === 'done'" class="alert alert-success" role="status">
      Demo data is back to its starting point.
    </div>
  </div>
</template>
