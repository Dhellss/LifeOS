'use client';

import { useEffect, useState } from 'react';

/**
 * Time-of-day greeting.
 *
 * Computed on the client so it matches the viewer's clock rather than the
 * server's; the first paint falls back to a neutral greeting.
 */
export function Greeting({ name }: { name: string }) {
  const [salutation, setSalutation] = useState('Hello');
  const [dateLabel, setDateLabel] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 5) setSalutation('Still up');
    else if (hour < 12) setSalutation('Good morning');
    else if (hour < 18) setSalutation('Good afternoon');
    else setSalutation('Good evening');

    setDateLabel(
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    );
  }, []);

  const firstName = name.trim().split(/\s+/)[0] ?? name;

  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">
        {salutation}, {firstName}
      </h1>
      <p className="text-sm text-muted-foreground" suppressHydrationWarning>
        {dateLabel || ' '}
      </p>
    </div>
  );
}
