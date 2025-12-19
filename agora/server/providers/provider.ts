/**
 * LLM Provider Interface
 *
 * All LLM providers must implement this interface to be used
 * interchangeably in the application.
 */
export interface LLMProvider {
  /**
     * Generate a response from the LLM
     * @param prompt - The full prompt to send
     * @param timeoutMs - Request timeout in milliseconds
     * @returns The generated text response
     */
  generate(prompt: string, timeoutMs?: number): Promise<string>
}

/**
 * Supported LLM provider names
 */
export type LLMProviderName = 'gemini'

/**
 * Default configuration for LLM providers
 */
export const LLM_DEFAULTS = {
  provider: 'gemini' as LLMProviderName,
  model: 'gemma-3-27b-it',
  maxOutputTokens: 400,
  timeoutMs: 30000
}
