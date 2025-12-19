import { Redis } from 'ioredis'

let redisClient: Redis | null = null

export const getRedisClient = () => {
  if (redisClient) return redisClient

  const config = useRuntimeConfig()
  const redisUrl = config.redisUrl || process.env.NUXT_REDIS_URL

  if (!redisUrl) {
    console.warn('[Redis] No REDIS_URL configured, skipping Redis connection')
    return null
  }

  console.log('[Redis] Initializing shared Redis client...')
  redisClient = new Redis(redisUrl as string, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) return null // Stop retrying after 3 attempts
      return Math.min(times * 100, 2000)
    }
  })

  redisClient.on('error', (err) => {
    console.error('[Redis] Client Error:', err.message)
  })

  redisClient.on('connect', () => {
    console.log('[Redis] Connected successfully')
  })

  return redisClient
}
