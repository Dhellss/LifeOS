'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Clock, Pencil, Trash2 } from 'lucide-react';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { StudyDialog } from '@/components/study/study-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api-client';
import { cn, formatMinutes, truncate } from '@/lib/utils';
import type { StudySession } from '@prisma/client';

export interface StudySessionListProps {
  sessions: StudySession[];
  subjects: string[];
  emptyAction?: React.ReactNode;
}

export function StudySessionList({ sessions, subjects, emptyAction }: StudySessionListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  async function handleDelete(session: StudySession) {
    try {
      await api.delete(`/api/study/${session.id}`);
      toast({ title: 'Session deleted', variant: 'success' });
      startTransition(() => router.refresh());
    } catch (error) {
      toast({
        title: 'Could not delete the session',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No study sessions yet"
        description="Log what you studied and for how long. Totals and subject breakdowns follow."
        action={emptyAction}
      />
    );
  }

  return (
    <ul
      className={cn(
        'divide-y divide-border overflow-hidden rounded-lg border border-border bg-card transition-opacity',
        isPending && 'opacity-60',
      )}
    >
      {sessions.map((session) => (
        <li key={session.id} className="flex items-start gap-3 px-4 py-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BookOpen className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{session.subject}</p>
              {session.topic ? <Badge variant="outline">{session.topic}</Badge> : null}
              <Badge variant="muted">
                <Clock className="h-3 w-3" />
                {formatMinutes(session.durationMinutes)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(session.sessionDate).toLocaleDateString(undefined, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
            {session.notes ? (
              <p className="text-xs text-muted-foreground">{truncate(session.notes, 180)}</p>
            ) : null}
          </div>

          <StudyDialog
            subjects={subjects}
            session={{
              id: session.id,
              subject: session.subject,
              topic: session.topic,
              durationMinutes: session.durationMinutes,
              notes: session.notes,
              sessionDate: session.sessionDate,
            }}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${session.subject} session`}>
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />

          <ConfirmDialog
            title="Delete this study session?"
            description={`The ${formatMinutes(session.durationMinutes)} ${session.subject} session will be removed. XP already earned is kept.`}
            confirmLabel="Delete session"
            onConfirm={() => handleDelete(session)}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${session.subject} session`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            }
          />
        </li>
      ))}
    </ul>
  );
}
