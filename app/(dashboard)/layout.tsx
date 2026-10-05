import { AppShell } from '@/components/layout/app-shell';
import { getProjectOptions } from '@/lib/services/projects';
import { getLevelProgress } from '@/lib/services/xp';
import { requireUser } from '@/lib/session';

/**
 * Guard for every protected route.
 *
 * `requireUser()` validates the session server-side and redirects to /login
 * when it is missing or expired, so no page under this segment can render
 * without an authenticated user.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [level, projectOptions] = await Promise.all([
    getLevelProgress(user.id),
    getProjectOptions(user.id),
  ]);

  return (
    <AppShell user={user} level={level} projectOptions={projectOptions}>
      {children}
    </AppShell>
  );
}
