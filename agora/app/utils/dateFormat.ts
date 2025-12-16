/**
 * Centralized date/time formatting utilities
 * Replaces 8+ duplicated formatDate/formatTime functions across the codebase
 */

/**
 * Format a date string as a relative time (e.g., "5m ago", "2h ago", "3d ago")
 * For dates older than 7 days, returns formatted date like "Dec 9"
 */
export function formatRelativeTime(dateStr: string): string {
  if (!dateStr || dateStr === 'Invalid Date') return 'just now'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'just now'

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Format a date string as a medium date (e.g., "Dec 9, 2024")
 */
export function formatMediumDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''

  return date.toLocaleDateString('en-US', {
    dateStyle: 'medium'
  })
}

/**
 * Format a date string as a short date (e.g., "12/9/2024")
 */
export function formatShortDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString()
}

/**
 * Format a date string as time only (e.g., "3:45 PM")
 */
export function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date)
}

/**
 * Composable for date formatting (for use in Vue components)
 */
export const useDateFormat = () => {
  return {
    formatRelativeTime,
    formatMediumDate,
    formatShortDate,
    formatTime
  }
}
