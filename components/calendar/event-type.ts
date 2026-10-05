import type { CalendarEventType } from '@prisma/client';

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  TASK: 'Task',
  STUDY: 'Study',
  FITNESS: 'Fitness',
  PERSONAL: 'Personal',
  PROJECT: 'Project',
  OTHER: 'Other',
};

/**
 * Each event type maps onto one of the five chart tokens so calendar colours
 * and analytics colours agree in both light and dark mode.
 */
export const EVENT_TYPE_COLORS: Record<CalendarEventType, string> = {
  STUDY: 'hsl(var(--chart-1))',
  FITNESS: 'hsl(var(--chart-2))',
  TASK: 'hsl(var(--chart-3))',
  PROJECT: 'hsl(var(--chart-4))',
  PERSONAL: 'hsl(var(--chart-5))',
  OTHER: 'hsl(var(--muted-foreground))',
};

export const EVENT_TYPE_ORDER: readonly CalendarEventType[] = [
  'STUDY',
  'FITNESS',
  'TASK',
  'PROJECT',
  'PERSONAL',
  'OTHER',
];
