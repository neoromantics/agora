<script setup lang="ts">
interface Philosopher {
  id: string
  name: string
  slug: string
  era: string
  years: string
  nationality: string
  biography: string
  portrait: string
}

const { data: response, pending, error } = await useFetch('/api/graphql', {
  method: 'POST',
  body: {
    query: `
      query GetPhilosophers {
        philosophers {
          id
          name
          slug
          portrait
          era
          years
          nationality
          biography

        }
      }
    `
  }
})

const philosophers = computed(() => {
  const result = response.value as { data?: { philosophers?: Philosopher[] } }
  return result?.data?.philosophers || []
})

// Search functionality
const searchQuery = ref('')

const filteredPhilosophers = computed(() => {
  if (!searchQuery.value.trim()) return philosophers.value

  const query = searchQuery.value.toLowerCase()
  return philosophers.value.filter(p =>
    p.name.toLowerCase().includes(query)
    || p.era.toLowerCase().includes(query)
    || p.nationality.toLowerCase().includes(query)
  )
})

definePageMeta({
  layout: 'default'
})
</script>

<template>
  <div class="py-12 bg-stone-50 dark:bg-stone-950 min-h-[calc(100vh-var(--header-height))]">
    <UContainer>
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-serif font-medium text-stone-900 dark:text-stone-100 mb-4">
          The Gallery of Minds
        </h1>
        <p class="max-w-2xl mx-auto text-lg text-stone-600 dark:text-stone-400 font-light">
          Engage with brilliant minds from history. Share your conversations with the community.
        </p>
      </div>

      <!-- Search Bar -->
      <div class="max-w-2xl mx-auto mb-8 flex gap-2">
        <UInput
          v-model="searchQuery"
          placeholder="Search by name, era, or nationality..."
          icon="i-lucide-search"
          size="lg"
          class="flex-1"
        >
          <template
            v-if="searchQuery"
            #trailing
          >
            <UButton
              color="neutral"
              variant="link"
              icon="i-lucide-x"
              size="xs"
              :padded="false"
              @click="searchQuery = ''"
            />
          </template>
        </UInput>
        <UButton
          label="Search"
          color="primary"
          size="lg"
          icon="i-lucide-search"
        />
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

      <!-- Error State -->
      <div
        v-else-if="error"
        class="text-center py-20 text-red-500"
      >
        <p>Unable to load the gallery. Please try again later.</p>
        <p class="text-sm mt-2 opacity-75">
          {{ error.message }}
        </p>
      </div>

      <!-- No Results -->
      <div
        v-else-if="filteredPhilosophers.length === 0"
        class="text-center py-20 text-stone-500"
      >
        <UIcon
          name="i-lucide-search-x"
          class="w-12 h-12 mx-auto mb-4 opacity-50"
        />
        <p>No thinkers found matching "{{ searchQuery }}"</p>
      </div>

      <!-- Gallery Grid -->
      <div
        v-else
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
      >
        <NuxtLink
          v-for="philosopher in filteredPhilosophers"

          :key="philosopher.id"
          :to="`/person/${philosopher.slug}`"
          class="block transition-transform hover:scale-[1.02]"
        >
          <UCard
            :ui="{
              body: 'flex flex-col items-center text-center gap-4 p-6'
            }"
          >
            <UAvatar
              :src="philosopher.portrait"
              :alt="philosopher.name"
              size="3xl"
              img-class="object-cover sepia-[0.15]"
            />

            <div class="space-y-3">
              <h3 class="text-xl font-serif font-semibold text-stone-900 dark:text-stone-100">
                {{ philosopher.name }}
              </h3>

              <UBadge
                color="neutral"
                variant="subtle"
                size="sm"
                class="uppercase tracking-wide"
              >
                {{ philosopher.years }}
              </UBadge>

              <p class="text-sm text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-3">
                {{ philosopher.biography }}
              </p>
            </div>

            <template #footer>
              <UButton
                :to="`/conversation/new?philosopher=${philosopher.slug}`"
                class="w-full"
                color="primary"
                icon="i-lucide-message-circle"
                @click.stop
              >
                Start Conversation
              </UButton>
            </template>
          </UCard>
        </NuxtLink>
      </div>
    </UContainer>
  </div>
</template>
