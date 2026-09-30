<script setup lang="ts">
import { inject, onBeforeUnmount, reactive, ref } from 'vue';
import { markUnreadable, verifyDocument, verifyManually } from '../data/checks';
import { dataLayerKey } from '../data/dataLayer';
import { UPLOAD_TYPES } from '../data/intake';
import type { RecordItem } from '../data/record';
import { formatLocalDateTime } from '../data/relativeDates';
import { sessionKey } from '../session';
import FormField from './FormField.vue';

// Document review on one item of the record view (T44): view the uploaded file, mark it verified or
// unreadable (R22), and verify a Manual Verification item by hand (R26, T64).
const props = defineProps<{ item: RecordItem }>();
const emit = defineEmits<{ changed: [] }>();

const dataLayer = inject(dataLayerKey)!;
const session = inject(sessionKey)!;
const actor = () => ({ role: 'coordinator' as const, name: session.value?.display_name ?? 'Coordinator' });
const today = formatLocalDateTime(dataLayer.today()).slice(0, 10);

const message = ref('');

// View document: a photo shows in the card; a PDF opens in a new tab. Seeded documents have no file.
const viewing = ref(false);
const fileUrl = ref('');
const fileMissing = ref(false);

async function toggleDocument() {
  viewing.value = !viewing.value;
  if (!viewing.value || fileUrl.value || fileMissing.value || !props.item.document) {
    return;
  }
  const stored = await dataLayer.getDocument(props.item.document.id);
  if (stored) {
    fileUrl.value = URL.createObjectURL(stored.file);
  } else {
    fileMissing.value = true;
  }
}

onBeforeUnmount(() => {
  if (fileUrl.value) {
    URL.revokeObjectURL(fileUrl.value);
  }
});

function done(result: { ok: true } | { ok: false; reason: string }) {
  message.value = result.ok ? '' : result.reason;
  if (result.ok) {
    emit('changed');
  }
}

function markVerified() {
  done(verifyDocument(dataLayer, props.item.id, actor()));
}

const confirmingUnreadable = ref(false);
function confirmUnreadable() {
  confirmingUnreadable.value = false;
  done(markUnreadable(dataLayer, props.item.id, actor()));
}

// Verify by hand (T64): a note of what was checked and a future expiration date.
const manual = reactive({ open: false, note: '', expirationDate: '' });
function openManual() {
  manual.open = true;
  manual.note = '';
  manual.expirationDate = props.item.expiration_date >= today ? props.item.expiration_date : '';
}
function saveManual() {
  const result = verifyManually(
    dataLayer,
    props.item.id,
    { note: manual.note, expirationDate: manual.expirationDate },
    actor(),
  );
  if (result.ok) {
    manual.open = false;
  }
  done(result);
}
</script>

<template>
  <div class="mt-3">
    <template v-if="item.document">
      <button
        type="button"
        class="btn btn-outline-primary btn-sm w-100"
        :aria-expanded="viewing"
        @click="toggleDocument"
      >
        <i class="bi bi-file-earmark-image me-1" aria-hidden="true"></i>{{ viewing ? 'Hide document' : 'View document' }}
      </button>
      <div v-if="viewing" class="border rounded p-2 mt-2 small">
        <p class="mb-2">
          {{ item.document.file_name }} · {{ UPLOAD_TYPES[item.document.file_type] ?? item.document.file_type }} ·
          expires {{ item.document.expiration_date }} · uploaded {{ item.document.uploaded_at.replace('T', ' ') }}
        </p>
        <p v-if="fileMissing" class="mb-0 text-body-secondary">Sample document: no image in the demo.</p>
        <template v-else-if="fileUrl">
          <img
            v-if="item.document.file_type.startsWith('image/')"
            :src="fileUrl"
            :alt="`${item.name}: ${item.document.file_name}`"
            class="img-fluid rounded border"
          />
          <a v-else :href="fileUrl" target="_blank" rel="noopener">Open the PDF</a>
        </template>
      </div>
    </template>

    <template v-if="item.reviewable">
      <button type="button" class="btn btn-outline-primary btn-sm w-100 mt-2" @click="markVerified">Mark verified</button>
      <button
        v-if="!confirmingUnreadable"
        type="button"
        class="btn btn-outline-primary btn-sm w-100 mt-2"
        @click="confirmingUnreadable = true"
      >
        Mark unreadable
      </button>
      <div v-else class="border rounded p-2 mt-2 small" role="alert">
        <p class="mb-2">This sends the item to Manual Verification, to be verified by hand.</p>
        <button type="button" class="btn btn-outline-primary btn-sm w-100" @click="confirmUnreadable">
          Yes, mark unreadable
        </button>
        <button type="button" class="btn btn-outline-primary btn-sm w-100 mt-2" @click="confirmingUnreadable = false">
          Cancel
        </button>
      </div>
    </template>

    <template v-if="item.canVerifyByHand">
      <button v-if="!manual.open" type="button" class="btn btn-outline-primary btn-sm w-100 mt-2" @click="openManual">
        Verify by hand
      </button>
      <form v-else class="border rounded p-2 mt-2" novalidate @submit.prevent="saveManual">
        <div class="mb-3">
          <label class="form-label small" :for="`note-${item.item_key}`">
            What did you check?<span class="ms-1" aria-hidden="true">*</span>
          </label>
          <textarea
            :id="`note-${item.item_key}`"
            v-model="manual.note"
            class="form-control form-control-sm"
            rows="2"
            required
          ></textarea>
        </div>
        <FormField
          :id="`manual-expires-${item.item_key}`"
          v-model="manual.expirationDate"
          label="Expiration date"
          type="date"
          :min="today"
          required
        />
        <button type="submit" class="btn btn-outline-primary btn-sm w-100">Save as verified</button>
        <button type="button" class="btn btn-outline-primary btn-sm w-100 mt-2" @click="manual.open = false">Cancel</button>
      </form>
    </template>

    <div v-if="message" class="alert alert-warning small mt-2 mb-0" role="alert">{{ message }}</div>
  </div>
</template>
