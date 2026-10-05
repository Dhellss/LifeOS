import { z } from 'zod';

/**
 * Server-side environment contract.
 *
 * Parsed lazily so that importing this module in a client bundle (or during
 * `next build`'s static analysis) never throws for variables that are only
 * needed at request time.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  BETTER_AUTH_SECRET: z.string().min(16, 'BETTER_AUTH_SECRET must be at least 16 characters long'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(
      `Invalid server environment configuration:\n${issues.join('\n')}\n\n` +
        'Copy .env.example to .env and fill in the missing values.',
    );
  }

  cached = parsed.data;
  return cached;
}
