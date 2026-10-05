'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Clock, MapPin, Pencil, Trash2 } from 'lucide-react';
import type { CalendarEvent } from '@prisma/client';

import { EventDialog } from '@/components/calendar/event-dialog';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/components/calendar/event-type';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export interface AgendaGroup {
  dayKey: string;
  events: CalendarEvent[];
}

export function AgendaList({
  groups,
  emptyAction,
}: {
  groups: AgendaGroup[];
  emptyAction?: React.ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  async function handleDelete(event: CalendarEvent) {
    try {
      await api.delete(`/api/calendar/${event.id}`);
      toast({ title: 'Event deleted', variant: 'success' });
      startTransition(() => router.refresh());
    } catch (error) {
      toast({
        title: 'Could not delete the event',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nothing scheduled"
        description="Add lectures, deadlines, workouts or anything else you want to remember."
        action={emptyAction}
      />
    );
  }

  return (
    <div className={cn('space-y-5 transition-opacity', isPending && 'opacity-60')}>
      {groups.map((group) => (
        <section key={group.dayKey}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {new Date(`${group.dayKey}T00:00:00`).toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h3>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {group.events.map((event) => (
              <li key={event.id} className="flex items-start gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: EVENT_TYPE_COLORS[event.type] }}
                />

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{event.title}</p>
                    <Badge variant="outline">{EVENT_TYPE_LABELS[event.type]}</Badge>
                  </div>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {event.allDay
                        ? 'All day'
                        : `${new Date(event.startTime).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}${
                            event.endTime
                              ? ` – ${new Date(event.endTime).toLocaleTimeString(undefined, {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}`
                              : ''
                          }`}
                    </span>
                    {event.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </span>
                    ) : null}
                  </p>
                  {event.description ? (
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                  ) : null}
                </div>

                <EventDialog
                  event={{
                    id: event.id,
                    title: event.title,
                    description: event.description,
                    type: event.type,
                    startTime: event.startTime,
                    endTime: event.endTime,
                    location: event.location,
                    allDay: event.allDay,
                  }}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${event.title}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  }
                />

                <ConfirmDialog
                  title="Delete this event?"
                  description={`"${event.title}" will be permanently removed from your calendar.`}
                  confirmLabel="Delete event"
                  onConfirm={() => handleDelete(event)}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${event.title}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
