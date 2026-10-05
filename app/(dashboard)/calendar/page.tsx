import type { Metadata } from 'next';
import { CalendarDays, Plus } from 'lucide-react';

import { AgendaList } from '@/components/calendar/agenda-list';
import { EventDialog } from '@/components/calendar/event-dialog';
import { MonthGrid, MonthNavigation } from '@/components/calendar/month-grid';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { addDays, endOfMonth, startOfMonth, toDayKey } from '@/lib/dates';
import { getAgenda, getMonthView, getUpcomingEvents } from '@/lib/services/calendar';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Calendar' };

/** `?month=yyyy-MM` drives the grid; anything invalid falls back to today. */
function resolveMonth(raw: string | undefined): Date {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [year, month] = raw.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return startOfMonth(new Date());
}

function monthParam(date: Date): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const reference = resolveMonth(typeof params.month === 'string' ? params.month : undefined);

  const agendaStart = new Date();
  agendaStart.setHours(0, 0, 0, 0);

  const [monthView, agenda, upcoming] = await Promise.all([
    getMonthView(user.id, reference),
    getAgenda(user.id, agendaStart, addDays(agendaStart, 30)),
    getUpcomingEvents(user.id, 1),
  ]);

  const previous = startOfMonth(addDays(startOfMonth(reference), -1));
  const next = startOfMonth(addDays(endOfMonth(reference), 1));
  const monthLabel = reference.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const agendaCount = agenda.reduce((total, group) => total + group.events.length, 0);

  const createTrigger = (
    <Button>
      <Plus className="h-4 w-4" />
      New event
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Everything scheduled, as a month grid or a rolling 30-day agenda."
        actions={<EventDialog trigger={createTrigger} />}
      />

      <section aria-label="Calendar summary" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={monthLabel}
          value={monthView.eventCount}
          hint="events in view"
          icon={CalendarDays}
        />
        <StatCard label="Next 30 days" value={agendaCount} hint="events scheduled" />
        <StatCard
          label="Next up"
          value={
            upcoming[0]
              ? new Date(upcoming[0].startTime).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                })
              : '—'
          }
          hint={upcoming[0]?.title ?? 'Nothing scheduled'}
        />
      </section>

      <Tabs defaultValue="month">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
          </TabsList>
          <MonthNavigation
            label={monthLabel}
            previousHref={`/calendar?month=${monthParam(previous)}`}
            nextHref={`/calendar?month=${monthParam(next)}`}
            todayHref="/calendar"
          />
        </div>

        <TabsContent value="month" className="space-y-3">
          <MonthGrid
            month={monthParam(reference)}
            todayKey={toDayKey(new Date())}
            days={monthView.days.map((day) => ({
              dayKey: day.dayKey,
              date: day.date.toISOString(),
              events: day.events,
            }))}
          />
        </TabsContent>

        <TabsContent value="agenda">
          <AgendaList
            groups={agenda}
            emptyAction={
              <EventDialog
                trigger={
                  <Button size="sm">
                    <Plus className="h-4 w-4" />
                    Add an event
                  </Button>
                }
              />
            }
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
