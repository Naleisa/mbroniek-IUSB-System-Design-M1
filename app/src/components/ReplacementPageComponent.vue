<script setup lang="ts">
import { computed, inject, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { compressImage } from '../compressImage';
import { dataLayerKey } from '../data/dataLayer';
import { applicantStatus, checkExpirationDate, checkUploadFile, uploadReplacement, type UploadErrors } from '../data/intake';
import { formatLocalDateTime } from '../data/relativeDates';
import FormField from './FormField.vue';

// Upload a replacement the agency asked for (Scenario 3, step 5; R11, C6). The same format, size,
// and date rules as the first upload apply, and the new card must expire after the current one.
const dataLayer = inject(dataLayerKey)!;
const route = useRoute();
const router = useRouter();

const itemKey = computed(() => String(route.params.itemKey ?? ''));
const status = applicantStatus(dataLayer);
const item = computed(() => status?.items.find((entry) => entry.item_key === itemKey.value));
const currentExpiration = computed(
  () =>
    dataLayer
      .list('required_items')
      .find((row) => row.caregiver_id === dataLayer.getSignedInUser()?.caregiver_id && row.item_key === itemKey.value)
      ?.expiration_date ?? '',
);
const today = formatLocalDateTime(dataLayer.today()).slice(0, 10);

const form = reactive<{ file: File | null; expirationDate: string; errors: UploadErrors; saving: boolean }>({
  file: null,
  expirationDate: '',
  errors: {},
  saving: false,
});

function chooseFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  form.file = file;
  form.errors = { ...form.errors, file: file ? checkUploadFile(file.type, file.size) || undefined : undefined };
}

async function save() {
  if (!form.file) {
    form.errors = { ...form.errors, file: 'Choose a photo or file first.' };
    return;
  }
  const fileError = checkUploadFile(form.file.type, form.file.size);
  const dateError = checkExpirationDate(form.expirationDate.trim(), today);
  if (fileError || dateError) {
    form.errors = { file: fileError || undefined, expiration_date: dateError || undefined };
    return;
  }
  form.saving = true;
  try {
    const { blob, name } = await compressImage(form.file);
    const result = await uploadReplacement(
      dataLayer,
      {
        itemKey: itemKey.value,
        file: blob,
        fileName: name,
        originalType: form.file.type,
        originalSize: form.file.size,
        expirationDate: form.expirationDate,
      },
      { role: 'applicant', name: dataLayer.getSignedInUser()?.display_name ?? 'Applicant' },
    );
    if (!result.ok) {
      form.errors = result.errors;
      return;
    }
    router.push('/applicant');
  } catch {
    form.errors = { file: "We couldn't save this document. Please try again." };
  } finally {
    form.saving = false;
  }
}
</script>

<template>
  <div class="container py-4">
    <div class="row justify-content-center">
      <div class="col-md-6 col-lg-5">
        <h1>Upload a replacement</h1>

        <div v-if="!item?.replacement || item.replacement.status !== 'Requested'" class="alert alert-warning" role="alert">
          There's no replacement waiting for this item.
          <router-link to="/applicant" class="alert-link">Back to your application</router-link>
        </div>

        <div v-else class="card">
          <div class="card-body">
            <h2 class="h5">{{ item.name }}</h2>
            <p>
              {{ status?.agencyName }} needs a new one by <strong>{{ item.replacement.due_date }}</strong>. Your current
              one expires on {{ currentExpiration }}.
            </p>
            <form novalidate @submit.prevent="save">
              <div class="mb-3">
                <label class="form-label" for="replacement-file">
                  Photo or file<span class="ms-1" aria-hidden="true">*</span>
                </label>
                <input
                  id="replacement-file"
                  type="file"
                  aria-required="true"
                  class="form-control"
                  :class="{ 'is-invalid': form.errors.file }"
                  accept="image/jpeg,image/png,application/pdf"
                  :aria-describedby="`replacement-file-help${form.errors.file ? ' replacement-file-error' : ''}`"
                  @change="chooseFile"
                />
                <div id="replacement-file-help" class="form-text">JPG, PNG, or PDF, up to 10 MB.</div>
                <div v-if="form.errors.file" id="replacement-file-error" class="invalid-feedback">
                  {{ form.errors.file }}
                </div>
              </div>
              <FormField
                id="replacement-expires"
                v-model="form.expirationDate"
                label="Expiration date on the new one"
                type="date"
                :min="today"
                required
                :error="form.errors.expiration_date"
              />
              <button type="submit" class="btn btn-primary w-100" :disabled="form.saving">
                {{ form.saving ? 'Saving…' : 'Upload replacement' }}
              </button>
            </form>
            <router-link to="/applicant" class="btn btn-outline-primary w-100 mt-2">Back</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
