<script setup lang="ts">
import { format } from 'date-fns'

definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

const { token } = useAuth()
const toast = useToast()

interface AdminUser {
  id: string
  name: string
  username: string
  email: string
  role: 'USER' | 'ADMIN' | 'MODERATOR'
  avatar: string
  bio?: string
  createdAt: string
  conversationCount: number
}

// Fetch Data
const { data: users, refresh, status, error } = await useAsyncData('admin-users', async () => {
  const { data, errors } = await $fetch<{ data: { adminUsers: AdminUser[] }, errors?: { message: string }[] }>('/api/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.value}` },
    body: {
      query: `
        query AdminUsers($limit: Int) {
          adminUsers(limit: $limit) {
            id
            name
            username
            email
            role
            avatar
            bio
            createdAt
            conversationCount
          }
        }
      `,
      variables: { limit: 100 }
    }
  })

  if (errors?.length) throw new Error(errors[0]!.message)
  return data?.adminUsers || []
})

// --- Search & Filtering ---
const searchQuery = ref('')
const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value || []
  const q = searchQuery.value.toLowerCase()
  return (users.value || []).filter(u =>
    u.name.toLowerCase().includes(q)
    || u.username.toLowerCase().includes(q)
    || u.email.toLowerCase().includes(q)
  )
})

// Actions - Role Update
const roleOptions = [
  { label: 'User', value: 'USER' },
  { label: 'Moderator', value: 'MODERATOR' },
  { label: 'Admin', value: 'ADMIN' }
]
const isUpdatingRole = ref(false)
const isRoleModalOpen = ref(false)
const usertoUpdateRole = ref<AdminUser | null>(null)
const selectedRole = ref('')

function openRoleModal(user: AdminUser) {
  usertoUpdateRole.value = user
  selectedRole.value = user.role
  isRoleModalOpen.value = true
}

async function saveRole() {
  if (!usertoUpdateRole.value || !selectedRole.value) return

  isUpdatingRole.value = true
  try {
    const { errors } = await $fetch<{ errors?: { message: string }[] }>('/api/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.value}` },
      body: {
        query: `
          mutation UpdateRole($userId: ID!, $role: String!) {
            updateUserRole(userId: $userId, role: $role) {
              id
              role
            }
          }
        `,
        variables: { userId: usertoUpdateRole.value.id, role: selectedRole.value }
      }
    })

    if (errors?.length) throw new Error(errors[0]!.message)

    toast.add({ title: 'Role updated', color: 'success' })
    isRoleModalOpen.value = false
    refresh()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    toast.add({ title: 'Failed to update role', description: message, color: 'error' })
  } finally {
    isUpdatingRole.value = false
  }
}

// Actions - Delete User
const showDeleteConfirm = ref(false)
const userToDelete = ref<AdminUser | null>(null)
const isDeleting = ref(false)

function confirmDelete(user: AdminUser) {
  userToDelete.value = user
  showDeleteConfirm.value = true
}

async function executeDelete() {
  if (!userToDelete.value) return
  isDeleting.value = true

  try {
    const { errors } = await $fetch<{ errors?: { message: string }[] }>('/api/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.value}` },
      body: {
        query: `
          mutation AdminDeleteUser($userId: ID!) {
            adminDeleteUser(userId: $userId)
          }
        `,
        variables: { userId: userToDelete.value.id }
      }
    })

    if (errors?.length) throw new Error(errors[0]!.message)

    toast.add({ title: 'User deleted', color: 'success' })
    refresh()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    toast.add({ title: 'Error', description: message, color: 'error' })
  } finally {
    isDeleting.value = false
    showDeleteConfirm.value = false
    userToDelete.value = null
  }
}

// --- Create/Edit User ---
const isEditModalOpen = ref(false)
const isCreating = ref(false)
const isSavingUser = ref(false)
const isUploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const editingUser = ref<AdminUser | null>(null)
const userForm = reactive({
  name: '',
  username: '',
  email: '',
  bio: '',
  avatar: '',
  role: 'USER',
  password: ''
})

function openCreateModal() {
  editingUser.value = null
  isCreating.value = true
  userForm.name = ''
  userForm.username = ''
  userForm.email = ''
  userForm.bio = ''
  userForm.avatar = ''
  userForm.role = 'USER'
  userForm.password = ''
  isEditModalOpen.value = true
}

