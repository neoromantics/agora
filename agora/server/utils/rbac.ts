import type { H3Event } from 'h3'
import { getCurrentUser } from './auth'

export enum Role {
  USER = 'USER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN'
}

// Check if user has a specific role
export async function requireRole(event: H3Event, role: Role) {
  const user = await getCurrentUser(event)

  if (!user) {
    throw new Error('Unauthorized')
  }

  if (user.role !== role) {
    throw new Error(`Forbidden: ${role} role required`)
  }

  return user
}

// Check if user has at least the minimum role level
export async function requireMinRole(event: H3Event, minRole: Role) {
  const user = await getCurrentUser(event)

  if (!user) {
    throw new Error('Unauthorized')
  }

  const roleHierarchy = {
    [Role.USER]: 0,
    [Role.MODERATOR]: 1,
    [Role.ADMIN]: 2
  }

  const userLevel = roleHierarchy[user.role as Role] ?? 0
  const requiredLevel = roleHierarchy[minRole]

  if (userLevel < requiredLevel) {
    throw new Error(`Forbidden: At least ${minRole} role required`)
  }

  return user
}

// Check if user is admin
export async function requireAdmin(event: H3Event) {
  return requireRole(event, Role.ADMIN)
}

// Check if user is at least moderator
export async function requireModerator(event: H3Event) {
  return requireMinRole(event, Role.MODERATOR)
}

// Check if user has permission for an action
export function hasPermission(userRole: string, action: string): boolean {
  const permissions: Record<string, string[]> = {
    [Role.ADMIN]: ['*'], // All permissions
    [Role.MODERATOR]: [
      'conversation.delete',
      'comment.delete',
      'user.view'
    ],
    [Role.USER]: [
      'conversation.create',
      'conversation.update_own',
      'conversation.delete_own',
      'comment.create',
      'comment.delete_own',
      'like.create'
    ]
  }

  const rolePermissions = permissions[userRole] || []

  // Admin has all permissions
  if (rolePermissions.includes('*')) {
    return true
  }

  return rolePermissions.includes(action)
}
