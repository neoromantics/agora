// Rate limiting utility using sliding window algorithm
// Uses Redis if available, otherwise falls back to in-memory store
import { type H3Event, getHeader, setHeader, createError } from 'h3'
import { getRedisClient } from './redis'

interface RateLimitEntry {
  count: number
  windowStart: number
}

// In-memory store for fallback
const rateLimitStore = new Map<string, RateLimitEntry>()
const MAX_RATE_LIMIT_KEYS = 50000 // Cap to prevent memory exhaustion

// Clean up old in-memory entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > 60000) {
      rateLimitStore.delete(key)
    }
  }
  if (rateLimitStore.size > MAX_RATE_LIMIT_KEYS) {
    let toDelete = Math.floor(MAX_RATE_LIMIT_KEYS * 0.1)
    for (const key of rateLimitStore.keys()) {
      if (toDelete <= 0) break
      rateLimitStore.delete(key)
      toDelete--
    }
  }
}, 30000)

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyGenerator?: (event: H3Event) => string
}

export const RATE_LIMITS = {
  default: { windowMs: 60000, maxRequests: 100 },
  auth: { windowMs: 60000, maxRequests: 10 },
  passwordReset: { windowMs: 3600000, maxRequests: 5 },
  llm: { windowMs: 60000, maxRequests: 20 },
  interaction: { windowMs: 60000, maxRequests: 30 },
  admin: { windowMs: 60000, maxRequests: 30 }
}

function getClientIP(event: H3Event): string {
  const forwarded = getHeader(event, 'x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  const realIP = getHeader(event, 'x-real-ip')
  if (realIP) return realIP
  return event.node.req.socket?.remoteAddress || 'unknown'
}

/**
 * Check limits for a specific key (Async)
 */
export async function checkLimitByKey(
  keyIdentifier: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean, remaining: number, resetAt: number }> {
  const redis = getRedisClient()
  const now = Date.now()

  // --- Redis Implementation ---
  if (redis) {
    const redisKey = `ratelimit:${keyIdentifier}`
    const windowSeconds = Math.ceil(config.windowMs / 1000)

    try {
      const multi = redis.multi()
      multi.incr(redisKey)
      multi.ttl(redisKey)
      const results = await multi.exec()

      if (!results) throw new Error('Redis transaction failed')

      const [incrErr, count] = results[0] as [Error | null, number]
      const [, ttl] = results[1] as [Error | null, number]

      if (incrErr) throw incrErr

      if (ttl === -1) {
        await redis.expire(redisKey, windowSeconds)
      }

      const currentCount = count
      const remaining = Math.max(0, config.maxRequests - currentCount)
      const resetAt = now + (ttl === -1 ? windowSeconds : ttl) * 1000

      if (currentCount > config.maxRequests) {
        return { allowed: false, remaining: 0, resetAt }
      }

      return { allowed: true, remaining, resetAt }
    } catch (err) {
      console.error('[RateLimit] Redis error, falling back to memory:', err)
    }
  }

  // --- In-Memory Fallback ---
  const key = keyIdentifier
  const entry = rateLimitStore.get(key)

  if (!entry || now - entry.windowStart >= config.windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now })
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs
    }
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.windowStart + config.windowMs
    }
  }

  entry.count++
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.windowStart + config.windowMs
  }
}

/**
 * Check if request should be rate limited (Async)
 */
export async function checkRateLimit(
  event: H3Event,
  config: RateLimitConfig = RATE_LIMITS.default
): Promise<{ allowed: boolean, remaining: number, resetAt: number }> {
  const keyIdentifier = config.keyGenerator?.(event) || `ip:${getClientIP(event)}`
  return checkLimitByKey(keyIdentifier, config)
}

/**
 * Apply rate limiting - throws error if limit exceeded (Async)
 */
export async function applyRateLimit(
  event: H3Event,
  config: RateLimitConfig = RATE_LIMITS.default,
  operation?: string
): Promise<void> {
  const result = await checkRateLimit(event, config)

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

export function createUserAwareKey(event: H3Event, operation: string): string {
  const authHeader = getHeader(event, 'authorization')
  const ip = getClientIP(event)

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7, 20)
    return `user:${token}:${operation}`
  }

  return `ip:${ip}:${operation}`
}
