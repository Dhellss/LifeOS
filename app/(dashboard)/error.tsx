'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Route-level error boundary for the protected app.
 * The raw error is logged to the console only; the user sees a safe message
 * plus the digest they can quote in a bug report.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[lifeos] route error', error);
  }, [error]);

  return (
    <Card className="border-destructive/40">
      <CardContent className="flex flex-col items-start gap-4 p-6">
        <span className="bg-destructive/12 flex h-10 w-10 items-center justify-center rounded-full text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Something went wrong on this page</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            The page could not be loaded. Retrying usually fixes it; if it does not, the error
            reference below helps track it down.
          </p>
          {error.digest ? (
            <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
          ) : null}
        </div>
        <Button onClick={reset}>
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
