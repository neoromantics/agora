#!/usr/bin/env npx tsx
/**
 * Migration script: Convert Base64 images in database to MinIO storage
 *
 * Usage:
 *   cd agora
 *   npx tsx scripts/migrate-images-to-minio.ts
 *
 * Environment variables required:
 *   DATABASE_URL - PostgreSQL connection string
 *   NUXT_MINIO_ENDPOINT - MinIO endpoint (host:port)
 *   NUXT_MINIO_ACCESS_KEY - MinIO access key
 *   NUXT_MINIO_SECRET_KEY - MinIO secret key
 *   NUXT_MINIO_BUCKET - MinIO bucket name (default: agora)
 *
 * Options:
 *   --dry-run  Show what would be migrated without making changes
 */

import pkg from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { Client } from 'minio'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { PrismaClient } = pkg as any

const DRY_RUN = process.argv.includes('--dry-run')

// Initialize Prisma with pg adapter (same as app)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Initialize MinIO
function createMinioClient(): Client {
  const endpoint = process.env.NUXT_MINIO_ENDPOINT
  if (!endpoint) {
    throw new Error('NUXT_MINIO_ENDPOINT is required')
  }

  const [endPoint, portStr] = endpoint.split(':')
  const port = portStr ? parseInt(portStr, 10) : 9000

  return new Client({
    endPoint,
    port,
    useSSL: process.env.NUXT_MINIO_USE_SSL === 'true',
    accessKey: process.env.NUXT_MINIO_ACCESS_KEY || '',
    secretKey: process.env.NUXT_MINIO_SECRET_KEY || ''
  })
}

const bucket = process.env.NUXT_MINIO_BUCKET || 'agora'

async function migrateBase64ToMinio(
  minio: Client,
  data: string,
  type: 'avatar' | 'portrait',
  id: string
): Promise<string> {
  // Parse base64 data URI
  const matches = data.match(/^data:([^;]+);base64,([\s\S]+)$/)
  if (!matches || !matches[1] || !matches[2]) {
    throw new Error('Invalid base64 data URI format')
  }

  const mimeType = matches[1]
  const base64Data = matches[2].replace(/\s/g, '')
  const buffer = Buffer.from(base64Data, 'base64')

  // Get extension from mime type
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
  }
  const extension = extMap[mimeType] || 'png'

  // Generate key
  const timestamp = Date.now()
  const key = `${type}s/${id}-${timestamp}.${extension}`

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would upload ${buffer.length} bytes to ${key}`)
    return `minio://${bucket}/${key}`
  }

  // Upload to MinIO
  await minio.putObject(bucket, key, buffer, buffer.length, {
    'Content-Type': mimeType
  })

  return `minio://${bucket}/${key}`
}

async function ensureBucket(minio: Client): Promise<void> {
  const exists = await minio.bucketExists(bucket)
  if (!exists) {
    if (DRY_RUN) {
      console.log(`[DRY RUN] Would create bucket: ${bucket}`)
    } else {
      await minio.makeBucket(bucket, 'us-east-1')
      console.log(`✓ Created bucket: ${bucket}`)
    }
  } else {
    console.log(`✓ Bucket exists: ${bucket}`)
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('MinIO Image Migration Script')
  console.log('='.repeat(60))

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n')
  }

  const minio = createMinioClient()

  // Ensure bucket exists
  await ensureBucket(minio)

  // Count what we're working with
  const userCount = await prisma.user.count({
    where: {
      avatar: { startsWith: 'data:' }
    }
  })
  const philosopherCount = await prisma.philosopher.count({
    where: {
      portrait: { startsWith: 'data:' }
    }
  })

  console.log(`\nFound ${userCount} user avatars and ${philosopherCount} philosopher portraits to migrate\n`)

  // Migrate user avatars
  if (userCount > 0) {
    console.log('--- Migrating User Avatars ---')
    const users = await prisma.user.findMany({
      where: { avatar: { startsWith: 'data:' } },
      select: { id: true, username: true, avatar: true }
    })

    for (const user of users) {
      try {
        console.log(`Processing user: ${user.username} (${user.id})`)
        const newUrl = await migrateBase64ToMinio(minio, user.avatar!, 'avatar', user.id)

        if (!DRY_RUN) {
          await prisma.user.update({
            where: { id: user.id },
            data: { avatar: newUrl }
          })
        }
        console.log(`  ✓ Migrated to: ${newUrl}`)
      } catch (error) {
        console.error(`  ✗ Failed: ${error}`)
      }
    }
  }

  // Migrate philosopher portraits
  if (philosopherCount > 0) {
    console.log('\n--- Migrating Philosopher Portraits ---')
    const philosophers = await prisma.philosopher.findMany({
      where: { portrait: { startsWith: 'data:' } },
      select: { id: true, name: true, portrait: true }
    })

    for (const phil of philosophers) {
      try {
        console.log(`Processing philosopher: ${phil.name} (${phil.id})`)
        const newUrl = await migrateBase64ToMinio(minio, phil.portrait, 'portrait', phil.id)

        if (!DRY_RUN) {
          await prisma.philosopher.update({
            where: { id: phil.id },
            data: { portrait: newUrl }
          })
        }
        console.log(`  ✓ Migrated to: ${newUrl}`)
      } catch (error) {
        console.error(`  ✗ Failed: ${error}`)
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  if (DRY_RUN) {
    console.log('DRY RUN COMPLETE - Run without --dry-run to apply changes')
  } else {
    console.log('MIGRATION COMPLETE')
  }
  console.log('='.repeat(60))

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
