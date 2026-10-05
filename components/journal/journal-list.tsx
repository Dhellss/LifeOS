'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NotebookPen, Pencil, Trash2 } from 'lucide-react';
import type { JournalEntry } from '@prisma/client';

import { JournalDialog } from '@/components/journal/journal-dialog';
import { MoodBadge } from '@/components/journal/mood';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export interface JournalListProps {
  entries: JournalEntry[];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}

export function JournalList({
  entries,
  emptyTitle = 'No entries yet',
  emptyDescription = 'Write a few lines about your day. Entries build a streak and earn XP.',
  emptyAction,
}: JournalListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  async function handleDelete(entry: JournalEntry) {
    try {
      await api.delete(`/api/journal/${entry.id}`);
      toast({ title: 'Entry deleted', variant: 'success' });
      startTransition(() => router.refresh());
    } catch (error) {
      toast({
        title: 'Could not delete the entry',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={NotebookPen}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <ul className={cn('space-y-3 transition-opacity', isPending && 'opacity-60')}>
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">{entry.title ?? 'Untitled entry'}</h3>
                <MoodBadge mood={entry.mood} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {new Date(entry.entryDate).toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <JournalDialog
                entry={{
                  id: entry.id,
                  title: entry.title,
                  content: entry.content,
                  mood: entry.mood,
                  entryDate: entry.entryDate,
                }}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label="Edit entry">
                    <Pencil className="h-4 w-4" />
                  </Button>
                }
              />
              <ConfirmDialog
                title="Delete this entry?"
                description="This journal entry will be permanently removed."
                confirmLabel="Delete entry"
                onConfirm={() => handleDelete(entry)}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label="Delete entry">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                }
              />
            </div>
          </div>

          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {entry.content}
          </p>
        </li>
      ))}
    </ul>
  );
}
