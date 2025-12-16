// Avatar upload API - returns base64 data URL for database storage
// This approach works in k3s without persistent storage

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

  // Limit file size to 500KB for avatars
  const maxSize = 500 * 1024 // 500KB
  if (file.data.length > maxSize) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Image too large. Maximum size is 500KB.'
    })
  }

  // Convert to base64 data URL
  const base64 = file.data.toString('base64')
  const dataUrl = `data:${contentType};base64,${base64}`

  return {
    url: dataUrl
  }
})
