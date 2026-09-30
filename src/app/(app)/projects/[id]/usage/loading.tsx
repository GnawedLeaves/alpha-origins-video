import { LoadingRegion } from "@/components/layout/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly while the usage page loads: totals, chart and table shapes.
export default function UsageLoading() {
  return (
    <LoadingRegion label="Loading usage and cost…">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-4 h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`rounded-2xl border border-border bg-card p-4 ${i === 0 ? "col-span-2 md:col-span-1" : ""}`}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="mt-2 h-4 w-40" />
        <div className="mt-6 flex h-48 items-end gap-1">
          {Array.from({ length: 30 }).map((_, i) => (
            <Skeleton key={i} className="flex-1" style={{ height: `${10 + ((i * 37) % 70)}%` }} />
          ))}
        </div>
      </div>
      <div className="mt-8 space-y-2 rounded-2xl border border-border bg-card p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </LoadingRegion>
  );
}
