import type { Metadata } from 'next';

import { PreferencesForm } from '@/components/settings/preferences-form';
import { SignOutButton } from '@/components/settings/sign-out-button';
import { PageHeader } from '@/components/shared/page-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getAccountDataSummary, getPreferences } from '@/lib/services/preferences';
import { requireUser } from '@/lib/session';
import { formatNumber, initials } from '@/lib/utils';

export const metadata: Metadata = { title: 'Settings' };

const DATA_LABELS: Record<string, string> = {
  tasks: 'Tasks',
  projects: 'Projects',
  habits: 'Habits',
  habitLogs: 'Habit check-ins',
  studySessions: 'Study sessions',
  workouts: 'Workouts',
  events: 'Calendar events',
  journalEntries: 'Journal entries',
  xpEvents: 'XP events',
  achievements: 'Achievements',
};

export default async function SettingsPage() {
  const user = await requireUser();
  const [preferences, dataSummary] = await Promise.all([
    getPreferences(user.id),
    getAccountDataSummary(user.id),
  ]);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile, goals and a summary of what LifeOS is storing for you."
      />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your account identity. Email is used to sign in and cannot be changed here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              {user.image ? <AvatarImage src={user.image} alt="" /> : null}
              <AvatarFallback className="text-base">{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium">{user.name}</p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Member since{' '}
                {user.createdAt.toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
          <Separator />
          <SignOutButton />
        </CardContent>
      </Card>

      <PreferencesForm preferences={preferences} />

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            Row counts scoped to your account. Every number is a live query against PostgreSQL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Object.entries(dataSummary).map(([key, count]) => (
              <div key={key} className="rounded-md border border-border p-3">
                <dt className="text-xs text-muted-foreground">{DATA_LABELS[key] ?? key}</dt>
                <dd className="tabular mt-0.5 text-lg font-semibold">{formatNumber(count)}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </>
  );
}
