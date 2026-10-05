import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckSquare,
  Dumbbell,
  FolderKanban,
  Hexagon,
  NotebookPen,
  Repeat,
  ShieldCheck,
  Trophy,
} from 'lucide-react';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/session';

const MODULES = [
  { icon: CheckSquare, title: 'Tasks', body: 'Priorities, due dates, statuses and project links.' },
  { icon: FolderKanban, title: 'Projects', body: 'Progress derived from the tasks underneath.' },
  { icon: Repeat, title: 'Habits', body: 'Daily check-ins with real streak calculation.' },
  { icon: BookOpen, title: 'Study', body: 'Sessions by subject with weekly breakdowns.' },
  { icon: Dumbbell, title: 'Fitness', body: 'Workouts with sets, reps and weight history.' },
  { icon: CalendarDays, title: 'Calendar', body: 'Month grid and agenda, colour-coded by type.' },
  { icon: NotebookPen, title: 'Journal', body: 'Dated entries with mood, search and filters.' },
  { icon: BarChart3, title: 'Analytics', body: 'Charts built from aggregate SQL queries.' },
  {
    icon: Trophy,
    title: 'XP & achievements',
    body: 'Earned once per action, never double-counted.',
  },
] as const;

export default async function LandingPage() {
  // Signed-in visitors go straight to their workspace.
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5">
          <span className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Hexagon className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            <span className="text-sm font-semibold tracking-tight">LifeOS</span>
          </span>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="hero-glow border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 text-center sm:py-28">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Private workspace, one account per person
            </p>
            <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              One control centre for everything you are trying to get done
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
              LifeOS keeps tasks, projects, habits, study time, workouts, events and journal entries
              in a single relational database — then turns them into streaks, levels and charts you
              can actually trust.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/register">
                  Create your workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">I already have an account</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-16">
          <h2 className="text-xl font-semibold tracking-tight">Nine modules, one schema</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Every module writes to PostgreSQL through a validated service layer, so the numbers on
            your dashboard are aggregates of your own records — not placeholders.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardContent className="space-y-2 p-5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="font-medium">{title}</p>
                    <p className="text-sm text-muted-foreground">{body}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>LifeOS — Next.js, TypeScript, Prisma and PostgreSQL.</p>
          <p>MIT licensed.</p>
        </div>
      </footer>
    </div>
  );
}
