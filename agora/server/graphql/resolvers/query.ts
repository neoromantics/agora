/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../../utils/db'
import { getCurrentUser, requireAuth } from '../../utils/auth'
import { applyRateLimit, RATE_LIMITS } from '../../utils/rateLimit'
import type { Context } from '../context'

const formatPhilosopher = (p: any) => {
  if (!p) return null
  return {
    ...p,
    era: p.era || 'Unknown Era',
    portrait: p.portrait || '',
    conversationCount: p._count?.conversations || 0
  }
}

export const queryResolvers = {
  Query: {
    me: async (_: unknown, __: unknown, context: Context) => {
      return getCurrentUser(context.event)
    },

    philosophers: async (_: unknown, { era, search }: { era?: string, search?: string }, context: Context) => {
      applyRateLimit(context.event, RATE_LIMITS.default, 'list philosophers')
      const where: Record<string, unknown> = {}

      if (era) where.era = era
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { biography: { contains: search, mode: 'insensitive' } }
        ]
      }
      const philosophers = await prisma.philosopher.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { conversations: { where: { isPublic: true, deletedAt: null } } } }
        }
      })
      return philosophers.map(formatPhilosopher)
    },

    philosopher: async (_: unknown, { slug }: { slug: string }, context: Context) => {
      applyRateLimit(context.event, RATE_LIMITS.default, 'view philosopher')

      const philosopher = await prisma.philosopher.findFirst({
        where: { slug },
        include: {
          _count: { select: { conversations: { where: { isPublic: true, deletedAt: null } } } }
        }
      })

      return formatPhilosopher(philosopher)
    },

    feed: async (_: unknown, { limit = 50, search, philosopherSlug }: { limit?: number, search?: string, philosopherSlug?: string }, context: Context) => {
      applyRateLimit(context.event, RATE_LIMITS.default, 'feed')

      const user = await getCurrentUser(context.event)

      // Build where clause with optional filters
      const where: Record<string, unknown> = {
        isPublic: true,
        deletedAt: null
      }

      // Filter by philosopher if specified
      if (philosopherSlug) {
        where.philosopher = { slug: philosopherSlug }
      }

      // Search in title or summary
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { summary: { contains: search, mode: 'insensitive' } }
        ]
      }

      const conversations = await prisma.conversation.findMany({
        take: limit,
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          philosopher: true,
          likes: { where: { userId: user?.id || '0' } }, // Optimization: Only fetch user's like
          _count: { select: { likes: true } }
        }
      })

      return {
        edges: conversations.map((c: any) => ({
          ...c,
          likeCount: c._count.likes,
          isLikedByMe: c.likes.length > 0
        })),
        pageInfo: {
          hasNextPage: false,
          endCursor: null
        }
      }
    },

    conversation: async (_: unknown, { id }: { id: string }, context: Context) => {
      const conversation = await prisma.conversation.findFirst({
        where: { id, deletedAt: null },
        include: {
          user: true,
          philosopher: true,
          _count: { select: { likes: true } }
        }
      })

      if (!conversation) return null

      // Security: Check if conversation is public or user is the owner or admin
      const currentUser = await getCurrentUser(context.event)
      if (!conversation.isPublic) {
        if (!currentUser || (currentUser.id !== conversation.userId && currentUser.role !== 'ADMIN')) {
          return null // Don't reveal existence of private conversations
        }
      }

      // Optimization: check if liked by me
      const like = await prisma.like.findFirst({
        where: { conversationId: conversation.id, userId: currentUser?.id || '0' }
      })
        ; (conversation as any).isLikedByMe = !!like

      // Only increment view count if viewer is not the author
      if (!currentUser || currentUser.id !== conversation.userId) {
        await prisma.conversation.update({
          where: { id },
          data: { viewCount: { increment: 1 } }
        })
      }
      return {
        ...conversation,
        likeCount: conversation._count.likes,
        isLikedByMe: (conversation as any).isLikedByMe
      }
    },

    myConversations: async (_: unknown, __: unknown, context: Context) => {
      const user = await requireAuth(context.event)
      const conversations = await prisma.conversation.findMany({
        where: { userId: user.id, deletedAt: null },
        include: {
          philosopher: true,
          user: true,
          _count: { select: { likes: true } }
        },
        orderBy: { updatedAt: 'desc' }
      })

      // Map _count to likeCount/commentCount
      return conversations.map((c: any) => ({
        ...c,
        likeCount: c._count?.likes || 0,
        isLikedByMe: false, // Own conversations
        forkCount: c.forkCount || 0,
        isAnonymous: c.isAnonymous || false
      }))
    },

    userConversations: async (_: unknown, { username, limit = 50 }: { username: string, limit?: number }, context: Context) => {
      const user = await prisma.user.findUnique({ where: { username } })
      if (!user) throw new Error('User not found')

      const currentUser = await getCurrentUser(context.event)

      const where: any = {
        userId: user.id,
        deletedAt: null,
        isPublic: true // Always show only public conversations in profile
      }

      // If not owner and not admin, also hide anonymous conversations
      const isAdmin = currentUser?.role === 'ADMIN'
      if ((!currentUser || currentUser.id !== user.id) && !isAdmin) {
        where.isAnonymous = false
      }

      const conversations = await prisma.conversation.findMany({
        take: limit,
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          philosopher: true,
          _count: { select: { likes: true } }
        }
      })

      // Add isLikedByMe and counts
      const edgesWithLikes = await Promise.all(conversations.map(async (c) => {
        let isLikedByMe = false
        if (currentUser) {
          const like = await prisma.like.findFirst({
            where: { conversationId: c.id, userId: currentUser.id }
          })
          isLikedByMe = !!like
        }
        return {
          ...c,
          likeCount: c._count?.likes || 0,
          isLikedByMe
        }
      }))

      return {
        edges: edgesWithLikes,
        pageInfo: {
          hasNextPage: false,
          endCursor: null
        }
      }
    },

    user: async (_: unknown, { username }: { username: string }, context: Context) => {
      applyRateLimit(context.event, RATE_LIMITS.default, 'view user')
      // Use findFirst with case-insensitive mode to allow flexibility

      const user = await prisma.user.findFirst({
        where: { username: { equals: username, mode: 'insensitive' } },
        include: { _count: { select: { conversations: { where: { isPublic: true, deletedAt: null } } } } }
      })
      if (!user) return null
      return {
        ...user,
        conversationCount: user._count.conversations
      }
    },

    myNotifications: async (_: unknown, { limit = 20, unreadOnly = false }: { limit?: number, unreadOnly?: boolean }, context: Context) => {
      const user = await requireAuth(context.event)
      return prisma.notification.findMany({
        where: {
          userId: user.id,
          ...(unreadOnly ? { read: false } : {})
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      })
    },

    unreadNotificationCount: async (_: unknown, __: unknown, context: Context) => {
      const user = await requireAuth(context.event)
      return prisma.notification.count({
        where: { userId: user.id, read: false }
      })
    },

    adminUsers: async (_: unknown, { limit = 50 }: { limit?: number }, context: Context) => {
      // Dynamic import to avoid circular dependency issues if any, or just import at top
      // Importing requireAdmin at top level in this file
      const { requireAdmin } = await import('../../utils/rbac')
      await requireAdmin(context.event)

      applyRateLimit(context.event, RATE_LIMITS.admin, 'admin list users')

      const users = await prisma.user.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { conversations: { where: { deletedAt: null } } } }
        }
      })

      return users.map(u => ({
        ...u,
        conversationCount: u._count.conversations
      }))
    },

    adminConversations: async (_: unknown, { limit = 50, search }: { limit?: number, search?: string }, context: Context) => {
      const { requireAdmin } = await import('../../utils/rbac')
      await requireAdmin(context.event)

      applyRateLimit(context.event, RATE_LIMITS.admin, 'admin conversations')

      const take = limit + 1
      const where: Record<string, unknown> = {
        deletedAt: null
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { summary: { contains: search, mode: 'insensitive' } },
          { user: { username: { contains: search, mode: 'insensitive' } } },
          { user: { name: { contains: search, mode: 'insensitive' } } }
        ]
      }

      const conversations = await prisma.conversation.findMany({
        take,
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          philosopher: true,
          _count: { select: { likes: true } }
        }
      })

      const hasNextPage = conversations.length > limit
      const edges = hasNextPage ? conversations.slice(0, -1) : conversations

      return {
        edges: edges.map((c: any) => ({
          ...c,
          likeCount: c._count.likes,
          isLikedByMe: false // Not relevant for admin view
        })),
        pageInfo: {
          hasNextPage,
          endCursor: edges.length > 0 ? edges[edges.length - 1]!.id : null
        }
      }
    }

  }
}
