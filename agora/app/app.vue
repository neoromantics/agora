<script setup lang="ts">
// Agora - Main App Layout
// Use auth composable
const { initialize, user } = useAuth()

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: computed(() => [
    { rel: 'icon', type: 'image/jpeg', href: '/favicon.jpg' },
    // Preload user avatar to prevent flash/delay on navigation
    ...(user.value?.avatar ? [{ rel: 'preload' as const, as: 'image' as const, href: user.value.avatar }] : [])
  ]),
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'Agora - Conversations with Great Minds'
const description = 'A platform for meaningful conversations with history\'s greatest philosophers and writers. Explore, engage, and share wisdom.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary_large_image'
})

// Initialize auth state on mount
onMounted(() => {
  initialize()
})
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <UNotifications />
  </UApp>
</template>
