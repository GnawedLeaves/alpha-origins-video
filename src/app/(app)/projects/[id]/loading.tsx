import { LoadingRegion } from "@/components/layout/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly while a project opens: its title, the step chips and the "Make clips" form.
export default function ProjectLoading() {
  return (
    <LoadingRegion label="Opening your project…">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-full" />
        ))}
      </div>
      <div className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-5">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-11 w-52" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-14 w-40 rounded-full" />
          <Skeleton className="h-14 w-32 rounded-full" />
          <Skeleton className="h-14 w-36 rounded-full" />
        </div>
        <Skeleton className="h-12 w-40 rounded-xl" />
      </div>
      <div className="mt-4 space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex gap-4 rounded-2xl border border-border bg-card p-4">
            <Skeleton className="size-20 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-6 w-40 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
