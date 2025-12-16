<script setup lang="ts">
definePageMeta({
  layout: 'auth'

})

const reload = () => {
  window.location.reload()
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 p-4">
    <UCard class="max-w-md w-full text-center">
      <template #header>
        <div class="flex justify-center mb-4">
          <div class="p-3 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
            <UIcon
              name="i-lucide-hammer"
              class="w-8 h-8"
            />
          </div>
        </div>
        <h1 class="text-2xl font-serif font-bold text-stone-900 dark:text-stone-100">
          Under Maintenance
        </h1>
      </template>

      <p class="text-stone-600 dark:text-stone-400 mb-6">
        The Agora is currently undergoing renovations. We are polishing the digital marble to provide you with a better experience.
      </p>

      <p class="text-sm text-stone-500 dark:text-stone-500 mb-6">
        Please check back shortly.
      </p>

      <template #footer>
        <UButton
          size="lg"
          block
          color="primary"
          variant="solid"
          icon="i-lucide-refresh-cw"
          @click="reload"
        >
          Check for Updates
        </UButton>
      </template>
    </UCard>
  </div>
</template>
