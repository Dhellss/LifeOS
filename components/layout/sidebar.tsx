'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Hexagon } from 'lucide-react';

import { NAV_ITEMS } from '@/components/layout/nav-items';
import { cn } from '@/lib/utils';
import type { LevelProgress } from '@/lib/xp';

import { LevelBadge } from './level-badge';

export interface SidebarProps {
  level: LevelProgress;
  /** Called after a navigation click so the mobile drawer can close itself. */
  onNavigate?: () => void;
}

/** Marks `/projects/abc` as active for the `/projects` nav item. */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ level, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col gap-4 bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 pt-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Hexagon className="h-4 w-4" strokeWidth={2.5} />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">LifeOS</p>
          <p className="text-[11px] text-muted-foreground">Personal operating system</p>
        </div>
      </div>

      <nav aria-label="Main navigation" className="scrollbar-thin flex-1 overflow-y-auto px-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-sidebar-accent text-accent-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-accent-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <LevelBadge level={level} />
      </div>
    </div>
  );
}
