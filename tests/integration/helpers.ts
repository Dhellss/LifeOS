import { randomUUID } from 'node:crypto';

import { prisma } from '@/lib/db';

/** Create an isolated user for a test and return its id. */
export async function createTestUser(label = 'user'): Promise<string> {
  const user = await prisma.user.create({
    data: {
      name: `Test ${label}`,
      email: `${label}-${randomUUID()}@integration.test`,
      emailVerified: true,
    },
  });
  return user.id;
}

/** Remove users created by a test. Cascades clear all owned rows. */
export async function deleteTestUsers(...userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

/** `yyyy-MM-dd` for `offset` days before today, in the server's timezone. */
export function dayKeyOffset(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
