import { cn } from '@/lib/utils';

/** Loading placeholder used by the route-level `loading.tsx` files. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export { Skeleton };
