'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Archive, CalendarRange, CheckCircle2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import { ProjectDialog } from '@/components/projects/project-dialog';
import { ProjectStatusBadge } from '@/components/projects/project-badges';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api-client';
import { cn, truncate } from '@/lib/utils';
import type { ProjectWithProgress } from '@/lib/services/projects';

export function ProjectCard({ project }: { project: ProjectWithProgress }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  async function mutate(body: Record<string, unknown>, successMessage: string) {
    try {
      await api.patch(`/api/projects/${project.id}`, body);
      toast({ title: successMessage, variant: 'success' });
      startTransition(() => router.refresh());
    } catch (error) {
      toast({
        title: 'Could not update the project',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/api/projects/${project.id}`);
      toast({
        title: 'Project deleted',
        description: 'Its tasks were kept and unlinked.',
        variant: 'success',
      });
      startTransition(() => router.refresh());
    } catch (error) {
      toast({
        title: 'Could not delete the project',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  }

  const accent = project.color ?? 'hsl(var(--primary))';

  return (
    <Card className={cn('flex h-full flex-col transition-opacity', isPending && 'opacity-60')}>
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/projects/${project.id}`} className="group min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: accent }}
              />
              <span className="truncate font-medium group-hover:underline">{project.name}</span>
            </span>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${project.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/projects/${project.id}`}>Open project</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={project.status === 'COMPLETED'}
                onSelect={() => void mutate({ action: 'complete' }, 'Project completed · +100 XP')}
              >
                <CheckCircle2 className="h-4 w-4" />
                Complete project
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={project.status === 'PAUSED'}
                onSelect={() => void mutate({ status: 'PAUSED' }, 'Project paused')}
              >
                Pause project
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={project.status === 'ACTIVE'}
                onSelect={() => void mutate({ status: 'ACTIVE' }, 'Project reactivated')}
              >
                Reactivate
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={project.status === 'ARCHIVED'}
                onSelect={() => void mutate({ status: 'ARCHIVED' }, 'Project archived')}
              >
                <Archive className="h-4 w-4" />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {project.description ? (
          <p className="text-sm text-muted-foreground">{truncate(project.description, 120)}</p>
        ) : null}

        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <ProjectStatusBadge status={project.status} />
            <span className="tabular text-muted-foreground">
              {project.progress.completed}/{project.progress.total} tasks ·{' '}
              {project.progress.percent}%
            </span>
          </div>
          <Progress
            value={project.progress.percent}
            aria-label={`${project.name} progress`}
            indicatorClassName={project.status === 'COMPLETED' ? 'bg-emerald-500' : undefined}
          />

          {project.targetDate ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarRange className="h-3 w-3" />
              Target{' '}
              {new Date(project.targetDate).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-1 pt-1">
          <ProjectDialog
            project={{
              id: project.id,
              name: project.name,
              description: project.description,
              status: project.status,
              color: project.color,
              startDate: project.startDate,
              targetDate: project.targetDate,
            }}
            trigger={
              <Button variant="outline" size="sm" className="flex-1">
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            }
          />
          <ConfirmDialog
            title="Delete this project?"
            description={`"${project.name}" will be removed. Its tasks are kept and simply unlinked.`}
            confirmLabel="Delete project"
            onConfirm={handleDelete}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Delete ${project.name}`}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
