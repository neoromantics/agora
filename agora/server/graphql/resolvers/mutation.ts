/* eslint-disable @typescript-eslint/no-explicit-any */

import { GraphQLError } from 'graphql'
import { prisma } from '../../utils/db'

import { requireAuth, hashPassword, verifyPassword, generateToken } from '../../utils/auth'
import { generatePhilosopherResponse, generateConversationSummary, generateConversationTitle } from '../../utils/llm'
import { applyRateLimit, RATE_LIMITS } from '../../utils/rateLimit'
import { requireAdmin, Role } from '../../utils/rbac'
import type { Context } from '../context'

interface MessageRecord {
  role: string
  content: string
}

export const mutationResolvers = {
  Mutation: {
    chatEphemeral: async (_: unknown, { philosopherId, messages }: { philosopherId: string, messages: { role: string, content: string }[] }, context: Context) => {
      // Rate limit: 20 LLM requests per minute
      applyRateLimit(context.event, RATE_LIMITS.llm, 'AI conversation')

      // No auth required for ephemeral chat
      const philosopher = await prisma.philosopher.findUnique({
        where: { id: philosopherId }
      })

      if (!philosopher) {
        throw new Error('Philosopher not found')
      }

      if (messages.length === 0) {
        throw new Error('Messages cannot be empty')
      }

      // Generate response using LLM utils
      // We perform this calculation but do not save results to DB
      return generatePhilosopherResponse(
        {
          name: philosopher.name,
          era: philosopher.era,
          systemPrompt: philosopher.systemPrompt
        },
        messages.slice(0, -1).map(m => ({
          role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
          content: m.content
        })),
        messages[messages.length - 1]!.content
      )
    },

    register: async (_: unknown, { email, password, name, username }: { email: string, password: string, name: string, username: string }, context: Context) => {
      // Rate limit: 10 auth attempts per minute
      applyRateLimit(context.event, RATE_LIMITS.auth, 'registration')

      const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { username }] }
      })
      if (existing) {
        throw new Error('Email or username already in use')
      }

      const passwordHash = await hashPassword(password)
      const user = await prisma.user.create({
        data: { email, passwordHash, name, username }
      })

      const token = generateToken({ userId: user.id, email: user.email })
      return { token, user }
    },

    login: async (_: unknown, { identifier, password }: { identifier: string, password: string }, context: Context) => {
      // Rate limit: 10 auth attempts per minute
      applyRateLimit(context.event, RATE_LIMITS.auth, 'login')

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: identifier },
            { username: { equals: identifier, mode: 'insensitive' } }
          ]
        }
      })
      if (!user || !user.passwordHash) {
        throw new Error('Account does not exist')
      }

      const valid = await verifyPassword(password, user.passwordHash)
      if (!valid) {
        throw new GraphQLError('Invalid credentials')
      }

      const token = generateToken({ userId: user.id, email: user.email })
      return { token, user }
    },

    requestPasswordReset: async (_: unknown, { email }: { email: string }, context: Context) => {
      // Rate limit: 5 password reset attempts per hour
      applyRateLimit(context.event, RATE_LIMITS.passwordReset, 'password reset')

      // Always return success to prevent email enumeration
      const user = await prisma.user.findUnique({ where: { email } })

      if (user) {
        // Generate a secure random token
        const resetToken = crypto.randomUUID() + '-' + crypto.randomUUID()

        // Create reset record - expires in 1 hour
        await prisma.passwordReset.create({
          data: {
            userId: user.id,
            token: resetToken,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
          }
        })

        // In production, you would send an email here
        // We are NOT logging the token for security reasons.
        // Integration with an email provider (e.g. Resend, SendGrid) is required.
      }

      return {
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.'
      }
    },

    resetPassword: async (_: unknown, { token, newPassword }: { token: string, newPassword: string }) => {
      // Find valid reset token
      const resetRecord = await prisma.passwordReset.findUnique({
        where: { token },
        include: { user: true }
      })

      if (!resetRecord) {
        throw new Error('Invalid or expired reset token')
      }

      if (resetRecord.used) {
        throw new Error('This reset link has already been used')
      }

      if (new Date() > resetRecord.expiresAt) {
        throw new Error('This reset link has expired')
      }

      // Update password
      const passwordHash = await hashPassword(newPassword)
      const user = await prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash }
      })

      // Mark token as used
      await prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used: true }
      })

      // Return auth token so user is logged in
      const authToken = generateToken({ userId: user.id, email: user.email })
      return { token: authToken, user }
    },

    createConversation: async (_: unknown, { philosopherId, title }: { philosopherId: string, title: string }, context: Context) => {
      const user = await requireAuth(context.event)
      return prisma.conversation.create({
        data: {
          title,
          userId: user.id,
          philosopherId
        },
        include: { philosopher: true, user: true }
      })
    },

    sendMessage: async (_: unknown, { conversationId, content }: { conversationId: string, content: string }, context: Context) => {
      const user = await requireAuth(context.event)

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { philosopher: true, messages: { orderBy: { createdAt: 'asc' } } }
      })

      if (!conversation || conversation.userId !== user.id) {
        throw new Error('Conversation not found')
      }

      const userMessage = await prisma.message.create({
        data: {
          content,
          role: 'user',
          conversationId
        }
      })

      // Emit to conversation room using Socket.IO from context
      const io = context.event.context.io

      if (io) {
        io.to(`conversation:${conversationId}`).emit('message:created', userMessage)
      }

      const _history = conversation.messages.map((m: MessageRecord) => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        content: m.content
      }))

      let philosopherResponse = ''
      try {
        philosopherResponse = await generatePhilosopherResponse(
          {
            name: conversation.philosopher.name,
            era: conversation.philosopher.era,
            systemPrompt: conversation.philosopher.systemPrompt
          },
          _history,
          content,
          user.id // Pass userId for rate limiting
        )
      } catch (error) {
        console.error('LLM generation failed:', error)
        // Fallback response to prevent UI from breaking
        philosopherResponse = 'I apologize, but I am momentarily unable to access my thoughts. Please try again.'
      }

      const botMessage = await prisma.message.create({
        data: {
          content: philosopherResponse,
          role: 'philosopher',
          conversationId
        }
      })

      if (io) {
        io.to(`conversation:${conversationId}`).emit('message:created', botMessage)
      }

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      })

      // Background: Check if we should update the title
      let newTitle: string | null = null
      if (conversation.title.startsWith('Conversation with') && conversation.messages.length < 2) {
        try {
          newTitle = await generateConversationTitle(conversation.philosopher.name, [
            ...conversation.messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content },
            { role: 'philosopher', content: philosopherResponse }
          ])

          if (newTitle) {
            await prisma.conversation.update({
              where: { id: conversationId },
              data: { title: newTitle }
            })
            if (io) {
              io.to(`conversation:${conversationId}`).emit('conversation:updated', { title: newTitle })
            }
          }
        } catch (err) {
          console.error('[Conversation] Failed to auto-title:', err)
        }
      }

      return { userMessage, philosopherMessage: botMessage, newConversationTitle: newTitle }
    },

    togglePublic: async (_: unknown, { conversationId }: { conversationId: string }, context: Context) => {
      const user = await requireAuth(context.event)
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId }
      })

      if (!conversation || (conversation.userId !== user.id && user.role !== 'ADMIN')) {
        throw new Error('Conversation not found')
      }

      let summary = conversation.summary
      if (!conversation.isPublic && !summary) {
        const messages = await prisma.message.findMany({
          where: { conversationId },
          orderBy: { createdAt: 'asc' }
        })
        const philosopher = await prisma.philosopher.findUnique({
          where: { id: conversation.philosopherId }
        })
        if (philosopher && messages.length > 0) {
          summary = await generateConversationSummary(philosopher.name, messages)
        }
      }

      return prisma.conversation.update({
        where: { id: conversationId },
        data: {
          isPublic: !conversation.isPublic,
          summary
        },
        include: { philosopher: true, user: true }
      })
    },

    deleteConversation: async (_: unknown, { conversationId }: { conversationId: string }, context: Context) => {
      const user = await requireAuth(context.event)
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId }
      })

      if (!conversation || (conversation.userId !== user.id && user.role !== 'ADMIN')) {
        throw new Error('Conversation not found')
      }

      // Soft delete - set deletedAt instead of actually deleting
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { deletedAt: new Date() }
      })
      return true
    },

    updateConversationTitle: async (_: unknown, { conversationId, title }: { conversationId: string, title: string }, context: Context) => {
      const user = await requireAuth(context.event)
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId }
      })

      if (!conversation || (conversation.userId !== user.id && user.role !== 'ADMIN')) {
        throw new Error('Conversation not found')
      }

      return prisma.conversation.update({
        where: { id: conversationId },
        data: { title },
        include: { philosopher: true, user: true }
      })
    },

    setAnonymous: async (_: unknown, { conversationId, isAnonymous }: { conversationId: string, isAnonymous: boolean }, context: Context) => {
      const user = await requireAuth(context.event)
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId }
      })

      if (!conversation || (conversation.userId !== user.id && user.role !== 'ADMIN')) {
        throw new Error('Conversation not found')
      }

      return prisma.conversation.update({
        where: { id: conversationId },
        data: { isAnonymous },
        include: { philosopher: true, user: true }
      })
    },

    forkConversation: async (_: unknown, { conversationId, title }: { conversationId: string, title?: string }, context: Context) => {
      const user = await requireAuth(context.event)

      // Get the original conversation with messages (ordered by createdAt)
      const original = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          philosopher: true,
          user: true
        }
      })

      if (!original) {
        throw new Error('Conversation not found')
      }

      if (original.deletedAt) {
        throw new Error('Cannot fork a deleted conversation')
      }

      // Security: Only allow forking public conversations or user's own conversations
      if (!original.isPublic && original.userId !== user.id) {
        throw new Error('Cannot fork a private conversation')
      }

      // Create messages with new timestamps but preserving order
      const now = new Date()
      const messagesData = original.messages.map((m: any, index: number) => ({
        content: m.content,
        role: m.role,
        // Use incrementing timestamps to preserve order
        createdAt: new Date(now.getTime() + index)
      }))

      // Create new conversation - PRIVATE by default
      const newConversation = await prisma.conversation.create({
        data: {
          title: title || `Fork of ${original.title}`,

          userId: user.id,
          philosopherId: original.philosopherId,
          forkedFromId: original.id,
          isPublic: false, // Forks are private by default
          messages: {
            create: messagesData
          }
        },
        include: { philosopher: true, user: true, messages: true }
      })

      // Increment fork count on original

      // Notify original author (if not forking own conversation)
      if (original.userId && original.userId !== user.id) {
        await prisma.notification.create({
          data: {
            userId: original.userId,
            type: 'FORK',
            conversationId: original.id,
            actorId: user.id,
            message: `${user.name} forked your conversation with ${original.philosopher.name}`

          }
        })
      }

      return newConversation
    },

    likeConversation: async (_: unknown, { conversationId }: { conversationId: string }, context: Context) => {
      const user = await requireAuth(context.event)

      await prisma.like.create({
        data: { userId: user.id, conversationId }
      })

      // Create notification for conversation owner (if not self)
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          user: true,
          philosopher: true,
          _count: { select: { likes: true, comments: true } }
        }
      })

      if (conversation && conversation.userId !== user.id) {
        await prisma.notification.create({
          data: {
            userId: conversation.userId,
            type: 'LIKE',
            conversationId,
            actorId: user.id,
            message: `${user.name} liked your conversation with ${conversation.philosopher.name}`

          }
        })
      }

      // Return updated conversation
      return {
        ...conversation,
        likeCount: (conversation?._count?.likes || 0) + 1,
        isLikedByMe: true
      }
    },

    unlikeConversation: async (_: unknown, { conversationId }: { conversationId: string }, context: Context) => {
      const user = await requireAuth(context.event)

      // Delete like
      await prisma.like.deleteMany({
        where: { userId: user.id, conversationId }
      })

      // Return updated conversation
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          user: true,
          philosopher: true,
          _count: { select: { likes: true, comments: true } }
        }
      })

      return {
        ...conversation,
        likeCount: conversation?._count?.likes || 0,
        isLikedByMe: false
      }
    },

    // ===== Comment Mutations =====

    addComment: async (_: unknown, { conversationId, content, parentId }: { conversationId: string, content: string, parentId?: string }, context: Context) => {
      const user = await requireAuth(context.event)

      // Validate content
      if (!content.trim()) {
        throw new Error('Comment cannot be empty')
      }

      if (content.length > 2000) {
        throw new Error('Comment is too long (max 2000 characters)')
      }

      // Verify conversation exists and is public (or user is owner/admin)
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { philosopher: true }
      })

      if (!conversation || conversation.deletedAt) {
        throw new Error('Conversation not found')
      }

      if (!conversation.isPublic && conversation.userId !== user.id && user.role !== 'ADMIN') {
        throw new Error('Cannot comment on private conversations')
      }

      // If parentId provided, verify parent comment exists and belongs to same conversation
      if (parentId) {
        const parentComment = await prisma.comment.findUnique({
          where: { id: parentId }
        })
        if (!parentComment || parentComment.conversationId !== conversationId) {
          throw new Error('Parent comment not found')
        }
      }

      // Create comment
      const comment = await prisma.comment.create({
        data: {
          content: content.trim(),
          userId: user.id,
          conversationId,
          parentId: parentId || null
        },
        include: { user: true }
      })

      // Create notification for conversation owner (if not self and not replying)
      if (conversation.userId !== user.id && !parentId) {
        await prisma.notification.create({
          data: {
            userId: conversation.userId,
            type: 'COMMENT',
            conversationId,
            actorId: user.id,
            message: `${user.name} commented on your conversation with ${conversation.philosopher.name}`
          }
        })
      }

      return {
        ...comment,
        likeCount: 0,
        isLikedByMe: false
      }
    },

    deleteComment: async (_: unknown, { commentId }: { commentId: string }, context: Context) => {
      const user = await requireAuth(context.event)

      const comment = await prisma.comment.findUnique({
        where: { id: commentId }
      })

      if (!comment) {
        throw new Error('Comment not found')
      }

      // Only owner or admin can delete
      if (comment.userId !== user.id && user.role !== 'ADMIN') {
        throw new Error('Not authorized to delete this comment')
      }

      // Cascade delete happens automatically via Prisma schema
      await prisma.comment.delete({
        where: { id: commentId }
      })

      return true
    },

    likeComment: async (_: unknown, { commentId }: { commentId: string }, context: Context) => {
      const user = await requireAuth(context.event)

      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        include: { user: true }
      })

      if (!comment) {
        throw new Error('Comment not found')
      }

      // Using update on comment to create the like via relation
      // This bypasses accessing prisma.commentLike directly which seems to be undefined
      try {
        await prisma.comment.update({
          where: { id: commentId },
          data: {
            likes: {
              create: { userId: user.id }
            }
          }
        })
      } catch (e: any) {
        // Prisma error code P2002 means unique constraint failed (already liked)
        if (e.code === 'P2002') {
          throw new Error('Already liked this comment')
        }
        throw e
      }

      const updated = await prisma.comment.findUnique({
        where: { id: commentId },
        include: {
          user: true,
          _count: { select: { likes: true } }
        }
      })

      return {
        ...updated,
        likeCount: updated?._count.likes || 0,
        isLikedByMe: true
      }
    },

    unlikeComment: async (_: unknown, { commentId }: { commentId: string }, context: Context) => {
      const user = await requireAuth(context.event)

      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        include: { user: true }
      })

      if (!comment) {
        throw new Error('Comment not found')
      }

      await prisma.comment.update({
        where: { id: commentId },
        data: {
          likes: {
            deleteMany: { userId: user.id }
          }
        }
      })

      const updated = await prisma.comment.findUnique({
        where: { id: commentId },
        include: {
          user: true,
          _count: { select: { likes: true } }
        }
      })

      return {
        ...updated,
        likeCount: updated?._count?.likes || 0,
        isLikedByMe: false
      }
    },

    // ===== End Comment Mutations =====

    updateProfile: async (_: unknown, args: any, context: Context) => {
      const user = await requireAuth(context.event)
      const { name, bio, avatar, username, email, currentPassword, newPassword } = args
      const data: any = {}

      if (name) data.name = name
      if (bio !== undefined) data.bio = bio
      if (avatar !== undefined) data.avatar = avatar // Allow null to remove
      if (username && username !== user.username) {
        // Check availability
        const existing = await prisma.user.findUnique({ where: { username } })
        if (existing) throw new Error('Username taken')
        data.username = username
      }
      if (email && email !== user.email) {
        // Check availability
        const existing = await prisma.user.findUnique({ where: { email } })
        if (existing) throw new Error('Email already in use')
        data.email = email
      }

      if (newPassword) {
        if (!currentPassword) throw new Error('Current password required to change password')

        // Fetch user with passwordHash to verify
        const userWithPassword = await prisma.user.findUnique({
          where: { id: user.id }
        })

        if (!userWithPassword || !userWithPassword.passwordHash) {
          throw new Error('Account has no password set')
        }

        const valid = await verifyPassword(currentPassword, userWithPassword.passwordHash)
        if (!valid) throw new Error('Incorrect current password')

        data.passwordHash = await hashPassword(newPassword)
      }

      return prisma.user.update({
        where: { id: user.id },
        data
      })
    },

    markNotificationRead: async (_: unknown, { notificationId }: { notificationId: string }, context: Context) => {
      const user = await requireAuth(context.event)
      const notification = await prisma.notification.findUnique({ where: { id: notificationId } })

      if (!notification || notification.userId !== user.id) {
        throw new Error('Notification not found')
      }

      return prisma.notification.update({
        where: { id: notificationId },
        data: { read: true }
      })
    },

    markAllNotificationsRead: async (_: unknown, __: unknown, context: Context) => {
      const user = await requireAuth(context.event)
      const result = await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true }
      })
      return result.count
    },

    adminDeleteConversation: async (_: unknown, { conversationId }: { conversationId: string }, context: Context) => {
      applyRateLimit(context.event, RATE_LIMITS.admin, 'admin action')
      await requireAdmin(context.event)

      await prisma.conversation.delete({ where: { id: conversationId } })
      return true
    },

    updateUserRole: async (_: unknown, { userId, role }: { userId: string, role: string }, context: Context) => {
      applyRateLimit(context.event, RATE_LIMITS.admin, 'admin action')
      await requireAdmin(context.event)

      // Validate role
      if (!Object.values(Role).includes(role as Role)) {
        throw new Error('Invalid role')
      }

      return prisma.user.update({
        where: { id: userId },
        data: { role: role as Role } // Cast string to Role enum
      })
    },

    adminDeleteUser: async (_: unknown, { userId }: { userId: string }, context: Context) => {
      applyRateLimit(context.event, RATE_LIMITS.admin, 'admin action')
      await requireAdmin(context.event)
      await prisma.user.delete({ where: { id: userId } })
      return true
    },

    adminCreateUser: async (_: unknown, args: { email: string, password: string, name: string, username: string, role?: string }, context: Context) => {
      applyRateLimit(context.event, RATE_LIMITS.admin, 'admin action')
      await requireAdmin(context.event)

      const { email, password, name, username, role = 'USER' } = args

      // Validate role
      if (!['USER', 'MODERATOR', 'ADMIN'].includes(role)) {
        throw new Error('Invalid role')
      }

      // Check if email or username already exists
      const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { username }] }
      })
      if (existing) {
        throw new Error(existing.email === email ? 'Email already in use' : 'Username already taken')
      }

      // Hash password
      const hashedPassword = await hashPassword(password)

      return prisma.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          name,
          username,
          role: role as Role
        }
      })
    },

    adminUpdateUser: async (_: unknown, args: { userId: string, name?: string, username?: string, email?: string, bio?: string, avatar?: string, role?: string, newPassword?: string }, context: Context) => {
      applyRateLimit(context.event, RATE_LIMITS.admin, 'admin action')
      await requireAdmin(context.event)

      const { userId, newPassword, role, ...profileData } = args

      // Check user exists
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        throw new Error('User not found')
      }

      // Check uniqueness of username/email if changed
      if (profileData.username && profileData.username !== user.username) {
        const existing = await prisma.user.findFirst({ where: { username: profileData.username } })
        if (existing) throw new Error('Username already taken')
      }
      if (profileData.email && profileData.email !== user.email) {
        const existing = await prisma.user.findFirst({ where: { email: profileData.email } })
        if (existing) throw new Error('Email already in use')
      }

      // Build update data
      const updateData: any = {}
      if (profileData.name) updateData.name = profileData.name
      if (profileData.username) updateData.username = profileData.username
      if (profileData.email) updateData.email = profileData.email
      if (profileData.bio !== undefined) updateData.bio = profileData.bio
      if (profileData.avatar !== undefined) updateData.avatar = profileData.avatar
      if (role && ['USER', 'MODERATOR', 'ADMIN'].includes(role)) {
        updateData.role = role as Role
      }
      if (newPassword) {
        updateData.passwordHash = await hashPassword(newPassword)
      }

      return prisma.user.update({
        where: { id: userId },
        data: updateData
      })
    },

    adminDeleteComment: async (_: unknown, { commentId }: { commentId: string }, context: Context) => {
      applyRateLimit(context.event, RATE_LIMITS.admin, 'admin action')
      await requireAdmin(context.event)
      await prisma.comment.delete({ where: { id: commentId } })
      return true
    },

    createPhilosopher: async (_: unknown, args: any, context: Context) => {
      applyRateLimit(context.event, RATE_LIMITS.admin, 'admin action')
      await requireAdmin(context.event)
      return prisma.philosopher.create({
        data: args
      })
    },

    updatePhilosopher: async (_: unknown, args: any, context: Context) => {
      applyRateLimit(context.event, RATE_LIMITS.admin, 'admin action')
      await requireAdmin(context.event)
      const { id, ...data } = args
      return prisma.philosopher.update({
        where: { id },
        data
      })
    },

    deletePhilosopher: async (_: unknown, { id }: { id: string }, context: Context) => {
      applyRateLimit(context.event, RATE_LIMITS.admin, 'admin action')
      await requireAdmin(context.event)
      await prisma.philosopher.delete({ where: { id } })
      return true
    }

  }
}
