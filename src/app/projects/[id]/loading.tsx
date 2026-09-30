import { LoadingRegion, NavbarSkeleton } from "@/components/layout/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly while a project opens: its title, the four step tabs and the "Make clips" form.
export default function ProjectLoading() {
  return (
    <LoadingRegion label="Opening your project…">
      <NavbarSkeleton />
      <div className="mx-auto max-w-6xl px-4 pt-10">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-3 h-10 w-80 max-w-full" />
      </div>
      <div className="mx-auto mt-6 w-full max-w-6xl px-4">
        <div className="flex gap-6 border-b border-border pb-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-24" />
          ))}
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="space-y-5 rounded-xl p-5 ring-1 ring-foreground/10">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-11 w-52" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-14 w-44" />
            <Skeleton className="h-14 w-36" />
            <Skeleton className="h-14 w-40" />
          </div>
          <Skeleton className="h-12 w-40" />
        </div>
        <div className="mt-4 space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-4 rounded-xl p-4 ring-1 ring-foreground/10">
              <Skeleton className="size-20 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-6 w-40" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}
