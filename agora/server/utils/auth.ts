import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { type H3Event, getHeader, getCookie, createError } from 'h3'

const AUTH_COOKIE_NAME = 'auth_token'
const SALT_ROUNDS = 12

export interface JWTPayload {
  userId: string
  email: string
  iat?: number
  exp?: number
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const config = useRuntimeConfig()
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: '7d'
  })
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const config = useRuntimeConfig()
    return jwt.verify(token, config.jwtSecret) as JWTPayload
  } catch {
    return null
  }
}

/**
 * Get the current user from the request
 */
export async function getCurrentUser(event: H3Event) {
  let token = ''
  const authHeader = getHeader(event, 'authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else {
    // Fallback to cookie
    const cookieToken = getCookie(event, AUTH_COOKIE_NAME)
    if (cookieToken) {
      token = cookieToken
    } else {
      return null
    }
  }
  const payload = verifyToken(token)
  if (!payload) {
    return null
  }

  // Fetch user from database
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      avatar: true,
      bio: true,
      role: true,
      createdAt: true
    }
  })

  if (!user) return null

  // Transform avatar to URL path to prevent large Base64 in cookies
  const baseURL = process.env.NUXT_PUBLIC_BASE_URL || '/agora/beta'
  return {
    ...user,
    avatar: user.avatar ? `${baseURL}/api/img/user/${user.id}` : null
  }
}

/**
 * Require authentication - throws 401 if not authenticated
 */
export async function requireAuth(event: H3Event) {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }
  return user
}
