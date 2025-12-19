/**
 * LLM Provider Factory
 *
 * Returns the appropriate LLM provider based on configuration.
 * Add new providers here as they are implemented.
 */
import type { LLMProvider, LLMProviderName } from './provider'
import { LLM_DEFAULTS } from './provider'
import { GeminiProvider } from './gemini'

// Provider registry - add new providers here
const providers: Record<LLMProviderName, LLMProvider> = {
  gemini: GeminiProvider
}

/**
 * Get the configured LLM provider
 *
 * @returns The LLM provider instance
 * @throws Error if the configured provider is not supported
 */
export function getLLMProvider(): LLMProvider {
  const config = useRuntimeConfig()
  const providerName = (config.llmProvider || LLM_DEFAULTS.provider) as LLMProviderName

  const provider = providers[providerName]
  if (!provider) {
    console.warn(`[LLM] Unknown provider "${providerName}", falling back to gemini`)
    return providers.gemini
  }

  return provider
}

// Re-export types and defaults for convenience
export type { LLMProvider, LLMProviderName }
export { LLM_DEFAULTS }
