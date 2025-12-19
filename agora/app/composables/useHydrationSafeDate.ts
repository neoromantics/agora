/**
 * Hydration-safe date formatting composable
 *
 * Returns an empty string during SSR and updates to the formatted value
 * after client-side hydration to prevent hydration mismatches.
 *
 * Date/time formatting can differ between server and client due to:
 * - Timezone differences
 * - Relative time calculations ("5m ago" changes between render and hydration)
 * - Locale differences
 */
import type { Ref } from 'vue'

/**
 * Creates a hydration-safe formatted date value
 * @param dateStr - The date string to format (can be reactive)
 * @param formatter - Function to format the date string
 * @returns Computed ref that's empty during SSR, formatted after hydration
 */
export const useHydrationSafeDate = (
  dateStr: string | Ref<string>,
  formatter: (dateStr: string) => string
) => {
  const isHydrated = ref(false)

  onMounted(() => {
    isHydrated.value = true
  })

  return computed(() => {
    if (!isHydrated.value) return ''
    const date = unref(dateStr)
    return date ? formatter(date) : ''
  })
}

/**
 * Hook version for use in v-for loops where you need to format multiple dates
 * Returns a function that formats dates only after hydration
 */
export const useHydrationSafeFormatter = (formatter: (dateStr: string) => string) => {
  const isHydrated = ref(false)

  onMounted(() => {
    isHydrated.value = true
  })

  return (dateStr: string) => {
    if (!isHydrated.value) return ''
    return dateStr ? formatter(dateStr) : ''
  }
}
