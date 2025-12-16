<script setup lang="ts">
import { z } from 'zod'

const props = defineProps<{
  user: {
    name: string
    username: string
    bio?: string | null
    avatar?: string | null
  }
  refresh: () => void
}>()

const isOpen = defineModel<boolean>('isOpen')
const { mutate } = useGraphQL()
const toast = useToast()

const state = reactive({
  name: props.user.name,
  username: props.user.username,
  bio: props.user.bio || '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  avatar: props.user.avatar || ''
})

const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const isSaving = ref(false)
const showPasswordSection = ref(false)

// Schema for validation
const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
  bio: z.string().max(300, 'Bio must be under 300 characters').optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  confirmPassword: z.string().optional()
}).refine((data) => {
  // If new password is provided, current password is required
  if (data.newPassword && !data.currentPassword) {
    return false
  }
  return true
}, {
  message: 'Current password is required',
  path: ['currentPassword']
}).refine((data) => {
  // New password and confirm must match
  if (data.newPassword && data.newPassword !== data.confirmPassword) {
    return false
  }
  return true
}, {
  message: 'Passwords don\'t match',
  path: ['confirmPassword']
})

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
    toast.add({ title: 'Photo uploaded!', description: 'Click "Save" to apply.', color: 'success' })
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
      username: state.username
    }

    // Only include password fields if changing password
    if (state.newPassword) {
      variables.currentPassword = state.currentPassword
      variables.newPassword = state.newPassword
    }

    const mutation = `
      mutation UpdateProfile($name: String, $bio: String, $avatar: String, $username: String, $currentPassword: String, $newPassword: String) {
        updateProfile(name: $name, bio: $bio, avatar: $avatar, username: $username, currentPassword: $currentPassword, newPassword: $newPassword) {
          id
          username
          name
          avatar
          bio
        }
      }
    `

    await mutate(mutation, variables)

    toast.add({ title: 'Profile updated!', color: 'success', icon: 'i-lucide-check-circle' })
    isOpen.value = false
    // Reset password fields
    state.currentPassword = ''
    state.newPassword = ''
    state.confirmPassword = ''
    showPasswordSection.value = false
    props.refresh()
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
  <UModal
    v-if="isOpen"
    v-model="isOpen"
  >
    <UCard class="w-full max-w-md">
      <!-- Header -->
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-stone-900 dark:text-stone-100">
            Edit Profile
          </h3>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            size="xs"
            @click="isOpen = false"
          />
        </div>
      </template>

      <UForm
        :schema="schema"
        :state="state"
        class="space-y-5"
        @submit="onSubmit"
      >
        <!-- Avatar -->
        <div class="flex items-center gap-4">
          <div class="relative">
            <UAvatar
              :src="state.avatar || undefined"
              :alt="state.name"
              size="xl"
              class="ring-2 ring-stone-200 dark:ring-stone-700"
            />
            <div
              v-if="isUploading"
              class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full"
            >
              <UIcon
                name="i-lucide-loader-2"
                class="w-5 h-5 text-white animate-spin"
              />
            </div>
          </div>
          <div>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleFileChange"
            >
            <UButton
              size="sm"
              color="neutral"
              variant="soft"
              icon="i-lucide-camera"
              :loading="isUploading"
              @click="triggerFileInput"
            >
              Change photo
            </UButton>
            <p class="text-xs text-stone-400 mt-1">
              Max 500KB
            </p>
          </div>
        </div>

        <!-- Name -->
        <div>
          <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
            Display Name
          </label>
          <UInput
            v-model="state.name"
            placeholder="Your name"
            size="md"
          />
          <p class="text-xs text-stone-400 mt-1">
            Shown on your conversations and profile
          </p>
        </div>

        <!-- Username -->
        <div>
          <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
            Username
          </label>
          <UInput
            v-model="state.username"
            placeholder="username"
            size="md"
          >
            <template #leading>
              <span class="text-stone-400 text-sm">@</span>
            </template>
          </UInput>
          <p class="text-xs text-stone-400 mt-1">
            Letters, numbers, and underscores only
          </p>
        </div>

        <!-- Bio -->
        <div>
          <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
            Bio
          </label>
          <UTextarea
            v-model="state.bio"
            placeholder="Tell others about yourself..."
            :rows="2"
            :maxlength="300"
            size="md"
          />
          <p class="text-xs text-stone-400 mt-1">
            {{ state.bio?.length || 0 }}/300 characters
          </p>
        </div>

        <!-- Password Section Toggle -->
        <div class="border-t border-stone-200 dark:border-stone-700 pt-4">
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
            class="mt-4 space-y-3 pl-6 border-l-2 border-stone-200 dark:border-stone-700"
          >
            <div>
              <label class="block text-xs text-stone-500 dark:text-stone-400 mb-1">
                Current Password <span class="text-red-500">*</span>
              </label>
              <UInput
                v-model="state.currentPassword"
                type="password"
                placeholder="Enter current password"
                size="md"
              />
            </div>

            <div>
              <label class="block text-xs text-stone-500 dark:text-stone-400 mb-1">
                New Password
              </label>
              <UInput
                v-model="state.newPassword"
                type="password"
                placeholder="At least 6 characters"
                size="md"
              />
            </div>

            <div v-if="state.newPassword">
              <label class="block text-xs text-stone-500 dark:text-stone-400 mb-1">
                Confirm New Password
              </label>
              <UInput
                v-model="state.confirmPassword"
                type="password"
                placeholder="Re-enter new password"
                size="md"
              />
            </div>
          </div>
        </div>
      </UForm>

      <!-- Footer -->
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            @click="isOpen = false"
          >
            Cancel
          </UButton>
          <UButton
            color="primary"
            size="sm"
            :loading="isSaving"
            @click="onSubmit"
          >
            Save Changes
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
