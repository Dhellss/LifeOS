import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarRange, Plus } from 'lucide-react';

import { ProjectDialog } from '@/components/projects/project-dialog';
import { ProjectStatusBadge } from '@/components/projects/project-badges';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { TaskDialog } from '@/components/tasks/task-dialog';
import { TaskList } from '@/components/tasks/task-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { NotFoundError } from '@/lib/errors';
import { getProject, getProjectOptions } from '@/lib/services/projects';
import { listTasks } from '@/lib/services/tasks';
import { requireUser } from '@/lib/session';

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const user = await requireUser();
  const { id } = await params;
  try {
    const project = await getProject(user.id, id);
    return { title: project.name };
  } catch {
    return { title: 'Project' };
  }
}

export default async function ProjectDetailPage({ params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  let project;
  try {
    project = await getProject(user.id, id);
  } catch (error) {
    // A project id belonging to another user is indistinguishable from one
    // that does not exist, which is exactly what we want to expose.
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const [tasks, projectOptions] = await Promise.all([
    listTasks(user.id, { projectId: project.id, sort: 'priority', direction: 'asc' }),
    getProjectOptions(user.id),
  ]);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
        <Link href="/projects">
          <ArrowLeft className="h-4 w-4" />
          All projects
        </Link>
      </Button>

      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        actions={
          <>
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
              trigger={<Button variant="outline">Edit project</Button>}
            />
            <TaskDialog
              projectOptions={projectOptions}
              defaultProjectId={project.id}
              trigger={
                <Button>
                  <Plus className="h-4 w-4" />
                  Add task
                </Button>
              }
            />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <ProjectStatusBadge status={project.status} />
        {project.startDate ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarRange className="h-3 w-3" />
            Started{' '}
            {new Date(project.startDate).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ) : null}
        {project.targetDate ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarRange className="h-3 w-3" />
            Target{' '}
            {new Date(project.targetDate).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ) : null}
        {project.completedAt ? (
          <span className="text-xs text-muted-foreground">
            Completed{' '}
            {new Date(project.completedAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ) : null}
      </div>

      <section aria-label="Project progress" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Progress"
          value={`${project.progress.percent}%`}
          hint={`${project.progress.completed} of ${project.progress.total} done`}
        />
        <StatCard label="To do" value={project.progress.todo} />
        <StatCard label="In progress" value={project.progress.inProgress} />
        <StatCard label="Archived tasks" value={project.progress.archived} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Completion</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={project.progress.percent} aria-label="Project completion" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tasks in this project</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskList
            tasks={tasks}
            projectOptions={projectOptions}
            hideProject
            emptyTitle="No tasks linked yet"
            emptyDescription="Add tasks to this project and its progress bar starts moving."
            emptyAction={
              <TaskDialog
                projectOptions={projectOptions}
                defaultProjectId={project.id}
                trigger={
                  <Button size="sm">
                    <Plus className="h-4 w-4" />
                    Add the first task
                  </Button>
                }
              />
            }
          />
        </CardContent>
      </Card>
    </>
  );
}
