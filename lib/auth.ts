import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';

import { prisma } from '@/lib/db';
import { getServerEnv } from '@/lib/env';

const env = getServerEnv();

/**
 * Test-only escape hatch.
 *
 * The E2E suite registers a fresh account per test, which legitimately exceeds
 * the credential budget below. Only `playwright.config.ts` sets this; it is
 * never set in `.env` or in any deployment.
 */
const rateLimitDisabled = process.env.AUTH_RATE_LIMIT_DISABLED === 'true';

/**
 * Better Auth instance.
 *
 * Email + password credentials are stored in the `account` table with a hashed
 * password (scrypt); sessions are database-backed rows in `session` carried by
 * an httpOnly, SameSite=Lax cookie. Identity is never persisted client-side.
 *
 * The default model names (`user`, `session`, `account`, `verification`) line
 * up with the Prisma client accessors generated from `prisma/schema.prisma`,
 * so no model mapping is needed here.
 */
export const auth = betterAuth({
  appName: 'LifeOS',
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh the expiry at most once a day
  },
  /**
   * Throttling for the auth endpoints, stated explicitly rather than left to
   * the library default (which only switches on in production).
   *
   * Credential endpoints get a much tighter budget than the rest of the
   * surface, because they are the ones worth brute-forcing.
   *
   * Storage is in-memory, so the budget is per server instance. On a
   * single-instance deployment that is the whole application; on a serverless
   * or horizontally scaled one it only slows an attacker down proportionally,
   * and a shared store (Redis via `secondarySettings`) would be the next step.
   */
  rateLimit: {
    enabled: !rateLimitDisabled,
    window: 60,
    max: 120,
    customRules: {
      '/sign-in/email': { window: 60, max: 10 },
      '/sign-up/email': { window: 60, max: 10 },
    },
  },
  advanced: {
    /**
     * Keyed off the deployment's actual scheme rather than `NODE_ENV`.
     *
     * A `Secure` cookie is only transmitted over https, so marking one on an
     * http origin makes sign-in fail silently - which is exactly what happens
     * when a production build is smoke-tested over plain http.
     */
    useSecureCookies: env.BETTER_AUTH_URL.startsWith('https://'),
  },
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
