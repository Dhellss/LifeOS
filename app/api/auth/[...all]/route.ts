import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '@/lib/auth';

/** Better Auth mounts its full endpoint surface under `/api/auth/*`. */
export const { GET, POST } = toNextJsHandler(auth.handler);
