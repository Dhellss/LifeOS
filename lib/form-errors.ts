import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiError } from '@/lib/api-client';

/**
 * Map a 422 response's `fieldErrors` onto React Hook Form's error state so
 * server-side validation messages appear next to the offending input.
 */
export function applyServerErrors<TValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TValues>,
): void {
  if (!(error instanceof ApiError)) return;
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const message = messages?.[0];
    if (message) setError(field as Path<TValues>, { type: 'server', message });
  }
}
