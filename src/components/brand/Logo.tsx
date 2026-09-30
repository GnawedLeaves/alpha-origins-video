import { cn } from "@/lib/utils";

// Yellow square with a hand-drawn "k" monogram, followed by the wordmark. The strokes are
// deliberately a little uneven, like a marker sketch.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={cn("size-9 shrink-0 rounded-md", className)}
    >
      <rect width="40" height="40" rx="6" className="fill-highlighter-yellow" />
      <g
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-forest-ink"
      >
        <path d="M14.2 9.6c.3 6.9-.2 13.9.4 20.8" />
        <path d="M25.6 16.4c-3.5 2.2-7.2 4.3-10.6 6.8" />
        <path d="M17.9 21.3c2.6 2.6 5.3 5.5 8.3 8.4" />
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-lg font-bold tracking-tight text-foreground">Keemu</span>
    </span>
  );
}
