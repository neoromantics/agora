export default defineNuxtRouteMiddleware(async (to) => {
  const { user, isAuthenticated, hasAuthCookie, initialize } = useAuth()

  // On server: ONLY verify auth cookie exists
  // We cannot reliably check user state during SSR because:
  // 1. The auth state might not be hydrated yet
  // 2. We can't make API calls during SSR (loopback issues)
  // Defense-in-depth happens on client + API layer
  if (import.meta.server) {
    if (!hasAuthCookie.value) {
      return navigateTo({
        path: '/auth/login',
        query: { redirect: to.fullPath }
      })
    }
    // Cookie exists, allow SSR to proceed
    // Client will validate role immediately on hydration
    return
  }

  // Client-side: perform full authentication check
  if (hasAuthCookie.value && !isAuthenticated.value) {
    await initialize()
  }

  // Verify authentication state
  if (!isAuthenticated.value || !user.value) {
    return navigateTo({
      path: '/auth/login',
      query: { redirect: to.fullPath }
    })
  }

  // Check for ADMIN role (validated by backend during initialize())
  if (user.value.role !== 'ADMIN') {
    return navigateTo('/')
  }
})
