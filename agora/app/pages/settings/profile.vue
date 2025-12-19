<script setup lang="ts">
import { z } from 'zod'

definePageMeta({
  middleware: 'auth'
})

const { user, token, initialize } = useAuth()
const toast = useToast()
const router = useRouter()

// Initialize auth
onMounted(() => {
  initialize()
})

// Redirect if not logged in
watch(token, (newToken) => {
  if (!newToken) {
    router.push('/auth/login')
  }
}, { immediate: true })

// Form state
const state = reactive({
  name: '',
  username: '',
  email: '',
  bio: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  avatar: ''
})

// Sync user data to form
watch(user, (newUser) => {
  if (newUser) {
    state.name = newUser.name || ''
    state.username = newUser.username || ''
    state.email = newUser.email || ''
    state.bio = newUser.bio || ''
    state.avatar = newUser.avatar || ''
  }
}, { immediate: true })

const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const isSaving = ref(false)
const showPasswordSection = ref(false)
const showPasswords = ref(false)

// Schema for validation
const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
  bio: z.string().max(300, 'Bio must be under 300 characters').optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  confirmPassword: z.string().optional()
}).refine((data) => {
  if (data.newPassword && !data.currentPassword) {
    return false
  }
  return true
}, {
  message: 'Current password is required',
  path: ['currentPassword']
}).refine((data) => {
  if (data.newPassword && data.newPassword !== data.confirmPassword) {
    return false
  }
  return true
}, {
  message: 'Passwords don\'t match',
  path: ['confirmPassword']
})

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token.value) {
    headers['Authorization'] = `Bearer ${token.value}`
  }
  return headers
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  isUploading.value = true
  const file = input.files[0]

  if (file && file.size > 500 * 1024) {
    toast.add({ title: 'File too large', description: 'Please choose an image under 500KB', color: 'error' })
    isUploading.value = false
    return
  }

  const formData = new FormData()
  formData.append('file', file as Blob)

  try {
    const data = await $fetch<{ url: string }>('/api/upload', {
      method: 'POST',
      body: formData
    })
    state.avatar = data.url
    toast.add({ title: 'Photo uploaded!', description: 'Click "Save Changes" to apply.', color: 'success' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Upload failed'
    toast.add({ title: 'Upload failed', description: message, color: 'error' })
  } finally {
    isUploading.value = false
  }
}

async function onSubmit() {
  isSaving.value = true
  try {
    const variables: Record<string, string | null | undefined> = {
      name: state.name,
      bio: state.bio,
      avatar: state.avatar,
      username: state.username,
      email: state.email
    }

    if (state.newPassword) {
      variables.currentPassword = state.currentPassword
      variables.newPassword = state.newPassword
    }

    const { errors } = await $fetch<{ data?: unknown, errors?: { message: string }[] }>('/api/graphql', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: {
        query: `
          mutation UpdateProfile($name: String, $bio: String, $avatar: String, $username: String, $email: String, $currentPassword: String, $newPassword: String) {
            updateProfile(name: $name, bio: $bio, avatar: $avatar, username: $username, email: $email, currentPassword: $currentPassword, newPassword: $newPassword) {
              id
              username
              name
              email
              avatar
              bio
            }
          }
        `,
        variables
      }
    })

    if (errors && errors.length > 0) throw new Error(errors[0]!.message)

    toast.add({ title: 'Profile updated!', color: 'success', icon: 'i-lucide-check-circle' })

    // Reset password fields
    state.currentPassword = ''
    state.newPassword = ''
    state.confirmPassword = ''
    showPasswordSection.value = false

    // Refresh user data
    initialize()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    toast.add({ title: 'Update failed', description: message, color: 'error' })
  } finally {
    isSaving.value = false
  }
}

function triggerFileInput() {
  fileInput.value?.click()
}
</script>

