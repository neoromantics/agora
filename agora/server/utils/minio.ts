/**
 * MinIO S3-compatible object storage client
 * Used for storing user avatars and philosopher portraits
 */
import { Client } from 'minio'

// Lazy-initialized MinIO client
let minioClient: Client | null = null

/**
 * Get or create the MinIO client instance
 */
export function getMinioClient(): Client {
  if (minioClient) {
    return minioClient
  }

  const config = useRuntimeConfig()

  // Check if MinIO is configured
  if (!config.minioEndpoint) {
    throw new Error('MinIO is not configured. Set NUXT_MINIO_ENDPOINT environment variable.')
  }

  // Parse endpoint (might be host:port format)
  const [endPoint, portStr] = config.minioEndpoint.split(':')
  const port = portStr ? parseInt(portStr, 10) : 9000

  minioClient = new Client({
    endPoint: endPoint as string,
    port,
    useSSL: config.minioUseSsl === 'true',
    accessKey: config.minioAccessKey as string,
    secretKey: config.minioSecretKey as string
  })

  return minioClient
}

/**
 * Get the default bucket name from config
 */
export function getMinioBucket(): string {
  const config = useRuntimeConfig()
  return config.minioBucket || 'agora'
}

/**
 * Check if MinIO is enabled/configured
 */
export function isMinioEnabled(): boolean {
  const config = useRuntimeConfig()
  return !!config.minioEndpoint
}

/**
 * Generate a unique object key for an image
 */
export function generateImageKey(type: 'avatar' | 'portrait', id: string, extension: string): string {
  const timestamp = Date.now()
  return `${type}s/${id}-${timestamp}.${extension}`
}

/**
 * Upload a buffer to MinIO
 * @returns The object key (path) that can be used to retrieve the image
 */
export async function uploadImage(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const client = getMinioClient()
  const bucket = getMinioBucket()

  await client.putObject(bucket, key, buffer, buffer.length, {
    'Content-Type': contentType
  })

  // Return minio:// URL for storage in database
  return `minio://${bucket}/${key}`
}

/**
 * Get an image from MinIO
 * @returns Buffer and content type
 */
export async function getImage(key: string): Promise<{ buffer: Buffer, contentType: string }> {
  const client = getMinioClient()
  const bucket = getMinioBucket()

  const stream = await client.getObject(bucket, key)
  const stat = await client.statObject(bucket, key)

  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }

  return {
    buffer: Buffer.concat(chunks),
    contentType: stat.metaData['content-type'] || 'application/octet-stream'
  }
}

/**
 * Delete an image from MinIO
 */
export async function deleteImage(key: string): Promise<void> {
  const client = getMinioClient()
  const bucket = getMinioBucket()
  await client.removeObject(bucket, key)
}

/**
 * Parse a minio:// URL into bucket and key
 */
export function parseMinioUrl(url: string): { bucket: string, key: string } | null {
  const match = url.match(/^minio:\/\/([^/]+)\/(.+)$/)
  if (!match || !match[1] || !match[2]) return null
  return { bucket: match[1], key: match[2] }
}
