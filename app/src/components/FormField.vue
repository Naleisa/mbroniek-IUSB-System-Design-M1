<script setup lang="ts">
// Label above the field; required fields are marked with an asterisk (design system Section 6).
// Optional autocomplete and inputmode pick the right phone keyboard; a placeholder shows an example
// of the format; an error shows under the field.
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
    placeholder?: string;
    /** For number fields: once this many digits are entered, further typed digits are blocked. */
    maxDigits?: number;
  }>(),
  {
    type: 'text',
    required: false,
    autocomplete: undefined,
    inputmode: undefined,
    error: '',
    help: '',
    placeholder: undefined,
    maxDigits: undefined,
  },
);

const model = defineModel<string>({ default: '' });

// Blocks a typed digit when the field is already full, unless some text is selected to replace.
// Pasted and autofilled values still go through, and the page trims them to size.
function blockExtraDigits(event: InputEvent) {
  const input = event.target as HTMLInputElement;
  const replacingSelection = input.selectionStart !== input.selectionEnd;
  if (
    props.maxDigits &&
    event.inputType === 'insertText' &&
    /\d/.test(event.data ?? '') &&
    !replacingSelection &&
    input.value.replace(/\D/g, '').length >= props.maxDigits
  ) {
    event.preventDefault();
  }
}
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
      :placeholder="placeholder"
      @beforeinput="blockExtraDigits"
      :aria-invalid="props.error ? 'true' : undefined"
      :aria-describedby="[props.help ? `${id}-help` : '', props.error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined"
    />
    <div v-if="props.help" :id="`${id}-help`" class="form-text">{{ props.help }}</div>
    <div v-if="props.error" :id="`${id}-error`" class="invalid-feedback">{{ props.error }}</div>
  </div>
</template>
