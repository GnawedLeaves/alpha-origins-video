import { LoadingRegion } from "@/components/layout/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly while the project list loads (e.g. right after signing in).
export default function DashboardLoading() {
  return (
    <LoadingRegion label="Loading your projects…">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
      <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="rounded-2xl border border-border bg-card p-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-4 h-3 w-28" />
          </li>
        ))}
      </ul>
    </LoadingRegion>
  );
}
