import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckSquare,
  Dumbbell,
  FolderKanban,
  LayoutDashboard,
  NotebookPen,
  Repeat,
  Settings,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Short description used by the command palette and mobile nav. */
  description: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Today at a glance',
  },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare, description: 'Everything on your plate' },
  { href: '/projects', label: 'Projects', icon: FolderKanban, description: 'Bigger efforts' },
  { href: '/habits', label: 'Habits', icon: Repeat, description: 'Daily check-ins and streaks' },
  { href: '/study', label: 'Study', icon: BookOpen, description: 'Logged learning time' },
  { href: '/fitness', label: 'Fitness', icon: Dumbbell, description: 'Workouts and exercises' },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays, description: 'Events and agenda' },
  { href: '/journal', label: 'Journal', icon: NotebookPen, description: 'Notes and reflections' },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, description: 'Trends over time' },
  { href: '/achievements', label: 'Achievements', icon: Trophy, description: 'XP and unlocks' },
  { href: '/settings', label: 'Settings', icon: Settings, description: 'Profile and goals' },
] as const;
