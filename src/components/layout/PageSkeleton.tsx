import { LogoMark } from "@/components/brand/Logo";
import { Skeleton } from "@/components/ui/skeleton";

// The navbar's shape (with the real logo, so the page is recognisable right away) for route
// loading screens.
export function NavbarSkeleton() {
  return (
    <header className="px-4 pt-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-input bg-background px-3 py-2 dark:border-border">
        <span className="inline-flex items-center gap-2.5">
          <LogoMark />
          <span className="text-lg font-bold tracking-tight text-foreground">Keemu</span>
        </span>
        <div className="flex items-center gap-2">
          <Skeleton className="hidden h-4 w-32 sm:block" />
          <Skeleton className="size-8" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </header>
  );
}

// Wraps a loading screen: announces "Loading…" to screen readers and marks the region busy.
export function LoadingRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
