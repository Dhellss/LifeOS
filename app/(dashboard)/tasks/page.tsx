import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Plus } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { TaskDialog } from '@/components/tasks/task-dialog';
import { TaskFilters } from '@/components/tasks/task-filters';
import { TaskList } from '@/components/tasks/task-list';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getProjectOptions } from '@/lib/services/projects';
import { getTaskStats, listTasks } from '@/lib/services/tasks';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Tasks' };

/** Filters arrive as search params and are applied by the service's Zod schema. */
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;

  const filter = {
    status: single(params.status),
    priority: single(params.priority),
    projectId: single(params.projectId),
    search: single(params.search),
    sort: single(params.sort) ?? 'dueDate',
    direction: single(params.direction) ?? 'asc',
    includeArchived: single(params.status) === 'ARCHIVED' ? 'true' : 'false',
  };

  const [tasks, stats, projectOptions] = await Promise.all([
    listTasks(user.id, filter),
    getTaskStats(user.id),
    getProjectOptions(user.id),
  ]);

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Everything on your plate, filterable by status, priority and project."
        actions={
          <TaskDialog
            projectOptions={projectOptions}
            trigger={
              <Button>
                <Plus className="h-4 w-4" />
                New task
              </Button>
            }
          />
        }
      />

      <section aria-label="Task counts" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="To do" value={stats.todo} />
        <StatCard label="In progress" value={stats.inProgress} />
        <StatCard label="Completed" value={stats.done} hint={`${stats.completionRate}% rate`} />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          hint={stats.overdue === 0 ? 'All clear' : 'Needs attention'}
        />
      </section>

      <Suspense fallback={<Skeleton className="h-9 w-full" />}>
        <TaskFilters projectOptions={projectOptions} />
      </Suspense>

      <TaskList
        tasks={tasks}
        projectOptions={projectOptions}
        emptyTitle={hasFilters(params) ? 'No tasks match these filters' : 'No tasks yet'}
        emptyDescription={
          hasFilters(params)
            ? 'Try clearing a filter to see more of your tasks.'
            : 'Create your first task to start tracking what needs doing.'
        }
        emptyAction={
          hasFilters(params) ? null : (
            <TaskDialog
              projectOptions={projectOptions}
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Create a task
                </Button>
              }
            />
          )
        }
      />
    </>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function hasFilters(params: Record<string, string | string[] | undefined>): boolean {
  return ['status', 'priority', 'projectId', 'search'].some((key) => Boolean(params[key]));
}
