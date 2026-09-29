<script setup lang="ts">
import NavbarComponent from './components/NavbarComponent.vue';
</script>

<template>
  <div class="d-flex flex-column min-vh-100">
    <NavbarComponent />
    <main class="flex-grow-1 overflow-auto">
      <router-view />
    </main>
  </div>
</template>
