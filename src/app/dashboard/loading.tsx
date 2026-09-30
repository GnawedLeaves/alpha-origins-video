import { LoadingRegion, NavbarSkeleton } from "@/components/layout/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly while the dashboard loads (e.g. right after signing in).
export default function DashboardLoading() {
  return (
    <LoadingRegion label="Loading your projects…">
      <NavbarSkeleton />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-72" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="rounded-xl p-4 ring-1 ring-foreground/10">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-6 h-3 w-24" />
            </li>
          ))}
        </ul>
      </main>
    </LoadingRegion>
  );
}
