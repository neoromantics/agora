<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  title: string
  description?: string
  mode?: 'confirm' | 'input'
  inputLabel?: string
  inputPlaceholder?: string
  inputValue?: string
  confirmLabel?: string
  confirmColor?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
  cancelLabel?: string
  loading?: boolean
  danger?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', value?: string): void
  (e: 'cancel'): void
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const textInput = ref(props.inputValue || '')

// Reset input when opening
watch(() => props.modelValue, (val) => {
  if (val) textInput.value = props.inputValue || ''
})

function handleConfirm() {
  if (props.mode === 'input' && !textInput.value.trim()) return
  emit('confirm', props.mode === 'input' ? textInput.value : undefined)
}
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <UCard
        class="ring-1 ring-stone-200/50 dark:ring-stone-700/50 divide-y divide-stone-100 dark:divide-stone-800 bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl shadow-2xl rounded-2xl"
        :ui="{ body: 'p-0 sm:p-0', header: 'p-0 sm:p-0', footer: 'p-0 sm:p-0' }"
      >
        <div class="p-6">
          <!-- Icon -->
          <div class="test-center flex justify-center mb-5">
            <div
              class="rounded-full p-3"
              :class="[
                danger ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
              ]"
            >
              <UIcon
                :name="danger ? 'i-lucide-alert-triangle' : (mode === 'input' ? 'i-lucide-pencil' : 'i-lucide-info')"
                class="w-6 h-6"
              />
            </div>
          </div>

          <!-- Content -->
          <div class="text-center mb-6">
            <h3 class="text-lg font-serif font-bold text-stone-900 dark:text-stone-100 mb-2">
              {{ title }}
            </h3>
            <p
              v-if="description"
              class="text-sm text-stone-500 dark:text-stone-400"
            >
              {{ description }}
            </p>
          </div>

          <!-- Custom Content Slot -->
          <slot />

          <!-- Input Mode -->
          <div
            v-if="mode === 'input'"
            class="mb-2"
          >
            <label
              v-if="inputLabel"
              class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5 text-left"
            >
              {{ inputLabel }}
            </label>
            <UInput
              v-model="textInput"
              :placeholder="inputPlaceholder"
              :color="danger ? 'neutral' : 'neutral'"
              autofocus
              @keydown.enter="handleConfirm"
            />
          </div>

          <!-- Actions -->
          <div class="grid grid-cols-2 gap-3 mt-6">
            <UButton
              block
              variant="ghost"
              color="neutral"
              @click="isOpen = false"
            >
              {{ cancelLabel || 'Cancel' }}
            </UButton>
            <UButton
              block
              :color="danger ? 'error' : (confirmColor || 'primary')"
              :loading="loading"
              @click="handleConfirm"
            >
              {{ confirmLabel || 'Confirm' }}
            </UButton>
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>
