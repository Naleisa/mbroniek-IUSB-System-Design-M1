<script setup lang="ts">
import { inject, reactive, ref } from 'vue';
import { compressImage } from '../compressImage';
import { dataLayerKey } from '../data/dataLayer';
import { checkUploadFile, UPLOAD_TYPES, uploadDocument, whatYoullNeed, type UploadErrors } from '../data/intake';
import FormField from './FormField.vue';
import StatusBadge from './StatusBadge.vue';

// Intake step: add your documents (Scenario 1, step 4; R11, ADR-15). Each document saves on its own,
// so an interrupted upload loses only the one being added.
const dataLayer = inject(dataLayerKey)!;
const items = whatYoullNeed(dataLayer).upload;
const caregiverId = dataLayer.getSignedInUser()?.caregiver_id ?? '';

interface ItemForm {
  file: File | null;
  expirationDate: string;
  errors: UploadErrors;
  saving: boolean;
}
const forms = reactive<Record<string, ItemForm>>(
  Object.fromEntries(items.map((item) => [item.item_key, { file: null, expirationDate: '', errors: {}, saving: false }])),
);
// Bumped after each save so the saved-document details re-read from the data layer.
const saves = ref(0);

function status(itemKey: string): string {
  void saves.value;
  return (
    dataLayer.list('required_items').find((row) => row.caregiver_id === caregiverId && row.item_key === itemKey)
      ?.status ?? ''
  );
}

function latestDocument(itemKey: string) {
  void saves.value;
  return dataLayer
    .list('documents')
    .filter((row) => row.caregiver_id === caregiverId && row.item_key === itemKey)
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))[0];
}

function chooseFile(itemKey: string, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  const form = forms[itemKey];
  form.file = file;
  form.errors = { ...form.errors, file: file ? checkUploadFile(file.type, file.size) || undefined : undefined };
}

async function saveDocument(itemKey: string) {
  const form = forms[itemKey];
  if (!form.file) {
    form.errors = { ...form.errors, file: 'Choose a photo or file first.' };
    return;
  }
  const fileError = checkUploadFile(form.file.type, form.file.size);
  if (fileError) {
    form.errors = { ...form.errors, file: fileError };
    return;
  }
  form.saving = true;
  try {
    const { blob, name } = await compressImage(form.file);
    const user = dataLayer.getSignedInUser();
    const result = await uploadDocument(
      dataLayer,
      {
        itemKey,
        file: blob,
        fileName: name,
        originalType: form.file.type,
        originalSize: form.file.size,
        expirationDate: form.expirationDate,
      },
      { role: 'applicant', name: user?.display_name ?? 'Applicant' },
    );
    if (!result.ok) {
      form.errors = result.errors;
      return;
    }
    forms[itemKey] = { file: null, expirationDate: '', errors: {}, saving: false };
    saves.value += 1;
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
        <h1>Add your documents</h1>
        <p>
          Take a photo or choose a file for each one, and enter the expiration date shown on it. Each document saves
          on its own, so if you're interrupted, just add the rest when you're back.
        </p>

        <div v-for="item in items" :key="item.item_key" class="card mb-3">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <h2 class="h5 mb-1">{{ item.name }}</h2>
              <StatusBadge v-if="latestDocument(item.item_key)" :status="status(item.item_key)" />
            </div>
            <p v-if="latestDocument(item.item_key)" class="small mb-3">
              {{ latestDocument(item.item_key)!.file_name }} ·
              {{ UPLOAD_TYPES[latestDocument(item.item_key)!.file_type] ?? latestDocument(item.item_key)!.file_type }} ·
              expires {{ latestDocument(item.item_key)!.expiration_date }}
            </p>
            <p v-else class="small mb-3">{{ item.reason }}</p>

            <!-- Keyed by save count so the file picker clears after each save. -->
            <form
              v-if="status(item.item_key) === 'Pending'"
              :key="`${item.item_key}-${saves}`"
              novalidate
              @submit.prevent="saveDocument(item.item_key)"
            >
              <div class="mb-3">
                <label class="form-label" :for="`file-${item.item_key}`">
                  {{ latestDocument(item.item_key) ? 'Replace with a new photo or file' : 'Photo or file'
                  }}<span class="ms-1" aria-hidden="true">*</span>
                </label>
                <input
                  :id="`file-${item.item_key}`"
                  type="file"
                  class="form-control"
                  :class="{ 'is-invalid': forms[item.item_key].errors.file }"
                  accept="image/jpeg,image/png,application/pdf"
                  :aria-describedby="`file-${item.item_key}-help${forms[item.item_key].errors.file ? ` file-${item.item_key}-error` : ''}`"
                  @change="chooseFile(item.item_key, $event)"
                />
                <div :id="`file-${item.item_key}-help`" class="form-text">JPG, PNG, or PDF, up to 10 MB.</div>
                <div
                  v-if="forms[item.item_key].errors.file"
                  :id="`file-${item.item_key}-error`"
                  class="invalid-feedback"
                >
                  {{ forms[item.item_key].errors.file }}
                </div>
              </div>
              <FormField
                :id="`expires-${item.item_key}`"
                v-model="forms[item.item_key].expirationDate"
                label="Expiration date"
                type="date"
                required
                :error="forms[item.item_key].errors.expiration_date"
              />
              <button type="submit" class="btn btn-outline-primary w-100" :disabled="forms[item.item_key].saving">
                {{ forms[item.item_key].saving ? 'Saving…' : 'Save document' }}
              </button>
            </form>
          </div>
        </div>

        <!-- The consent steps (T35) come next; until then Continue goes to the applicant's home page. -->
        <router-link to="/applicant" class="btn btn-primary w-100">Continue</router-link>
        <router-link to="/applicant/intake/needed" class="btn btn-outline-primary w-100 mt-2">Back</router-link>
      </div>
    </div>
  </div>
</template>
