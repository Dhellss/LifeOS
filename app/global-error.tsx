'use client';

/**
 * Last-resort boundary. It replaces the root layout, so it must render its own
 * `<html>` and cannot rely on the app's providers or Tailwind layer order.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
          background: '#f8f9fb',
          color: '#111827',
        }}
      >
        <main style={{ maxWidth: '32rem' }}>
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>LifeOS could not start</h1>
          <p style={{ fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.6 }}>
            An unexpected error occurred before the application could render. Reloading may resolve
            it.
          </p>
          {error.digest ? (
            <p style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace' }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#4f46e5',
              color: 'white',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
