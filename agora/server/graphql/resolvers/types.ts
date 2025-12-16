/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../../utils/db'
import { getCurrentUser } from '../../utils/auth'
import type { Context } from '../context'

export const typeResolvers = {
  Conversation: {
    user: async (parent: any, _: unknown, context: Context) => {
      // access parent.user if already included, or fetch
      // But we need to check isAnonymous
      const currentUser = await getCurrentUser(context.event)

      if (parent.isAnonymous && (!currentUser || currentUser.id !== parent.userId)) {
        return null // Anonymous to others
      }

      if (parent.user) return parent.user // If included in query
      return prisma.user.findUnique({ where: { id: parent.userId } })
    },
    forkedFrom: async (parent: any) => {
      if (!parent.forkedFromId) return null
      return prisma.conversation.findUnique({
        where: { id: parent.forkedFromId },
        include: { user: true, philosopher: true }
      })
    },
    forkCount: async (parent: any) => {
      return prisma.conversation.count({
        where: {
          forkedFromId: parent.id,
          deletedAt: null // Only count active forks
        }
      })
    },
    messages: async (parent: any, { limit = 50 }: { limit?: number }) => {
      if (parent.messages) return parent.messages // Fallback if already fetched
      return prisma.message.findMany({
        where: { conversationId: parent.id },
        orderBy: { createdAt: 'asc' },
        take: limit
      })
    },
    likes: async (parent: any, { limit = 50 }: { limit?: number }) => {
      if (parent.likes) return parent.likes // Fallback
      return prisma.like.findMany({
        where: { conversationId: parent.id },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        take: limit
      })
    },
    comments: async (parent: any, { limit }: { limit?: number }) => {
      if (parent.comments) return parent.comments // Fallback
      // Only fetch root comments (no parentId), replies are resolved separately
      return prisma.comment.findMany({
        where: { conversationId: parent.id, parentId: null },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        take: limit
      })
    }
  },

  Comment: {
    replies: async (parent: any, { limit }: { limit?: number }) => {
      if (parent.replies) return parent.replies
      return prisma.comment.findMany({
        where: { parentId: parent.id },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
        take: limit
      })
    },
    likeCount: async (parent: any) => {
      if (parent.likeCount !== undefined) return parent.likeCount
      const count = await prisma.commentLike.count({
        where: { commentId: parent.id }
      })
      return count
    },
    isLikedByMe: async (parent: any, _: unknown, context: Context) => {
      if (parent.isLikedByMe !== undefined) return parent.isLikedByMe
      const currentUser = await getCurrentUser(context.event)
      if (!currentUser) return false
      const like = await prisma.commentLike.findUnique({
        where: { userId_commentId: { userId: currentUser.id, commentId: parent.id } }
      })
      return !!like
    }
  }
}
