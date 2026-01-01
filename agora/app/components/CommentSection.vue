<script setup lang="ts">
// CommentSection - Container for comments on a conversation

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
  conversationId: string
  isPublic: boolean
  isOwner?: boolean
}>()

const { token, user } = useAuth()
const toast = useToast()

const comments = ref<Comment[]>([])
const isLoading = ref(true)
const newComment = ref('')
const isSubmitting = ref(false)
const commentCount = ref(0)

// Fetch comments on mount
async function fetchComments() {
  isLoading.value = true
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }

    const response = await $fetch<{ data?: { conversation?: { comments: Comment[], commentCount: number } }, errors?: { message: string }[] }>('/api/graphql', {
      method: 'POST',
      headers,
      body: {
        query: `query GetComments($id: ID!) {
          conversation(id: $id) {
            commentCount
            comments {
              id content createdAt likeCount isLikedByMe parentId
              user { id name username avatar }
              replies {
                id content createdAt likeCount isLikedByMe parentId
                user { id name username avatar }
                replies {
                  id content createdAt likeCount isLikedByMe parentId
                  user { id name username avatar }
                }
              }
            }
          }
        }`,
        variables: { id: props.conversationId }
      }
    })

    if (response.data?.conversation) {
      comments.value = response.data.conversation.comments || []
      commentCount.value = response.data.conversation.commentCount || comments.value.length
    }
  } catch (e) {
    console.error('Failed to fetch comments:', e)
  } finally {
    isLoading.value = false
  }
}

async function submitComment() {
  if (!newComment.value.trim() || !token.value || isSubmitting.value) return

  isSubmitting.value = true
  try {
    const response = await $fetch<{ data?: { addComment?: Comment }, errors?: { message: string }[] }>('/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: {
        query: `mutation AddComment($conversationId: ID!, $content: String!) {
          addComment(conversationId: $conversationId, content: $content) {
            id content createdAt likeCount isLikedByMe
            user { id name username avatar }
          }
        }`,
        variables: {
          conversationId: props.conversationId,
          content: newComment.value.trim()
        }
      }
    })

    if (response.errors?.length) {
      throw new Error(response.errors[0]?.message)
    }

    if (response.data?.addComment) {
      comments.value.unshift({ ...response.data.addComment, replies: [] })
      commentCount.value++
    }

    newComment.value = ''
    toast.add({ title: 'Comment added!', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Error', description: (e as Error).message, color: 'error' })
  } finally {
    isSubmitting.value = false
  }
}

function handleCommentDeleted(commentId: string) {
  comments.value = comments.value.filter(c => c.id !== commentId)
  commentCount.value = Math.max(0, commentCount.value - 1)
}

function handleReplyAdded() {
  commentCount.value++
}

onMounted(() => {
  if (props.conversationId) {
    fetchComments()
  }
})

watch(() => props.conversationId, (newId) => {
  if (newId) {
    fetchComments()
  }
})
</script>

<template>
  <div class="border-t border-stone-200 dark:border-stone-800 pt-6">
    <!-- Header -->
    <div class="flex items-center gap-2 mb-4">
      <UIcon
        name="i-lucide-message-circle"
        class="w-5 h-5 text-stone-500"
      />
      <h3 class="text-lg font-medium text-stone-900 dark:text-stone-100">
        Comments
        <span
          v-if="commentCount > 0"
          class="text-stone-400 font-normal"
        >({{ commentCount }})</span>
      </h3>
    </div>

    <!-- Add Comment Form -->
    <div
      v-if="token && (isPublic || isOwner)"
      class="mb-6"
    >
      <form
        class="flex gap-3"
        @submit.prevent="submitComment"
      >
        <div
          v-if="user?.avatar"
          class="w-8 h-8 rounded-full overflow-hidden ring-1 ring-stone-200 dark:ring-stone-700 flex-shrink-0"
        >
          <img
            :src="user.avatar"
            :alt="user.name"
            class="w-full h-full object-cover"
          >
        </div>
        <UAvatar
          v-else-if="user"
          :alt="user.name"
          size="sm"
          class="flex-shrink-0"
        />
        <div class="flex-1 flex gap-2">
          <UTextarea
            v-model="newComment"
            placeholder="Add a comment..."
            :rows="1"
            autoresize
            class="flex-1"
          />
          <UButton
            type="submit"
            :loading="isSubmitting"
            :disabled="!newComment.trim()"
            icon="i-lucide-send"
          >
            Post
          </UButton>
        </div>
      </form>
    </div>

    <!-- Login Prompt -->
    <div
      v-else-if="!token && isPublic"
      class="mb-6 p-4 bg-stone-100 dark:bg-stone-900 rounded-lg text-center"
    >
      <p class="text-sm text-stone-600 dark:text-stone-400">
        <NuxtLink
          to="/auth/login"
          class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
        >
          Sign in
        </NuxtLink>
        to join the conversation.
      </p>
    </div>

    <!-- Private Notice -->
    <div
      v-else-if="!isPublic && !isOwner"
      class="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-center"
    >
      <p class="text-sm text-amber-700 dark:text-amber-300">
        Comments are only available on public conversations.
      </p>
    </div>

    <!-- Loading State -->
    <div
      v-if="isLoading"
      class="flex justify-center py-8"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-6 h-6 animate-spin text-stone-400"
      />
    </div>

    <!-- Comments List -->
    <div
      v-else-if="comments.length > 0"
      class="space-y-4"
    >
      <CommentItem
        v-for="comment in comments"
        :key="comment.id"
        :comment="comment"
        :conversation-id="conversationId"
        :current-user-id="user?.id"
        @deleted="handleCommentDeleted"
        @reply-added="handleReplyAdded"
      />
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="text-center py-8 text-stone-500"
    >
      <UIcon
        name="i-lucide-message-circle"
        class="w-10 h-10 mx-auto mb-2 opacity-50"
      />
      <p>No comments yet. Be the first to share your thoughts!</p>
    </div>
  </div>
</template>
