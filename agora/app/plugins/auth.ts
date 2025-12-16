// Initialize auth state globally (Server & Client)
export default defineNuxtPlugin(async () => {
  const { initialize, hasAuthCookie, isAuthenticated } = useAuth()

  // Systematic Check:
  // If we have a cookie, we MUST resolve the user session before the app loads.
  // This ensures that all subsequent data fetches (Pages, Components) have the correct Authorization headers.
  if (hasAuthCookie.value && !isAuthenticated.value) {
    await initialize()
  }
})
