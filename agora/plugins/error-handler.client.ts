export default defineNuxtPlugin((nuxtApp) => {
  // Only setup on client
  if (!import.meta.client) return

  const logger = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    log: (error: any, context?: any) => {
      // Prevent infinite loops if the log endpoint itself fails
      if (context?.url?.includes('/api/logs')) return

      const payload = {
        level: 'error',
        message: error?.message || String(error),
        stack: error?.stack,
        context: {
          ...context,
          url: window.location.href,
          timestamp: new Date().toISOString()
        },
        userAgent: navigator.userAgent
      }

      // Use fetch directly to avoid Nuxt hook overhead/loops
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true // Ensure request is sent even if page unloads
      }).catch((e) => {
        // Fallback to console if network log fails
        console.warn('Failed to send error log:', e)
      })
    }
  }

  // 1. Vue Errors
  nuxtApp.vueApp.config.errorHandler = (error, instance, info) => {
    logger.log(error, { type: 'vue', info, component: instance?.$options?.__name })
    console.error('[Vue Error]', error) // Keep local console for dev
  }

  // 2. Global Window Errors
  window.onerror = (message, source, lineno, colno, error) => {
    logger.log(error || message, { type: 'global', source, lineno, colno })
  }

  // 3. Unhandled Promise Rejections
  window.onunhandledrejection = (event) => {
    logger.log(event.reason, { type: 'promise' })
  }

  return {
    provide: {
      clientLogger: logger
    }
  }
})
