<script setup lang="ts">
// Reset Password Page - validates token and sets new password
definePageMeta({
  layout: 'default'
})

const route = useRoute()
const router = useRouter()
const { login: setAuth } = useAuth()

const token = computed(() => route.query.token as string)
const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

// Validate token is present
if (!token.value) {
  errorMessage.value = 'Invalid reset link. Please request a new one.'
}

async function handleSubmit() {
  if (!token.value || !password.value || !confirmPassword.value) return

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match'
    return
  }

  if (password.value.length < 8) {
    errorMessage.value = 'Password must be at least 8 characters'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    interface ResetResponse {
      data?: {
        resetPassword: {
          token: string
          user: {
            id: string
            name: string
            email: string
            username: string
            avatar: string | null
          }
        }
      }
      errors?: { message: string }[]
    }

    const response = await $fetch<ResetResponse>('/api/graphql', {
      method: 'POST',
      body: {
        query: `
          mutation ResetPassword($token: String!, $newPassword: String!) {
            resetPassword(token: $token, newPassword: $newPassword) {
              token
              user {
                id
                name
                email
                username
                avatar
              }
            }
          }
        `,
        variables: {
          token: token.value,
          newPassword: password.value
        }
      }
    })

    if (response.errors?.length) {
      throw new Error(response.errors[0]?.message)
    }

    if (response.data?.resetPassword) {
      // Log the user in
      setAuth(response.data.resetPassword.token, response.data.resetPassword.user)

      // Show success and redirect
      const toast = useToast()
      toast.add({
        title: 'Password Reset Successful',
        description: 'You are now logged in with your new password.',
        color: 'success',
        icon: 'i-lucide-check-circle'
      })

      router.push('/conversations')
    }
  } catch (e) {
    errorMessage.value = (e as Error).message || 'An error occurred'
  } finally {
    isLoading.value = false
  }
}

useHead({
  title: 'Reset Password | Agora'
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 px-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-serif font-semibold text-stone-900 dark:text-stone-100">
            Reset Password
          </h1>
          <p class="text-sm text-stone-600 dark:text-stone-400 mt-1">
            Enter your new password below
          </p>
        </div>
      </template>

      <form
        class="space-y-4"
        @submit.prevent="handleSubmit"
      >
        <UFormField label="New Password">
          <UInput
            v-model="password"
            type="password"
            placeholder="••••••••"
            icon="i-lucide-lock"
            required
            autofocus
          />
        </UFormField>

        <UFormField label="Confirm Password">
          <UInput
            v-model="confirmPassword"
            type="password"
            placeholder="••••••••"
            icon="i-lucide-lock"
            required
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
          :disabled="!token"
        >
          Reset Password
        </UButton>

        <div class="text-center text-sm">
          <NuxtLink
            to="/auth/forgot-password"
            class="text-primary-600 dark:text-primary-400 hover:underline"
          >
            Request a new reset link
          </NuxtLink>
        </div>
      </form>
    </UCard>
  </div>
</template>
