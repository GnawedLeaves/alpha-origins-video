import { cn } from "@/lib/utils";

// Monochrome mark: a warm-ink rounded square with a light "k". Flips with the theme
// (ink on light, light on dark) so it's always the strongest mark on the page.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <g
        fill="none"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-foreground"
      >
        <path d="M11.5 8.5v15" />
        <path d="M21 13l-7.5 5.2" />
        <path d="M15.2 17l6 6.5" />
      </g>
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      {!compact && <span className="text-lg font-medium text-foreground">Keemu</span>}
    </span>
  );
}