<template>
  <div class="min-h-screen bg-cream dark:bg-stone-950">
    <!-- Header -->
    <header class="sticky top-0 z-10 bg-cream/95 dark:bg-stone-950/95 backdrop-blur border-b border-stone-200 dark:border-stone-800 px-4 py-3">
      <div class="max-w-2xl mx-auto flex items-center gap-4">
        <NuxtLink
          to="/conversations"
          class="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
        >
          <UIcon
            name="i-lucide-arrow-left"
            class="w-5 h-5"
          />
        </NuxtLink>
        <h1 class="text-lg font-serif font-medium text-stone-800 dark:text-stone-100">
          Edit Profile
        </h1>
      </div>
    </header>

    <!-- Content -->
    <main class="max-w-2xl mx-auto px-4 py-8">
      <UCard>
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-8"
          @submit="onSubmit"
        >
          <!-- Avatar Section -->
          <div class="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-stone-200 dark:border-stone-700">
            <div class="relative">
              <UAvatar
                :src="state.avatar || undefined"
                :alt="state.name"
                size="3xl"
                class="ring-4 ring-stone-200 dark:ring-stone-700"
              />
              <div
                v-if="isUploading"
                class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full"
              >
                <UIcon
                  name="i-lucide-loader-2"
                  class="w-8 h-8 text-white animate-spin"
                />
              </div>
            </div>
            <div class="text-center sm:text-left">
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleFileChange"
              >
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-camera"
                :loading="isUploading"
                @click="triggerFileInput"
              >
                Change photo
              </UButton>
              <p class="text-xs text-stone-400 mt-2">
                JPG, PNG or GIF. Max 500KB.
              </p>
            </div>
          </div>

          <!-- Basic Info -->
          <div class="space-y-6">
            <h3 class="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide">
              Basic Information
            </h3>

            <!-- Name -->
            <UFormField
              label="Display Name"
              name="name"
              description="Shown on your conversations and profile"
            >
              <UInput
                v-model="state.name"
                placeholder="Your name"
                size="lg"
              />
            </UFormField>

            <!-- Username -->
            <UFormField
              label="Username"
              name="username"
              description="Letters, numbers, and underscores only"
            >
              <UInput
                v-model="state.username"
                placeholder="username"
                size="lg"
              >
                <template #leading>
                  <span class="text-stone-400">@</span>
                </template>
              </UInput>
            </UFormField>

            <!-- Email -->
            <UFormField
              label="Email"
              name="email"
            >
              <UInput
                v-model="state.email"
                type="email"
                placeholder="your@email.com"
                size="lg"
              />
            </UFormField>

            <!-- Bio -->
            <UFormField
              label="Bio"
              name="bio"
              :description="`${state.bio?.length || 0}/300 characters`"
            >
              <UTextarea
                v-model="state.bio"
                placeholder="Tell others about yourself..."
                :rows="3"
                :maxlength="300"
                size="lg"
              />
            </UFormField>
          </div>

          <!-- Password Section -->
          <div class="pt-6 border-t border-stone-200 dark:border-stone-700">
            <button
              type="button"
              class="flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100"
              @click="showPasswordSection = !showPasswordSection"
            >
              <UIcon
                :name="showPasswordSection ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                class="w-4 h-4"
              />
              Change Password
            </button>

            <div
              v-if="showPasswordSection"
              class="mt-6 space-y-4 pl-6 border-l-2 border-stone-200 dark:border-stone-700"
            >
              <UFormField
                label="Current Password"
                name="currentPassword"
                required
              >
                <UInput
                  v-model="state.currentPassword"
                  :type="showPasswords ? 'text' : 'password'"
                  placeholder="Enter current password"
                  size="lg"
                >
                  <template #trailing>
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      :icon="showPasswords ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                      :padded="false"
                      @click="showPasswords = !showPasswords"
                    />
                  </template>
                </UInput>
              </UFormField>

              <UFormField
                label="New Password"
                name="newPassword"
              >
                <UInput
                  v-model="state.newPassword"
                  :type="showPasswords ? 'text' : 'password'"
                  placeholder="At least 6 characters"
                  size="lg"
                >
                  <template #trailing>
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      :icon="showPasswords ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                      :padded="false"
                      @click="showPasswords = !showPasswords"
                    />
                  </template>
                </UInput>
              </UFormField>

              <UFormField
                v-if="state.newPassword"
                label="Confirm New Password"
                name="confirmPassword"
              >
                <UInput
                  v-model="state.confirmPassword"
                  :type="showPasswords ? 'text' : 'password'"
                  placeholder="Re-enter new password"
                  size="lg"
                >
                  <template #trailing>
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      :icon="showPasswords ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                      :padded="false"
                      @click="showPasswords = !showPasswords"
                    />
                  </template>
                </UInput>
              </UFormField>
            </div>
          </div>

          <!-- Submit -->
          <div class="flex justify-end gap-3 pt-6 border-t border-stone-200 dark:border-stone-700">
            <UButton
              to="/conversations"
              color="neutral"
              variant="ghost"
            >
              Cancel
            </UButton>
            <UButton
              type="submit"
              color="primary"
              :loading="isSaving"
              icon="i-lucide-check"
            >
              Save Changes
            </UButton>
          </div>
        </UForm>
      </UCard>
    </main>
  </div>
</template>
