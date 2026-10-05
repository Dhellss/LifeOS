import type { Metadata } from 'next';
import { FolderKanban, Plus } from 'lucide-react';

import { ProjectCard } from '@/components/projects/project-card';
import { ProjectDialog } from '@/components/projects/project-dialog';
import { ProjectStatusFilter } from '@/components/projects/project-status-filter';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { getProjectStats, listProjects } from '@/lib/services/projects';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Projects' };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const status = typeof params.status === 'string' ? params.status : undefined;

  const [projects, stats] = await Promise.all([
    listProjects(user.id, { status, sort: 'createdAt', direction: 'desc' }),
    getProjectStats(user.id),
  ]);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Group tasks into bigger efforts. Progress is derived from the tasks underneath."
        actions={
          <ProjectDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4" />
                New project
              </Button>
            }
          />
        }
      />

      <section aria-label="Project counts" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active" value={stats.active} icon={FolderKanban} />
        <StatCard label="Paused" value={stats.paused} />
        <StatCard label="Completed" value={stats.completed} />
        <StatCard label="Archived" value={stats.archived} />
      </section>

      <ProjectStatusFilter current={status} />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={status ? 'No projects with this status' : 'No projects yet'}
          description={
            status
              ? 'Switch the filter to see your other projects.'
              : 'Create a project to track a bigger effort and watch progress accumulate from its tasks.'
          }
          action={
            status ? null : (
              <ProjectDialog
                trigger={
                  <Button size="sm">
                    <Plus className="h-4 w-4" />
                    Create a project
                  </Button>
                }
              />
            )
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
