<script setup lang="ts">
import { io, type Socket } from 'socket.io-client'
import { formatTime as formatTimeUtil } from '~/utils/dateFormat'

definePageMeta({
  layout: 'blank'
})

// Conversation Page - Chat interface with philosopher

// Auth & Router
const { token, user: currentUser } = useAuth()
const router = useRouter()
const toast = useToast()
const route = useRoute()

// Reactive ID
const conversationId = computed(() => route.params.id as string)
const isNewConversation = computed(() => conversationId.value === 'new')
const isEphemeral = computed(() => isNewConversation.value && !token.value)
const philosopherSlug = route.query.philosopher as string

// Refs
const socket = ref<Socket | null>(null)
const messagesContainer = ref<HTMLElement | null>(null)
const showForkModal = ref(false)
const newMessage = ref('')
const isSending = ref(false)

// Interfaces
interface Philosopher {
  id: string
  name: string
  slug: string
  era: string
  portrait: string
}

interface Message {
  id: string
  role: string
  content: string
  createdAt: string
}

interface Conversation {
  id: string
  title: string
  isPublic: boolean
  isAnonymous: boolean
  createdAt: string
  forkCount: number
  userId?: string
  user?: {
    id: string
    name: string
    username: string
    avatar?: string
  }
  forkedFrom?: {
    id: string
    title: string
    user: {
      name: string
    }
  } | null
  messages: Message[]
  philosopher: Philosopher
  likeCount: number
  isLikedByMe: boolean
  commentCount?: number
}

// Helpers
const emptyPhilosopher: Philosopher = { id: '', name: '', slug: '', era: '', portrait: '' }
const createEmptyConversation = (): Conversation => ({
  id: '',
  title: '',
  isPublic: false,
  isAnonymous: false,
  createdAt: '',
  forkCount: 0,
  likeCount: 0,
  isLikedByMe: false,
  commentCount: 0,
  messages: [],
  philosopher: { ...emptyPhilosopher }
})

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (token.value) {
    headers['Authorization'] = `Bearer ${token.value}`
  }
  return headers
}

