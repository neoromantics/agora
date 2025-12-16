<script setup lang="ts">
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
  user: {
    id: string
    username: string
    name: string
    avatar: string | null
  } | null
  philosopher: {
    id: string
    name: string
    slug: string
    portrait: string
  }
}

interface Philosopher {
  id: string
  name: string
  slug: string
}

interface FeedResponse {
  data?: {
    feed: {
      edges: Conversation[]
      pageInfo: {
        hasNextPage: boolean
        endCursor: string | null
      }
    }
  }
}

interface PhilosophersResponse {
  data?: {
    philosophers: Philosopher[]
  }
}

// Feed is public - no auth required
definePageMeta({
  // No middleware - feed shows public conversations
})

const conversations = ref<Conversation[]>([])
// const cursor = ref<string | null>(null) // Removed pagination
// const hasMore = ref(true) // Removed pagination
const isLoading = ref(false)
const isInitialLoad = ref(true)

// Search and filter state
const searchQuery = ref('')
const selectedPhilosopher = ref<string | null>(null)
const philosophers = ref<Philosopher[]>([])

// Fetch philosophers for filter dropdown
async function fetchPhilosophers() {
  try {
    const response = await $fetch<PhilosophersResponse>('/api/graphql', {
      method: 'POST',
      body: {
        query: `
          query GetPhilosophers {
            philosophers {
              id
              name
              slug
            }
          }
        `
      }
    })
    if (response.data?.philosophers) {
      philosophers.value = response.data.philosophers
    }
  } catch (error) {
    // Log for debugging - non-critical failure
    if (import.meta.dev) console.warn('Failed to fetch philosophers:', error)
  }
}

// Fetch conversations - Fixed limit, no pagination
async function fetchFeed(reset = false) { // reset is effectively just "refresh" now
  if (isLoading.value) return

  if (reset) {
    conversations.value = []
    // cursor.value = null
    // hasMore.value = true
  }

  isLoading.value = true

  try {
    const response = await $fetch<FeedResponse>('/api/graphql', {
      method: 'POST',
      body: {
        query: `
          query Feed($limit: Int, $search: String, $philosopherSlug: String) {
            feed(limit: $limit, search: $search, philosopherSlug: $philosopherSlug) {
              edges {
                id
                title
                summary
                viewCount
                createdAt
                likeCount
                forkCount
                isAnonymous
                isLikedByMe
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
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        `,
        variables: {
          // cursor: cursor.value,
          limit: 50, // Fixed limit as requested
          search: searchQuery.value || null,
          philosopherSlug: selectedPhilosopher.value || null
        }
      }
    })

    if (response.data?.feed) {
      // Just replace or append? Since we removed pagination, we likely just want the top 50.
      // If we are "refreshing" (reset=true), we replace.
      // If we are just loading initially, we replace.
      conversations.value = response.data.feed.edges
      // cursor.value = response.data.feed.pageInfo.endCursor
      // hasMore.value = response.data.feed.pageInfo.hasNextPage
    }
  } catch (error) {
    // Log for debugging - non-critical failure
    if (import.meta.dev) console.warn('Failed to fetch feed:', error)
  } finally {
    isLoading.value = false
    isInitialLoad.value = false
  }
}

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    fetchFeed(true)
  }, 400)
}

// Filter by philosopher
function onPhilosopherChange() {
  fetchFeed(true)
}

// Clear all filters
function clearFilters() {
  searchQuery.value = ''
  selectedPhilosopher.value = null
  fetchFeed(true)
}

// Infinite scroll removed
// const canLoadMore = computed(() => hasMore.value && !isLoading.value)
// const { triggerRef: loadMoreTrigger } = useInfiniteScroll(
//   () => fetchFeed(),
//   { enabled: canLoadMore }
// )

// Load initial data
onMounted(() => {
  fetchPhilosophers()

  // No cached state to restore - fetch fresh
  fetchFeed(true)
})

const showForkModal = ref(false)
const selectedConversation = ref<Conversation | null>(null)

function onFork(conversation: Conversation) {
  selectedConversation.value = conversation
  showForkModal.value = true
}
</script>

<template>
  <div class="min-h-screen bg-stone-50 dark:bg-stone-950">
    <UContainer class="py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl md:text-4xl font-serif font-semibold text-stone-900 dark:text-stone-100 mb-2">
          Conversation Feed
        </h1>
        <p class="text-stone-600 dark:text-stone-400">
          Discover meaningful dialogues shared by the community
        </p>
      </div>

      <!-- Search & Filter -->
      <div class="mb-6 flex flex-col sm:flex-row gap-4">
        <UInput
          v-model="searchQuery"
          placeholder="Search conversations..."
          icon="i-lucide-search"
          class="flex-1"
          @input="onSearchInput"
        />
        <USelectMenu
          v-model="selectedPhilosopher"
          :items="[{ label: 'All Thinkers', value: null }, ...philosophers.map(p => ({ label: p.name, value: p.slug }))]"
          value-key="value"
          searchable
          searchable-placeholder="Search thinkers..."
          placeholder="Filter by thinker"
          class="w-full sm:w-64"
          @update:model-value="onPhilosopherChange"
        />
        <UButton
          v-if="searchQuery || selectedPhilosopher"
          variant="ghost"
          color="neutral"
          icon="i-lucide-x"
          @click="clearFilters"
        >
          Clear
        </UButton>
      </div>

      <!-- Loading State -->
      <div
        v-if="isInitialLoad"
        class="flex justify-center py-20"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="w-10 h-10 animate-spin text-stone-400"
        />
      </div>

      <!-- Feed -->
      <div
        v-else
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
      >
        <ConversationCard
          v-for="conv in conversations"
          :key="conv.id"
          :conversation="conv"
          @fork="onFork"
        />

        <!-- Infinite Scroll Removed -->
      </div>

      <!-- Empty State -->
      <div
        v-if="conversations.length === 0 && !isInitialLoad"
        class="text-center py-20"
      >
        <UIcon
          name="i-lucide-inbox"
          class="w-16 h-16 mx-auto mb-4 text-stone-300 dark:text-stone-700"
        />
        <h3 class="text-xl font-serif text-stone-600 dark:text-stone-400 mb-2">
          No conversations yet
        </h3>
        <p class="text-stone-500 dark:text-stone-500 mb-6">
          Be the first to share a conversation with the community
        </p>
        <UButton
          to="/gallery"
          icon="i-lucide-users"
        >
          Visit Gallery
        </UButton>
      </div>
    </UContainer>

    <ForkConversationModal
      v-if="selectedConversation"
      v-model="showForkModal"
      :conversation="selectedConversation"
      @success="(id) => $router.push(`/conversation/${id}`)"
    />
  </div>
</template>
```
