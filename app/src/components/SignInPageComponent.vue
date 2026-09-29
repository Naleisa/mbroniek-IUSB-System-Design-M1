<script setup lang="ts">
import { inject, ref } from 'vue';
import { useRouter } from 'vue-router';
import { dataLayerKey } from '../data/dataLayer';
import { sessionKey } from '../session';
import FormField from './FormField.vue';

const dataLayer = inject(dataLayerKey)!;
const session = inject(sessionKey)!;
const router = useRouter();

const email = ref('');
const password = ref('');
const error = ref('');

function signIn() {
  const user = dataLayer.signIn(email.value, password.value);
  if (!user) {
    error.value = "That email and password don't match a coordinator account. Please try again.";
    return;
  }
  error.value = '';
  session.value = user;
  router.push('/dashboard');
}
</script>

<template>
  <div class="container py-4">
    <div class="row justify-content-center">
      <div class="col-md-6 col-lg-5">
        <h1>Coordinator sign-in</h1>
        <div class="card">
          <div class="card-body">
            <form novalidate @submit.prevent="signIn">
              <FormField id="sign-in-email" v-model="email" label="Email" type="email" required />
              <FormField id="sign-in-password" v-model="password" label="Password" type="password" required />
              <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
              <button type="submit" class="btn btn-primary w-100">Sign in</button>
            </form>
          </div>
        </div>
        <p class="small mt-3 mb-1">Demo accounts (password <code>demo1234</code>):</p>
        <ul class="small">
          <li>dana.whitfield@hoosierhomecare.example</li>
          <li>marcus.lee@riverbendcaregivers.example</li>
        </ul>
        <p class="small">
          Applying for a job? <router-link to="/applicant/sign-in">Sign in with an email link</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
