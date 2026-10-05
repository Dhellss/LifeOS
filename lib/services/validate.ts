import type { ZodTypeAny, z } from 'zod';

import { ValidationError } from '@/lib/errors';

/**
 * Run a Zod schema and translate failures into a `ValidationError`.
 *
 * Services call this on every write so that a malformed payload produces a 422
 * with per-field messages instead of a Prisma error leaking to the client.
 */
export function parseOrThrow<TSchema extends ZodTypeAny>(
  schema: TSchema,
  value: unknown,
): z.infer<TSchema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const [key, messages] of Object.entries(result.error.flatten().fieldErrors)) {
      if (messages && messages.length > 0) fieldErrors[key] = messages;
    }
    const formErrors = result.error.flatten().formErrors;
    const message = formErrors[0] ?? 'The submitted data is invalid.';
    throw new ValidationError(message, fieldErrors);
  }
  return result.data;
}
