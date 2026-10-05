import { PrismaClient } from '@prisma/client';

/**
 * A single PrismaClient instance per process.
 *
 * Next.js dev mode hot-reloads modules on every edit; without the global cache
 * each reload would open a new connection pool and exhaust Postgres.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { Prisma } from '@prisma/client';
