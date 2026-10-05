'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  BookOpen,
  CalendarPlus,
  CheckSquare,
  Dumbbell,
  FolderPlus,
  NotebookPen,
  Plus,
  Repeat,
} from 'lucide-react';

import { EventDialog } from '@/components/calendar/event-dialog';
import { HabitDialog } from '@/components/habits/habit-dialog';
import { JournalDialog } from '@/components/journal/journal-dialog';
import { ProjectDialog } from '@/components/projects/project-dialog';
import { StudyDialog } from '@/components/study/study-dialog';
import { TaskDialog, type ProjectOption } from '@/components/tasks/task-dialog';
import { WorkoutDialog } from '@/components/fitness/workout-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type QuickAction = 'task' | 'project' | 'habit' | 'study' | 'workout' | 'event' | 'journal';

const ACTIONS: readonly { key: QuickAction; label: string; icon: typeof Plus }[] = [
  { key: 'task', label: 'New task', icon: CheckSquare },
  { key: 'project', label: 'New project', icon: FolderPlus },
  { key: 'habit', label: 'New habit', icon: Repeat },
  { key: 'study', label: 'Log study session', icon: BookOpen },
  { key: 'workout', label: 'Log workout', icon: Dumbbell },
  { key: 'event', label: 'New event', icon: CalendarPlus },
  { key: 'journal', label: 'New journal entry', icon: NotebookPen },
];

/**
 * Top-bar "quick add" menu.
 *
 * Each item opens the module's real create dialog in controlled mode, so a
 * record created here goes through exactly the same validation and service
 * path as one created from the module's own page.
 */
export function QuickActions({ projectOptions }: { projectOptions: ProjectOption[] }) {
  const [active, setActive] = useState<QuickAction | null>(null);
  const close = (open: boolean) => {
    if (!open) setActive(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Quick add</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Create</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ACTIONS.map(({ key, label, icon: Icon }) => (
            <DropdownMenuItem key={key} onSelect={() => setActive(key)}>
              <Icon className="h-4 w-4" />
              {label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/analytics">
              <BarChart3 className="h-4 w-4" />
              View analytics
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TaskDialog projectOptions={projectOptions} open={active === 'task'} onOpenChange={close} />
      <ProjectDialog open={active === 'project'} onOpenChange={close} />
      <HabitDialog open={active === 'habit'} onOpenChange={close} />
      <StudyDialog open={active === 'study'} onOpenChange={close} />
      <WorkoutDialog open={active === 'workout'} onOpenChange={close} />
      <EventDialog open={active === 'event'} onOpenChange={close} />
      <JournalDialog open={active === 'journal'} onOpenChange={close} />
    </>
  );
}
