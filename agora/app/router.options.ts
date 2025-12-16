// Router options - preserve scroll position on back navigation
import type { RouterConfig } from '@nuxt/schema'

export default <RouterConfig>{
  scrollBehavior(to, from, savedPosition) {
    // If the user navigates back (using browser back or NuxtLink with back),
    // restore their previous scroll position
    if (savedPosition) {
      return savedPosition
    }

    // For hash links (anchors), scroll to the element
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth'
      }
    }

    // For new page navigation, scroll to top
    return { top: 0 }
  }
}
