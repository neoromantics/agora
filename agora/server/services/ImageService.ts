import { prisma } from '../utils/db'
import { lookup } from 'node:dns'
import net from 'node:net'
import { promisify } from 'node:util'
import {
  isMinioEnabled,
  parseMinioUrl,
  getImage as getMinioImage
} from '../utils/minio'

const dnsLookup = promisify(lookup)

/**
 * Checks if an IP address belongs to a private/internal network.
 * Protects against SSRF attacks.
 */
function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4) return false

  const [first, second] = parts as [number, number, number, number]

  // 127.0.0.0/8 (Localhost)
  if (first === 127) return true
  // 10.0.0.0/8 (Private A)
  if (first === 10) return true
  // 172.16.0.0/12 (Private B)
  if (first === 172 && second >= 16 && second <= 31) return true
  // 192.168.0.0/16 (Private C)
  if (first === 192 && second === 168) return true
  // 0.0.0.0/8 (Current network)
  if (first === 0) return true
  // 169.254.0.0/16 (Link-local)
  if (first === 169 && second === 254) return true

  return false
}

/**
 * Validates that an external URL does not resolve to a private IP.
 */
async function validateExternalUrl(url: string): Promise<void> {
  try {
    const { hostname } = new URL(url)
    const { address } = await dnsLookup(hostname)

    if (net.isIP(address) === 4 && isPrivateIP(address)) {
      throw new Error(`SSRF Blocked: ${hostname} resolves to private IP ${address}`)
    }
  } catch (e: unknown) {
    // Re-throw if it's our block, otherwise valid DNS error
    const message = e instanceof Error ? e.message : ''
    if (message.startsWith('SSRF')) throw e
    throw new Error('Access denied to internal resources')
  }
}

/**
 * Fetches an image by type and ID.
 * Handles MinIO (minio://), Base64 (data:), and External URLs (http/https).
 * @returns Object containing buffer and mimeType
 */
export async function getImage(type: string, id: string): Promise<{ buffer: Buffer, mimeType: string }> {
  let imageUrl: string | null = null

  // 1. Resolve URL from Database
  if (type === 'user') {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { avatar: true }
    })
    imageUrl = user?.avatar || null
  } else if (type === 'philosopher') {
    const philosopher = await prisma.philosopher.findUnique({
      where: { id },
      select: { portrait: true }
    })
    imageUrl = philosopher?.portrait || null
  } else {
    throw new Error('Invalid image type') // Controller handles 400
  }

  if (!imageUrl) {
    throw new Error('Image not found') // Controller handles 404
  }

  imageUrl = imageUrl.trim()

  // 2. Handle MinIO internal storage (minio://bucket/key)
  if (imageUrl.startsWith('minio://')) {
    if (!isMinioEnabled()) {
      throw new Error('MinIO is not configured')
    }
    const parsed = parseMinioUrl(imageUrl)
    if (!parsed) {
      throw new Error('Invalid MinIO URL format')
    }
    const result = await getMinioImage(parsed.key)
    return {
      buffer: result.buffer,
      mimeType: result.contentType
    }
  }

  // 3. Handle Base64 (Legacy - for migration period)
  if (imageUrl.startsWith('data:')) {
    const matches = imageUrl.match(/^data:([^;]+);base64,([\s\S]+)$/)
    if (matches && matches[1] && matches[2]) {
      return {
        mimeType: matches[1],
        buffer: Buffer.from(matches[2].replace(/\s/g, ''), 'base64')
      }
    }
  }

  // 4. Handle External URL (Proxy with SSRF Protection)
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    await validateExternalUrl(imageUrl)

    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch upstream image: ${response.statusText}`)
    }

    const mimeType = response.headers.get('content-type') || 'application/octet-stream'
    const arrayBuffer = await response.arrayBuffer()
    return {
      mimeType,
      buffer: Buffer.from(arrayBuffer)
    }
  }

  throw new Error('Invalid image source format')
}

// Export as namespace for backward compatibility
export const ImageService = {
  getImage
}
