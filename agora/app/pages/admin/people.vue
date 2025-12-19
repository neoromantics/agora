<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'

definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

const toast = useToast()
const { token } = useAuth()

interface PhilosopherBasic {
  id: string
  name: string
  slug: string
  era: string
  portrait: string
  nationality: string
  years: string
  biography: string
  systemPrompt: string
  topics: string[]
  quotes: string[]
}

// --- Data Fetching ---
const { data: philosophers, refresh, status, error } = await useAsyncData('admin-philosophers', async () => {
  const { data } = await $fetch<{ data: { philosophers: PhilosopherBasic[] } }>('/api/graphql', {
    method: 'POST',
    headers: token.value ? { Authorization: `Bearer ${token.value}` } : undefined,
    body: {
      query: `
        query {
          philosophers {
            id
            name
            slug
            era
            years
            nationality
            biography
            systemPrompt
            portrait
            topics
            quotes
          }
        }
      `
    }
  })

  return data?.philosophers || []
})

// --- Search & Filtering ---
const searchQuery = ref('')
const filteredPhilosophers = computed(() => {
  if (!searchQuery.value) return philosophers.value || []
  const q = searchQuery.value.toLowerCase()
  return (philosophers.value || []).filter(p =>
    p.name.toLowerCase().includes(q)
    || p.slug.toLowerCase().includes(q)
    || p.era.toLowerCase().includes(q)
  )
})

// --- Schema & State ---
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  era: z.string().min(1, 'Era is required'),
  years: z.string().min(1, 'Years are required'),
  nationality: z.string().min(1, 'Nationality is required'),
  portrait: z.string().url('Must be a valid URL'),
  biography: z.string().min(10, 'Biography must be at least 10 characters'),
  systemPrompt: z.string().min(10, 'System prompt must be at least 10 characters'),
  topics: z.string(),
  quotes: z.string()
})

type Schema = z.output<typeof schema>

const isModalOpen = ref(false)
const isEditing = ref(false)
const editingId = ref('')
const loading = ref(false)

const formState = reactive({
  name: '',
  slug: '',
  era: '',
  years: '',
  nationality: '',
  portrait: '',
  biography: '',
  systemPrompt: '',
  topics: '',
  quotes: ''
})

function resetForm() {
  formState.name = ''
  formState.slug = ''
  formState.era = ''
  formState.years = ''
  formState.nationality = ''
  formState.portrait = ''
  formState.biography = ''
  formState.systemPrompt = ''
  formState.topics = ''
  formState.quotes = ''
}

function openCreate() {
  resetForm()
  isEditing.value = false
  editingId.value = ''
  isModalOpen.value = true
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function openEdit(phil: any) {
  formState.name = phil.name
  formState.slug = phil.slug
  formState.era = phil.era
  formState.years = phil.years
  formState.nationality = phil.nationality
  formState.portrait = phil.portrait
  formState.biography = phil.biography
  formState.systemPrompt = phil.systemPrompt || ''
  formState.topics = phil.topics ? phil.topics.join(', ') : ''
  formState.quotes = phil.quotes ? phil.quotes.join('\n') : ''

  isEditing.value = true
  editingId.value = phil.id
  isModalOpen.value = true
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  const data = event.data

  try {
    const input = {
      name: data.name,
      slug: data.slug,
      era: data.era,
      years: data.years,
      nationality: data.nationality,
      portrait: data.portrait,
      biography: data.biography,
      systemPrompt: data.systemPrompt,
      topics: data.topics.split(',').map(t => t.trim()).filter(Boolean),
      quotes: data.quotes.split('\n').map(q => q.trim()).filter(Boolean)
    }

    const mutation = isEditing.value
      ? `
      mutation UpdatePhilosopher($id: ID!, $name: String, $slug: String, $era: String, $years: String, $nationality: String, $biography: String, $portrait: String, $systemPrompt: String, $topics: [String!], $quotes: [String!]) {
        updatePhilosopher(id: $id, name: $name, slug: $slug, era: $era, years: $years, nationality: $nationality, biography: $biography, portrait: $portrait, systemPrompt: $systemPrompt, topics: $topics, quotes: $quotes) {
          id
        }
      }
    `
      : `
      mutation CreatePhilosopher($name: String!, $slug: String!, $era: String!, $years: String!, $nationality: String!, $biography: String!, $portrait: String!, $systemPrompt: String!, $topics: [String!]!, $quotes: [String!]!) {
          createPhilosopher(name: $name, slug: $slug, era: $era, years: $years, nationality: $nationality, biography: $biography, portrait: $portrait, systemPrompt: $systemPrompt, topics: $topics, quotes: $quotes) {
              id
          }
      }
    `
    const variables = isEditing.value ? { id: editingId.value, ...input } : input

    const { errors } = await $fetch<{ data?: unknown, errors?: { message: string }[] }>('/api/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${useAuth().token.value}` },
      body: {
        query: mutation,
        variables
      }
    })

    if (errors && errors.length > 0) throw new Error(errors[0]!.message)

    toast.add({ title: isEditing.value ? 'Thinker updated' : 'Thinker created', color: 'success' })

    isModalOpen.value = false
    refresh()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    toast.add({ title: 'Failed to save', description: message, color: 'error' })
  } finally {
    loading.value = false
  }
}

