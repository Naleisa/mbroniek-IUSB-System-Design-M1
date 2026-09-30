<script setup lang="ts">
import { computed, inject } from 'vue';
import { useRoute } from 'vue-router';
import { sessionKey } from '../session';

// Demo home page (T66): what CareMatch is and three ways in. "Try applying" names one fictional agency;
// it's the only place an agency is named publicly, an accepted demo-only exception to ADR-18 and C7.
const route = useRoute();
const session = inject(sessionKey)!;

const home = computed(() =>
  session.value?.role === 'coordinator'
    ? { to: '/dashboard', label: 'Go to your dashboard' }
    : session.value?.role === 'applicant'
      ? { to: '/applicant', label: 'Go to your application' }
      : undefined,
);

// The docs site is published alongside the app on GitHub Pages; it isn't served by the dev server.
const docsUrl = `${import.meta.env.BASE_URL}docs/`;
</script>

<template>
  <div class="container py-4">
    <div v-if="route.query.reset === 'done'" class="alert alert-success" role="status">
      Demo data is back to its starting point.
    </div>

    <div v-if="home" class="alert alert-secondary d-flex flex-wrap align-items-center justify-content-between gap-2" role="status">
      <span>You're signed in as <strong>{{ session?.display_name }}</strong>.</span>
      <router-link :to="home.to" class="btn btn-outline-primary btn-sm">{{ home.label }}</router-link>
    </div>

    <h1>CareMatch</h1>
    <p class="lead">Hire home-care aides faster, with every required check tracked and verified.</p>

    <div class="row g-3 mt-1">
      <div class="col-12 col-md-4">
        <article class="card h-100">
          <div class="card-body d-flex flex-column">
            <h2 class="h5">Apply to be a caregiver</h2>
            <p>Start an application on your phone. It takes a few minutes, and your progress is saved as you go.</p>
            <router-link to="/apply/hoosier-home-care" class="btn btn-primary w-100 mt-auto">Try applying</router-link>
            <p class="small text-body-secondary mt-2 mb-0">
              Demo shortcut to Hoosier Home Care, a fictional agency. Real applicants get their agency's own link.
            </p>
          </div>
        </article>
      </div>
      <div class="col-12 col-md-4">
        <article class="card h-100">
          <div class="card-body d-flex flex-column">
            <h2 class="h5">Continue an application</h2>
            <p>Already started or submitted? We'll email you a link to sign in. No password needed.</p>
            <router-link to="/applicant/sign-in" class="btn btn-outline-primary w-100 mt-auto">
              Applicant sign-in
            </router-link>
          </div>
        </article>
      </div>
      <div class="col-12 col-md-4">
        <article class="card h-100">
          <div class="card-body d-flex flex-column">
            <h2 class="h5">Agency staff</h2>
            <p>Review applicants, order checks, and keep every caregiver's credentials current.</p>
            <router-link to="/sign-in" class="btn btn-outline-primary w-100 mt-auto">Coordinator sign-in</router-link>
          </div>
        </article>
      </div>
    </div>

    <p class="small mt-4 mb-0">
      About this demo: all data is fictional and stays in your browser.
      <a :href="docsUrl">Read the project docs</a>
    </p>
  </div>
</template>
