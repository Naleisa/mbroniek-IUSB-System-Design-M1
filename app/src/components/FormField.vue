<script setup lang="ts">
// Label above the field; required fields are marked with an asterisk (design system Section 6).
// Optional autocomplete and inputmode pick the right phone keyboard; an error shows under the field.
const props = withDefaults(
  defineProps<{
    id: string;
    label: string;
    type?: string;
    required?: boolean;
    autocomplete?: string;
    inputmode?: 'text' | 'email' | 'tel' | 'numeric' | 'decimal' | 'search' | 'url' | 'none';
    error?: string;
    help?: string;
  }>(),
  { type: 'text', required: false, autocomplete: undefined, inputmode: undefined, error: '', help: '' },
);

const model = defineModel<string>({ default: '' });
</script>

<template>
  <div class="mb-3">
    <label class="form-label" :for="id">
      {{ label }}<span v-if="required" class="ms-1" aria-hidden="true">*</span>
    </label>
    <input
      :id="id"
      v-model="model"
      class="form-control"
      :class="{ 'is-invalid': props.error }"
      :type="type"
      :required="required"
      :autocomplete="autocomplete"
      :inputmode="inputmode"
      :aria-invalid="props.error ? 'true' : undefined"
      :aria-describedby="[props.help ? `${id}-help` : '', props.error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined"
    />
    <div v-if="props.help" :id="`${id}-help`" class="form-text">{{ props.help }}</div>
    <div v-if="props.error" :id="`${id}-error`" class="invalid-feedback">{{ props.error }}</div>
  </div>
</template>
