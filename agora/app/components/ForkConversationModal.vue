<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  conversation: {
    id: string
    title: string
    philosopher: {
      name: string
      portrait: string
    }
  }
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success', id: string): void
}>()

const { token } = useAuth()
const toast = useToast()
const router = useRouter()

const isOpen = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', val)
})

const forkTitle = ref('')
const isLoading = ref(false)

// Init title
watch(() => props.modelValue, (val) => {
  if (val) forkTitle.value = `Fork of ${props.conversation.title}`
})

async function handleFork() {
  if (!token.value) {
    router.push('/auth/login')
    return
  }

  isLoading.value = true
  try {
    const { data, errors } = await $fetch<{ data?: { forkConversation?: { id: string } }, errors?: Array<{ message: string }> }>('/api/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.value}` },
      body: {
        query: `mutation ForkConversation($id: ID!, $title: String) {
          forkConversation(conversationId: $id, title: $title) { id }
        }`,
        variables: {
          id: props.conversation.id,
          title: forkTitle.value
        }
      }
    })

    if (errors?.length) throw new Error(errors[0]?.message || 'Unknown error')
    if (!data?.forkConversation?.id) throw new Error('No ID returned')

    const newId = data!.forkConversation!.id
    emit('success', newId)

    toast.add({
      title: 'Conversation forked!',
      description: 'Your copy is private. You can make it public later.',
      color: 'success',
      icon: 'i-lucide-git-fork'
    })

    isOpen.value = false
    await navigateTo(`/conversation/${newId}`)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    toast.add({
      title: 'Fork failed',
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
    mode="confirm"
    title="Fork Conversation"
    description="Create your own copy of this dialogue"
    confirm-label="Fork Conversation"
    cancel-label="Cancel"
    confirm-color="primary"
    :loading="isLoading"
    @confirm="handleFork"
  >
    <div class="space-y-6 py-2 text-left">
      <!-- What you're forking -->
      <div class="flex items-center gap-4 bg-stone-50 dark:bg-stone-900/50 p-4 rounded-lg border border-stone-100 dark:border-stone-800">
        <UAvatar
          :src="conversation.philosopher.portrait"
          :alt="conversation.philosopher.name"
          size="lg"
          class="ring-2 ring-white dark:ring-stone-900 shadow-sm"
        />
        <div class="min-w-0">
          <p class="font-serif font-semibold text-stone-900 dark:text-stone-100 truncate">
            {{ conversation.title }}
          </p>
          <p class="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Originally with {{ conversation.philosopher.name }}
          </p>
        </div>
      </div>

      <!-- Title input -->
      <div class="space-y-1.5">
        <label class="text-sm font-medium text-stone-700 dark:text-stone-300">
          Title for your copy
        </label>
        <UInput
          v-model="forkTitle"
          placeholder="e.g. My thoughts on..."
          icon="i-lucide-type"
          size="md"
          autofocus
          @keydown.enter="handleFork"
        />
      </div>

      <!-- Info Grid -->
      <div class="grid grid-cols-2 gap-4">
        <div class="text-center p-3 rounded-lg bg-stone-50 dark:bg-stone-900/30">
          <UIcon
            name="i-lucide-lock"
            class="w-4 h-4 mx-auto mb-1 text-stone-400"
          />
          <span class="text-xs font-medium text-stone-600 dark:text-stone-300">Private Copy</span>
        </div>
        <div class="text-center p-3 rounded-lg bg-stone-50 dark:bg-stone-900/30">
          <UIcon
            name="i-lucide-history"
            class="w-4 h-4 mx-auto mb-1 text-stone-400"
          />
          <span class="text-xs font-medium text-stone-600 dark:text-stone-300">Retain History</span>
        </div>
      </div>
    </div>
  </ActionModal>
</template>
