'use client';

import { createAuthClient } from 'better-auth/react';

/**
 * Browser-side auth client.
 *
 * `baseURL` is deliberately omitted so requests go to `/api/auth/*` on
 * whatever origin served the page. A `NEXT_PUBLIC_*` value would be inlined at
 * build time, which would pin one build to a single origin — wrong for a
 * container image that runs in several environments, and wrong for preview
 * deployments.
 *
 * The client holds no tokens; the session lives in an httpOnly cookie.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
