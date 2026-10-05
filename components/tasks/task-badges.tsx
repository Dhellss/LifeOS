import type { TaskPriority, TaskStatus } from '@prisma/client';

import { Badge, type BadgeProps } from '@/components/ui/badge';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  ARCHIVED: 'Archived',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

const STATUS_VARIANTS: Record<TaskStatus, BadgeProps['variant']> = {
  TODO: 'muted',
  IN_PROGRESS: 'info',
  DONE: 'success',
  ARCHIVED: 'outline',
};

const PRIORITY_VARIANTS: Record<TaskPriority, BadgeProps['variant']> = {
  LOW: 'muted',
  MEDIUM: 'secondary',
  HIGH: 'warning',
  URGENT: 'danger',
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge variant={PRIORITY_VARIANTS[priority]}>{TASK_PRIORITY_LABELS[priority]}</Badge>;
}
