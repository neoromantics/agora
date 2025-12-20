export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  const errors: string[] = []

  // Skip validation in development if not strictly required,
  // but here we enforce it to "Adopt good practice and secure" as requested.
  // We can make exceptions for build time if needed, but runtime is critical.

  if (!config.jwtSecret) {
    errors.push('Missing configuration: JWT_SECRET (NUXT_JWT_SECRET)')
  } else if (config.jwtSecret.length < 32) {
    errors.push(`Insecure configuration: JWT_SECRET must be at least 32 characters (current: ${config.jwtSecret.length})`)
  }

  if (!config.databaseUrl) {
    errors.push('Missing configuration: DATABASE_URL (NUXT_DATABASE_URL)')
  }

  if (!config.redisUrl) {
    errors.push('Missing configuration: REDIS_URL (NUXT_REDIS_URL)')
  }

  // GEMINI_API_KEY is technically optional if LLM is disabled, but let's assume it's core for now or check disableLlm
  if (!config.disableLlm && !config.geminiApiKey) {
    errors.push('Missing configuration: GEMINI_API_KEY (NUXT_GEMINI_API_KEY) - required unless disableLlm is set')
  }

  if (errors.length > 0) {
    console.error('❌ FATAL: Invalid Server Configuration')
    errors.forEach(err => console.error(`   - ${err}`))

    // In production, we should fail fast
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Server configuration validation failed. See logs for details.`)
    } else {
      console.warn('⚠️  Dev Mode: Proceeding despite configuration errors (some features may break)')
    }
  }
})
