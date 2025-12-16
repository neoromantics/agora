// Auth middleware to protect routes
// Auth middleware to protect routes
export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated, initialize, hasAuthCookie } = useAuth()

  // Try to recover session if cookie exists but not authenticated (SSR or missing cache)
  if (hasAuthCookie.value && !isAuthenticated.value) {
    await initialize()
  }

  // List of routes that require authentication
  const protectedRoutes = [
    '/conversations',
    '/conversation',
    '/settings'
  ]

  // Check if current route requires auth (match without base path since to.path includes it)
  const requiresAuth = protectedRoutes.some(route => to.path.includes(route))

  if (requiresAuth && !isAuthenticated.value) {
    // Redirect to login with return URL
    return navigateTo({
      path: '/auth/login',
      query: { redirect: to.fullPath }
    })
  }
})
