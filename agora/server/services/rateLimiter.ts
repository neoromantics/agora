// Per-user rate limiting (in-memory, resets on restart)
const userRateLimits = new Map<string, { count: number, resetAt: number }>()
const USER_RATE_LIMIT = 20 // Messages per minute
const USER_RATE_WINDOW = 60 * 1000

export const RateLimiter = {
  checkUserLimit(userId: string): boolean {
    const now = Date.now()
    const userLimit = userRateLimits.get(userId)

    if (!userLimit || now > userLimit.resetAt) {
      userRateLimits.set(userId, { count: 1, resetAt: now + USER_RATE_WINDOW })
      return true
    }

    if (userLimit.count >= USER_RATE_LIMIT) {
      console.warn(`[LLM] Rate limit exceeded for user ${userId}`)
      return false
    }

    userLimit.count++
    return true
  }
}