function openEditModal(user: AdminUser) {
  editingUser.value = user
  isCreating.value = false
  userForm.name = user.name
  userForm.username = user.username
  userForm.email = user.email
  userForm.bio = user.bio || ''
  userForm.avatar = user.avatar || ''
  userForm.role = user.role
  userForm.password = '' // Don't show existing password
  isEditModalOpen.value = true
}

async function saveUser() {
  isSavingUser.value = true
  try {
    if (isCreating.value) {
      // Create new user
      if (!userForm.password) {
        throw new Error('Password is required for new users')
      }
      const { errors } = await $fetch<{ errors?: { message: string }[] }>('/api/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.value}` },
        body: {
          query: `
            mutation AdminCreateUser($email: String!, $password: String!, $name: String!, $username: String!, $role: String) {
              adminCreateUser(email: $email, password: $password, name: $name, username: $username, role: $role) {
                id
              }
            }
          `,
          variables: {
            email: userForm.email,
            password: userForm.password,
            name: userForm.name,
            username: userForm.username,
            role: userForm.role
          }
        }
      })
      if (errors?.length) throw new Error(errors[0]!.message)
      toast.add({ title: 'User created', color: 'success' })
    } else {
      // Update existing user
      const variables: Record<string, string | undefined> = {
        userId: editingUser.value!.id,
        name: userForm.name,
        username: userForm.username,
        email: userForm.email,
        bio: userForm.bio,
        avatar: userForm.avatar,
        role: userForm.role
      }
      if (userForm.password) {
        variables.newPassword = userForm.password
      }
      const { errors } = await $fetch<{ errors?: { message: string }[] }>('/api/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.value}` },
        body: {
          query: `
            mutation AdminUpdateUser($userId: ID!, $name: String, $username: String, $email: String, $bio: String, $avatar: String, $role: String, $newPassword: String) {
              adminUpdateUser(userId: $userId, name: $name, username: $username, email: $email, bio: $bio, avatar: $avatar, role: $role, newPassword: $newPassword) {
                id
              }
            }
          `,
          variables
        }
      })
      if (errors?.length) throw new Error(errors[0]!.message)
      toast.add({ title: 'User updated', color: 'success' })
    }
    isEditModalOpen.value = false
    refresh()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    toast.add({ title: 'Error', description: message, color: 'error' })
  } finally {
    isSavingUser.value = false
  }
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  isUploading.value = true
  const file = input.files[0]

  // 5MB limit
  if (file && file.size > 5 * 1024 * 1024) {
    toast.add({ title: 'File too large', description: 'Please choose an image under 5MB', color: 'error' })
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
    userForm.avatar = data.url
    toast.add({ title: 'Photo uploaded', color: 'success' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Upload failed'
    toast.add({ title: 'Upload failed', description: message, color: 'error' })
  } finally {
    isUploading.value = false
    // Reset input
    input.value = ''
  }
}

function triggerFileInput() {
  fileInput.value?.click()
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-serif font-medium text-stone-900 dark:text-stone-100">
          Users
        </h1>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Manage platform members and permissions
        </p>
      </div>
      <div class="w-full sm:w-auto flex gap-2">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Search users..."
          size="sm"
          class="min-w-[200px] w-full"
        />
        <UButton
          icon="i-lucide-user-plus"
          color="primary"
          size="sm"
          @click="openCreateModal"
        >
          Create
        </UButton>
      </div>
    </div>

    <!-- Grid -->
    <ClientOnly>
      <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        <div
          v-for="user in filteredUsers"
          :key="user.id"
          class="group relative bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden hover:shadow-lg hover:border-stone-300 dark:hover:border-stone-700 transition-all duration-300 flex flex-col"
        >
          <!-- Header (Avatar + Name) -->
          <div class="p-4 flex items-center gap-3 border-b border-stone-100 dark:border-stone-800/50 bg-stone-50/50 dark:bg-stone-800/20">
            <NuxtLink
              :to="`/user/${user.username}`"
              class="hover:scale-110 transition-transform"
            >
              <UAvatar
                :src="user.avatar"
                :alt="user.name"
                size="md"
                class="ring-1 ring-stone-200 dark:ring-stone-700 cursor-pointer"
              />
            </NuxtLink>
            <div class="min-w-0 flex-1">
              <h3 class="font-medium text-stone-900 dark:text-stone-100 truncate">
                {{ user.name }}
              </h3>
              <p class="text-xs text-stone-500 truncate">
                @{{ user.username }}
              </p>
            </div>
            <!-- Role Badge/Dropdown -->
            <!-- Role Badge (Click to Edit) -->
            <UTooltip text="Click to change role">
              <UBadge
                :color="user.role === 'ADMIN' ? 'primary' : (user.role === 'MODERATOR' ? 'warning' : 'neutral')"
                variant="subtle"
                size="xs"
                class="cursor-pointer hover:ring-1 hover:ring-current transition-all"
                @click="openRoleModal(user)"
              >
                {{ user.role }}
              </UBadge>
            </UTooltip>
          </div>

          <!-- Body Info -->
          <div class="p-4 space-y-3 flex-1 text-sm">
            <div class="flex items-center gap-2 text-stone-600 dark:text-stone-400">
              <UIcon
                name="i-lucide-mail"
                class="w-4 h-4 text-stone-400"
              />
              <span
                class="truncate"
                :title="user.email"
              >{{ user.email }}</span>
            </div>
            <div class="flex items-center gap-2 text-stone-600 dark:text-stone-400">
              <UIcon
                name="i-lucide-message-square"
                class="w-4 h-4 text-stone-400"
              />
              <span>{{ user.conversationCount }} conversations</span>
            </div>
            <div class="flex items-center gap-2 text-stone-600 dark:text-stone-400">
              <UIcon
                name="i-lucide-calendar"
                class="w-4 h-4 text-stone-400"
              />
              <span>Joined {{ format(new Date(user.createdAt), 'MMM d, yyyy') }}</span>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="p-3 border-t border-stone-100 dark:border-stone-800 flex justify-end gap-2 bg-stone-50/30 dark:bg-stone-800/10">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              size="xs"
              label="Edit"
              @click="openEditModal(user)"
            />
            <UButton
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              size="xs"
              label="Delete"
              @click="confirmDelete(user)"
            />
          </div>
        </div>
      </div>
    </ClientOnly>

    <!-- Empty State -->
    <div
      v-if="!status && (filteredUsers.length === 0 || error)"
      class="text-center py-12 text-stone-500"
    >
      <div
        v-if="error"
        class="text-red-500 mb-2"
      >
        Error loading users: {{ error.message }}
      </div>
      <div v-else>
        No users found matching "{{ searchQuery }}"
      </div>
    </div>

    <!-- Role Edit Modal -->
    <!-- Role Edit Modal -->
    <UModal v-model:open="isRoleModalOpen">
      <template #content>
        <ClientOnly>
          <UCard>
            <template #header>
              <h3 class="text-lg font-bold text-stone-900 dark:text-stone-100">
                Update User Role
              </h3>
            </template>

            <div class="p-4 space-y-4">
              <p class="text-sm text-stone-600 dark:text-stone-400">
                Select a new role for <strong>@{{ usertoUpdateRole?.username }}</strong>.
              </p>

              <div class="space-y-3">
                <div
                  v-for="option in roleOptions"
                  :key="option.value"
                  class="flex items-center p-3 rounded-lg border cursor-pointer transition-colors"
                  :class="selectedRole === option.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20' : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'"
                  @click="selectedRole = option.value"
                >
                  <URadio
                    v-model="selectedRole"
                    :value="option.value"
                    :ui="{ wrapper: 'items-center' }"
                  />
                  <span class="ml-3 font-medium text-stone-900 dark:text-stone-100">
                    {{ option.label }}
                  </span>
                </div>
              </div>

              <div
                v-if="selectedRole === 'ADMIN'"
                class="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 rounded"
              >
                ⚠️ Warning: Admins have full access to the system.
              </div>
            </div>

            <template #footer>
              <div class="flex justify-end gap-3">
                <UButton
                  label="Cancel"
                  color="neutral"
                  variant="ghost"
                  @click="isRoleModalOpen = false"
                />
                <UButton
                  label="Save Role"
                  color="primary"
                  :loading="isUpdatingRole"
                  @click="saveRole"
                />
              </div>
            </template>
          </UCard>
        </ClientOnly>
      </template>
    </UModal>

    <!-- Delete Modal -->
    <UModal v-model:open="showDeleteConfirm">
      <template #content>
        <UCard>
          <div class="text-center p-4">
            <UIcon
              name="i-lucide-user-x"
              class="w-12 h-12 mx-auto mb-4 text-red-500"
            />
            <h3 class="text-lg font-bold text-stone-900 dark:text-stone-100 mb-2">
              Delete User?
            </h3>
            <p class="text-stone-600 dark:text-stone-400 mb-6">
              This will permanently delete <strong>@{{ userToDelete?.username }}</strong> and ALL their data.
            </p>
            <div class="flex justify-center gap-3">
              <UButton
                label="Cancel"
                color="neutral"
                variant="ghost"
                @click="showDeleteConfirm = false"
              />
              <UButton
                label="Delete User"
                color="error"
                :loading="isDeleting"
                @click="executeDelete"
              />
            </div>
          </div>
        </UCard>
      </template>
    </UModal>

    <!-- Create/Edit User Modal -->
    <UModal v-model:open="isEditModalOpen">
      <template #content>
        <ClientOnly>
          <UCard>
            <template #header>
              <h3 class="text-lg font-bold text-stone-900 dark:text-stone-100">
                {{ isCreating ? 'Create User' : 'Edit User' }}
              </h3>
            </template>

            <div class="p-4 space-y-4">
              <!-- Avatar Preview -->
              <div class="flex items-center gap-4 pb-4 border-b border-stone-200 dark:border-stone-700">
                <div class="relative">
                  <UAvatar
                    :src="userForm.avatar || undefined"
                    :alt="userForm.name"
                    size="xl"
                  />
                  <div
                    v-if="isUploading"
                    class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full"
                  >
                    <UIcon
                      name="i-lucide-loader-2"
                      class="w-6 h-6 text-white animate-spin"
                    />
                  </div>
                </div>
                <div class="flex-1">
                  <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Avatar
                  </label>
                  <div class="flex gap-2">
                    <UInput
                      v-model="userForm.avatar"
                      placeholder="https://..."
                      size="sm"
                      class="flex-1"
                    />
                    <input
                      ref="fileInput"
                      type="file"
                      accept="image/*"
                      class="hidden"
                      @change="handleFileChange"
                    >
                    <UTooltip text="Upload photo (max 5MB)">
                      <UButton
                        color="neutral"
                        variant="soft"
                        icon="i-lucide-camera"
                        size="sm"
                        :loading="isUploading"
                        @click="triggerFileInput"
                      />
                    </UTooltip>
                  </div>
                </div>
              </div>

              <!-- Name -->
              <div>
                <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Name *
                </label>
                <UInput
                  v-model="userForm.name"
                  placeholder="Display name"
                />
              </div>

              <!-- Username -->
              <div>
                <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Username *
                </label>
                <UInput
                  v-model="userForm.username"
                  placeholder="username"
                >
                  <template #leading>
                    <span class="text-stone-400">@</span>
                  </template>
                </UInput>
              </div>

              <!-- Email -->
              <div>
                <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Email *
                </label>
                <UInput
                  v-model="userForm.email"
                  type="email"
                  placeholder="email@example.com"
                />
              </div>

              <!-- Bio -->
              <div>
                <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Bio
                </label>
                <UTextarea
                  v-model="userForm.bio"
                  placeholder="About this user..."
                  :rows="2"
                />
              </div>

              <!-- Role -->
              <div>
                <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Role
                </label>
                <USelect
                  v-model="userForm.role"
                  :items="roleOptions"
                  value-key="value"
                  label-key="label"
                />
              </div>

              <!-- Password -->
              <div>
                <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  {{ isCreating ? 'Password *' : 'New Password (leave blank to keep current)' }}
                </label>
                <UInput
                  v-model="userForm.password"
                  type="password"
                  :placeholder="isCreating ? 'Required' : 'Optional'"
                />
              </div>
            </div>

            <template #footer>
              <div class="flex justify-end gap-3">
                <UButton
                  label="Cancel"
                  color="neutral"
                  variant="ghost"
                  @click="isEditModalOpen = false"
                />
                <UButton
                  :label="isCreating ? 'Create User' : 'Save Changes'"
                  color="primary"
                  :loading="isSavingUser"
                  @click="saveUser"
                />
              </div>
            </template>
          </UCard>
        </ClientOnly>
      </template>
    </UModal>
  </div>
</template>
