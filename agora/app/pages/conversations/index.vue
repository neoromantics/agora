<script setup lang="ts">
// My Conversations - View and manage all your past conversations
import ConversationCard from '~/components/ConversationCard.vue'

interface Philosopher {
  id: string
  name: string
  slug: string
  era: string
  portrait: string
}

interface Conversation {
  id: string
  title: string
  summary: string | null
  isPublic: boolean
  viewCount: number
  createdAt: string
  updatedAt: string
  philosopher: Philosopher
  likeCount: number
  isLikedByMe: boolean
  forkCount: number
  isAnonymous: boolean
  user: {
    id: string
    name: string
    username: string
    avatar: string | null
  }
}

interface MyConversationsResponse {
  data?: {
    myConversations: Conversation[]
  }
  errors?: { message: string }[]
}

definePageMeta({
  middleware: 'auth'
})

const { token, initialize } = useAuth()
initialize() // Restore token immediately
const toast = useToast()

// Filter state
const filter = ref<'all' | 'public' | 'private'>('all')

// Delete confirmation
const showDeleteConfirm = ref(false)
const conversationToDelete = ref<Conversation | null>(null)
const isDeleting = ref(false)

// Fetch conversations
const { data: response, pending, refresh } = await useFetch<MyConversationsResponse>('/api/graphql', {
  method: 'POST',
  headers: computed(() => ({
    Authorization: `Bearer ${token.value}`
  })),
  body: {
    query: `
      query MyConversations {
        myConversations {
          id
          title
          summary
          isPublic
          viewCount
          createdAt
          updatedAt
          philosopher {
            id
            name
            slug
            era
            portrait
          }
          likeCount
          isLikedByMe
          forkCount
          isAnonymous
          user {
            id
            name
            username
            avatar
          }
        }
      }
    `
  }
})

const conversations = computed(() => {
  const all = response.value?.data?.myConversations || []
  if (filter.value === 'public') {
    return all.filter(c => c.isPublic)
  } else if (filter.value === 'private') {
    return all.filter(c => !c.isPublic)
  }
  return all
})

const publicCount = computed(() =>
  (response.value?.data?.myConversations || []).filter(c => c.isPublic).length
)

const privateCount = computed(() =>
  (response.value?.data?.myConversations || []).filter(c => !c.isPublic).length
)

// Open delete confirmation
function confirmDelete(conv: Conversation) {
  conversationToDelete.value = conv
  showDeleteConfirm.value = true
}

// Delete conversation
async function deleteConversation() {
  if (!conversationToDelete.value) return

  isDeleting.value = true
  try {
    await $fetch('/api/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.value}`
      },
      body: {
        query: `
          mutation DeleteConversation($conversationId: ID!) {
            deleteConversation(conversationId: $conversationId)
          }
        `,
        variables: { conversationId: conversationToDelete.value.id }
      }
    })

    toast.add({
      title: 'Conversation deleted',
      description: 'Your conversation has been permanently removed',
      color: 'success',
      icon: 'i-lucide-check'
    })

    // Feed cache invalidation removed

    await refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to delete conversation',
      color: 'error'
    })
  } finally {
    isDeleting.value = false
    showDeleteConfirm.value = false
    conversationToDelete.value = null
  }
}

useHead({
  title: 'My Conversations | Agora'
})
</script>

<template>
  <div class="min-h-screen bg-stone-50 dark:bg-stone-950">
    <UContainer class="py-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl md:text-4xl font-serif font-semibold text-stone-900 dark:text-stone-100 mb-2">
            My Conversations
          </h1>
          <p class="text-stone-600 dark:text-stone-400">
            Continue your philosophical dialogues
          </p>
        </div>

        <UButton
          to="/gallery"
          icon="i-lucide-plus"
          color="primary"
        >
          New Chat
        </UButton>
      </div>

      <!-- Filter Tabs -->
      <div class="flex gap-2 mb-6">
        <UButton
          :variant="filter === 'all' ? 'solid' : 'outline'"
          :color="filter === 'all' ? 'primary' : 'neutral'"
          size="sm"
          @click="filter = 'all'"
        >
          All ({{ response?.data?.myConversations?.length || 0 }})
        </UButton>
        <UButton
          :variant="filter === 'public' ? 'solid' : 'outline'"
          :color="filter === 'public' ? 'primary' : 'neutral'"
          size="sm"
          icon="i-lucide-globe"
          @click="filter = 'public'"
        >
          Public ({{ publicCount }})
        </UButton>
        <UButton
          :variant="filter === 'private' ? 'solid' : 'outline'"
          :color="filter === 'private' ? 'primary' : 'neutral'"
          size="sm"
          icon="i-lucide-lock"
          @click="filter = 'private'"
        >
          Private ({{ privateCount }})
        </UButton>
      </div>

      <!-- Loading State -->
      <div
        v-if="pending"
        class="flex justify-center py-20"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="w-10 h-10 animate-spin text-stone-400"
        />
      </div>

      <!-- Conversations List -->
      <div
        v-else-if="conversations.length > 0"
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
      >
        <ConversationCard
          v-for="conv in conversations"
          :key="conv.id"
          :conversation="conv"
          can-delete
          @delete="confirmDelete(conv)"
        />
      </div>

      <!-- Empty State -->
      <UCard
        v-else
        class="text-center py-16"
      >
        <UIcon
          name="i-lucide-inbox"
          class="w-16 h-16 mx-auto mb-4 text-stone-300 dark:text-stone-700"
        />
        <h3 class="text-xl font-serif text-stone-600 dark:text-stone-400 mb-2">
          No conversations yet
        </h3>
        <p class="text-stone-500 dark:text-stone-500 mb-6">
          Start your first philosophical dialogue
        </p>
        <UButton
          to="/gallery"
          icon="i-lucide-users"
          color="primary"
        >
          Visit Gallery
        </UButton>
      </UCard>

      <!-- Delete Confirmation Modal -->
      <UModal v-model:open="showDeleteConfirm">
        <template #content>
          <UCard>
            <div class="text-center">
              <UIcon
                name="i-lucide-trash-2"
                class="w-12 h-12 mx-auto mb-4 text-red-500"
              />
              <h3 class="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
                Delete Conversation?
              </h3>
              <p class="text-stone-600 dark:text-stone-400 mb-6">
                This will permanently delete the conversation and all its messages. This action cannot be undone.
              </p>
              <div class="flex justify-center gap-3">
                <UButton
                  variant="outline"
                  color="neutral"
                  @click="showDeleteConfirm = false"
                >
                  Cancel
                </UButton>
                <UButton
                  color="error"
                  :loading="isDeleting"
                  @click="deleteConversation"
                >
                  Delete
                </UButton>
              </div>
            </div>
          </UCard>
        </template>
      </UModal>
    </UContainer>
  </div>
</template>
