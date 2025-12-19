/**
 * Avatar/Image upload API
 * Uploads to MinIO object storage if configured, otherwise falls back to base64 (legacy)
 */
import {
  isMinioEnabled,
  uploadImage,
  generateImageKey
} from '../utils/minio'

export default defineEventHandler(async (event) => {
  const files = await readMultipartFormData(event)
  if (!files || files.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No file uploaded'
    })
  }

  const file = files.find(f => f.name === 'file')
  if (!file || !file.data) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No file data found'
    })
  }

  // Validate file type
  const contentType = file.type || 'image/png'
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(contentType)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'
    })
  }

  // Limit file size to 5MB for avatars
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.data.length > maxSize) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Image too large. Maximum size is 5MB.'
    })
  }

  // Get file extension from content type
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
  }
  const extension = extMap[contentType] || 'png'

  // Use MinIO if configured, otherwise fall back to base64
  if (isMinioEnabled()) {
    // Generate unique key using a random ID (will be replaced with actual user/philosopher ID by caller)
    const tempId = crypto.randomUUID()
    const key = generateImageKey('avatar', tempId, extension)

    const minioUrl = await uploadImage(file.data, key, contentType)

    return {
      url: minioUrl
    }
  }

  // Fallback: Convert to base64 data URL (legacy mode)
  console.warn('[upload] MinIO not configured, falling back to base64 storage')
  const base64 = file.data.toString('base64')
  const dataUrl = `data:${contentType};base64,${base64}`

  return {
    url: dataUrl
  }
})
