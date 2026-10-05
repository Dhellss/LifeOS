'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Flame, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import { HabitDialog } from '@/components/habits/habit-dialog';
import { HabitHistoryStrip } from '@/components/habits/habit-history-strip';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api-client';
import { cn, truncate } from '@/lib/utils';
import type { HabitWithStats } from '@/lib/services/habits';

export interface HabitCardProps {
  habit: HabitWithStats;
  /** `yyyy-MM-dd` for today, resolved on the server. */
  todayKey: string;
}

export function HabitCard({ habit, todayKey }: HabitCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const accent = habit.color ?? 'hsl(var(--chart-2))';
  const atTarget = habit.todayCount >= habit.targetCount;

  async function checkIn(count: number) {
    try {
      const result = await api.post<{ xpAwarded: number }>('/api/habits/checkin', {
        habitId: habit.id,
        date: todayKey,
        count,
      });
      if (count === 0) {
        toast({ title: 'Check-in removed', variant: 'info' });
      } else {
        toast({
          title: count >= habit.targetCount ? 'Habit completed' : 'Progress saved',
          description: result?.xpAwarded ? `+${result.xpAwarded} XP` : undefined,
          variant: 'success',
        });
      }
      startTransition(() => router.refresh());
    } catch (error) {
      toast({ title: 'Could not check in', description: errorMessage(error), variant: 'error' });
    }
  }

  async function setActive(isActive: boolean) {
    try {
      await api.patch(`/api/habits/${habit.id}`, { isActive });
      toast({ title: isActive ? 'Habit reactivated' : 'Habit archived', variant: 'success' });
      startTransition(() => router.refresh());
    } catch (error) {
      toast({
        title: 'Could not update the habit',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/api/habits/${habit.id}`);
      toast({ title: 'Habit deleted', variant: 'success' });
      startTransition(() => router.refresh());
    } catch (error) {
      toast({
        title: 'Could not delete the habit',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  }

  return (
    <Card
      className={cn(
        'flex h-full flex-col transition-opacity',
        isPending && 'opacity-60',
        !habit.isActive && 'opacity-70',
      )}
    >
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-medium">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: accent }}
              />
              <span className="truncate">{habit.name}</span>
            </p>
            {habit.description ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {truncate(habit.description, 100)}
              </p>
            ) : null}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${habit.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {habit.targetCount > 1 ? (
                <>
                  <DropdownMenuItem
                    onSelect={() => void checkIn(Math.min(habit.targetCount, habit.todayCount + 1))}
                  >
                    Add one ({habit.todayCount}/{habit.targetCount})
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              {habit.isActive ? (
                <DropdownMenuItem onSelect={() => void setActive(false)}>
                  Archive habit
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => void setActive(true)}>
                  Reactivate habit
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Badge variant="muted">
            <Flame className="h-3 w-3" />
            {habit.streak.current} day streak
          </Badge>
          <Badge variant="outline">Best {habit.streak.longest}</Badge>
          <Badge variant="outline">{habit.completionRate}% in 28d</Badge>
          {habit.targetCount > 1 ? (
            <Badge variant="secondary">
              {habit.todayCount}/{habit.targetCount} today
            </Badge>
          ) : null}
          {!habit.isActive ? <Badge variant="warning">Archived</Badge> : null}
        </div>

        <HabitHistoryStrip history={habit.history} targetCount={habit.targetCount} color={accent} />

        <div className="mt-auto flex items-center gap-1 pt-1">
          <Button
            variant={atTarget ? 'secondary' : 'default'}
            size="sm"
            className="flex-1"
            disabled={!habit.isActive}
            onClick={() => void checkIn(atTarget ? 0 : habit.targetCount)}
          >
            <Check className="h-3.5 w-3.5" />
            {atTarget ? 'Checked in' : 'Check in'}
          </Button>

          <HabitDialog
            habit={{
              id: habit.id,
              name: habit.name,
              description: habit.description,
              frequency: habit.frequency,
              targetCount: habit.targetCount,
              color: habit.color,
            }}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${habit.name}`}>
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />

          <ConfirmDialog
            title="Delete this habit?"
            description={`"${habit.name}" and all of its check-ins will be permanently removed.`}
            confirmLabel="Delete habit"
            onConfirm={handleDelete}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Delete ${habit.name}`}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
