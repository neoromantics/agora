import { ImageService } from '../../../services/ImageService'

export default defineEventHandler(async (event) => {
  const type = getRouterParam(event, 'type')
  const id = getRouterParam(event, 'id')

  if (!type || !id) {
    throw createError({ statusCode: 400, message: 'Missing type or id' })
  }

  try {
    // Note: ImageService.getImage is now aliased to getImageStream
    const { stream, mimeType } = await ImageService.getImage(type, id)

    // Set Content-Type
    if (mimeType) {
      setHeader(event, 'Content-Type', mimeType)
    }

    // Set Cache-Control Headers
    // User requested NO browser caching to ensure updates are seen immediately
    setHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate')
    setHeader(event, 'Pragma', 'no-cache')
    setHeader(event, 'Expires', '0')

    return sendStream(event, stream)
  } catch (error: unknown) {
    // Map Service Errors to HTTP Errors
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Image not found') {
      throw createError({ statusCode: 404, message: 'Image not found' })
    }
    if (message === 'Invalid image type') {
      throw createError({ statusCode: 400, message: 'Invalid image type' })
    }
    if (message.startsWith('SSRF')) {
      throw createError({ statusCode: 403, message: 'Access denied' })
    }

    // Default 500
    console.error('Image Service Error:', error)
    throw createError({ statusCode: 500, message: 'Internal Server Error fetching image' })
  }
})
