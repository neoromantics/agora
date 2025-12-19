import { prisma } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const type = getRouterParam(event, 'type')
  const id = getRouterParam(event, 'id')

  if (!type || !id) {
    throw createError({ statusCode: 400, message: 'Missing type or id' })
  }

  let imageData: string | null = null

  if (type === 'user') {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { avatar: true }
    })
    imageData = user?.avatar || null
  } else if (type === 'philosopher') {
    const philosopher = await prisma.philosopher.findUnique({
      where: { id },
      select: { portrait: true }
    })
    imageData = philosopher?.portrait || null
  } else {
    throw createError({ statusCode: 400, message: 'Invalid type' })
  }

  if (!imageData) {
    throw createError({ statusCode: 404, message: 'Image not found' })
  }

  imageData = imageData.trim()

  // Handle Base64 Data URI
  if (imageData.startsWith('data:')) {
    const matches = imageData.match(/^data:([^;]+);base64,([\s\S]+)$/)
    if (matches && matches[1] && matches[2]) {
      const mimeType = matches[1]
      const base64Data = matches[2].replace(/\s/g, '')
      const buffer = Buffer.from(base64Data, 'base64')

      setHeaders(event, {
        'Content-Type': mimeType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=86400'
      })

      return buffer
    }
  }

  // Handle external URL - redirect
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return sendRedirect(event, imageData, 302)
  }

  throw createError({ statusCode: 400, message: 'Invalid image format' })
})
