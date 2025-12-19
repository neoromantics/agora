<script setup lang="ts">
import ConversationCard from '~/components/ConversationCard.vue'

import { formatMediumDate } from '~/utils/dateFormat'

const route = useRoute()
const username = route.params.username as string

definePageMeta({
  // Public page
})

interface User {
  id: string
  name: string
  username: string
  avatar: string | null
}

interface Philosopher {
  id: string
  name: string
  slug: string
  portrait: string
}

interface Conversation {
  id: string
  title: string
  summary: string | null
  viewCount: number
  createdAt: string
  likeCount: number
  isLikedByMe: boolean
  forkCount: number

  isAnonymous: boolean
  isPublic: boolean
  user: User | null
  philosopher: Philosopher
}

const { token, user: currentUser } = useAuth()
const { data: initialData, pending, error } = await useAsyncData(`user-${username}`, async () => {
  const query = `
    query GetUserProfile($username: String!) {
      user(username: $username) {
        id
        name
        username
        avatar
        bio
        conversationCount
        createdAt
      }
      userConversations(username: $username, limit: 50) {
        edges {
          id
          title
          summary
          viewCount
          createdAt
          likeCount
          isLikedByMe
          forkCount
          isAnonymous
          user {
            id
            username
            name
            avatar
          }
          philosopher {
            id
            name
            slug
            portrait
          }
        }
      }
    }
  `

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await $fetch<{ data: { user: any, userConversations: any } }>('/api/graphql', {
    method: 'POST',
    headers: token.value ? { Authorization: `Bearer ${token.value}` } : undefined,
    body: {
      query,
      variables: { username }
    }
  })

  return result.data
})
// State
const user = computed(() => initialData.value?.user)
const conversations = ref<Conversation[]>(initialData.value?.userConversations?.edges || [])

// Watch for initial data changes (needed for hydration/navigation)
watch(() => initialData.value, (newData) => {
  if (newData) {
    conversations.value = newData.userConversations?.edges || []
  }
})

const isOwner = computed(() => currentUser.value?.id === user.value?.id)

// Format date helper - using centralized utility
const formatDate = formatMediumDate

const showForkModal = ref(false)
const selectedConversation = ref<Conversation | null>(null)

function onFork(conversation: Conversation) {
  selectedConversation.value = conversation
  showForkModal.value = true
}
</script>

<template>
  <div class="min-h-screen bg-stone-50 dark:bg-stone-950">
    <!-- Loading/Error -->
    <div
      v-if="pending"
      class="flex justify-center py-20"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-10 h-10 animate-spin text-stone-400"
      />
    </div>
    <div
      v-else-if="error || !user"
      class="flex flex-col items-center py-20 text-stone-500"
    >
      <UIcon
        name="i-lucide-user-x"
        class="w-16 h-16 mb-4"
      />
      <h1 class="text-2xl font-serif text-stone-800 dark:text-stone-200 mb-2">
        User not found
      </h1>
      <p>The user '{{ username }}' could not be found.</p>
      <UButton
        to="/"
        variant="ghost"
        class="mt-4"
      >
        Return Home
      </UButton>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800">
        <UContainer class="py-12">
          <div class="flex flex-col md:flex-row items-center md:items-start gap-8">
            <img
              v-if="user.avatar"
              :src="user.avatar"
              :alt="user.name"
              loading="eager"
              class="w-32 h-32 rounded-full object-cover ring-4 ring-white dark:ring-stone-900 shadow-sm"
            >
            <span
              v-else
              class="w-32 h-32 rounded-full bg-stone-200 dark:bg-stone-800 ring-4 ring-white dark:ring-stone-900 shadow-sm flex items-center justify-center text-4xl text-stone-500"
            >
              <UIcon
                name="i-lucide-user"
                class="w-12 h-12"
              />
            </span>

            <div class="flex-1 text-center md:text-left">
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-1">
                <h1 class="text-3xl font-serif font-bold text-stone-900 dark:text-stone-100">
                  {{ user.name }}
                </h1>
                <UButton
                  v-if="isOwner"
                  to="/settings/profile"
                  icon="i-lucide-edit-2"
                  color="neutral"
                  variant="ghost"
                >
                  Edit Profile
                </UButton>
              </div>

              <p class="text-stone-500 dark:text-stone-400 font-medium mb-4">
                @{{ user.username }}
              </p>

              <p
                v-if="user.bio"
                class="text-stone-700 dark:text-stone-300 max-w-xl mx-auto md:mx-0 mb-6 leading-relaxed"
              >
                {{ user.bio }}
              </p>
              <p
                v-else
                class="text-stone-400 italic mb-6"
              >
                No bio provided.
              </p>

              <div class="flex flex-wrap justify-center md:justify-start gap-6 text-sm text-stone-500">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-message-square" />
                  <span class="font-medium text-stone-900 dark:text-stone-100">{{ user.conversationCount }}</span> Conversations
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-calendar" />
                  Joined {{ formatDate(user.createdAt) }}
                </div>
              </div>
            </div>
          </div>
        </UContainer>
      </div>

      <!-- Content -->
      <UContainer class="py-8">
        <h2 class="text-xl font-serif font-semibold text-stone-900 dark:text-stone-100 mb-6">
          Public Conversations
        </h2>

        <div
          v-if="conversations.length > 0"
          class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
        >
          <ConversationCard
            v-for="conv in conversations"
            :key="conv.id"
            :conversation="conv"
            @fork="onFork"
          />
          <!-- End of List -->          <div
            class="text-center py-8 text-stone-500 dark:text-stone-400 col-span-full"
          >
            End of conversations
          </div>
        </div>

        <div
          v-else
          class="text-center py-12 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800"
        >
          <UIcon
            name="i-lucide-message-square-dashed"
            class="w-12 h-12 text-stone-300 dark:text-stone-600 mb-3 mx-auto"
          />
          <p class="text-stone-500">
            No public conversations yet.
          </p>
        </div>
      </UContainer>

      <ForkConversationModal
        v-if="selectedConversation"
        v-model="showForkModal"
        :conversation="selectedConversation"
        @success="(id) => $router.push(`/conversation/${id}`)"
      />
    </template>
  </div>
</template>
