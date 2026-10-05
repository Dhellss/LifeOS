import { CheckSquare } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';
import { TaskRow } from '@/components/tasks/task-row';
import type { ProjectOption } from '@/components/tasks/task-dialog';
import type { TaskWithProject } from '@/lib/services/tasks';

export interface TaskListProps {
  tasks: TaskWithProject[];
  projectOptions: ProjectOption[];
  hideProject?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}

export function TaskList({
  tasks,
  projectOptions,
  hideProject,
  emptyTitle = 'No tasks here yet',
  emptyDescription = 'Create your first task to start tracking what needs doing.',
  emptyAction,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={CheckSquare}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          projectOptions={projectOptions}
          hideProject={hideProject}
        />
      ))}
    </ul>
  );
}
