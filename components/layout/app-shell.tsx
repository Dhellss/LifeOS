'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

import { QuickActions } from '@/components/layout/quick-actions';
import { SidebarNav } from '@/components/layout/sidebar';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { ProjectOption } from '@/components/tasks/task-dialog';
import type { SessionUser } from '@/lib/session';
import type { LevelProgress } from '@/lib/xp';

export interface AppShellProps {
  user: SessionUser;
  level: LevelProgress;
  projectOptions: ProjectOption[];
  children: React.ReactNode;
}

/**
 * Persistent application frame: fixed sidebar on desktop, slide-over drawer on
 * mobile, and a top bar carrying the date, quick-add menu and account menu.
 */
export function AppShell({ user, level, projectOptions, children }: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setDrawerOpen(false), [pathname]);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-sidebar-border lg:block">
        <SidebarNav level={level} />
      </aside>

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="left-0 top-0 h-dvh max-h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-y-0 border-l-0 p-0">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <SidebarNav level={level} onNavigate={() => setDrawerOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>

            <CurrentDate />

            <div className="ml-auto flex items-center gap-1.5">
              <QuickActions projectOptions={projectOptions} />
              <ThemeToggle />
              <UserMenu name={user.name} email={user.email} image={user.image} />
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl animate-fade-in space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

/**
 * Rendered client-side so the date reflects the viewer's timezone rather than
 * the server's. The server-rendered pass shows nothing to avoid a mismatch.
 */
function CurrentDate() {
  const [label, setLabel] = useState('');

  useEffect(() => {
    setLabel(
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    );
  }, []);

  return (
    <p
      className="hidden truncate text-sm font-medium text-muted-foreground sm:block"
      suppressHydrationWarning
    >
      {label}
    </p>
  );
}
