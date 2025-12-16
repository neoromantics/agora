<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{
  error: NuxtError
}>()

const handleError = () => clearError({ redirect: '/' })
</script>

<template>
  <div class="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col items-center justify-center p-4 font-sans text-center">
    <div class="max-w-md w-full bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 p-8">
      <div class="mb-6 flex justify-center">
        <div class="p-4 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400">
          <UIcon
            name="i-lucide-alert-triangle"
            class="w-10 h-10"
          />
        </div>
      </div>

      <h1 class="text-4xl font-serif font-bold text-stone-900 dark:text-stone-100 mb-2">
        {{ error.statusCode }}
      </h1>

      <p class="text-lg text-stone-600 dark:text-stone-400 mb-8">
        {{ error.message || 'An unexpected error occurred.' }}
      </p>

      <UButton
        label="Go back home"
        color="primary"
        size="lg"
        block
        icon="i-lucide-home"
        @click="handleError"
      />
    </div>
  </div>
</template>
