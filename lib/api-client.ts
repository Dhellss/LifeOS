'use client';

/**
 * Thin fetch wrapper for the app's own JSON API.
 *
 * Normalises error shapes so that forms can surface `fieldErrors` from the
 * server's Zod validation without every component re-implementing the parsing.
 */

export interface ApiErrorShape {
  error: { code: string; message: string; fieldErrors?: Record<string, string[]> };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string[]>;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const shape = payload as Partial<ApiErrorShape> | null;
    throw new ApiError(
      response.status,
      shape?.error?.code ?? 'REQUEST_FAILED',
      shape?.error?.message ?? `Request failed with status ${response.status}.`,
      shape?.error?.fieldErrors ?? {},
    );
  }

  return (payload as { data: T } | null)?.data as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

/** Human-readable message for any thrown value, for toast copy. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
