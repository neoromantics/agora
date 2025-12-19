<script setup lang="ts">
// Comments page for a conversation

definePageMeta({
  layout: 'default'
})

const route = useRoute()
const conversationId = computed(() => route.params.id as string)

const { token } = useAuth()

// Fetch conversation to get title and public status
const { data: conversationData, error } = await useAsyncData(
  `conversation-comments-${conversationId.value}`,
  async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }

    const response = await $fetch<{
      data?: { conversation?: { id: string, title: string, isPublic: boolean, philosopher: { name: string, slug: string, portrait: string } } }
      errors?: { message: string }[]
    }>('/api/graphql', {
      method: 'POST',
      headers,
      body: {
        query: `query GetConversation($id: ID!) {
          conversation(id: $id) {
            id title isPublic
            philosopher { name slug portrait }
          }
        }`,
        variables: { id: conversationId.value }
      }
    })

    if (response.errors?.length) {
      throw createError({ statusCode: 500, message: response.errors[0]?.message })
    }

    if (!response.data?.conversation) {
      throw createError({ statusCode: 404, message: 'Conversation not found' })
    }

    return response.data.conversation
  }
)

if (error.value) {
  showError({
    statusCode: error.value.statusCode || 404,
    statusMessage: error.value.message || 'Conversation not found',
    fatal: true
  })
}

const conversation = computed(() => conversationData.value)
</script>

<template>
  <div class="min-h-screen bg-stone-50 dark:bg-stone-950">
    <UContainer class="py-8">
      <!-- Back Link -->
      <div class="mb-6">
        <UButton
          :to="`/conversation/${conversationId}`"
          variant="ghost"
          color="neutral"
          icon="i-lucide-arrow-left"
        >
          Back to Conversation
        </UButton>
      </div>

      <!-- Header -->
      <div
        v-if="conversation"
        class="mb-8"
      >
        <div class="flex items-center gap-4 mb-4">
          <NuxtLink :to="`/person/${conversation.philosopher.slug}`">
            <UAvatar
              :src="conversation.philosopher.portrait"
              :alt="conversation.philosopher.name"
              size="lg"
            />
          </NuxtLink>
          <div>
            <h1 class="text-2xl font-serif font-bold text-stone-900 dark:text-stone-100">
              {{ conversation.title }}
            </h1>
            <p class="text-stone-500">
              Conversation with {{ conversation.philosopher.name }}
            </p>
          </div>
        </div>
      </div>

      <!-- Comments Section -->
      <div
        v-if="conversation"
        class="bg-white dark:bg-stone-900 rounded-xl shadow-sm border border-stone-200 dark:border-stone-800 p-6"
      >
        <CommentSection
          :conversation-id="conversationId"
          :is-public="conversation.isPublic"
        />
      </div>
    </UContainer>
  </div>
</template>
