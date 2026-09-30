<script setup lang="ts">
import { inject } from 'vue';
import { dataLayerKey } from '../data/dataLayer';
import { whatYoullNeed } from '../data/intake';

// Intake step: what you'll need and why (Scenario 1, step 3; R18). Built from the requirement
// template (ADR-03), so a change to template_items.csv shows here with no code change.
const dataLayer = inject(dataLayerKey)!;
const needed = whatYoullNeed(dataLayer);
</script>

<template>
  <div class="container py-4">
    <div class="row justify-content-center">
      <div class="col-md-6 col-lg-5">
        <h1>What you'll need</h1>
        <div class="card">
          <div class="card-body">
            <p>Here's everything we need to finish your application, and why.</p>

            <h2 class="h5 mt-4">
              <i class="bi bi-camera me-2" aria-hidden="true"></i>You'll upload
            </h2>
            <p class="small">Have these ready. You'll take a photo of each one next.</p>
            <ul class="list-unstyled">
              <li v-for="item in needed.upload" :key="item.item_key" class="mb-3">
                <strong>{{ item.name }}</strong>
                <div>{{ item.reason }}</div>
              </li>
            </ul>

            <h2 class="h5 mt-4">
              <i class="bi bi-shield-check me-2" aria-hidden="true"></i>We'll check for you
            </h2>
            <p class="small">There's nothing to upload for these. We run them once you give permission.</p>
            <ul class="list-unstyled">
              <li v-for="item in needed.check" :key="item.item_key" class="mb-3">
                <strong>{{ item.name }}</strong>
                <div>{{ item.reason }}</div>
              </li>
            </ul>

            <router-link to="/applicant/intake/uploads" class="btn btn-primary w-100">Continue</router-link>
            <router-link to="/applicant/intake/identity" class="btn btn-outline-primary w-100 mt-2">Back</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
