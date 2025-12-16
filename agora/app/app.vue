<script setup lang="ts">
// Agora - Main App Layout
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', type: 'image/jpeg', href: '/favicon.jpg' }
  ],
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

// Use auth composable
const { initialize } = useAuth()

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
