import { Suspense } from 'react';
import type { Metadata } from 'next';
import type { Mood } from '@prisma/client';
import { Flame, NotebookPen, Plus, Type } from 'lucide-react';

import { JournalDialog } from '@/components/journal/journal-dialog';
import { JournalFilters } from '@/components/journal/journal-filters';
import { JournalList } from '@/components/journal/journal-list';
import { moodOption } from '@/components/journal/mood';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getJournalSummary, listJournalEntries } from '@/lib/services/journal';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Journal' };

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const search = typeof params.search === 'string' ? params.search : undefined;
  const mood = typeof params.mood === 'string' ? (params.mood as Mood) : undefined;

  const [entries, summary] = await Promise.all([
    listJournalEntries(user.id, { search, mood, limit: 50 }),
    getJournalSummary(user.id),
  ]);

  const topMood = summary.moodCounts[0];
  const filtered = Boolean(search || mood);

  const createTrigger = (
    <Button>
      <Plus className="h-4 w-4" />
      New entry
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Journal"
        description="A private, dated log. Search it, filter it by mood, and keep the streak alive."
        actions={<JournalDialog trigger={createTrigger} />}
      />

      <section aria-label="Journal summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Entries" value={summary.totalEntries} icon={NotebookPen} />
        <StatCard
          label="Current streak"
          value={summary.streak.current}
          hint={`Best ${summary.streak.longest} days`}
          icon={Flame}
        />
        <StatCard label="Average length" value={summary.averageWords} hint="words" icon={Type} />
        <StatCard
          label="Most common mood"
          value={topMood ? (moodOption(topMood.mood as Mood)?.label ?? '—') : '—'}
          hint={topMood ? `${topMood.count} entries` : 'No moods recorded'}
        />
      </section>

      <Suspense fallback={<Skeleton className="h-9 w-full" />}>
        <JournalFilters />
      </Suspense>

      <JournalList
        entries={entries}
        emptyTitle={filtered ? 'No entries match' : 'No entries yet'}
        emptyDescription={
          filtered
            ? 'Try a different search term or clear the mood filter.'
            : 'Write a few lines about your day. Entries build a streak and earn XP.'
        }
        emptyAction={
          filtered ? null : (
            <JournalDialog
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Write your first entry
                </Button>
              }
            />
          )
        }
      />
    </>
  );
}
