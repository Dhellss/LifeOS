'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';

import { MOOD_OPTIONS } from '@/components/journal/mood';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Search + mood filters, held in the URL and applied server-side.
 *
 * The search box stays client-side so it can debounce, but the mood chips are
 * plain anchors: a `router.replace` fired straight out of a button's `onClick`
 * was observed to drop some query-only navigations, leaving a chip visibly
 * "clicked" with the list unchanged. An anchor always navigates, and it keeps
 * each filter shareable.
 */
export function JournalFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const mood = searchParams.get('mood') ?? '';

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value) params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // Debounce the free-text search so typing does not fire a request per key.
  useEffect(() => {
    const current = searchParams.get('search') ?? '';
    if (search === current) return;
    const timer = setTimeout(() => pushParams({ search: search || null }), 300);
    return () => clearTimeout(timer);
  }, [search, searchParams, pushParams]);

  /** Toggling a mood keeps the active search; re-picking it clears the mood. */
  const moodHref = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (mood === value) params.delete('mood');
    else params.set('mood', value);
    const query = params.toString();
    return query ? `/journal?${query}` : '/journal';
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search entries…"
          aria-label="Search journal entries"
          className="pl-8"
        />
      </div>

      <nav aria-label="Filter by mood" className="flex flex-wrap gap-1.5">
        {MOOD_OPTIONS.map((option) => (
          <a
            key={option.value}
            href={moodHref(option.value)}
            aria-current={mood === option.value ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              mood === option.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {option.emoji} {option.label}
          </a>
        ))}
      </nav>

      {search || mood ? (
        <a href="/journal" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          <X className="h-4 w-4" />
          Clear
        </a>
      ) : null}
    </div>
  );
}
