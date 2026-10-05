import type { ProjectStatus } from '@prisma/client';

import { PROJECT_STATUS_LABELS } from '@/components/projects/project-badges';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const OPTIONS: { value: ProjectStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  ...(Object.entries(PROJECT_STATUS_LABELS) as [ProjectStatus, string][]).map(([value, label]) => ({
    value,
    label,
  })),
];

/**
 * Status filter.
 *
 * Server-rendered plain anchors, for the same reason as the analytics range
 * selector: each status is its own shareable URL, and a full navigation always
 * applies where the App Router's query-only soft navigation sometimes did not.
 */
export function ProjectStatusFilter({ current }: { current?: string }) {
  const active = current ?? '';

  return (
    <nav aria-label="Filter projects by status" className="flex flex-wrap gap-1.5">
      {OPTIONS.map((option) => {
        const isActive = option.value === active;
        return (
          <a
            key={option.value || 'all'}
            href={option.value ? `/projects?status=${option.value}` : '/projects'}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }),
              isActive && 'font-semibold',
            )}
          >
            {option.label}
          </a>
        );
      })}
    </nav>
  );
}
