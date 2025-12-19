<script setup lang="ts">
// Notifications Page
import { formatRelativeTime } from '~/utils/dateFormat'
import { useHydrationSafeFormatter } from '~/composables/useHydrationSafeDate'

definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

interface Notification {
  id: string
  type: string
  conversationId: string | null
  actorId: string | null
  message: string
  read: boolean
  createdAt: string
}

const { token } = useAuth()
const notifications = ref<Notification[]>([])
const isLoading = ref(true)
const unreadCount = ref(0)

async function fetchNotifications() {
  isLoading.value = true
  try {
    interface NotifResponse {
      data?: {
        myNotifications: Notification[]
        unreadNotificationCount: number
      }
    }

    const response = await $fetch<NotifResponse>('/api/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.value}` },
      body: {
        query: `
          query {
            myNotifications(limit: 50) {
              id
              type
              conversationId
              actorId
              message
              read
              createdAt
            }
            unreadNotificationCount
          }
        `
      }
    })

    if (response.data) {
      notifications.value = response.data.myNotifications
      unreadCount.value = response.data.unreadNotificationCount
    }
  } finally {
    isLoading.value = false
  }
}

async function markAsRead(notificationId: string) {
  await $fetch('/api/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.value}` },
    body: {
      query: `
        mutation MarkRead($id: ID!) {
          markNotificationRead(notificationId: $id) { id read }
        }
      `,
      variables: { id: notificationId }
    }
  })

  const notif = notifications.value.find(n => n.id === notificationId)
  if (notif && !notif.read) {
    notif.read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }
}

async function markAllAsRead() {
  await $fetch('/api/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.value}` },
    body: {
      query: `mutation { markAllNotificationsRead }`
    }
  })

  notifications.value.forEach(n => n.read = true)
  unreadCount.value = 0
}

// Format time helper - using hydration-safe formatter
const formatTime = useHydrationSafeFormatter(formatRelativeTime)

function getIcon(type: string): string {
  switch (type) {
    case 'LIKE': return 'i-lucide-heart'
    case 'COMMENT': return 'i-lucide-message-circle'
    case 'FORK': return 'i-lucide-git-branch'
    default: return 'i-lucide-bell'
  }
}

onMounted(fetchNotifications)

useHead({ title: 'Notifications | Agora' })
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-2xl">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-serif font-semibold text-stone-900 dark:text-stone-100">
        Notifications
        <UBadge
          v-if="unreadCount > 0"
          color="primary"
          class="ml-2"
        >
          {{ unreadCount }}
        </UBadge>
      </h1>
      <UButton
        v-if="unreadCount > 0"
        variant="outline"
        size="sm"
        @click="markAllAsRead"
      >
        Mark all as read
      </UButton>
    </div>

    <UCard v-if="isLoading">
      <div class="flex items-center justify-center py-12">
        <UIcon
          name="i-lucide-loader-2"
          class="w-8 h-8 animate-spin text-stone-400"
        />
      </div>
    </UCard>

    <div
      v-else-if="notifications.length === 0"
      class="text-center py-16"
    >
      <UIcon
        name="i-lucide-bell-off"
        class="w-16 h-16 mx-auto mb-4 text-stone-300 dark:text-stone-600"
      />
      <p class="text-stone-500 dark:text-stone-400">
        No notifications yet
      </p>
    </div>

    <div
      v-else
      class="space-y-2"
    >
      <NuxtLink
        v-for="notif in notifications"
        :key="notif.id"
        :to="notif.conversationId ? `/conversation/${notif.conversationId}` : '#'"
        class="block"
        @click="markAsRead(notif.id)"
      >
        <UCard
          :class="[
            'transition-colors hover:bg-stone-50 dark:hover:bg-stone-800',
            !notif.read ? 'border-l-4 border-l-primary-500' : ''
          ]"
        >
          <div class="flex items-start gap-3">
            <UIcon
              :name="getIcon(notif.type)"
              :class="[
                'w-5 h-5 mt-0.5',
                notif.type === 'LIKE' ? 'text-red-500' : 'text-primary-500'
              ]"
            />
            <div class="flex-1 min-w-0">
              <p
                :class="[
                  'text-sm',
                  notif.read ? 'text-stone-600 dark:text-stone-400' : 'text-stone-900 dark:text-stone-100 font-medium'
                ]"
              >
                {{ notif.message }}
              </p>
              <p class="text-xs text-stone-400 mt-1">
                {{ formatTime(notif.createdAt) }}
              </p>
            </div>
            <UBadge
              v-if="!notif.read"
              size="xs"
              color="primary"
            >
              New
            </UBadge>
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </div>
</template>
