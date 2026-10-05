import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { UnauthorizedError } from '@/lib/errors';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: Date;
}

/**
 * Resolve the signed-in user from the request's session cookie.
 *
 * Wrapped in React's `cache` so that a single render pass hits the session
 * table once no matter how many server components ask for the user.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
    createdAt: new Date(session.user.createdAt),
  };
});

/**
 * Server-component guard: returns the user or redirects to the login page.
 * Used by the dashboard layout so every protected page is covered.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Route-handler guard: returns the user or throws an `UnauthorizedError`,
 * which the API error mapper turns into a 401 JSON response.
 */
export async function requireApiUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
