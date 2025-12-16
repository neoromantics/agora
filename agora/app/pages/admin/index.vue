<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

const { user } = useAuth()

const menuItems = [
  {
    title: 'Thinkers',
    description: 'Manage AI personas',
    icon: 'i-lucide-users',
    to: '/admin/people',
    color: 'stone'
  },
  {
    title: 'Users',
    description: 'Platform members',
    icon: 'i-lucide-user-cog',
    to: '/admin/users',
    color: 'stone'
  },
  {
    title: 'Conversations',
    description: 'Monitor chats',
    icon: 'i-lucide-message-square',
    to: '/admin/conversations',
    color: 'stone'
  },
  {
    title: 'Analytics',
    description: 'Traffic insights',
    icon: 'i-lucide-bar-chart-3',
    to: '/admin/analytics',
    color: 'stone'
  }
]
</script>

<template>
  <div class="space-y-12">
    <!-- Header -->
    <div class="max-w-2xl">
      <h1 class="text-3xl font-serif font-medium text-stone-900 dark:text-stone-100">
        Overview
      </h1>
      <p class="mt-2 text-stone-500 dark:text-stone-400">
        Welcome back, {{ user?.name }}. Here is what is happening in Agora today.
      </p>
    </div>

    <!-- Quick Links Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <NuxtLink
        v-for="item in menuItems"
        :key="item.title"
        :to="item.to"
        class="group relative flex flex-col p-6 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/50 hover:bg-stone-50 dark:hover:bg-stone-900 transition-all duration-300"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="p-2 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 group-hover:text-stone-900 dark:group-hover:text-stone-100 transition-colors">
            <UIcon
              :name="item.icon"
              class="w-5 h-5"
            />
          </div>
          <UIcon
            name="i-lucide-arrow-right"
            class="w-4 h-4 text-stone-300 group-hover:text-stone-600 dark:text-stone-700 dark:group-hover:text-stone-400 transform group-hover:translate-x-1 transition-all"
          />
        </div>

        <h3 class="text-lg font-medium text-stone-900 dark:text-stone-100 mb-1">
          {{ item.title }}
        </h3>
        <p class="text-sm text-stone-500 dark:text-stone-400">
          {{ item.description }}
        </p>
      </NuxtLink>
    </div>

    <!-- Placeholder for Future Widgets (e.g., specific recent activity) -->
    <!-- Keeping it clean for now as per Minimalist instruction -->
  </div>
</template>
