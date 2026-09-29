<script setup lang="ts">
import { computed, inject } from 'vue';
import { useRoute } from 'vue-router';
import { dataLayerKey } from '../data/dataLayer';

// Minimal demo outbox for applicants (ADR-06). The coordinator outbox page is T49.
const dataLayer = inject(dataLayerKey)!;
const route = useRoute();

const recipient = computed(() => (typeof route.query.to === 'string' ? route.query.to.trim().toLowerCase() : ''));

const messages = computed(() => {
  const user = dataLayer.list('users').find((row) => row.email.toLowerCase() === recipient.value);
  if (!user) {
    return [];
  }
  return dataLayer
    .list('notifications')
    .filter((message) => message.channel === 'email' && message.recipient_user_id === user.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    // The link stays in the stored email; the outbox shows it as a button instead of raw text.
    .map((message) => ({
      id: message.id,
      subject: message.subject,
      body: message.body.replace(/:?\s*#\/auth\?\S+/, '.'),
      created_at: message.created_at,
      link: /#(\/auth\?\S+)/.exec(message.body)?.[1],
    }));
});
</script>

<template>
  <div class="container py-4">
    <h1>Demo outbox</h1>
    <p>Emails aren't sent in the demo. They appear here instead.</p>
    <p v-if="recipient">Messages to <strong>{{ recipient }}</strong></p>

    <p v-if="messages.length === 0">No messages yet.</p>
    <div v-for="message in messages" :key="message.id" class="card mb-3">
      <div class="card-body">
        <h2 class="h5 card-title">{{ message.subject }}</h2>
        <p class="small mb-2">{{ message.created_at.replace('T', ' ') }}</p>
        <p class="card-text text-break">{{ message.body }}</p>
        <router-link v-if="message.link" class="btn btn-outline-primary" :to="message.link">
          Open sign-in link
        </router-link>
      </div>
    </div>
  </div>
</template>
