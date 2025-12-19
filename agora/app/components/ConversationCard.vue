<script setup lang="ts">
// Helper to format date
import { formatRelativeTime } from '~/utils/dateFormat'
import { useHydrationSafeDate } from '~/composables/useHydrationSafeDate'

const router = useRouter()
const { token, user: currentUser } = useAuth()

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

const props = defineProps<{
  conversation: Conversation
  canDelete?: boolean
}>()

const emit = defineEmits<{
  (e: 'delete'): void
  (e: 'fork', conversation: Conversation): void
}>()

// Format date helper - using hydration-safe composable
const formattedDate = useHydrationSafeDate(
  computed(() => props.conversation.createdAt),
  formatRelativeTime
)

function handleFork(e: Event) {
  e.preventDefault()
  if (!token.value) {
    router.push('/auth/login')
    return
  }
  e.stopPropagation()
  emit('fork', props.conversation)
}

// Like conversation
async function toggleLike(e: Event) {
  e.preventDefault() // Prevent navigation
  if (!token.value) {
    router.push('/auth/login')
    return
  }

  const isLiked = props.conversation.isLikedByMe
  // Optimistic update
  // eslint-disable-next-line vue/no-mutating-props
  props.conversation.isLikedByMe = !isLiked
  // eslint-disable-next-line vue/no-mutating-props
  props.conversation.likeCount += isLiked ? -1 : 1

  try {
    await $fetch('/api/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.value}`
      },
      body: {
        query: `
          mutation ToggleLike($id: ID!) {
            ${isLiked ? 'unlikeConversation' : 'likeConversation'}(conversationId: $id) {
              id
            }
          }
        `,
        variables: { id: props.conversation.id }
      }
    })
  } catch {
    // Revert on error
    // eslint-disable-next-line vue/no-mutating-props
    props.conversation.isLikedByMe = isLiked
    // eslint-disable-next-line vue/no-mutating-props
    props.conversation.likeCount += isLiked ? 1 : -1
  }
}
// Display Logic
const displayUserName = computed(() => {
  // 1. If not anonymous, always show name
  if (!props.conversation.isAnonymous) {
    return props.conversation.user?.name || 'Unknown'
  }

  // 2. If Owner, show name (You)
  if (currentUser.value?.id === props.conversation.user?.id) {
    return `${props.conversation.user?.name || 'Unknown'} (You)`
  }

  // 3. If anonymous, check for Admin privileges
  const isAdmin = currentUser.value?.role === 'ADMIN'
  if (isAdmin) {
    return `${props.conversation.user?.name || 'Unknown'} (Anon)`
  }

  // 4. Fallback
  return 'Anonymous'
})
</script>

<template>
  <div
    class="block outline-none h-full"
    role="button"
    tabindex="0"
    @click="router.push(`/conversation/${conversation.id}`)"
    @keydown.enter="router.push(`/conversation/${conversation.id}`)"
  >
    <UCard
      class="hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors cursor-pointer h-full"
    >
      <div class="flex flex-col h-full gap-4">
        <!-- Header: Philosophers & Users Avatars -->
        <div class="flex items-center justify-between">
          <div class="flex -space-x-3 overflow-hidden p-1">
            <!-- Philosopher Avatar (left) -->
            <NuxtLink
              :to="`/person/${conversation.philosopher.slug}`"
              class="flex-shrink-0 hover:opacity-80 transition-opacity"
              @click.stop
            >
              <NuxtImg
                :src="conversation.philosopher.portrait"
                :alt="conversation.philosopher.name"
                width="32"
                height="32"
                fit="cover"
                class="w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-stone-900"
              />
            </NuxtLink>

            <!-- User Avatar -->
            <NuxtLink
              v-if="conversation.user && (!conversation.isAnonymous || currentUser?.id === conversation.user.id)"
              :to="`/user/${conversation.user.username}`"
              class="relative z-0 hover:z-20 hover:scale-105 transition-all outline-none"
              @click.stop
            >
              <NuxtImg
                v-if="conversation.user.avatar"
                :src="conversation.user.avatar"
                :alt="conversation.user.name"
                width="32"
                height="32"
                fit="cover"
                class="w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-stone-900 cursor-pointer"
              />
              <span
                v-else
                class="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-800 ring-2 ring-white dark:ring-stone-900 flex items-center justify-center text-stone-500"
              >
                <UIcon
                  name="i-lucide-user"
                  class="w-4 h-4"
                />
              </span>
            </NuxtLink>
            <span
              v-else
              class="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-800 ring-2 ring-white dark:ring-stone-900 flex items-center justify-center text-stone-500"
            >
              <UIcon
                name="i-lucide-user"
                class="w-4 h-4"
              />
            </span>
          </div>

          <!-- Date -->
          <span class="text-xs text-stone-500 font-medium">
            {{ formattedDate }}
          </span>
        </div>

        <!-- Content -->
        <div class="flex-1">
          <h3 class="text-base font-serif font-semibold text-stone-900 dark:text-stone-100 line-clamp-2 mb-1.5 min-h-[1.5rem]">
            {{ conversation.title }}
          </h3>

          <div class="text-xs text-stone-600 dark:text-stone-400 mb-2">
            <span class="font-medium text-stone-900 dark:text-stone-100">{{ conversation.philosopher.name }}</span>
            <span class="mx-1">with</span>
            <span class="font-medium text-stone-900 dark:text-stone-100">
              {{ displayUserName }}
            </span>
          </div>

          <p
            class="text-sm text-stone-500 dark:text-stone-400 line-clamp-3 mb-3"
          >
            {{ conversation.summary || 'No summary available.' }}
          </p>
        </div>

        <!-- Footer Actions -->
        <div class="pt-3 mt-auto border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1 group">
              <UButton
                variant="ghost"
                size="xs"
                icon="i-lucide-heart"
                :class="[
                  'p-0 hover:bg-transparent transition-colors',
                  conversation.isLikedByMe ? 'text-red-500 hover:text-red-600' : 'text-stone-400 hover:text-red-500'
                ]"
                @click.stop="toggleLike"
              />
              <span :class="{ 'text-red-500': conversation.isLikedByMe }">{{ conversation.likeCount }}</span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1 mr-1">
              <UIcon
                name="i-lucide-eye"
                class="w-3.5 h-3.5"
              />
              <span>{{ conversation.viewCount }}</span>
            </div>

            <UButton
              v-if="canDelete"
              variant="ghost"
              color="error"
              size="xs"
              icon="i-lucide-trash-2"
              @click.stop="emit('delete')"
            />
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              icon="i-lucide-git-fork"
              @click.stop="handleFork"
            >
              {{ conversation.forkCount > 0 ? conversation.forkCount : '' }}
            </UButton>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
