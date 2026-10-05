'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarClock, FolderKanban, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { TaskDialog, type ProjectOption } from '@/components/tasks/task-dialog';
import { TaskPriorityBadge, TaskStatusBadge } from '@/components/tasks/task-badges';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api-client';
import { cn, truncate } from '@/lib/utils';
import { TASK_PRIORITY_LABELS } from '@/components/tasks/task-badges';
import type { TaskWithProject } from '@/lib/services/tasks';

export interface TaskRowProps {
  task: TaskWithProject;
  projectOptions: ProjectOption[];
  /** Hide the project chip when the row already lives inside a project view. */
  hideProject?: boolean;
}

export function TaskRow({ task, projectOptions, hideProject = false }: TaskRowProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [optimisticDone, setOptimisticDone] = useState(task.status === 'DONE');

  const isDone = task.status === 'DONE';
  const overdue = !isDone && task.dueDate !== null && new Date(task.dueDate).getTime() < Date.now();

  async function setStatus(status: TaskWithProject['status']) {
    try {
      await api.patch(`/api/tasks/${task.id}`, { status });
      startTransition(() => router.refresh());
    } catch (error) {
      setOptimisticDone(isDone);
      toast({
        title: 'Could not update the task',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  }

  async function setPriority(priority: TaskWithProject['priority']) {
    try {
      await api.patch(`/api/tasks/${task.id}`, { priority });
      startTransition(() => router.refresh());
    } catch (error) {
      toast({
        title: 'Could not update the task',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  }

  async function handleToggle(checked: boolean) {
    setOptimisticDone(checked);
    await setStatus(checked ? 'DONE' : 'TODO');
    if (checked) toast({ title: 'Task completed', description: 'XP awarded.', variant: 'success' });
  }

  async function handleDelete() {
    try {
      await api.delete(`/api/tasks/${task.id}`);
      toast({ title: 'Task deleted', variant: 'success' });
      startTransition(() => router.refresh());
    } catch (error) {
      toast({
        title: 'Could not delete the task',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  }

  return (
    <li
      className={cn(
        'flex items-start gap-3 border-b border-border px-4 py-3 transition-opacity last:border-b-0',
        isPending && 'opacity-60',
      )}
    >
      <Checkbox
        className="mt-1"
        checked={optimisticDone}
        onCheckedChange={(value) => void handleToggle(value === true)}
        aria-label={
          optimisticDone ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`
        }
      />

      <div className="min-w-0 flex-1 space-y-1.5">
        <p
          className={cn(
            'text-sm font-medium leading-snug',
            optimisticDone && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </p>

        {task.description ? (
          <p className="text-xs text-muted-foreground">{truncate(task.description, 140)}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          <TaskStatusBadge status={task.status} />
          <TaskPriorityBadge priority={task.priority} />

          {task.dueDate ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs',
                overdue ? 'font-medium text-destructive' : 'text-muted-foreground',
              )}
            >
              <CalendarClock className="h-3 w-3" />
              {new Date(task.dueDate).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
              })}
              {overdue ? ' · overdue' : ''}
            </span>
          ) : null}

          {!hideProject && task.project ? (
            <Link
              href={`/projects/${task.project.id}`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: task.project.color ?? 'hsl(var(--primary))' }}
              />
              <FolderKanban className="h-3 w-3" />
              {task.project.name}
            </Link>
          ) : null}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for "${task.title}"`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void setStatus('IN_PROGRESS')}>
            Mark in progress
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void setStatus('ARCHIVED')}>Archive</DropdownMenuItem>
          <DropdownMenuSeparator />
          {(Object.keys(TASK_PRIORITY_LABELS) as (keyof typeof TASK_PRIORITY_LABELS)[]).map(
            (priority) => (
              <DropdownMenuItem
                key={priority}
                disabled={task.priority === priority}
                onSelect={() => void setPriority(priority)}
              >
                Priority: {TASK_PRIORITY_LABELS[priority]}
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <TaskDialog
        projectOptions={projectOptions}
        task={{
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          projectId: task.projectId,
        }}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Edit "${task.title}"`}>
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />

      <ConfirmDialog
        title="Delete this task?"
        description={`"${task.title}" will be permanently removed. XP already earned is kept.`}
        confirmLabel="Delete task"
        onConfirm={handleDelete}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Delete "${task.title}"`}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        }
      />
    </li>
  );
}
