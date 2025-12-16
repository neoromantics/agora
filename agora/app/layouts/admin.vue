<script setup lang="ts">
const { user, logout } = useAuth()
const route = useRoute()

const links = [
  { label: 'Overview', to: '/admin', icon: 'i-lucide-layout-dashboard' },
  { label: 'Conversations', to: '/admin/conversations', icon: 'i-lucide-message-square' },
  { label: 'Users', to: '/admin/users', icon: 'i-lucide-users' },
  { label: 'Thinkers', to: '/admin/people', icon: 'i-lucide-brain-circuit' }
]

async function handleLogout() {
  logout()
  await navigateTo('/auth/login')
}

// Breadcrumbs computation
const breadcrumbs = computed(() => {
  const parts = route.path.split('/').filter(Boolean)
  // parts[0] is 'admin'
  const items = [{ label: 'Admin', to: '/admin' }]

  if (parts[1]) {
    const label = parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
    items.push({ label: label, to: route.path })
  }
  return items
})

// Mobile Menu (Manual)
const isMobileMenuOpen = ref(false)

// Close menu when route changes (just in case)
watch(() => route.fullPath, () => {
  isMobileMenuOpen.value = false
})
</script>

<template>
  <div class="min-h-screen bg-stone-50 dark:bg-stone-950 flex font-sans text-stone-900 dark:text-stone-100">
    <!-- Sidebar (Desktop) -->
    <aside class="hidden lg:flex flex-col w-72 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800">
      <!-- Logo Area -->
      <div class="h-20 flex items-center px-8 border-b border-stone-100 dark:border-stone-800/50">
        <NuxtLink
          to="/admin"
          class="group flex flex-col"
        >
          <span class="text-2xl font-serif font-bold tracking-tight text-stone-900 dark:text-stone-50">
            Agora
          </span>
          <span class="text-[10px] uppercase tracking-widest text-stone-400 font-medium group-hover:text-stone-600 transition-colors">
            Administration
          </span>
        </NuxtLink>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-4 py-8 space-y-1">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 group"
          :class="[
            route.path === link.to || (link.to !== '/admin' && route.path.startsWith(link.to))
              ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-50 shadow-sm'
              : 'text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:hover:text-stone-200'
          ]"
        >
          <UIcon
            :name="link.icon"
            class="w-5 h-5 transition-colors"
            :class="[
              route.path === link.to || (link.to !== '/admin' && route.path.startsWith(link.to))
                ? 'text-stone-900 dark:text-stone-50'
                : 'text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-300'
            ]"
          />
          {{ link.label }}
        </NuxtLink>
      </nav>

      <!-- User/Footer -->
      <div class="p-4 border-t border-stone-100 dark:border-stone-800/50 bg-stone-50/50 dark:bg-stone-900/50">
        <div class="flex items-center gap-3 px-2">
          <UAvatar
            :src="user?.avatar || undefined"
            :alt="user?.name"
            size="sm"
            class="ring-2 ring-white dark:ring-stone-800"
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
              {{ user?.name }}
            </p>
            <p class="text-xs text-stone-500 truncate">
              Admin
            </p>
          </div>
          <UButton
            icon="i-lucide-log-out"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="handleLogout"
          />
        </div>
        <NuxtLink
          to="/feed"
          class="flex items-center gap-3 px-4 py-2 mt-2 text-sm font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
        >
          <UIcon
            name="i-lucide-arrow-left"
            class="w-4 h-4"
          />
          Back to App
        </NuxtLink>
      </div>
    </aside>

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Top Bar (Mobile Toggle + Breadcrumbs/Actions) -->
      <header class="h-16 flex items-center justify-between px-4 sm:px-8 bg-white/80 dark:bg-stone-950/80 backdrop-blur-md sticky top-0 z-40 border-b border-stone-200/50 dark:border-stone-800/50">
        <div class="flex items-center gap-4">
          <!-- Mobile Menu Dropdown -->
          <!-- Mobile Menu (Manual Implementation) -->
          <div class="lg:hidden relative">
            <UButton
              icon="i-lucide-menu"
              color="neutral"
              variant="ghost"
              aria-label="Toggle mobile menu"
              @click="isMobileMenuOpen = !isMobileMenuOpen"
            />

            <!-- Backdrop (Click Outside) -->
            <div
              v-if="isMobileMenuOpen"
              class="fixed inset-0 z-40 bg-black/5 dark:bg-white/5 backdrop-blur-[1px]"
              @click="isMobileMenuOpen = false"
            />

            <!-- Menu Content -->
            <Transition
              enter-active-class="transition duration-200 ease-out"
              enter-from-class="transform scale-95 opacity-0"
              enter-to-class="transform scale-100 opacity-100"
              leave-active-class="transition duration-150 ease-in"
              leave-from-class="transform scale-100 opacity-100"
              leave-to-class="transform scale-95 opacity-0"
            >
              <div
                v-if="isMobileMenuOpen"
                class="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-stone-900 rounded-xl shadow-xl ring-1 ring-stone-200 dark:ring-stone-800 z-50 overflow-hidden"
              >
                <div class="py-1">
                  <NuxtLink
                    v-for="link in links"
                    :key="link.to"
                    :to="link.to"
                    class="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors"
                    :class="[
                      route.path === link.to || (link.to !== '/admin' && route.path.startsWith(link.to))
                        ? 'bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-50'
                        : 'text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:hover:text-stone-100'
                    ]"
                    @click="isMobileMenuOpen = false"
                  >
                    <UIcon
                      :name="link.icon"
                      class="w-4 h-4"
                    />
                    {{ link.label }}
                  </NuxtLink>
                  <div class="border-t border-stone-100 dark:border-stone-800 my-1" />
                  <NuxtLink
                    to="/feed"
                    class="flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                    @click="isMobileMenuOpen = false"
                  >
                    <UIcon
                      name="i-lucide-arrow-left"
                      class="w-4 h-4"
                    />
                    Back to App
                  </NuxtLink>
                  <button
                    class="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    @click="handleLogout"
                  >
                    <UIcon
                      name="i-lucide-log-out"
                      class="w-4 h-4"
                    />
                    Sign out
                  </button>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Breadcrumbs (Simple) -->
          <nav class="hidden sm:flex items-center text-sm text-stone-500">
            <template
              v-for="(crumb, index) in breadcrumbs"
              :key="crumb.to"
            >
              <NuxtLink
                :to="crumb.to"
                class="hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                :class="{ 'font-medium text-stone-900 dark:text-stone-100': index === breadcrumbs.length - 1 }"
              >
                {{ crumb.label }}
              </NuxtLink>
              <UIcon
                v-if="index < breadcrumbs.length - 1"
                name="i-lucide-chevron-right"
                class="w-4 h-4 mx-2 text-stone-300"
              />
            </template>
          </nav>
        </div>

        <div class="flex items-center gap-3">
          <UButton
            to="/"
            variant="ghost"
            color="neutral"
            icon="i-lucide-external-link"
            label="View Site"
            class="hidden sm:flex"
            size="sm"
          />
          <!-- Theme Toggle placed here if needed, or rely on system preference -->
          <UColorModeButton
            variant="ghost"
            color="neutral"
          />
        </div>
      </header>

      <!-- Page Content -->
      <main class="flex-1 p-4 sm:p-8 overflow-y-auto">
        <div class="max-w-7xl mx-auto">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
