<script setup lang="ts">
// Individual Philosopher Page
const route = useRoute()
const slug = route.params.slug as string

interface Philosopher {
  id: string
  name: string
  slug: string
  era: string
  years: string
  nationality: string
  biography: string
  portrait: string
  topics: string[]
  quotes: string[]
  conversationCount: number
}

// Fetch philosopher from GraphQL
const { data: response, pending, error } = await useFetch('/api/graphql', {
  method: 'POST',
  body: {
    query: `
      query GetPhilosopher($slug: String!) {
        philosopher(slug: $slug) {
          id
          name
          slug
          portrait
          era
          years
          nationality
          biography

          topics
          quotes
          conversationCount
        }
      }
    `,
    variables: { slug }
  }
})

const philosopher = computed(() => {
  const result = response.value as { data?: { philosopher?: Philosopher } }
  return result?.data?.philosopher || null
})

// Use auth composable for proper auth state
useAuth()

// Start conversation
function startConversation() {
  // Allow unauthenticated users to start ephemeral conversation
  // Navigate to new conversation
  navigateTo(`/conversation/new?philosopher=${philosopher.value?.slug}`)
}

// Update page meta
useHead({
  title: () => `${philosopher.value?.name || 'Thinker'} | Agora`
})
</script>

<template>
  <div class="min-h-screen">
    <!-- Loading State -->
    <div
      v-if="pending"
      class="flex justify-center items-center min-h-screen"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-12 h-12 animate-spin text-stone-400"
      />
    </div>

    <!-- Error State -->
    <div
      v-else-if="error || !philosopher"
      class="flex flex-col justify-center items-center min-h-screen"
    >
      <h1 class="text-2xl font-serif text-stone-800 dark:text-stone-100 mb-4">
        Figure Not Found
      </h1>
      <UButton
        to="/gallery"
        icon="i-lucide-arrow-left"
      >
        Return to Gallery
      </UButton>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Hero Section -->
      <section class="relative py-16 px-6 bg-gradient-to-b from-stone-100 to-cream dark:from-stone-900 dark:to-stone-950">
        <div class="max-w-5xl mx-auto">
          <div class="flex flex-col md:flex-row gap-10 items-start">
            <!-- Portrait -->
            <div class="w-full md:w-1/3 flex-shrink-0">
              <div class="portrait-frame rounded-lg overflow-hidden">
                <img
                  :src="philosopher.portrait"
                  :alt="philosopher.name"
                  class="w-full aspect-[3/4] object-cover"
                >
              </div>
            </div>

            <!-- Info -->
            <div class="flex-1">
              <div class="text-sm uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
                {{ philosopher.era }} • {{ philosopher.years }}
              </div>

              <h1 class="text-3xl sm:text-4xl md:text-5xl font-serif font-semibold text-stone-800 dark:text-stone-100 mb-4">
                {{ philosopher.name }}
              </h1>

              <p class="text-stone-600 dark:text-stone-400 mb-6">
                {{ philosopher.nationality }} Thinker
              </p>

              <!-- Topics -->
              <div class="flex flex-wrap gap-2 mb-8">
                <UBadge
                  v-for="topic in philosopher.topics"
                  :key="topic"
                  color="primary"
                  variant="subtle"
                  size="md"
                >
                  {{ topic }}
                </UBadge>
              </div>

              <!-- Stats -->
              <div class="flex gap-6 mb-8 text-sm text-stone-500 dark:text-stone-400">
                <div class="flex items-center gap-2">
                  <UIcon
                    name="i-lucide-message-circle"
                    class="w-4 h-4"
                  />
                  <span>{{ philosopher.conversationCount }} conversations</span>
                </div>
              </div>

              <!-- CTA -->
              <UButton
                size="xl"
                color="primary"
                icon="i-lucide-message-square-plus"
                @click="startConversation"
              >
                Start Conversation
              </UButton>
            </div>
          </div>
        </div>
      </section>

      <!-- Biography -->
      <section class="py-16 px-6">
        <div class="max-w-3xl mx-auto">
          <h2 class="text-2xl font-serif font-medium text-stone-800 dark:text-stone-100 mb-6">
            Biography
          </h2>
          <div class="prose prose-stone dark:prose-invert prose-lg max-w-none">
            <p
              v-for="(paragraph, i) in philosopher.biography.split('\n\n')"
              :key="i"
              class="text-stone-600 dark:text-stone-400 leading-relaxed mb-4"
            >
              {{ paragraph }}
            </p>
          </div>
        </div>
      </section>

      <!-- Quotes -->
      <section class="py-16 px-6 bg-stone-50 dark:bg-stone-900/50">
        <div class="max-w-3xl mx-auto">
          <h2 class="text-2xl font-serif font-medium text-stone-800 dark:text-stone-100 mb-8 text-center">
            Notable Quotes
          </h2>

          <div class="space-y-6">
            <blockquote
              v-for="(quote, i) in philosopher.quotes"
              :key="i"
              class="text-xl font-serif italic text-stone-600 dark:text-stone-400 border-l-3 border-indigo-500 pl-6"
            >
              "{{ quote }}"
            </blockquote>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
