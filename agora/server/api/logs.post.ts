import { z } from 'zod'
import { prisma } from '../utils/db'

const logSchema = z.object({
  level: z.enum(['error', 'warn', 'info']).default('error'),
  message: z.string(),
  stack: z.string().optional(),
  context: z.any().optional(),
  userAgent: z.string().optional(),
  userId: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = logSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid log format'
    })
  }

  const { level, message, stack, context, userAgent, userId } = result.data

  // 1. Store the log
  try {
    await prisma.clientLog.create({
      data: {
        level,
        message,
        stack,
        context: context ? JSON.stringify(context) : undefined,
        userAgent,
        userId
      }
    })
  } catch (e) {
    // If logging fails, we shouldn't crash the app, but maybe console.error strictly on server
    console.error('Failed to write client log to DB:', e)
  }

  // 2. Auto-delete old logs (Probabilistic cleanup - 10% chance)
  if (Math.random() < 0.1) {
    // Fire and forget - don't await strictly to slow down response
    deleteOldLogs().catch(e => console.error('Failed to cleanup logs:', e))
  }

  return { success: true }
})

async function deleteOldLogs() {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  await prisma.clientLog.deleteMany({
    where: {
      createdAt: {
        lt: sevenDaysAgo
      }
    }
  })
}
