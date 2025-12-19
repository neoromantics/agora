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

const isInitialLoad = ref(true) // Deprecated really, but keeping for template compat if needed or mapping to status

// Search and filter state
const searchQuery = ref('')
const activeSearch = ref('') // Debounced
const selectedPhilosopher = ref<string | null>(null)
const philosophers = ref<Philosopher[]>([])

// Fetch philosophers for filter dropdown (Client-side is fine for this secondary data)
async function fetchPhilosophers() {
  try {
    const response = await $fetch<PhilosophersResponse>('/api/graphql', {
      method: 'POST',
      body: {
        query: `query GetPhilosophers { philosophers { id name slug } }`
      }
    })
    if (response.data?.philosophers) {
      philosophers.value = response.data.philosophers
    }
  } catch (error) {
    if (import.meta.dev) console.warn('Failed to fetch philosophers:', error)
  }
}

// Debounce Search
let searchTimeout: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    activeSearch.value = searchQuery.value
  }, 400)
}

function clearFilters() {
  searchQuery.value = '' // Reset
  activeSearch.value = ''
  selectedPhilosopher.value = null
  // No explicit fetch needed, watchers handle it
}

// SSR Feed Fetching
const { data: feedData, status } = await useFetch<FeedResponse>('/api/graphql', {
  method: 'POST',
  body: computed(() => ({
    query: `
      query Feed($limit: Int, $search: String, $philosopherSlug: String) {
        feed(limit: $limit, search: $search, philosopherSlug: $philosopherSlug) {
          edges {
            id title summary viewCount createdAt likeCount forkCount
            isAnonymous isLikedByMe
            user { id username name avatar }
            philosopher { id name slug portrait }
          }
        }
      }
    `,
    variables: {
      limit: 50,
      search: activeSearch.value || null,
      philosopherSlug: selectedPhilosopher.value || null
    }
  })),
  watch: [activeSearch, selectedPhilosopher]
})

const conversations = computed(() => feedData.value?.data?.feed?.edges || [])
const isLoading = computed(() => status.value === 'pending')

// Load initial secondary data
onMounted(() => {
  fetchPhilosophers()
  isInitialLoad.value = false
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
        v-if="isLoading && conversations.length === 0"
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
          v-for="(conv, index) in conversations"
          :key="conv.id"
          :conversation="conv"
          :preload-image="index < 6"
          @fork="onFork"
        />

        <!-- Infinite Scroll Removed -->
      </div>

      <!-- Empty State -->
      <div
        v-if="conversations.length === 0 && !isLoading"
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