const showDeleteModal = ref(false)
const selectedPhilId = ref('')

function confirmDelete(id: string) {
  selectedPhilId.value = id
  showDeleteModal.value = true
}

async function executeDelete() {
  if (!selectedPhilId.value) return
  showDeleteModal.value = false

  try {
    const { errors } = await $fetch<{ errors?: { message: string }[] }>('/api/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${useAuth().token.value}` },
      body: {
        query: `mutation DeletePhil($id: ID!) { deletePhilosopher(id: $id) }`,
        variables: { id: selectedPhilId.value }
      }
    })
    if (errors && errors.length > 0) throw new Error(errors[0]!.message)
    refresh()
    toast.add({ title: 'Deleted', color: 'success' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    toast.add({ title: 'Error', description: message, color: 'error' })
  } finally {
    selectedPhilId.value = ''
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
          Thinkers
        </h1>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Manage the AI personas available for conversation
        </p>
      </div>
      <div class="flex gap-2 w-full sm:w-auto">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Search thinkers..."
          size="sm"
          class="min-w-[200px] flex-1 sm:flex-initial"
        />
        <UButton
          label="New Thinker"
          icon="i-lucide-plus"
          color="primary"
          size="sm"
          @click="openCreate"
        />
      </div>
    </div>

    <!-- Grid -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6">
      <div
        v-for="phil in filteredPhilosophers"
        :key="phil.id"
        class="group relative bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden hover:shadow-lg hover:border-stone-300 dark:hover:border-stone-700 transition-all duration-300 cursor-pointer"
        @click="openEdit(phil)"
      >
        <!-- Image & Actions -->
        <div class="aspect-[4/5] relative overflow-hidden bg-stone-100 dark:bg-stone-800">
          <NuxtImg
            :src="phil.portrait"
            :alt="phil.name"
            width="300"
            height="375"
            fit="cover"
            class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
          />
          <!-- Delete Action (Overlay) -->
          <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <UButton
              icon="i-lucide-trash"
              color="error"
              variant="solid"
              size="xs"
              @click.stop="confirmDelete(phil.id)"
            />
          </div>
          <!-- Gradient Overlay for aesthetics -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 pointer-events-none">
            <!-- Content removed, just gradient now -->
          </div>
        </div>

        <!-- Info -->
        <div class="p-4">
          <h3 class="font-serif font-bold text-lg text-stone-900 dark:text-stone-100 truncate">
            {{ phil.name }}
          </h3>
          <p class="text-xs text-stone-500 dark:text-stone-400 uppercase tracking-wide mt-1">
            {{ phil.era }}
          </p>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="!status && (filteredPhilosophers.length === 0 || error)"
      class="text-center py-12 text-stone-500"
    >
      <div
        v-if="error"
        class="text-red-500 mb-2"
      >
        Error loading thinkers: {{ error.message }}
      </div>
      <div v-else>
        No thinkers found matching "{{ searchQuery }}"
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <UModal
      v-model:open="isModalOpen"
      :ui="{ width: 'sm:max-w-4xl' } as any"
    >
      <template #content>
        <UCard
          class="ring-1 ring-stone-200/50 dark:ring-stone-700/50 divide-y divide-stone-100 dark:divide-stone-800 bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl shadow-2xl rounded-2xl"
          :ui="{ body: 'p-0 sm:p-0', header: 'px-6 py-4 sm:px-6', footer: 'px-6 py-4 sm:px-6' }"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                {{ editingId ? 'Edit Thinker' : 'New Thinker' }}
              </h3>
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                class="-my-1"
                @click="isModalOpen = false"
              />
            </div>
          </template>

          <UForm
            :schema="schema"
            :state="formState"
            class="space-y-6 p-6 max-h-[70vh] overflow-y-auto"
            @submit="onSubmit"
          >
            <!-- Identity -->
            <div class="space-y-4">
              <h4 class="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <UIcon
                  name="i-lucide-user"
                  class="w-4 h-4"
                />
                Identity
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField
                  label="Name"
                  name="name"
                  required
                >
                  <UInput
                    v-model="formState.name"
                    placeholder="e.g. Socrates"
                    icon="i-lucide-user"
                  />
                </UFormField>
                <UFormField
                  label="Slug"
                  name="slug"
                  required
                >
                  <UInput
                    v-model="formState.slug"
                    placeholder="e.g. socrates"
                    icon="i-lucide-link"
                  >
                    <template #leading>
                      <span class="text-stone-400">/</span>
                    </template>
                  </UInput>
                </UFormField>
                <UFormField
                  label="Portrait URL"
                  name="portrait"
                  class="md:col-span-2"
                >
                  <div class="flex gap-4 items-start">
                    <UAvatar
                      :src="formState.portrait"
                      :alt="formState.name"
                      size="xl"
                      class="ring-1 ring-stone-200 dark:ring-stone-800"
                    />
                    <UInput
                      v-model="formState.portrait"
                      placeholder="https://..."
                      icon="i-lucide-image"
                      class="flex-1"
                    />
                  </div>
                </UFormField>
              </div>
            </div>

            <UDivider />

            <!-- Context -->
            <div class="space-y-4">
              <h4 class="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <UIcon
                  name="i-lucide-hourglass"
                  class="w-4 h-4"
                />
                Context
              </h4>
              <div class="grid grid-cols-3 gap-4">
                <UFormField
                  label="Era"
                  name="era"
                >
                  <UInput
                    v-model="formState.era"
                    placeholder="e.g. Ancient"
                  />
                </UFormField>
                <UFormField
                  label="Years"
                  name="years"
                >
                  <UInput
                    v-model="formState.years"
                    placeholder="e.g. 500 BC"
                  />
                </UFormField>
                <UFormField
                  label="Nationality"
                  name="nationality"
                >
                  <UInput
                    v-model="formState.nationality"
                    placeholder="e.g. Greek"
                  />
                </UFormField>
              </div>
            </div>

            <UDivider />

            <!-- Content -->
            <div class="space-y-4">
              <h4 class="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <UIcon
                  name="i-lucide-book-open"
                  class="w-4 h-4"
                />
                Content
              </h4>
              <UFormField
                label="Biography"
                name="biography"
              >
                <UTextarea
                  v-model="formState.biography"
                  :rows="3"
                />
              </UFormField>
              <UFormField
                label="Topics (comma separated)"
                name="topics"
              >
                <UInput
                  v-model="formState.topics"
                  placeholder="Logic, Ethics..."
                />
              </UFormField>
              <UFormField
                label="Quotes (one per line)"
                name="quotes"
              >
                <UTextarea
                  v-model="formState.quotes"
                  :rows="4"
                />
              </UFormField>
            </div>

            <UDivider />

            <!-- AI Config -->
            <div class="space-y-4">
              <h4 class="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <UIcon
                  name="i-lucide-cpu"
                  class="w-4 h-4"
                />
                AI Configuration
              </h4>
              <UFormField
                label="System Prompt"
                description="The core personality instructions"
                name="systemPrompt"
              >
                <UTextarea
                  v-model="formState.systemPrompt"
                  :rows="8"
                  class="font-mono text-xs"
                />
              </UFormField>
            </div>

            <div class="flex justify-end gap-3 border-t border-stone-100 dark:border-stone-800 pt-6">
              <UButton
                label="Cancel"
                color="neutral"
                variant="ghost"
                @click="isModalOpen = false"
              />
              <UButton
                type="submit"
                label="Save Thinker"
                color="primary"
                :loading="loading"
              />
            </div>
          </UForm>
        </UCard>
      </template>
    </UModal>

    <DeleteConfirmationModal
      v-if="showDeleteModal"
      v-model="showDeleteModal"
      item-type="Philosopher"
      @confirm="executeDelete"
    />
  </div>
</template>
