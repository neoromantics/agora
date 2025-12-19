import { ImageService } from '../../../services/ImageService'

export default defineCachedEventHandler(async (event) => {
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

    // Set Aggressive Cache Headers (Immutable / 1 Year)
    // The server-side cache (SWR) handles the "execution" cache,
    // this header handles the "Browser" cache.
    setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

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
    // console.error('Image Service Error:', error)
    throw createError({ statusCode: 500, message: 'Internal Server Error fetching image' })
  }
}, {
  swr: true,
  maxAge: 60 * 60 * 24, // Server-Side Cache: 24 Hours
  name: 'image-proxy'
})
