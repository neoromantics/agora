<script setup lang="ts">
// Forgot Password Page
definePageMeta({
  layout: 'default'
})

const email = ref('')
const isLoading = ref(false)
const isSubmitted = ref(false)
const errorMessage = ref('')

async function handleSubmit() {
  if (!email.value.trim()) return

  isLoading.value = true
  errorMessage.value = ''

  try {
    interface ResetResponse {
      data?: {
        requestPasswordReset: {
          success: boolean
          message: string
        }
      }
      errors?: { message: string }[]
    }

    const response = await $fetch<ResetResponse>('/api/graphql', {
      method: 'POST',
      body: {
        query: `
          mutation RequestPasswordReset($email: String!) {
            requestPasswordReset(email: $email) {
              success
              message
            }
          }
        `,
        variables: { email: email.value }
      }
    })

    if (response.errors?.length) {
      throw new Error(response.errors[0]?.message)
    }

    isSubmitted.value = true
  } catch (e) {
    errorMessage.value = (e as Error).message || 'An error occurred'
  } finally {
    isLoading.value = false
  }
}

useHead({
  title: 'Forgot Password | Agora'
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 px-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-serif font-semibold text-stone-900 dark:text-stone-100">
            Forgot Password
          </h1>
          <p class="text-sm text-stone-600 dark:text-stone-400 mt-1">
            Enter your email to receive a password reset link
          </p>
        </div>
      </template>

      <!-- Success State -->
      <div
        v-if="isSubmitted"
        class="text-center py-8"
      >
        <UIcon
          name="i-lucide-mail-check"
          class="w-16 h-16 mx-auto mb-4 text-green-500"
        />
        <h2 class="text-xl font-medium text-stone-900 dark:text-stone-100 mb-2">
          Check Your Email
        </h2>
        <p class="text-stone-600 dark:text-stone-400 mb-6">
          If an account exists with that email, we've sent a password reset link.
        </p>
        <UButton
          to="/auth/login"
          variant="outline"
        >
          Back to Login
        </UButton>
      </div>

      <!-- Form -->
      <form
        v-else
        class="space-y-4"
        @submit.prevent="handleSubmit"
      >
        <UFormField label="Email Address">
          <UInput
            v-model="email"
            type="email"
            placeholder="you@example.com"
            icon="i-lucide-mail"
            required
            autofocus
          />
        </UFormField>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          icon="i-lucide-alert-circle"
          :description="errorMessage"
        />

        <UButton
          type="submit"
          block
          :loading="isLoading"
        >
          Send Reset Link
        </UButton>

        <div class="text-center text-sm">
          <NuxtLink
            to="/auth/login"
            class="text-primary-600 dark:text-primary-400 hover:underline"
          >
            Back to Login
          </NuxtLink>
        </div>
      </form>
    </UCard>
  </div>
</template>
