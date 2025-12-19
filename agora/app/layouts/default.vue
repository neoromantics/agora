<script setup lang="ts">
const navLinks = [
  { label: 'Gallery', to: '/gallery', icon: 'i-lucide-users' },
  { label: 'Feed', to: '/feed', icon: 'i-lucide-book-open' }
]

const { user, isAuthenticated, logout: handleLogout } = useAuth()

function logout() {
  handleLogout()
  navigateTo('/')
}

const userMenuItems = computed(() => [
  [{
    label: user.value?.name || 'Profile',
    avatar: { src: user.value?.avatar || undefined },
    disabled: true
  }],
  [{
    label: 'My Profile',
    icon: 'i-lucide-user',
    to: `/user/${user.value?.username}`
  }, {
    label: 'My Conversations',
    icon: 'i-lucide-message-square',
    to: '/conversations'
  }],
  [{
    label: 'Sign Out',
    icon: 'i-lucide-log-out',
    click: logout,
    onSelect: logout
  }]
])
</script>

<template>
  <div class="flex flex-col min-h-screen">
    <!-- Header using NuxtUI components -->
    <header class="sticky top-0 z-50 backdrop-blur border-b border-(--ui-border)">
      <UContainer class="flex items-center justify-between h-16">
        <!-- Left: Logo + Nav -->
        <div class="flex items-center gap-6">
          <NuxtLink to="/">
            <span class="text-2xl font-serif font-semibold text-(--ui-text)">
              Agora
            </span>
          </NuxtLink>

          <UNavigationMenu :items="navLinks.map(link => ({ label: link.label, to: link.to, icon: link.icon }))" />
        </div>

        <!-- Right: Theme + Auth -->
        <div class="flex items-center gap-2">
          <UColorModeButton />

          <template v-if="isAuthenticated">
            <UDropdownMenu :items="userMenuItems">
              <UButton
                variant="ghost"
                color="neutral"
                trailing-icon="i-lucide-chevron-down"
              >
                <UAvatar
                  :src="user?.avatar || undefined"
                  :alt="user?.name"
                  size="xs"
                />
              </UButton>
            </UDropdownMenu>
          </template>

          <template v-else>
            <UButton
              to="/auth/login"
              variant="ghost"
              color="neutral"
            >
              Sign In
            </UButton>
          </template>
        </div>
      </UContainer>
    </header>

    <UMain class="flex-1">
      <slot />
    </UMain>

    <template v-if="!$route.path.startsWith('/conversation/')">
      <UFooter class="py-6 border-t border-(--ui-border)">
        <template #left>
          <p class="text-sm text-stone-500 dark:text-stone-400">
            &copy; {{ new Date().getFullYear() }} Agora. All rights reserved.
          </p>
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              to="/about"
              variant="ghost"
              color="neutral"
              size="sm"
            >
              About
            </UButton>
            <UButton
              to="/privacy"
              variant="ghost"
              color="neutral"
              size="sm"
            >
              Privacy
            </UButton>
            <UButton
              to="/terms"
              variant="ghost"
              color="neutral"
              size="sm"
            >
              Terms
            </UButton>
            <UButton
              to="https://github.com/neoromantics"
              target="_blank"
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-simple-icons-github"
            />
          </div>
        </template>
      </UFooter>
    </template>
  </div>
</template>
