import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Hexagon } from 'lucide-react';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { getCurrentUser } from '@/lib/session';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Already signed in? There is nothing to do on the auth screens.
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <div className="hero-glow flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Hexagon className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          <span className="text-sm font-semibold tracking-tight">LifeOS</span>
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
