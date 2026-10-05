import { Skeleton } from '@/components/ui/skeleton';

export default function TasksLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
