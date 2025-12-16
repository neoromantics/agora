import { promises as fs } from 'fs'
import path from 'path'
import { prisma } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const slug = event.context.params?.slug

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Slug not provided'
    })
  }

  const philosopher = await prisma.philosopher.findUnique({
    where: { slug }
  })

  if (!philosopher || !philosopher.portrait) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Portrait not found'
    })
  }

  // Check if it's an external URL
  if (philosopher.portrait.startsWith('http://') || philosopher.portrait.startsWith('https://')) {
    return sendRedirect(event, philosopher.portrait)
  }

  // Assuming portrait path is relative to the public dir
  const imagePath = path.resolve(process.cwd(), 'public', philosopher.portrait)

  try {
    const file = await fs.readFile(imagePath)

    // Set appropriate content type
    event.res.setHeader('Content-Type', 'image/jpeg')
    return file
  } catch {
    throw createError({
      statusCode: 404,
      statusMessage: 'Image file not found'
    })
  }
})
