<script setup lang="ts">
// CommentItem - Individual comment with replies, likes, and actions
import { useHydrationSafeFormatter } from '~/composables/useHydrationSafeDate'

interface User {
  id: string
  name: string
  username: string
  avatar?: string
}

interface Comment {
  id: string
  content: string
  user: User
  createdAt: string
  parentId?: string
  likeCount: number
  isLikedByMe: boolean
  replies?: Comment[]
}

const props = defineProps<{
  comment: Comment
  conversationId: string
  currentUserId?: string
  depth?: number
}>()

const emit = defineEmits<{
  (e: 'deleted', commentId: string): void
  (e: 'reply-added', comment: Comment): void
}>()

const { token } = useAuth()
const toast = useToast()

const depth = computed(() => props.depth || 0)
const maxDepth = 3 // Limit nesting depth

// Local state for optimistic updates
const localLikeCount = ref(props.comment.likeCount)
const localIsLiked = ref(props.comment.isLikedByMe)
const isLiking = ref(false)
const isDeleting = ref(false)
const showReplyForm = ref(false)
const replyContent = ref('')
const isSubmittingReply = ref(false)
const localReplies = ref<Comment[]>(props.comment.replies || [])

// Watch for prop changes
watch(() => props.comment.replies, (newReplies) => {
  if (newReplies) localReplies.value = newReplies
})

const isOwner = computed(() => props.currentUserId === props.comment.user.id)

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

// Hydration-safe formatter for SSR
const formatTimeSafe = useHydrationSafeFormatter(formatTimeAgo)

async function toggleLike() {
  if (!token.value || isLiking.value) return

  isLiking.value = true
  const wasLiked = localIsLiked.value

  // Optimistic update
  localIsLiked.value = !wasLiked
  localLikeCount.value += wasLiked ? -1 : 1

  try {
    await $fetch('/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: {
        query: `mutation ${wasLiked ? 'UnlikeComment' : 'LikeComment'}($commentId: ID!) {
          ${wasLiked ? 'unlikeComment' : 'likeComment'}(commentId: $commentId) {
            id likeCount isLikedByMe
          }
        }`,
        variables: { commentId: props.comment.id }
      }
    })
  } catch {
    // Revert on error
    localIsLiked.value = wasLiked
    localLikeCount.value += wasLiked ? 1 : -1
    toast.add({ title: 'Error', description: 'Failed to update like', color: 'error' })
  } finally {
    isLiking.value = false
  }
}

async function deleteComment() {
  if (!token.value || isDeleting.value) return

  isDeleting.value = true
  try {
    const response = await $fetch<{ errors?: { message: string }[] }>('/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: {
        query: `mutation DeleteComment($commentId: ID!) {
          deleteComment(commentId: $commentId)
        }`,
        variables: { commentId: props.comment.id }
      }
    })

    if (response.errors?.length) {
      throw new Error(response.errors[0]?.message)
    }

    emit('deleted', props.comment.id)
    toast.add({ title: 'Comment deleted', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Error', description: (e as Error).message, color: 'error' })
  } finally {
    isDeleting.value = false
  }
}

async function submitReply() {
  if (!replyContent.value.trim() || !token.value || isSubmittingReply.value) return

  isSubmittingReply.value = true
  try {
    const response = await $fetch<{ data?: { addComment?: Comment }, errors?: { message: string }[] }>('/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: {
        query: `mutation AddComment($conversationId: ID!, $content: String!, $parentId: ID) {
          addComment(conversationId: $conversationId, content: $content, parentId: $parentId) {
            id content createdAt likeCount isLikedByMe
            user { id name username avatar }
          }
        }`,
        variables: {
          conversationId: props.conversationId,
          content: replyContent.value.trim(),
          parentId: props.comment.id
        }
      }
    })

    if (response.errors?.length) {
      throw new Error(response.errors[0]?.message)
    }

    if (response.data?.addComment) {
      localReplies.value.push(response.data.addComment)
      emit('reply-added', response.data.addComment)
    }

    replyContent.value = ''
    showReplyForm.value = false
  } catch (e) {
    toast.add({ title: 'Error', description: (e as Error).message, color: 'error' })
  } finally {
    isSubmittingReply.value = false
  }
}

function handleNestedDelete(commentId: string) {
  localReplies.value = localReplies.value.filter(r => r.id !== commentId)
}
</script>

<template>
  <div :class="['flex gap-3', depth > 0 ? 'ml-8 mt-3' : '']">
    <!-- Avatar -->
    <NuxtLink
      :to="`/user/${comment.user.username}`"
      class="flex-shrink-0"
    >
      <UAvatar
        :src="comment.user.avatar || undefined"
        :alt="comment.user.name"
        size="sm"
        class="ring-1 ring-stone-200 dark:ring-stone-700"
      />
    </NuxtLink>

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <!-- Header -->
      <div class="flex items-center gap-2 mb-1">
        <NuxtLink
          :to="`/user/${comment.user.username}`"
          class="font-medium text-sm text-stone-900 dark:text-stone-100 hover:underline"
        >
          {{ comment.user.name }}
        </NuxtLink>
        <span class="text-xs text-stone-400">
          {{ formatTimeSafe(comment.createdAt) }}
        </span>
      </div>

      <!-- Comment text -->
      <p class="text-sm text-stone-700 dark:text-stone-300 whitespace-pre-wrap mb-2">
        {{ comment.content }}
      </p>

      <!-- Actions -->
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="flex items-center gap-1 text-xs transition-colors"
          :class="localIsLiked ? 'text-red-500' : 'text-stone-400 hover:text-red-500'"
          :disabled="!token || isLiking"
          @click="toggleLike"
        >
          <UIcon
            :name="localIsLiked ? 'i-lucide-heart' : 'i-lucide-heart'"
            class="w-4 h-4"
          />
          <span v-if="localLikeCount > 0">{{ localLikeCount }}</span>
        </button>

        <button
          v-if="token && depth < maxDepth"
          type="button"
          class="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
          @click="showReplyForm = !showReplyForm"
        >
          <UIcon
            name="i-lucide-message-circle"
            class="w-4 h-4"
          />
          Reply
        </button>

        <button
          v-if="isOwner"
          type="button"
          class="flex items-center gap-1 text-xs text-stone-400 hover:text-red-500 transition-colors"
          :disabled="isDeleting"
          @click="deleteComment"
        >
          <UIcon
            name="i-lucide-trash-2"
            class="w-4 h-4"
          />
          Delete
        </button>
      </div>

      <!-- Reply Form -->
      <div
        v-if="showReplyForm"
        class="mt-3"
      >
        <form
          class="flex gap-2"
          @submit.prevent="submitReply"
        >
          <UInput
            v-model="replyContent"
            placeholder="Write a reply..."
            size="sm"
            class="flex-1"
          />
          <UButton
            type="submit"
            size="sm"
            :loading="isSubmittingReply"
            :disabled="!replyContent.trim()"
          >
            Reply
          </UButton>
          <UButton
            type="button"
            size="sm"
            variant="ghost"
            color="neutral"
            @click="showReplyForm = false"
          >
            Cancel
          </UButton>
        </form>
      </div>

      <!-- Nested Replies -->
      <div
        v-if="localReplies.length > 0"
        class="mt-2"
      >
        <CommentItem
          v-for="reply in localReplies"
          :key="reply.id"
          :comment="reply"
          :conversation-id="conversationId"
          :current-user-id="currentUserId"
          :depth="depth + 1"
          @deleted="handleNestedDelete"
          @reply-added="(c) => emit('reply-added', c)"
        />
      </div>
    </div>
  </div>
</template>
