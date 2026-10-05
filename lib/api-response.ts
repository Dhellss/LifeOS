import { NextResponse } from 'next/server';

import { isAppError, ValidationError } from '@/lib/errors';

/**
 * HTTP envelope helpers shared by every route handler.
 *
 * Success: `{ data: ... }`. Failure: `{ error: { code, message, fieldErrors } }`.
 * Unknown errors are logged server-side and reported as a generic 500 so that
 * stack traces and SQL never reach the client.
 */

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function created<T>(data: T) {
  return ok(data, 201);
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function failure(error: unknown) {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: { code: error.code, message: error.message, fieldErrors: error.fieldErrors },
      },
      { status: error.status },
    );
  }

  if (isAppError(error)) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  console.error('[api] unhandled error', error);
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.' } },
    { status: 500 },
  );
}

/** Parse a request body as JSON, tolerating an empty body. */
export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError('The request body must be valid JSON.');
  }
}

/** Collapse a `URLSearchParams` into a plain object for Zod parsing. */
export function searchParamsToObject(url: string): Record<string, string> {
  const params = new URL(url).searchParams;
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    if (value !== '') result[key] = value;
  });
  return result;
}
