// Prisma client singleton for Nuxt server
// Using Prisma 7 with PostgreSQL adapter
// import { createRequire } from 'module'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

import pkg from '@prisma/client'
import type { PrismaClient as PrismaClientType } from '@prisma/client'

const { PrismaClient } = pkg as unknown as { PrismaClient: typeof PrismaClientType }

// const require = createRequire(import.meta.url)
// const { PrismaClient } = require('@prisma/client')

type PrismaClientInstance = InstanceType<typeof PrismaClientType> | null
let pool: Pool | null = null
let prismaInstance: PrismaClientInstance | null = null

function createPrismaClient(): PrismaClientInstance {
  const config = useRuntimeConfig()
  const databaseUrl = config.databaseUrl

  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl
    })
  }

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma = (() => {
  if (!prismaInstance) {
    prismaInstance = createPrismaClient()
  }
  return prismaInstance!
})()

export default prisma
