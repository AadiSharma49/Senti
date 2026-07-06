import { PrismaClient } from '@prisma/client'

/**
 * Prisma client singleton. Reused across hot reloads in dev to avoid
 * exhausting DB connections. Only used when DATABASE_URL is configured;
 * routes fall back to the local file store otherwise.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const dbEnabled = !!process.env.DATABASE_URL

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
