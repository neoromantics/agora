<script setup lang="ts">
// Register Page
definePageMeta({
  layout: 'auth'
})

// Response type
interface RegisterResponse {
  data?: {
    register: {
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

const router = useRouter()
const { login: setAuth, logout } = useAuth()

// Form state
const name = ref('')
const username = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const error = ref('')

// Form validation
const isValid = computed(() => {
  return name.value.length >= 2
    && username.value.length >= 3
    && email.value.includes('@')
    && password.value.length >= 8
    && password.value === confirmPassword.value
})

// Form submission
async function handleRegister() {
  if (!isValid.value) return

  error.value = ''
  isLoading.value = true

  try {
    const response = await $fetch<RegisterResponse>('/api/graphql', {
      method: 'POST',
      body: {
        query: `
          mutation Register($email: String!, $password: String!, $name: String!, $username: String!) {
            register(email: $email, password: $password, name: $name, username: $username) {
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
        variables: {
          email: email.value,
          password: password.value,
          name: name.value,
          username: username.value
        }
      }
    })

    if (response.errors && response.errors.length > 0) {
      throw new Error(response.errors[0]?.message || 'Registration failed')
    }

    if (!response.data) {
      throw new Error('No data received')
    }

    // Logout existing session if any to ensure clean state
    logout()

    // Use auth composable to store credentials
    setAuth(response.data.register.token, response.data.register.user)

    // Redirect to gallery
    router.push('/gallery')
  } catch (e: unknown) {
    error.value = (e as Error).message || 'Failed to create account. Please try again.'
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
          Join the conversation
        </p>
      </div>

      <!-- Register Form -->
      <UCard class="shadow-xl backdrop-blur-sm bg-white/80 dark:bg-stone-900/80 border border-stone-200/50 dark:border-stone-700/50">
        <form
          class="space-y-4"
          @submit.prevent="handleRegister"
        >
          <div>
            <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
              Full Name
            </label>
            <UInput
              v-model="name"
              type="text"
              placeholder="Your full name"
              size="xl"
              required
              autocomplete="name"
              icon="i-lucide-user"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
              Username <span class="text-stone-400 font-normal">(at least 3 characters)</span>
            </label>
            <UInput
              v-model="username"
              type="text"
              placeholder="your_username"
              size="xl"
              required
              autocomplete="username"
              icon="i-lucide-at-sign"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
              Email
            </label>
            <UInput
              v-model="email"
              type="email"
              placeholder="you@example.com"
              size="xl"
              required
              autocomplete="email"
              icon="i-lucide-mail"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
              Password <span class="text-stone-400 font-normal">(at least 8 characters)</span>
            </label>
            <UInput
              v-model="password"
              type="password"
              placeholder="••••••••"
              size="xl"
              required
              autocomplete="new-password"
              icon="i-lucide-lock"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
              Confirm Password
            </label>
            <UInput
              v-model="confirmPassword"
              type="password"
              placeholder="••••••••"
              size="xl"
              required
              autocomplete="new-password"
              icon="i-lucide-lock"
              :color="confirmPassword && password !== confirmPassword ? 'error' : undefined"
            />
            <p
              v-if="confirmPassword && password !== confirmPassword"
              class="text-red-500 text-sm mt-1"
            >
              Passwords don't match
            </p>
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
            :disabled="!isValid"
            class="mt-6"
            icon="i-lucide-user-plus"
          >
            Create Account
          </UButton>
        </form>

        <template #footer>
          <div class="text-center text-sm text-stone-500 dark:text-stone-400 pt-2">
            Already have an account?
            <NuxtLink
              to="/auth/login"
              class="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
            >
              Sign in
            </NuxtLink>
          </div>
        </template>
      </UCard>

      <!-- Terms notice -->
      <p class="text-center mt-6 text-xs text-stone-400 dark:text-stone-500 max-w-sm mx-auto">
        By creating an account, you agree to engage in respectful philosophical discourse.
      </p>

      <!-- Back to home -->
      <div class="text-center mt-6">
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
