<script setup lang="ts">
// Login Page
definePageMeta({
  layout: 'auth'
})

// Response type
interface LoginResponse {
  data?: {
    login: {
      token: string
      user: {
        id: string
        name: string
        username: string
        email: string
        avatar: string | null
      }
    }
  }
  errors?: Array<{ message: string }>
}

const route = useRoute()
const { login: setAuth, logout } = useAuth()

// Form state
const identifier = ref('')
const password = ref('')
const isLoading = ref(false)
const error = ref('')

// Form submission
async function handleLogin() {
  error.value = ''
  isLoading.value = true

  try {
    const response = await $fetch<LoginResponse>('/api/graphql', {
      method: 'POST',
      body: {
        query: `
          mutation Login($identifier: String!, $password: String!) {
            login(identifier: $identifier, password: $password) {
              token
              user {
                id
                name
                username
                email
                avatar
                role

              }
            }
          }
        `,
        variables: { identifier: identifier.value, password: password.value }
      }
    })

    if (response.errors && response.errors.length > 0) {
      throw new Error(response.errors[0]?.message || 'Login failed')
    }

    if (!response.data) {
      throw new Error('No data received')
    }

    // Logout existing session if any to ensure clean state
    logout()

    // Use auth composable to store credentials
    setAuth(response.data.login.token, response.data.login.user)

    // Redirect to return URL or gallery
    const redirectParam = route.query.redirect
    const redirectTo = typeof redirectParam === 'string' ? redirectParam : '/gallery'

    await navigateTo(redirectTo)
  } catch (e: unknown) {
    error.value = (e as Error).message || 'Failed to login. Please try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-6 py-12 bg-gradient-to-br from-stone-100 via-stone-50 to-indigo-50 dark:from-stone-900 dark:via-stone-950 dark:to-indigo-950">
    <div class="w-full max-w-md">
      <!-- Logo/Brand -->
      <div class="text-center mb-10">
        <NuxtLink
          to="/"
          class="inline-block"
        >
          <h1 class="text-5xl font-serif font-semibold text-stone-800 dark:text-stone-100 tracking-tight">
            Agora
          </h1>
        </NuxtLink>
        <p class="text-stone-500 dark:text-stone-400 mt-3 text-lg">
          Welcome back to the conversation
        </p>
      </div>

      <!-- Login Form -->
      <UCard class="shadow-xl backdrop-blur-sm bg-white/80 dark:bg-stone-900/80 border border-stone-200/50 dark:border-stone-700/50">
        <form
          class="space-y-5"
          @submit.prevent="handleLogin"
        >
          <div>
            <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
              Email or Username
            </label>
            <UInput
              v-model="identifier"
              type="text"
              placeholder="Enter your email or username"
              size="xl"
              required
              autocomplete="username"
              icon="i-lucide-user"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
              Password
            </label>
            <UInput
              v-model="password"
              type="password"
              placeholder="••••••••"
              size="xl"
              required
              autocomplete="current-password"
              icon="i-lucide-lock"
            />
          </div>

          <UAlert
            v-if="error"
            color="error"
            variant="subtle"
            icon="i-lucide-alert-circle"
            :title="error"
            class="mt-4"
          />

          <UButton
            type="submit"
            block
            size="xl"
            :loading="isLoading"
            class="mt-6"
            icon="i-lucide-log-in"
          >
            Sign In
          </UButton>
        </form>

        <template #footer>
          <div class="text-center space-y-3 pt-2">
            <NuxtLink
              to="/auth/forgot-password"
              class="text-sm text-stone-500 dark:text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline block"
            >
              Forgot your password?
            </NuxtLink>
            <div class="text-sm text-stone-500 dark:text-stone-400">
              Don't have an account?
              <NuxtLink
                to="/auth/register"
                class="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                Create one
              </NuxtLink>
            </div>
          </div>
        </template>
      </UCard>

      <!-- Back to home -->
      <div class="text-center mt-8">
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
        >
          <UIcon
            name="i-lucide-arrow-left"
            class="w-4 h-4"
          />
          Back to Agora
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
