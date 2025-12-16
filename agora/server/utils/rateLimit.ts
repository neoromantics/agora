// Rate limiting utility using sliding window algorithm
// Uses in-memory store for simplicity (Redis adapter can be added for distributed)
import { type H3Event, getHeader, setHeader, createError } from 'h3'

interface RateLimitEntry {
  count: number
  windowStart: number
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>()
const MAX_RATE_LIMIT_KEYS = 50000 // Cap to prevent memory exhaustion DoS

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > 60000) { // 1 minute window
      rateLimitStore.delete(key)
    }
  }

  // Emergency cleanup if still too big
  if (rateLimitStore.size > MAX_RATE_LIMIT_KEYS) {
    // Naively delete the first 10% of keys (oldest due to insertion order)
    let toDelete = Math.floor(MAX_RATE_LIMIT_KEYS * 0.1)
    for (const key of rateLimitStore.keys()) {
      if (toDelete <= 0) break
      rateLimitStore.delete(key)
      toDelete--
    }
  }
}, 30000) // Clean up every 30 seconds

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  keyGenerator?: (event: H3Event) => string // Custom key generator
}

// Default configs for different operations
export const RATE_LIMITS = {
  // General API requests per IP
  default: { windowMs: 60000, maxRequests: 100 },

  // More restrictive for auth operations (prevent brute force)
  auth: { windowMs: 60000, maxRequests: 10 },

  // Password reset (prevent enumeration)
  passwordReset: { windowMs: 3600000, maxRequests: 5 }, // 5 per hour

  // LLM operations (expensive)
  llm: { windowMs: 60000, maxRequests: 20 },

  // Comment/like operations
  // Comment/like operations
  interaction: { windowMs: 60000, maxRequests: 30 },

  // Admin operations (high privilege, low frequency)
  admin: { windowMs: 60000, maxRequests: 30 } // Enough for bulk ops but prevents runaways

}

/**
 * Get client IP from event
 */
function getClientIP(event: H3Event): string {
  // Check standard headers for proxied requests
  const forwarded = getHeader(event, 'x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }

  const realIP = getHeader(event, 'x-real-ip')
  if (realIP) {
    return realIP
  }

  // Fallback to socket address
  return event.node.req.socket?.remoteAddress || 'unknown'
}

/**
 * Check if request should be rate limited
 * Returns remaining requests and reset time
 */
export function checkRateLimit(
  event: H3Event,
  config: RateLimitConfig = RATE_LIMITS.default
): { allowed: boolean, remaining: number, resetAt: number } {
  const key = config.keyGenerator?.(event) || `ip:${getClientIP(event)}`
  const now = Date.now()

  const entry = rateLimitStore.get(key)

  if (!entry || now - entry.windowStart >= config.windowMs) {
    // New window
    rateLimitStore.set(key, { count: 1, windowStart: now })
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs
    }
  }

  // Within existing window
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.windowStart + config.windowMs
    }
  }

  // Increment counter
  entry.count++
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.windowStart + config.windowMs
  }
}

/**
 * Apply rate limiting - throws error if limit exceeded
 */
export function applyRateLimit(
  event: H3Event,
  config: RateLimitConfig = RATE_LIMITS.default,
  operation?: string
): void {
  const result = checkRateLimit(event, config)

  // Set rate limit headers
  setHeader(event, 'X-RateLimit-Limit', config.maxRequests.toString())
  setHeader(event, 'X-RateLimit-Remaining', result.remaining.toString())
  setHeader(event, 'X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString())

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
    setHeader(event, 'Retry-After', retryAfter)

    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: operation
        ? `Rate limit exceeded for ${operation}. Try again in ${retryAfter} seconds.`
        : `Rate limit exceeded. Try again in ${retryAfter} seconds.`
    })
  }
}

/**
 * Create a rate limit key that includes user ID for authenticated requests
 */
export function createUserAwareKey(event: H3Event, operation: string): string {
  const authHeader = getHeader(event, 'authorization')
  const ip = getClientIP(event)

  if (authHeader?.startsWith('Bearer ')) {
    // Use a hash of the token for authenticated users
    const token = authHeader.slice(7, 20) // First ~13 chars of token as identifier
    return `user:${token}:${operation}`
  }

  return `ip:${ip}:${operation}`
}
