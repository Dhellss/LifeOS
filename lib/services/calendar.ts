import type { CalendarEvent, Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { monthGridDays, toDayKey, type DayKey } from '@/lib/dates';
import { calendarEventCreateSchema, calendarEventUpdateSchema } from '@/lib/validations/calendar';

import { parseOrThrow } from './validate';

/**
 * Calendar service.
 *
 * Events are plain time ranges; the month grid and agenda views are both built
 * from the same `listEvents` read, grouped by day key on the server so the
 * client components stay presentational.
 */

export interface EventListFilter {
  from?: Date;
  to?: Date;
  type?: CalendarEvent['type'];
  limit?: number;
}

export async function listEvents(
  userId: string,
  filter: EventListFilter = {},
): Promise<CalendarEvent[]> {
  const where: Prisma.CalendarEventWhereInput = { userId };
  if (filter.type) where.type = filter.type;
  if (filter.from || filter.to) {
    where.startTime = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    };
  }

  return prisma.calendarEvent.findMany({
    where,
    orderBy: { startTime: 'asc' },
    ...(filter.limit ? { take: filter.limit } : {}),
  });
}

export async function getEvent(userId: string, id: string): Promise<CalendarEvent> {
  const event = await prisma.calendarEvent.findFirst({ where: { id, userId } });
  if (!event) throw new NotFoundError('Event');
  return event;
}

export async function createEvent(userId: string, input: unknown): Promise<CalendarEvent> {
  const data = parseOrThrow(calendarEventCreateSchema, input);
  return prisma.calendarEvent.create({
    data: {
      userId,
      title: data.title,
      description: data.description,
      startTime: data.startTime,
      endTime: data.endTime,
      type: data.type,
      location: data.location,
      allDay: data.allDay,
    },
  });
}

export async function updateEvent(
  userId: string,
  id: string,
  input: unknown,
): Promise<CalendarEvent> {
  const data = parseOrThrow(calendarEventUpdateSchema, input);
  const existing = await getEvent(userId, id);

  // Re-check the window against the merged record so a partial update that
  // moves only the start time cannot produce an event that ends before it
  // begins.
  const startTime = data.startTime ?? existing.startTime;
  const endTime = data.endTime ?? existing.endTime;
  if (endTime && endTime < startTime) {
    throw new ValidationError('The end time cannot be before the start time.', {
      endTime: ['The end time cannot be before the start time.'],
    });
  }

  return prisma.calendarEvent.update({
    where: { id: existing.id },
    data: {
      title: data.title,
      description: data.description,
      startTime: data.startTime,
      endTime: data.endTime,
      type: data.type,
      location: data.location,
      allDay: data.allDay,
    },
  });
}

export async function deleteEvent(userId: string, id: string): Promise<void> {
  const existing = await getEvent(userId, id);
  await prisma.calendarEvent.delete({ where: { id: existing.id } });
}

export async function getUpcomingEvents(userId: string, limit = 5): Promise<CalendarEvent[]> {
  return prisma.calendarEvent.findMany({
    where: { userId, startTime: { gte: new Date() } },
    orderBy: { startTime: 'asc' },
    take: limit,
  });
}

export interface MonthView {
  /** 42 days covering the 6x7 grid, including adjacent-month padding. */
  days: { dayKey: DayKey; date: Date; events: CalendarEvent[] }[];
  eventCount: number;
}

/**
 * Month grid data for a given reference date.
 * Events are fetched for the full visible window, not just the calendar month,
 * so padding days still render their events.
 */
export async function getMonthView(userId: string, reference: Date): Promise<MonthView> {
  const gridDays = monthGridDays(reference);
  const first = gridDays[0]!;
  const last = gridDays[gridDays.length - 1]!;

  const windowStart = new Date(first);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(last);
  windowEnd.setHours(23, 59, 59, 999);

  const events = await listEvents(userId, { from: windowStart, to: windowEnd });

  const byDay = new Map<DayKey, CalendarEvent[]>();
  for (const event of events) {
    const key = toDayKey(event.startTime);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(event);
    else byDay.set(key, [event]);
  }

  return {
    days: gridDays.map((date) => {
      const dayKey = toDayKey(date);
      return { dayKey, date, events: byDay.get(dayKey) ?? [] };
    }),
    eventCount: events.length,
  };
}

/** Agenda view: events grouped by day, ascending. */
export async function getAgenda(
  userId: string,
  from: Date,
  to: Date,
): Promise<{ dayKey: DayKey; events: CalendarEvent[] }[]> {
  const events = await listEvents(userId, { from, to });
  const groups: { dayKey: DayKey; events: CalendarEvent[] }[] = [];
  for (const event of events) {
    const dayKey = toDayKey(event.startTime);
    const last = groups[groups.length - 1];
    if (last && last.dayKey === dayKey) last.events.push(event);
    else groups.push({ dayKey, events: [event] });
  }
  return groups;
}

export async function getEventCountsByType(
  userId: string,
): Promise<{ type: string; count: number }[]> {
  const rows = await prisma.calendarEvent.groupBy({
    by: ['type'],
    where: { userId },
    _count: { _all: true },
  });
  return rows
    .map((row) => ({ type: row.type as string, count: row._count._all }))
    .sort((a, b) => b.count - a.count);
}
