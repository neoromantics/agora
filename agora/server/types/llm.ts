export interface Message {
  role: 'user' | 'model'
  content: string
}

export interface PhilosopherContext {
  name: string
  era: string
  systemPrompt: string
}

export interface CircuitBreakerState {
  isOpen: boolean
  openUntil: number
  failureCount: number
  lastFailure: number
}

export interface LLMConfig {
  maxMessageLength: number
  maxHistoryMessages: number
  requestTimeout: number
  circuitBreaker: {
    duration: number
    failureThreshold: number
    window: number
  }
}
