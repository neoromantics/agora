<script setup lang="ts">
// Landing page logic
definePageMeta({
  layout: 'default'
})
</script>

<template>
  <div class="h-[calc(100vh-4rem)] flex items-center justify-center relative overflow-hidden">
    <!-- Hero Section -->
    <div class="relative w-full isolate">
      <!-- Background effects could go here -->

      <div class="mx-auto max-w-7xl px-6 lg:px-8 text-center">
        <h1 class="font-serif text-6xl sm:text-8xl font-bold tracking-tight text-stone-900 dark:text-stone-100 mb-4">
          Agora
        </h1>
        <h2 class="font-serif text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-stone-600 dark:text-stone-400 mb-8">
          Where <span class="italic text-indigo-600 dark:text-indigo-400">History</span> Speaks
        </h2>

        <p class="mx-auto max-w-2xl text-lg leading-8 text-stone-600 dark:text-stone-300 font-light mb-8">
          Talk to philosophers, writers, and thinkers from across the ages.
        </p>

        <div class="flex items-center justify-center gap-x-6">
          <UButton
            to="/gallery"
            size="xl"
            color="primary"
            variant="solid"
            class="px-8"
          >
            Enter the Gallery
          </UButton>
        </div>
      </div>
    </div>

    <!-- Feature Grid removed as requested -->
  </div>
</template>
