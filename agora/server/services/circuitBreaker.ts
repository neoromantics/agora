import type { CircuitBreakerState, LLMConfig } from '../types/llm'

const DEFAULT_CONFIG = {
  duration: 60 * 1000, // 1 minute
  failureThreshold: 3,
  window: 30 * 1000 // 30 seconds
}

const state: CircuitBreakerState = {
  isOpen: false,
  openUntil: 0,
  failureCount: 0,
  lastFailure: 0
}

export const CircuitBreaker = {
  isOpen(): boolean {
    if (state.isOpen && Date.now() < state.openUntil) {
      return true
    }
    // Reset if circuit was open but time has passed
    if (state.isOpen) {
      state.isOpen = false
      state.failureCount = 0
    }
    return false
  },

  recordFailure(config: LLMConfig['circuitBreaker'] = DEFAULT_CONFIG): void {
    const now = Date.now()

    // Reset failure count if outside window
    if (now - state.lastFailure > config.window) {
      state.failureCount = 0
    }

    state.failureCount++
    state.lastFailure = now

    if (state.failureCount >= config.failureThreshold) {
      state.isOpen = true
      state.openUntil = now + config.duration
      console.warn(`[LLM] Circuit breaker OPEN until ${new Date(state.openUntil).toISOString()}`)
    }
  }
}
