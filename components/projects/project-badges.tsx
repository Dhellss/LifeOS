import type { ProjectStatus } from '@prisma/client';

import { Badge, type BadgeProps } from '@/components/ui/badge';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

const VARIANTS: Record<ProjectStatus, BadgeProps['variant']> = {
  ACTIVE: 'info',
  PAUSED: 'warning',
  COMPLETED: 'success',
  ARCHIVED: 'outline',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge variant={VARIANTS[status]}>{PROJECT_STATUS_LABELS[status]}</Badge>;
}
