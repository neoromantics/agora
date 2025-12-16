<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  conversationId: string
  currentTitle: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success', newTitle: string): void
}>()

const { token } = useAuth()
const toast = useToast()

const isOpen = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', val)
})

const isLoading = ref(false)

async function handleRename(newTitle?: string) {
  if (!newTitle || !newTitle.trim() || newTitle === props.currentTitle) {
    isOpen.value = false
    return
  }

  isLoading.value = true
  try {
    const title = newTitle.trim()
    const { errors } = await $fetch<{ errors?: Array<{ message: string }> }>('/api/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.value}` },
      body: {
        query: `mutation UpdateTitle($id: ID!, $title: String!) {
          updateConversationTitle(conversationId: $id, title: $title) { id title }
        }`,
        variables: { id: props.conversationId, title }
      }
    })

    if (errors?.length) throw new Error(errors[0]?.message || 'Unknown error')

    emit('success', title)
    toast.add({ title: 'Title updated', color: 'success' })
    isOpen.value = false
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    toast.add({
      title: 'Failed to update title',
      description: message,
      color: 'error'
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <ActionModal
    v-model="isOpen"
    mode="input"
    title="Rename Conversation"
    description="Choose a new title for this conversation"
    input-label="Title"
    confirm-label="Save"
    cancel-label="Cancel"
    :input-value="currentTitle"
    :loading="isLoading"
    @confirm="handleRename"
  />
</template>
