<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'

definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

const { token } = useAuth()
const toast = useToast()

interface AdminConversation {
  id: string
  title: string
  summary: string | null
  isPublic: boolean
  viewCount: number
  likeCount: number
  createdAt: string
  philosopher: {
    name: string
    portrait: string
  }
  user: {
    username: string
    name: string
    avatar: string
  } | null
}

// Fetch Data
const limit = ref(100)
const { data: conversations, refresh, status, error } = await useAsyncData('admin-conversations', async () => {
  const { data, errors } = await $fetch<{ data: { adminConversations: { edges: AdminConversation[] } }, errors?: { message: string }[] }>('/api/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.value}` },
    body: {
      query: `
        query AdminConversations($limit: Int) {
          adminConversations(limit: $limit) {
            edges {
              id
              title
              summary
              isPublic
              viewCount
              likeCount
              createdAt
              philosopher {
                name
                portrait
              }
              user {
                username
                name
                avatar
              }
            }
          }
        }
      `,
      variables: {
        limit: limit.value
      }
    }
  })

  if (errors?.length) throw new Error(errors[0]!.message)
  return data?.adminConversations?.edges || []
})

// --- Search (Client-side) ---
const searchQuery = ref('')
const filteredConversations = computed(() => {
  if (!searchQuery.value) return conversations.value || []
  const q = searchQuery.value.toLowerCase()
  return (conversations.value || []).filter(c =>
    c.title.toLowerCase().includes(q)
    || (c.summary && c.summary.toLowerCase().includes(q))
    || (c.user && c.user.username.toLowerCase().includes(q))
    || c.philosopher.name.toLowerCase().includes(q)
  )
})

// Delete
const showDeleteModal = ref(false)
const conversationToDelete = ref<AdminConversation | null>(null)
const isDeleting = ref(false)

function confirmDelete(conv: AdminConversation) {
  conversationToDelete.value = conv
  showDeleteModal.value = true
}

async function executeDelete() {
  if (!conversationToDelete.value) return
  isDeleting.value = true

  try {
    const { errors } = await $fetch<{ errors?: { message: string }[] }>('/api/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.value}` },
      body: {
        query: `
          mutation AdminDeleteConversation($id: ID!) {
            adminDeleteConversation(conversationId: $id)
          }
        `,
        variables: { id: conversationToDelete.value.id }
      }
    })

    if (errors?.length) throw new Error(errors[0]!.message)

    toast.add({ title: 'Conversation deleted', color: 'success' })
    refresh()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    toast.add({ title: 'Error', description: message, color: 'error' })
  } finally {
    isDeleting.value = false
    showDeleteModal.value = false
    conversationToDelete.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-serif font-medium text-stone-900 dark:text-stone-100">
          Conversations
        </h1>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Monitor and manage platform dialogues
        </p>
      </div>
      <div class="w-full sm:w-auto">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Search conversations..."
          size="sm"
          class="min-w-[250px] w-full"
        />
      </div>
    </div>

    <!-- Grid -->
    <ClientOnly>
      <div class="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        <div
          v-for="conv in filteredConversations"
          :key="conv.id"
          class="group relative bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden hover:shadow-lg hover:border-stone-300 dark:hover:border-stone-700 transition-all duration-all flex flex-col"
        >
          <!-- Header: Title & Status -->
          <div class="p-4 border-b border-stone-100 dark:border-stone-800/50 bg-stone-50/50 dark:bg-stone-800/20">
            <div class="flex justify-between items-start gap-2 mb-2">
              <UBadge
                :color="conv.isPublic ? 'primary' : 'neutral'"
                :variant="conv.isPublic ? 'subtle' : 'outline'"
                size="xs"
              >
                {{ conv.isPublic ? 'Public' : 'Private' }}
              </UBadge>
              <span class="text-xs text-stone-500">
                {{ formatDistanceToNow(new Date(conv.createdAt), { addSuffix: true }) }}
              </span>
            </div>
            <NuxtLink
              :to="`/conversation/${conv.id}`"
              class="font-medium text-stone-900 dark:text-stone-100 line-clamp-1 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              :title="conv.title"
            >
              {{ conv.title }}
            </NuxtLink>
            <p class="text-xs text-stone-500 mt-1 line-clamp-2 min-h-[2.5em]">
              {{ conv.summary || 'No summary available.' }}
            </p>
          </div>

          <!-- Participants -->
          <div class="p-4 flex items-center justify-between flex-1">
            <div class="flex items-center -space-x-2">
              <UAvatar
                v-if="conv.user"
                :src="conv.user.avatar"
                :alt="conv.user.name"
                size="sm"
                class="ring-2 ring-white dark:ring-stone-900"
                :ui="{ chip: { base: 'hidden' } } as any"
              />
              <UAvatar
                v-else
                icon="i-lucide-user"
                size="sm"
                class="ring-2 ring-white dark:ring-stone-900 bg-stone-100 dark:bg-stone-800"
              />

              <UAvatar
                :src="conv.philosopher.portrait"
                :alt="conv.philosopher.name"
                size="sm"
                class="ring-2 ring-white dark:ring-stone-900"
              />
            </div>
            <div class="text-xs text-stone-500 flex items-center gap-1">
              <span v-if="conv.user">{{ conv.user.username }}</span>
              <span
                v-else
                class="italic"
              >Anonymous</span>
              <span class="text-stone-300">with</span>
              <span>{{ conv.philosopher.name }}</span>
            </div>
          </div>

          <!-- Footer: Stats & Actions -->
          <div class="p-3 border-t border-stone-100 dark:border-stone-800 flex justify-between items-center bg-stone-50/30 dark:bg-stone-800/10">
            <div class="flex gap-3 text-xs text-stone-500">
              <span class="flex items-center gap-1">
                <UIcon
                  name="i-lucide-eye"
                  class="w-3 h-3"
                /> {{ conv.viewCount }}
              </span>
              <span class="flex items-center gap-1">
                <UIcon
                  name="i-lucide-heart"
                  class="w-3 h-3"
                /> {{ conv.likeCount }}
              </span>
            </div>
            <UButton
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              size="xs"
              @click="confirmDelete(conv)"
            />
          </div>
        </div>
      </div>
    </ClientOnly>

    <!-- Empty State -->
    <div
      v-if="!status && (filteredConversations.length === 0 || error)"
      class="text-center py-12 text-stone-500"
    >
      <div
        v-if="error"
        class="text-red-500 mb-2"
      >
        Error loading conversations: {{ error.message }}
      </div>
      <div v-else>
        No conversations found matching "{{ searchQuery }}"
      </div>
    </div>

    <!-- Delete Modal -->
    <UModal v-model:open="showDeleteModal">
      <template #content>
        <UCard>
          <div class="text-center p-4">
            <UIcon
              name="i-lucide-alert-triangle"
              class="w-12 h-12 mx-auto mb-4 text-amber-500"
            />
            <h3 class="text-lg font-bold text-stone-900 dark:text-stone-100 mb-2">
              Permanently Delete?
            </h3>
            <p class="text-stone-600 dark:text-stone-400 mb-6">
              This will permanently remove "{{ conversationToDelete?.title }}" and all its messages. This action cannot be undone.
            </p>
            <div class="flex justify-center gap-3">
              <UButton
                label="Cancel"
                color="neutral"
                variant="ghost"
                @click="showDeleteModal = false"
              />
              <UButton
                label="Delete Forever"
                color="error"
                :loading="isDeleting"
                @click="executeDelete"
              />
            </div>
          </div>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
