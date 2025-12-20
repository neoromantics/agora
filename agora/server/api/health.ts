// Health check endpoint with dependency verification
import { prisma } from '../utils/db'
import { isMinioEnabled, checkMinioHealth } from '../utils/minio'

export default defineEventHandler(async () => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'unknown',
    storage: 'local'
  }

  // Check Database
  try {
    // efficient way to check connection
    await prisma.$queryRaw`SELECT 1`
    health.database = 'connected'
  } catch (e) {
    console.error('Health Check: Database failed', e)
    health.database = 'disconnected'
    health.status = 'error'
  }

  // Check Storage
  if (isMinioEnabled()) {
    try {
      const isConnected = await checkMinioHealth()
      health.storage = isConnected ? 'minio_connected' : 'minio_disconnected'
      if (!isConnected) health.status = 'error'
    } catch {
      health.storage = 'minio_error'
      health.status = 'error'
    }
  }

  if (health.status === 'error') {
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
      data: health
    })
  }

  return health
})
