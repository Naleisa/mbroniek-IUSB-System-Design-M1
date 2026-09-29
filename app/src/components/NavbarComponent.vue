<script setup lang="ts">
import logoUrl from '../assets/carematchlogo.png';
</script>

<template>
  <nav class="navbar sticky-top bg-white border-bottom px-3">
    <router-link class="navbar-brand py-2" to="/">
      <!-- 160 x 40 keeps the logo above its 120px minimum width without stretching it -->
      <img :src="logoUrl" alt="CareMatch" width="160" height="40" />
    </router-link>
  </nav>
</template>
