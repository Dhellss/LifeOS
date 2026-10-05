'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';

import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/components/tasks/task-badges';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProjectOption } from '@/components/tasks/task-dialog';
import { cn } from '@/lib/utils';

const ANY = '__any__';

const SORT_OPTIONS = [
  { value: 'dueDate', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
  { value: 'createdAt', label: 'Created' },
  { value: 'title', label: 'Title' },
] as const;

/**
 * Filters are held in the URL so a filtered list is shareable, survives a
 * refresh, and is re-queried on the server rather than filtered client-side.
 */
export function TaskFilters({ projectOptions }: { projectOptions: ProjectOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') params.delete(key);
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

  const status = searchParams.get('status') ?? ANY;
  const priority = searchParams.get('priority') ?? ANY;
  const projectId = searchParams.get('projectId') ?? ANY;
  const sort = searchParams.get('sort') ?? 'dueDate';
  const hasFilters =
    status !== ANY || priority !== ANY || projectId !== ANY || search !== '' || sort !== 'dueDate';

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search tasks…"
          aria-label="Search tasks"
          className="pl-8"
        />
      </div>

      <Select
        value={status}
        onValueChange={(value) => pushParams({ status: value === ANY ? null : value })}
      >
        <SelectTrigger className="sm:w-40" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any status</SelectItem>
          {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={priority}
        onValueChange={(value) => pushParams({ priority: value === ANY ? null : value })}
      >
        <SelectTrigger className="sm:w-40" aria-label="Filter by priority">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any priority</SelectItem>
          {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={projectId}
        onValueChange={(value) => pushParams({ projectId: value === ANY ? null : value })}
      >
        <SelectTrigger className="sm:w-44" aria-label="Filter by project">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any project</SelectItem>
          {projectOptions.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={(value) => pushParams({ sort: value })}>
        <SelectTrigger className="sm:w-40" aria-label="Sort tasks">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              Sort: {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters ? (
        // An anchor rather than a button: a `router.replace` fired straight out
        // of a click handler was observed to drop some query-only navigations.
        <a href={pathname} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          <X className="h-4 w-4" />
          Clear
        </a>
      ) : null}
    </div>
  );
}
