import type { Message, PhilosopherContext } from '../types/llm'
import { CircuitBreaker } from '../services/circuitBreaker'
import { RateLimiter } from '../services/rateLimiter'
import { PromptBuilder } from '../services/promptBuilder'
import { FallbackService } from '../services/fallbacks'
import { getLLMProvider } from '../providers'

// Configuration
const CONFIG = {
  REQUEST_TIMEOUT: 30 * 1000,
  MAX_MESSAGE_LENGTH: 2000,
  MAX_CONTEXT_CHARS: 12000
}

export type { Message, PhilosopherContext }

/**
 * Generate a response from a philosopher using Gemini
 */
export async function generatePhilosopherResponse(
  philosopher: PhilosopherContext,
  conversationHistory: Message[],
  userMessage: string,
  userId?: string
): Promise<string> {
  // Check circuit breaker
  if (CircuitBreaker.isOpen()) {
    console.log(`[LLM] Circuit breaker open - serving fallback for ${philosopher.name}`)
    return FallbackService.getResponse(philosopher.name, userMessage)
  }

  // Check user rate limit
  if (userId && !RateLimiter.checkUserLimit(userId)) {
    return 'I appreciate your enthusiasm, but let us pause for a moment. Even Socrates took breaks between dialogues. Please wait a minute before continuing our conversation.'
  }

  // Check if LLM is disabled
  const config = useRuntimeConfig()
  if (config.disableLlm) {
    console.log(`[LLM] Disabled - serving fallback for ${philosopher.name}`)
    return FallbackService.getResponse(philosopher.name, userMessage)
  }

  // Sanitize input
  const sanitizedMessage = PromptBuilder.sanitizeInput(userMessage, CONFIG.MAX_MESSAGE_LENGTH)
  if (!sanitizedMessage) {
    return 'I could not quite understand your message. Could you please rephrase your question?'
  }

  // Build prompt
  const limitedHistory = PromptBuilder.buildContext(conversationHistory, CONFIG.MAX_CONTEXT_CHARS)
  const fullPrompt = PromptBuilder.buildSystemPrompt(philosopher, limitedHistory, sanitizedMessage)

  try {
    console.log(`[LLM] Generating response for ${philosopher.name}, history: ${limitedHistory.length} messages`)

    const text = await getLLMProvider().generate(fullPrompt, CONFIG.REQUEST_TIMEOUT)

    if (!text || text.trim().length === 0) {
      console.warn('[LLM] Empty response received')
      return FallbackService.getResponse(philosopher.name, userMessage)
    }

    console.log(`[LLM] Response generated successfully (${text.length} chars)`)
    return text
  } catch (error: unknown) {
    const errorMessage = (error as Error).message || ''
    console.error('[LLM] Error:', errorMessage)

    // Check for specific error types
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('Too Many Requests')) {
      console.warn('[LLM] Rate limit hit from API')
      CircuitBreaker.recordFailure()
    } else if (errorMessage.includes('timeout')) {
      console.warn('[LLM] Request timeout')
      CircuitBreaker.recordFailure()
    } else if (errorMessage.includes('SAFETY')) {
      console.warn('[LLM] Content blocked by safety filters')
      return 'Your question ventures into territory that requires more careful consideration. Perhaps we could approach this topic from a different angle?'
    } else {
      CircuitBreaker.recordFailure()
    }

    return FallbackService.getResponse(philosopher.name, userMessage)
  }
}

/**
 * Generate a conversation summary
 */
export async function generateConversationSummary(
  philosopherName: string,
  messages: { role: string, content: string }[]
): Promise<string> {
  if (CircuitBreaker.isOpen()) {
    return ''
  }

  try {
    const conversationText = messages
      .slice(-10)
      .map(m => `${m.role === 'user' ? 'User' : philosopherName}: ${m.content}`)
      .join('\n\n')

    const prompt = `Summarize this philosophical conversation between a user and ${philosopherName} in 2-3 sentences. Focus on the main topics discussed and any insights shared:\n\n${conversationText}`

    return await getLLMProvider().generate(prompt, CONFIG.REQUEST_TIMEOUT)
  } catch (error) {
    console.error('[LLM] Failed to generate summary:', error)
    return ''
  }
}

/**
 * Generate a creative title for a conversation
 */
export async function generateConversationTitle(
  philosopherName: string,
  messages: { role: string, content: string }[]
): Promise<string> {
  if (CircuitBreaker.isOpen()) {
    return ''
  }

  try {
    const conversationText = messages
      .slice(-4) // Last few messages are enough for a title context if starting, or early messages
      .map(m => `${m.role === 'user' ? 'User' : philosopherName}: ${m.content}`)
      .join('\n\n')

    const prompt = `Create a short, intriguing, philosophical title (max 6 words) for this conversation between a user and ${philosopherName}. 
RULES:
1. Return ONLY the title text.
2. Do NOT include "Here are some options" or any conversational filler.
3. Do NOT provide multiple options.
4. Do NOT use quotes.
5. Do NOT use "Conversation with".

Conversation:
${conversationText}

Title:`

    const title = await getLLMProvider().generate(prompt, CONFIG.REQUEST_TIMEOUT)
    // Clean up potential noise if LLM ignores rules
    return (title.split('\n')[0] || '').replace(/^["'*]+|["'*]+$/g, '').replace(/^Title:\s*/i, '').trim()
  } catch (error) {
    console.error('[LLM] Failed to generate title:', error)
    return ''
  }
}
