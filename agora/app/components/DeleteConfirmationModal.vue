<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  itemType: string // e.g., "conversation", "user", "philosopher"
  itemName?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', val)
})

const isLoading = ref(false)

function handleConfirm() {
  isLoading.value = true
  emit('confirm')
}

// Reset loading when modal closes
watch(isOpen, (val) => {
  if (!val) isLoading.value = false
})
</script>

<template>
  <ActionModal
    v-model="isOpen"
    mode="confirm"
    :title="`Delete ${itemType}?`"
    :description="itemName ? `Are you sure you want to delete '${itemName}'? This action cannot be undone.` : `Are you sure you want to delete this ${itemType}? This action cannot be undone.`"
    confirm-label="Delete"
    cancel-label="Cancel"
    confirm-color="error"
    danger
    :loading="isLoading"
    @confirm="handleConfirm"
  />
</template>