// --- SSR Data Fetching with useAsyncData ---
const { data: fetchedData, status, error } = await useAsyncData(
  `conversation-${conversationId.value}`,
  async () => {
    // 1. New Conversation Mode
    if (isNewConversation.value) {
      if (!philosopherSlug) throw new Error('Philosopher slug required')

      const response = await $fetch<{ data?: { philosopher?: Philosopher }, errors?: Array<{ message: string }> }>('/api/graphql', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          ...useRequestHeaders(['cookie'])
        },
        body: {
          query: `query GetPhilosopher($slug: String!) {
            philosopher(slug: $slug) { id name slug era portrait }
          }`,
          variables: { slug: philosopherSlug }
        }
      })

      if (response.errors?.length) {
        throw createError({ statusCode: 500, message: response.errors[0]?.message })
      }

      if (!response.data?.philosopher) throw createError({ statusCode: 404, message: 'Philosopher not found' })

      const draft = createEmptyConversation()
      draft.philosopher = response.data.philosopher
      return { conversation: draft }
    }

    // 2. Existing Conversation Mode
    const response = await $fetch<{ data?: { conversation?: Conversation }, errors?: Array<{ message: string }> }>('/api/graphql', {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        ...useRequestHeaders(['cookie']) // Proxy cookies for SSR auth
      },
      body: {
        query: `query GetConversation($id: ID!) {
          conversation(id: $id) {
            id title isPublic isAnonymous createdAt forkCount commentCount
            user { id name username avatar }
            forkedFrom { id title user { name } }
            likeCount isLikedByMe
            philosopher { id name slug era portrait }
            messages { id role content createdAt }
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

    return { conversation: response.data.conversation }
  },
  {
    watch: [conversationId]
  }
)

// Handle 404s
if (error.value) {
  showError({
    statusCode: error.value.statusCode || 404,
    statusMessage: error.value.message || 'Conversation not found',
    fatal: true
  })
}

// Mutable State
const conversation = ref<Conversation>(createEmptyConversation())
const philosopher = computed(() => conversation.value.philosopher)
const isLoading = computed(() => status.value === 'pending')

// Computed user for display
const displayUser = computed(() => {
  if (conversation.value?.user) {
    return conversation.value.user
  }
  if (currentUser.value) {
    return {
      id: currentUser.value.id,
      name: currentUser.value.name,
      username: currentUser.value.username,
      avatar: currentUser.value.avatar || undefined
    }
  }
  return null
})

const displayUserName = computed(() => {
  if (!conversation.value.isAnonymous) {
    return conversation.value.user?.name || displayUser.value?.name
  }
  // If owner, show name (You)
  if (conversation.value.user?.id === currentUser.value?.id) {
    return `${conversation.value.user?.name || 'Unknown'} (You)`
  }
  return currentUser.value?.role === 'ADMIN'
    ? `${conversation.value.user?.name} (Anonymous)`
    : 'Anonymous'
})

// Actions
const isOwner = computed(() => {
  if (!currentUser.value || !conversation.value.id) return false
  // Check direct userId (if available) or nested user.id, OR if user is ADMIN
  return (conversation.value.userId === currentUser.value.id)
    || (conversation.value.user?.id === currentUser.value.id)
    || (currentUser.value.role === 'ADMIN')
})

async function toggleLike() {
  if (!conversation.value) return

  const isLiked = conversation.value.isLikedByMe
  conversation.value.isLikedByMe = !isLiked // Optimistic
  conversation.value.likeCount += isLiked ? -1 : 1

  try {
    await $fetch('/api/graphql', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: {
        query: `mutation ToggleLike($id: ID!) {
          ${isLiked ? 'unlikeConversation' : 'likeConversation'}(conversationId: $id) { id }
        }`,
        variables: { id: conversationId.value }
      }
    })
  } catch {
    conversation.value.isLikedByMe = isLiked
    conversation.value.likeCount += isLiked ? 1 : -1
  }
}

async function toggleAnonymous() {
  if (!conversation.value) return

  const newState = !conversation.value.isAnonymous
  conversation.value.isAnonymous = newState // Optimistic

  try {
    await $fetch('/api/graphql', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: {
        query: `mutation SetAnonymous($id: ID!, $isAnonymous: Boolean!) {
          setAnonymous(conversationId: $id, isAnonymous: $isAnonymous) { isAnonymous }
        }`,
        variables: { id: conversationId.value, isAnonymous: newState }
      }
    })

    toast.add({
      title: newState ? 'Anonymous mode enabled' : 'Anonymous mode disabled',
      color: 'neutral',
      icon: newState ? 'i-lucide-ghost' : 'i-lucide-user'
    })
  } catch {
    conversation.value.isAnonymous = !newState
    toast.add({ title: 'Error', description: 'Failed to update settings', color: 'error' })
  }
}

// Sync Watcher (Hydrate Mutable State)
watch(fetchedData, (newData) => {
  if (newData?.conversation) {
    conversation.value = JSON.parse(JSON.stringify(newData.conversation))
    if (import.meta.client) connectSocket()
  }
}, { immediate: true, deep: true })

// Socket & Scroll
function connectSocket() {
  if (socket.value) {
    socket.value.disconnect()
    socket.value = null
  }
  if (!conversation.value.id || isNewConversation.value) return

  socket.value = io({ path: '/agora/socket.io', transports: ['websocket'] })
  socket.value.on('connect', () => socket.value?.emit('join-conversation', conversation.value.id))
  socket.value.on('message:created', (message: Message) => {
    const isDuplicate = conversation.value.messages.some((m: Message) =>
      m.id === message.id || (m.content === message.content && m.role === message.role)
    )
    if (!isDuplicate) conversation.value.messages.push(message)
  })
}

watch(() => conversation.value.messages.length, (newLen: number, oldLen: number) => {
  const isBulkLoad = newLen - oldLen > 2
  scrollToBottom(!isBulkLoad)
})

function scrollToBottom(smooth = false) {
  if (import.meta.server) return
  if (messagesContainer.value) {
    requestAnimationFrame(() => {
      messagesContainer.value?.scrollTo({
        top: messagesContainer.value.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      })
    })
  }
}

// Edit Title
const showEditTitleModal = ref(false)

function openEditTitle() {
  if (!isOwner.value) return
  showEditTitleModal.value = true
}

// Send Message
async function sendMessage() {
  if (!newMessage.value.trim() || isSending.value) return

  const content = newMessage.value.trim()
  newMessage.value = ''
  isSending.value = true

  try {
    const optimisticMessage: Message = { id: `temp-${Date.now()}`, role: 'user', content, createdAt: new Date().toISOString() }
    conversation.value.messages.push(optimisticMessage)

    if (isEphemeral.value) {
      const history = conversation.value.messages.map(m => ({ role: m.role, content: m.content }))
      const response = await $fetch<{ data?: { chatEphemeral?: string }, errors?: Array<{ message: string }> }>('/api/graphql', {
        method: 'POST',
        body: {
          query: `mutation ChatEphemeral($philosopherId: ID!, $messages: [MessageInput!]!) {
            chatEphemeral(philosopherId: $philosopherId, messages: $messages)
          }`,
          variables: { philosopherId: philosopher.value?.id, messages: history }
        }
      })
      if (response.errors?.length) throw new Error(response.errors[0]?.message)
      if (response.data?.chatEphemeral) {
        conversation.value.messages.push({
          id: `bot-${Date.now()}`, role: 'philosopher', content: response.data.chatEphemeral, createdAt: new Date().toISOString()
        })
      }
      return
    }

    // Persistent Chat
    let wasCreated = false
    if (isNewConversation.value) {
      const createResponse = await $fetch<{ data?: { createConversation?: { id: string } }, errors?: Array<{ message: string }> }>('/api/graphql', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: {
          query: `mutation CreateConversation($philosopherId: ID!, $title: String!) {
            createConversation(philosopherId: $philosopherId, title: $title) { id }
          }`,
          variables: { philosopherId: philosopher.value?.id, title: `Conversation with ${philosopher.value?.name}` }
        }
      })
      if (createResponse.errors?.length) throw new Error(createResponse.errors[0]?.message)
      const newId = createResponse.data?.createConversation?.id
      if (newId) {
        // We cannot assign to the computed conversationId. We will navigate later.
        conversation.value.id = newId
        conversation.value.userId = currentUser.value?.id
        wasCreated = true
        // Note: We don't navigate yet, we wait for message send.
      } else {
        throw new Error('Failed to create conversation')
      }
    }

    const sendResponse = await $fetch<{ data?: { sendMessage?: { userMessage: Message, philosopherMessage: Message } }, errors?: Array<{ message: string }> }>('/api/graphql', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: {
        query: `mutation SendMessage($conversationId: ID!, $content: String!) {
          sendMessage(conversationId: $conversationId, content: $content) {
            userMessage { id role content createdAt }
            philosopherMessage { id role content createdAt }
          }
        }`,
        variables: { conversationId: conversation.value.id, content }
      }
    })

    if (sendResponse.errors?.length) throw new Error(sendResponse.errors[0]?.message)
    if (sendResponse.data?.sendMessage) {
      const { userMessage, philosopherMessage } = sendResponse.data.sendMessage
      const idx = conversation.value.messages.findIndex(m => m.id === optimisticMessage.id)
      if (idx !== -1) conversation.value.messages[idx] = userMessage
      if (!conversation.value.messages.find(m => m.id === philosopherMessage.id)) conversation.value.messages.push(philosopherMessage)

      if (wasCreated) {
        await router.replace(`/conversation/${conversation.value.id}`)
        connectSocket()
      }
    }
  } catch (e: unknown) {
    conversation.value.messages = conversation.value.messages.filter(m => !m.id.startsWith('temp-'))
    newMessage.value = content
    toast.add({ title: 'Failed to send message', description: (e as Error).message, color: 'error' })
  } finally {
    isSending.value = false
  }
}

async function togglePublic() {
  const newState = !conversation.value.isPublic
  conversation.value.isPublic = newState
  try {
    const response = await $fetch<{ data?: { togglePublic?: { isPublic: boolean } }, errors?: { message: string }[] }>('/api/graphql', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: {
        query: `mutation TogglePublic($id: ID!) { togglePublic(conversationId: $id) { isPublic } }`,
        variables: { id: conversationId.value }
      }
    })
    if (response.errors?.length) throw new Error(response.errors[0]?.message)
    if (response.data?.togglePublic?.isPublic !== undefined) conversation.value.isPublic = response.data.togglePublic.isPublic
    toast.add({
      title: newState ? 'Conversation shared!' : 'Conversation made private',
      color: newState ? 'success' : 'neutral',
      icon: newState ? 'i-lucide-globe' : 'i-lucide-lock'
    })
  } catch (e) {
    conversation.value.isPublic = !newState
    toast.add({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to update visibility', color: 'error' })
  }
}

const formatTime = formatTimeUtil

onUnmounted(() => socket.value?.disconnect())

// Delete Conversation
const showDeleteConfirm = ref(false)
const isDeleting = ref(false)

async function deleteConversation() {
  if (!conversation.value.id || isDeleting.value) return
  isDeleting.value = true
  try {
    const { errors } = await $fetch<{ errors?: { message: string }[] }>('/api/graphql', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: {
        query: `mutation DeleteConversation($conversationId: ID!) {
          deleteConversation(conversationId: $conversationId)
        }`,
        variables: { conversationId: conversation.value.id }
      }
    })
    if (errors?.length) throw new Error(errors[0]?.message)
    toast.add({ title: 'Conversation deleted', color: 'success' })
    navigateTo('/conversations')
  } catch (e) {
    toast.add({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to delete', color: 'error' })
  } finally {
    isDeleting.value = false
    showDeleteConfirm.value = false
  }
}
</script>

<template>
  <div>
    <!-- Loading State -->
    <div
      v-if="isLoading"
      class="h-screen flex items-center justify-center bg-cream dark:bg-stone-950"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-8 h-8 animate-spin text-stone-400"
      />
    </div>

    <!-- Conversation UI -->
    <div
      v-else-if="conversation.id || isNewConversation"
      class="h-screen flex flex-col"
    >
      <!-- Header -->
      <header class="sticky top-0 z-10 bg-cream/95 dark:bg-stone-950/95 backdrop-blur border-b border-stone-200 dark:border-stone-800 px-4 py-3">
        <div class="max-w-4xl mx-auto flex items-center justify-between">
          <div class="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              type="button"
              class="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 flex-shrink-0 transition-colors"
              @click="router.back()"
            >
              <UIcon
                name="i-lucide-arrow-left"
                class="w-5 h-5"
              />
            </button>

            <NuxtLink
              v-if="philosopher"
              :to="`/person/${philosopher.slug}`"
              class="flex items-center gap-2 sm:gap-3 min-w-0 hover:opacity-80 transition-opacity"
            >
              <img
                :src="philosopher.portrait"
                :alt="philosopher.name"
                class="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-stone-300 dark:border-stone-700 flex-shrink-0"
              >
              <div class="min-w-0">
                <h1 class="font-serif font-medium text-stone-800 dark:text-stone-100 text-sm sm:text-base truncate">
                  {{ philosopher.name }}
                </h1>
                <p class="text-xs text-stone-500 hidden sm:block">
                  {{ philosopher.era }}
                </p>
              </div>
            </NuxtLink>
          </div>

          <div
            v-if="!isNewConversation"
            class="flex items-center gap-1 sm:gap-2"
          >
            <template v-if="isOwner">
              <UButton
                variant="ghost"
                :color="conversation.isPublic ? 'primary' : 'neutral'"
                :icon="conversation.isPublic ? 'i-lucide-globe' : 'i-lucide-lock'"
                size="xs"
                :loading="false"
                @click="togglePublic"
              />

              <UButton
                v-if="conversation.isPublic"
                variant="ghost"
                :color="conversation.isAnonymous ? 'neutral' : 'neutral'"
                :icon="conversation.isAnonymous ? 'i-lucide-ghost' : 'i-lucide-user'"
                size="xs"
                @click="toggleAnonymous"
              >
                <span class="hidden sm:inline">{{ conversation.isAnonymous ? 'Anonymous' : 'Shown' }}</span>
              </UButton>
            </template>

            <UButton
              v-if="!isNewConversation"
              variant="ghost"
              :class="[conversation.isLikedByMe ? 'text-red-500' : 'text-stone-500']"
              icon="i-lucide-heart"
              size="xs"
              @click="toggleLike"
            >
              {{ conversation.likeCount || '' }}
            </UButton>

            <UButton
              v-if="!isNewConversation && token"
              variant="ghost"
              color="neutral"
              icon="i-lucide-git-fork"
              size="xs"
              @click="showForkModal = true"
            >
              <span class="hidden sm:inline">{{ conversation.forkCount > 0 ? conversation.forkCount : '' }}</span>
              <span class="sm:hidden">{{ conversation.forkCount > 0 ? conversation.forkCount : '' }}</span>
            </UButton>

            <UButton
              v-if="!isNewConversation && conversation.isPublic"
              :to="`/conversation/${conversation.id}/comments`"
              variant="ghost"
              color="neutral"
              icon="i-lucide-message-circle"
              size="xs"
            >
              <span v-if="(conversation.commentCount || 0) > 0">{{ conversation.commentCount }}</span>
            </UButton>

            <UButton
              v-if="isOwner && !isNewConversation"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              size="xs"
              @click="showDeleteConfirm = true"
            />
          </div>
        </div>
      </header>

      <!-- Messages -->
      <div
        ref="messagesContainer"
        class="flex-1 h-0 overflow-y-auto px-4 py-6"
        style="overflow-anchor: none"
      >
        <!-- Conversation Header (Title & Attribution) -->
        <div
          v-if="conversation"
          class="max-w-3xl mx-auto mb-8 text-center"
        >
          <h1
            class="text-3xl font-serif font-bold text-stone-900 dark:text-stone-100 mb-2 transition-colors"
            :class="{ 'cursor-pointer hover:text-primary-500 hover:underline': isOwner }"
            :title="isOwner ? 'Click to edit title' : ''"
            @click="isOwner ? openEditTitle() : null"
          >
            {{ conversation.title }}
          </h1>
          <p class="text-stone-500 dark:text-stone-400">
            with
            <span class="font-medium text-stone-900 dark:text-stone-100">
              {{ displayUserName }}
            </span>
          </p>

          <!-- Fork Attribution -->
          <div
            v-if="conversation.forkedFrom"
            class="flex justify-center items-center gap-2 text-sm text-stone-500 mb-4"
          >
            <UIcon
              name="i-lucide-git-fork"
              class="w-4 h-4"
            />
            <span>Forked from</span>
            <NuxtLink
              :to="`/conversation/${conversation.forkedFrom.id}`"
              class="font-medium text-primary-600 dark:text-primary-400 hover:underline"
            >
              {{ conversation.forkedFrom.title }}
            </NuxtLink>
            <span>by {{ conversation.forkedFrom.user?.name || 'Unknown' }}</span>
          </div>

          <div class="flex justify-center items-center gap-2 text-sm text-stone-500">
            <span>Started <ClientOnly>{{ formatTimeUtil(conversation.createdAt) }}</ClientOnly></span>
            <span v-if="displayUser">&bull; by {{ displayUser.name }}</span>
          </div>
        </div>

        <div class="max-w-3xl mx-auto space-y-6">
          <!-- Conversation start -->
          <div
            v-if="philosopher"
            class="text-center py-8"
          >
            <NuxtLink :to="`/person/${philosopher.slug}`">
              <img
                :src="philosopher.portrait"
                :alt="philosopher.name"
                class="w-24 h-24 rounded-full object-cover mx-auto mb-4 portrait-frame hover:ring-2 hover:ring-indigo-500 transition-all cursor-pointer"
              >
            </NuxtLink>
            <h2 class="text-xl font-serif font-medium text-stone-800 dark:text-stone-100 mb-2">
              Conversation with
              <NuxtLink
                :to="`/person/${philosopher.slug}`"
                class="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                {{ philosopher.name }}
              </NuxtLink>
            </h2>
            <p class="text-sm text-stone-500 dark:text-stone-400">
              {{ philosopher.era }}
            </p>
            <div
              v-if="conversation.forkedFrom"
              class="mt-2 text-xs text-stone-400 bg-stone-100 dark:bg-stone-900/50 inline-block px-2 py-1 rounded-full"
            >
              <UIcon
                name="i-lucide-git-fork"
                class="w-3 h-3 inline-block mr-1"
              />
              Forked from {{ conversation.forkedFrom.user?.name || 'Anonymous' }}'s conversation
            </div>
          </div>

          <!-- Ephemeral Mode Warning -->
          <div
            v-if="isEphemeral"
            class="mx-auto max-w-lg mb-8"
          >
            <UAlert
              icon="i-lucide-users"
              color="warning"
              variant="subtle"
              title="Temporary Conversation"
              description="You are not signed in. This conversation will not be saved."
            >
              <template #description>
                <div class="mt-2">
                  This conversation will not be saved. <NuxtLink
                    to="/auth/login"
                    class="underline font-medium hover:text-amber-800"
                  >Sign in</NuxtLink> to save your conversations.
                </div>
              </template>
            </UAlert>
          </div>

          <!-- Messages list -->
          <div
            v-for="message in conversation.messages"
            :key="message.id"
            :class="[
              'flex gap-3',
              message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            ]"
          >
            <!-- Avatar -->
            <!-- Avatar -->
            <div class="flex-shrink-0">
              <!-- Philosopher Avatar -->
              <NuxtLink
                v-if="message.role === 'philosopher' && philosopher"
                :to="`/person/${philosopher.slug}`"
                class="block cursor-pointer hover:opacity-80 transition-opacity"
              >
                <UAvatar
                  :src="philosopher.portrait"
                  :alt="philosopher.name"
                  size="sm"
                  class="border-2 border-stone-300 dark:border-stone-700"
                />
              </NuxtLink>

              <!-- User Avatar -->
              <NuxtLink
                v-else-if="displayUser && !conversation.isAnonymous"
                :to="`/user/${displayUser.username}`"
                class="block cursor-pointer hover:opacity-80 transition-opacity"
              >
                <UAvatar
                  :src="displayUser.avatar || undefined"
                  :alt="displayUser.name"
                  size="sm"
                  class="border-2 border-indigo-300 dark:border-indigo-700"
                />
              </NuxtLink>

              <!-- Anonymous/Fallback Avatar -->
              <UAvatar
                v-else
                icon="i-lucide-user"
                size="sm"
                class="bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400"
              />
            </div>

            <!-- Message bubble container -->
            <div :class="['flex flex-col max-w-[75%]', message.role === 'user' ? 'items-end' : 'items-start']">
              <!-- Name -->
              <span class="text-xs text-stone-500 mb-1 px-1">
                <template v-if="message.role === 'philosopher' && philosopher">
                  {{ philosopher.name }}
                </template>
                <template v-else-if="message.role === 'user'">
                  <template v-if="displayUser && !conversation.isAnonymous">
                    {{ displayUser.name }}
                  </template>
                  <template v-else>
                    Anonymous
                  </template>
                </template>
              </span>

              <!-- Bubble -->
              <div
                :class="[
                  'p-4 w-full',
                  message.role === 'user' ? 'message-user' : 'message-philosopher'
                ]"
              >
                <p class="whitespace-pre-wrap leading-relaxed font-serif text-lg md:text-xl">
                  {{ message.content }}
                </p>
                <p class="text-xs text-stone-400 mt-2">
                  <ClientOnly>{{ formatTime(message.createdAt) }}</ClientOnly>
                </p>

                <!-- Reaction Placeholder -->
                <!-- <div class="mt-2 pt-2 border-t border-stone-200 dark:border-stone-700/50 flex justify-end">
                  <UTooltip text="Ask another philosopher to react">
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      icon="i-lucide-message-circle-question"
                      @click="triggerReactionPlaceholder"
                    >
                      Ask Reaction
                    </UButton>
                  </UTooltip>
                </div> -->
              </div>
            </div>
          </div>

          <!-- Typing indicator -->
          <div
            v-if="isSending"
            class="flex gap-3"
          >
            <!-- Avatar -->
            <div class="flex-shrink-0">
              <UAvatar
                v-if="philosopher"
                :src="philosopher.portrait"
                :alt="philosopher.name"
                size="sm"
                class="border-2 border-stone-300 dark:border-stone-700"
              />
            </div>

            <div class="message-philosopher p-4">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 bg-stone-400 rounded-full animate-pulse" />
                <span
                  class="w-2 h-2 bg-stone-400 rounded-full animate-pulse"
                  style="animation-delay: 0.2s"
                />
                <span
                  class="w-2 h-2 bg-stone-400 rounded-full animate-pulse"
                  style="animation-delay: 0.4s"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Input or Fork CTA -->
      <div class="sticky bottom-0 bg-cream dark:bg-stone-950 border-t border-stone-200 dark:border-stone-800 px-4 py-4">
        <form
          v-if="isOwner || isNewConversation || isEphemeral"
          class="max-w-3xl mx-auto flex gap-3"
          @submit.prevent="sendMessage"
        >
          <UTextarea
            v-model="newMessage"
            placeholder="Share your thoughts..."
            :rows="1"
            autoresize
            class="flex-1 !text-base bg-white dark:bg-stone-900"
            @keydown.enter.exact.prevent="sendMessage"
          />
          <UButton
            type="submit"
            icon="i-lucide-send"
            :loading="isSending"
            :disabled="!newMessage.trim()"
          />
        </form>

        <!-- Read Only / Fork CTA -->
        <div
          v-else
          class="max-w-3xl mx-auto text-center"
        >
          <div class="p-4 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-4">
            <div class="text-left">
              <h3 class="font-medium text-stone-900 dark:text-stone-100">
                Reader View
              </h3>
              <p class="text-sm text-stone-500">
                Fork this conversation to continue the dialogue yourself.
              </p>
            </div>
            <UButton
              v-if="token"
              icon="i-lucide-git-fork"
              color="primary"
              @click="showForkModal = true"
            >
              Fork to Continue
            </UButton>
            <UButton
              v-else
              to="/auth/login"
              icon="i-lucide-log-in"
              color="neutral"
              variant="ghost"
            >
              Sign in to Fork
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Fork Confirmation Modal -->
    <!-- Fork Confirmation Modal -->

    <!-- Modals -->
    <RenameConversationModal
      v-if="conversation"
      v-model="showEditTitleModal"
      :conversation-id="conversation.id"
      :current-title="conversation.title"
      @success="(newTitle) => conversation.title = newTitle"
    />

    <ForkConversationModal
      v-if="conversation"
      v-model="showForkModal"
      :conversation="conversation"
    />

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="showDeleteConfirm">
      <template #content>
        <UCard>
          <div class="text-center p-4">
            <UIcon
              name="i-lucide-trash-2"
              class="w-12 h-12 mx-auto mb-4 text-red-500"
            />
            <h3 class="text-lg font-bold text-stone-900 dark:text-stone-100 mb-2">
              Delete Conversation?
            </h3>
            <p class="text-stone-600 dark:text-stone-400 mb-6">
              This will permanently delete this conversation and all its messages.
            </p>
            <div class="flex justify-center gap-3">
              <UButton
                label="Cancel"
                color="neutral"
                variant="ghost"
                @click="showDeleteConfirm = false"
              />
              <UButton
                label="Delete"
                color="error"
                :loading="isDeleting"
                @click="deleteConversation"
              />
            </div>
          </div>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
