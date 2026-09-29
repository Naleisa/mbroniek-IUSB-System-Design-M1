<script setup lang="ts">
// Label above the field; required fields are marked with an asterisk (design system Section 6).
withDefaults(
  defineProps<{
    id: string;
    label: string;
    type?: string;
    required?: boolean;
  }>(),
  { type: 'text', required: false },
);

const model = defineModel<string>({ default: '' });
</script>

<template>
  <div class="mb-3">
    <label class="form-label" :for="id">
      {{ label }}<span v-if="required" class="ms-1" aria-hidden="true">*</span>
    </label>
    <input :id="id" v-model="model" class="form-control" :type="type" :required="required" />
  </div>
</template>
