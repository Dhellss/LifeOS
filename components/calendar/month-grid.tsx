'use client';

import { useState } from 'react';
import type { CalendarEvent } from '@prisma/client';

import { EventDialog } from '@/components/calendar/event-dialog';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/components/calendar/event-type';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface MonthGridDay {
  dayKey: string;
  /** Serialised as an ISO string when crossing the server/client boundary. */
  date: string;
  events: CalendarEvent[];
}

export interface MonthGridProps {
  days: MonthGridDay[];
  /** `yyyy-MM` of the month being displayed. */
  month: string;
  todayKey: string;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Maximum events rendered inside a cell before collapsing into a "+n" chip. */
const MAX_VISIBLE = 3;

export function MonthGrid({ days, month, todayKey }: MonthGridProps) {
  const [composeDay, setComposeDay] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border bg-muted/50">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <span className="hidden sm:inline">{weekday}</span>
              <span aria-hidden className="sm:hidden">
                {weekday[0]}
              </span>
              <span className="sr-only sm:hidden">{weekday}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const inMonth = day.dayKey.startsWith(month);
            const isToday = day.dayKey === todayKey;
            const extra = day.events.length - MAX_VISIBLE;

            return (
              <div
                key={day.dayKey}
                className={cn(
                  'group relative min-h-[5.5rem] border-b border-r border-border p-1.5 text-left last:border-r-0 sm:min-h-[7rem]',
                  !inMonth && 'bg-muted/35',
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      'tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs',
                      isToday
                        ? 'bg-primary font-semibold text-primary-foreground'
                        : inMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground',
                    )}
                  >
                    {Number(day.dayKey.slice(-2))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setComposeDay(day.dayKey)}
                    aria-label={`Add an event on ${day.dayKey}`}
                    className="rounded px-1 text-xs text-muted-foreground opacity-0 transition hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    +
                  </button>
                </div>

                <ul className="space-y-0.5">
                  {day.events.slice(0, MAX_VISIBLE).map((event) => (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedEvent(event)}
                        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight transition-colors hover:bg-accent"
                      >
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: EVENT_TYPE_COLORS[event.type] }}
                        />
                        <span className="truncate">
                          {!event.allDay
                            ? `${new Date(event.startTime).toLocaleTimeString(undefined, {
                                hour: '2-digit',
                                minute: '2-digit',
                              })} `
                            : ''}
                          {event.title}
                        </span>
                      </button>
                    </li>
                  ))}
                  {extra > 0 ? (
                    <li className="px-1 text-[11px] text-muted-foreground">+{extra} more</li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => (
          <span key={type} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: EVENT_TYPE_COLORS[type as keyof typeof EVENT_TYPE_COLORS] }}
            />
            {label}
          </span>
        ))}
      </p>

      {/* One dialog instance per purpose, driven by the clicked cell/event. */}
      <EventDialog
        defaultDay={composeDay ?? undefined}
        open={composeDay !== null}
        onOpenChange={(open) => {
          if (!open) setComposeDay(null);
        }}
      />

      {selectedEvent ? (
        <EventDialog
          event={{
            id: selectedEvent.id,
            title: selectedEvent.title,
            description: selectedEvent.description,
            type: selectedEvent.type,
            startTime: selectedEvent.startTime,
            endTime: selectedEvent.endTime,
            location: selectedEvent.location,
            allDay: selectedEvent.allDay,
          }}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedEvent(null);
          }}
        />
      ) : null}
    </>
  );
}

export function MonthNavigation({
  label,
  previousHref,
  nextHref,
  todayHref,
}: {
  label: string;
  previousHref: string;
  nextHref: string;
  todayHref: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <a href={previousHref} aria-label="Previous month">
          ‹
        </a>
      </Button>
      <p className="min-w-40 text-center text-sm font-semibold">{label}</p>
      <Button variant="outline" size="sm" asChild>
        <a href={nextHref} aria-label="Next month">
          ›
        </a>
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <a href={todayHref}>Today</a>
      </Button>
    </div>
  );
}
